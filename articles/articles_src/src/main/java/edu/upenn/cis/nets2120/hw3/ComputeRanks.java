package edu.upenn.cis.nets2120.hw3;
import java.time.LocalDateTime;
import java.io.IOException;
import java.lang.Math;
import java.io.File;
import java.util.Scanner;
import java.util.*;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Arrays;
import java.util.stream.StreamSupport;
import scala.Tuple2;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import com.amazonaws.services.dynamodbv2.AmazonDynamoDB;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.document.utils.*;
import com.amazonaws.services.dynamodbv2.document.TableWriteItems;
import com.amazonaws.services.dynamodbv2.document.Item;
import com.amazonaws.services.dynamodbv2.document.BatchWriteItemOutcome;
import com.amazonaws.services.dynamodbv2.document.ItemCollection;
import com.amazonaws.services.dynamodbv2.document.ScanOutcome;
import com.amazonaws.services.dynamodbv2.document.spec.*;
import com.amazonaws.services.dynamodbv2.model.WriteRequest;
import com.amazonaws.services.dynamodbv2.model.AttributeDefinition;
import com.amazonaws.services.dynamodbv2.model.KeySchemaElement;
import com.amazonaws.services.dynamodbv2.model.KeyType;
import com.amazonaws.services.dynamodbv2.model.ProvisionedThroughput;
import com.amazonaws.services.dynamodbv2.model.ResourceInUseException;
import com.amazonaws.services.dynamodbv2.model.ScalarAttributeType;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;

public class ComputeRanks {
        static AmazonDynamoDB client = AmazonDynamoDBClientBuilder.standard().build();
        static DynamoDB dynamoDB = new DynamoDB(client);
        private class Node {
            public String identifier;
            public ArrayList<Edge> outgoing;
            public HashMap<String, Double> weights;
            public HashMap<String, Double> newWeights;
            public Node(String id) {
                weights = new HashMap<>();
                newWeights = new HashMap<>();
                outgoing = new ArrayList<>();
                identifier = id;
            }
            public String toString() {
                
                return "id: " + identifier + " edges: " + outgoing.toString();
            }
        }
        private class Edge {
            public Node n;
            public double weight;
            public Edge(Node node, double w) {
                n = node;
                weight = w;
            }
            public String toString() {
                return "(" + n.identifier + ", " + weight + ")";
            }
        }
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(ComputeRanks.class);

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;

        int imax = 25;
        double dmax = 30.0;
        boolean debug = false;
	
	public ComputeRanks() {
		System.setProperty("file.encoding", "UTF-8");
	}

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 */
	public void initialize() throws IOException, InterruptedException {
		logger.info("Connecting to Spark...");

		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		logger.debug("Connected!");
	}
	
	/**
	 * Fetch the social network from the S3 path, and create a (followed, follower) edge graph
	 * 
	 * @param filePath
	 * @return JavaPairRDD: (followed: int, follower: int)
	 */
        JavaRDD<Node> getNetwork() {

            try {        
                Table usertable = dynamoDB.getTable("users");
                ItemCollection<ScanOutcome> items = usertable.scan(null, // FilterExpression
                    "username, interests", // ProjectionExpression
                    null, null);
                Iterator<Item> iterator = items.iterator();
                HashMap<String, List<String>> user_categories = new HashMap<>();
                HashSet<String> all_categories = new HashSet<>();
                while (iterator.hasNext()) {
                    Map<String, Object> map = iterator.next().asMap();
                    //System.out.println(map);
                    ArrayList<String> categories = new ArrayList<>();
                    for (String s: (Set<String>) map.get("interests")) {
                        categories.add(s.toUpperCase());
                        all_categories.add(s.toUpperCase());
                    }
                    user_categories.put((String) map.get("username"), categories);
                }
                //System.out.println(user_categories);

                Table articles = dynamoDB.getTable("articles");
                Index index = articles.getIndex("date-article_id-index2");
                long curDate = Long.parseLong(java.time.LocalDate.now().toString().replace("-", ""));
                //System.out.println(curDate);
                QuerySpec spec = new QuerySpec()
                    .withKeyConditionExpression("#dateCol = :end")
                    .withValueMap(new ValueMap()
                        //.withNumber(":start", (Long) 20221221L)
                        .withNumber(":end", curDate))
                    .withNameMap(new NameMap()
                            .with("#dateCol", "date"));

                ItemCollection<QueryOutcome> items2 = index.query(spec);

                iterator = items2.iterator();
                HashMap<String, String> article_category = new HashMap<>();
                HashMap<String, Set<String>> category_to_articles = new HashMap<>();
                for (String s : all_categories) {
                    category_to_articles.put(s, new HashSet<String>());
                }
                while (iterator.hasNext()) {
                    Map<String, Object> map = iterator.next().asMap();
                    String cname = ((String) map.get("category")).toUpperCase();
                    all_categories.add(cname);
                    article_category.put(map.get("article_id").toString(), cname);
                    if (!category_to_articles.containsKey(cname)) {
                        category_to_articles.put(cname, new HashSet<String>());
                    }
                    category_to_articles.get(cname).add(map.get("article_id").toString());
                }
                ArrayList<Node> nodes = new ArrayList<>();
                HashMap<String, Node> username_to_node = new HashMap<>();
                HashMap<String, Node> category_to_node = new HashMap<>();
                HashMap<String, Node> article_to_node = new HashMap<>();
                for (String s: all_categories) {
                    category_to_node.put(s, new Node(s));
                }
                for (Map.Entry<String, List<String>> e: user_categories.entrySet()) {
                    Node tmp = new Node(e.getKey());
                    tmp.weights.put(e.getKey(), 1.0);
                    username_to_node.put(e.getKey(), tmp);
                    int num_categories = e.getValue().size();
                    for (String cat : e.getValue()) {
                        Node cat_node = category_to_node.get(cat);
                        Edge ed = new Edge(cat_node, 0.3 / num_categories); 
                        Edge ed2 = new Edge(tmp, 0.3 / num_categories); 
                        tmp.outgoing.add(ed);
                        cat_node.outgoing.add(ed2);
                    }
                }

                for (Map.Entry<String, String> e: article_category.entrySet()) {
                    Node tmp = new Node(e.getKey());
                    article_to_node.put(e.getKey(), tmp);
                    Node cat_node = category_to_node.get(e.getValue());
                    int a_in_c = category_to_articles.get(e.getValue()).size();
                    Edge ed = new Edge(tmp, 1.0 / a_in_c);
                    Edge ed2 = new Edge(cat_node, 1.0);
                    cat_node.outgoing.add(ed);
                    tmp.outgoing.add(ed2);
                }

                Table user_liked = dynamoDB.getTable("user_liked_articles");
                items = user_liked.scan(null, // FilterExpression
                    "username,  article_id", // ProjectionExpression
                    null, null);

                iterator = items.iterator();
                HashMap<String, Set<String>> articles_for_user = new HashMap<>();
                while (iterator.hasNext()) {
                    Map<String, Object> map = iterator.next().asMap();
                    String user = (String) map.get("username");
                    if (!articles_for_user.containsKey(user)) {
                        articles_for_user.put(user, new HashSet<String>());
                    }
                    String article_id = map.get("article_id").toString();
                    articles_for_user.get(user).add(article_id);
                }
                for (Map.Entry<String, Set<String>> e : articles_for_user.entrySet()) {
                    int num_a = e.getValue().size(); 
                    Node tmp = username_to_node.get(e.getKey());
                    for (String s : e.getValue()) {
                        Node art = article_to_node.get(s);
                        art.outgoing.add(new Edge(tmp, 1.0));
                        tmp.outgoing.add(new Edge(art, 0.4 / num_a));
                    }
                }

                Table user_friends = dynamoDB.getTable("friendships");
                items = user_friends.scan(null, // FilterExpression
                    "friend1,  friend2", // ProjectionExpression
                    null, null);

                HashMap<String, Set<String>> friend_list = new HashMap<>();
                for (String s: user_categories.keySet()) {
                    friend_list.put(s, new HashSet<String>());
                }
                iterator = items.iterator();
                while (iterator.hasNext()) {
                    Map<String, Object> map = iterator.next().asMap();
                    String f1 = (String) map.get("friend1");
                    String f2 = (String) map.get("friend2");
                    friend_list.get(f1).add(f2);
                }
                for (Map.Entry<String, Set<String>> e : friend_list.entrySet()) {
                    int num_f = e.getValue().size(); 
                    Node tmp = username_to_node.get(e.getKey());
                    for (String s : e.getValue()) {
                        Node friend = username_to_node.get(s);
                        tmp.outgoing.add(new Edge(friend, 0.3 / num_f));
                    }
                }

                for (Node n: username_to_node.values()) {
                    nodes.add(n);
                }
                for (Node n: category_to_node.values()) {
                    nodes.add(n);
                    System.out.println(n);
                    //System.out.println(n);
                }
                for (Node n: article_to_node.values()) {
                    for (Edge e : n.outgoing) {
                        e.weight = 1.0 / n.outgoing.size();
                    }
                    nodes.add(n);
                }
                for (Node n : nodes) {
                    //System.out.println(nodes);
                }
                //File file = new File(filePath);
                //Scanner fileReader = new Scanner(file);
                ////prevent duplicate edges
                //HashSet<Tuple2<Integer, Integer>> network = new HashSet<>();
                ////this method is too slow for big dataset but works fine for twitter
                //while(fileReader.hasNextLine()) {
                //    String[] edge = fileReader.nextLine().split("\\s+");
                //    network.add(new Tuple2<Integer, Integer>(Integer.parseInt(edge[1]), Integer.parseInt(edge[0])));
                //}
                //return context.parallelizePairs(new ArrayList<Tuple2<Integer, Integer>>(network));
                return context.parallelize(nodes);
            }
            catch (Exception e) {
                    e.printStackTrace(System.out);
                System.out.println("exception???");
                return null;
            }
	}
	
	private JavaRDD<Integer> getSinks(JavaPairRDD<Integer,Integer> network) {
            //remove keys which follow others, since they aren't sinks
            return network.keys().distinct().subtract(network.values().distinct());
	}

	/**
	 * Main functionality in the program: read and process the social network
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run() throws IOException, InterruptedException {
		logger.info("Running");
                JavaRDD<Node> network = getNetwork();
		// Load the social network
                

                //followed, follower
//		JavaPairRDD<Integer, Integer> network = getSocialNetwork(Config.SOCIAL_NET_PATH);
//                //get followers for each node
//                JavaPairRDD<Integer, List<Integer>> followers = network.groupByKey().mapValues(iter -> {List<Integer> nodes = new ArrayList<>(); iter.forEach(nodes::add); return nodes;});
//                //follower, followed
//                //reversed network to find number of following per node
//                JavaPairRDD<Integer, Integer> networkReversed = JavaPairRDD.fromJavaRDD(network.rdd().toJavaRDD().map(tuple -> new Tuple2<Integer, Integer>(tuple._2, tuple._1)));
//
//
//                final Map<Integer, Long> followingCount1 = networkReversed.countByKey();
//                JavaRDD<Integer> all_nodes = network.keys().union(network.values()).distinct();
//
//                System.out.println("This graph contains " + all_nodes.count() + " nodes and " + network.count() + " edges");
//                //add backlinks by getting sink nodes, and adding back edges to all followers for sinks
//                long backLinksAdded = 0;
//                JavaPairRDD<Integer, Integer> backLinks = followers.filter(tup -> !(followingCount1.containsKey(tup._1))).flatMapToPair(tup -> {
//                    List<Tuple2<Integer, Integer>> list = new ArrayList<>();
//                    for (Integer f: tup._2) {
//                        list.add(new Tuple2<Integer, Integer>(f, tup._1)); 
//                    }
//                    return list.iterator();
//                });
//                backLinksAdded = backLinks.count();
//                System.out.println("Added " + backLinksAdded + " backlinks");
//                //add backlinks to network
//                network = network.union(backLinks);
//
//                followers = network.groupByKey().mapValues(iter -> {List<Integer> nodes = new ArrayList<>(); iter.forEach(nodes::add); return nodes;});
//                //now, no more sinks
//                
//                Map<Integer, List<Integer>> followerMap = followers.collectAsMap();
//                
//                networkReversed = JavaPairRDD.fromJavaRDD(network.rdd().toJavaRDD().map(tuple -> new Tuple2<Integer, Integer>(tuple._2, tuple._1)));
//                final Map<Integer, Long> followingCount = networkReversed.countByKey();
//
//
//                //begin social rank algorithm
//                JavaPairRDD<Integer, Double> socialRank = context.parallelizePairs(JavaPairRDD.fromJavaRDD(all_nodes.map(node -> new Tuple2<Integer, Double>(node, 1.0))).collect());
//                logger.info("started social rank");
//                Map<Integer, Double> socialRankMap = socialRank.collectAsMap();
//                double d = 0.15;
//                int rounds = 1; 
//                int imax = this.imax;
//                double dmax = this.dmax;
//                //calculate new social rank
//                JavaPairRDD<Integer, Double> newSocialRank = socialRank.mapPartitionsToPair(iter -> {
//                    Iterable<Tuple2<Integer, Double>> iterable = () -> iter;
//                    return StreamSupport.stream(iterable.spliterator(), false).map(tup -> {
//                        double oldRank = tup._2;
//                        double newRank = d;
//                        if (followerMap.containsKey(tup._1)) {
//                            List<Integer> followersList = followerMap.get(tup._1);
//                            for (Integer f: followersList) {
//                                newRank += (1.0 - d) * socialRankMap.get(f) / followingCount.get(f);
//                            }
//                        }
//                        
//                        return new Tuple2<Integer, Double>(tup._1, newRank);
//                    }).iterator();
//                });
//                if (this.debug) {
//                    newSocialRank.foreach(tup -> System.out.println(tup._1 + " " + tup._2)); 
//                }
//                //recalculate new social rank until threshold is done
//                while ((!socialRank.join(newSocialRank).filter(tup -> Math.abs(tup._2._1 - tup._2._2) >= dmax).isEmpty()) && rounds < imax) 
//                {
//                    rounds++;
//
//                    logger.info("NEW ROUND");
//                    socialRank = newSocialRank;
//                    Map<Integer, Double> socialRankMap2 = socialRank.collectAsMap();
//                    newSocialRank = socialRank.mapPartitionsToPair(iter -> {
//                        Iterable<Tuple2<Integer, Double>> iterable = () -> iter;
//                        return StreamSupport.stream(iterable.spliterator(), false).map(tup -> {
//                            double oldRank = tup._2;
//                            double newRank = d;
//                            if (followerMap.containsKey(tup._1)) {
//                                List<Integer> followersList = followerMap.get(tup._1);
//                                for (Integer f: followersList) {
//                                    newRank += (1.0 - d) * socialRankMap2.get(f) / followingCount.get(f);
//                                    //System.out.println
//                                }
//                            }
//                            
//                            return new Tuple2<Integer, Double>(tup._1, newRank);
//                        }).iterator();
//                    });
//                    if (debug) {
//                        newSocialRank.foreach(tup -> System.out.println(tup._1 + " " + tup._2)); 
//                    }
//                }
//                //output social ranks
//                for (Tuple2<Double, Integer> tup: (JavaPairRDD.fromJavaRDD(newSocialRank.rdd().toJavaRDD().map(tuple -> new Tuple2<Double, Integer>(tuple._2, tuple._1)))).sortByKey(false).take(10)) {
//                    System.out.println(tup._2 + " " + tup._1);
//                }
//		logger.info("*** Finished social network ranking! ***");
	}


	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		logger.info("Shutting down");

		if (spark != null)
			spark.close();
	}
	
	

	public static void main(String[] args) {
		final ComputeRanks cr = new ComputeRanks();
                if (args.length >= 1) {
                    cr.dmax = Double.parseDouble(args[0]);
                }
                if (args.length >= 2) {
                    cr.imax = Integer.parseInt(args[1]);
                }
                cr.debug = args.length >= 3;

		try {
			cr.initialize();

			cr.run();
		} catch (final IOException ie) {
			logger.error("I/O error: ");
			ie.printStackTrace();
		} catch (final InterruptedException e) {
			e.printStackTrace();
		} finally {
			cr.shutdown();
		}
	}

}
