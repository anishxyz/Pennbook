package edu.upenn.cis.nets2120.hw3;
import java.time.LocalDateTime;
import java.io.IOException;
import java.io.*;
import java.lang.Math;
import java.math.BigDecimal;
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
	/**
	 * The basic logger
	 */
	static Logger logger = LogManager.getLogger(ComputeRanks.class);
        //username to node
        HashMap<String, Node> utn;
        //article id to node
        HashMap<String, Node> atn;
        //identifier to node, for all nodes created
        HashMap<String, Node> idtn;

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;

	
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
        JavaPairRDD<String, Node> getNetwork() {

            try {        
                Table usertable = dynamoDB.getTable("users");
                ItemCollection<ScanOutcome> items = usertable.scan(null, // FilterExpression
                    "username, interests", // ProjectionExpression
                    null, null);
                Iterator<Item> iterator = items.iterator();
                HashMap<String, List<String>> user_categories = new HashMap<>();
                HashSet<String> all_categories = new HashSet<>();
                //need to first see the category interests for each user
                while (iterator.hasNext()) {
                    Map<String, Object> map = iterator.next().asMap();
                    ArrayList<String> categories = new ArrayList<>();
                    for (String s: (Set<String>) map.get("interests")) {
                        categories.add(s.toUpperCase());
                        all_categories.add(s.toUpperCase());
                    }
                    user_categories.put((String) map.get("username"), categories);
                }

                //get articles from current day by querying secondary index
                Table articles = dynamoDB.getTable("articles");
                Index index = articles.getIndex("date-article_id-index2");
                long curDate = Long.parseLong(java.time.LocalDate.now().toString().replace("-", ""));
                QuerySpec spec = new QuerySpec()
                    .withKeyConditionExpression("#dateCol = :end")
                    .withValueMap(new ValueMap()
                        .withNumber(":end", curDate))
                    .withNameMap(new NameMap()
                            .with("#dateCol", "date"));

                ItemCollection<QueryOutcome> items2 = index.query(spec);

                //get category for each article, and all articles for each category
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
                //storing user nodes, category nodes, and article nodes separately to help create edges easily
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
                        //create edge from user to each liked category
                        Node cat_node = category_to_node.get(cat);
                        Edge ed = new Edge(cat_node.identifier, 0.3 / num_categories); 
                        Edge ed2 = new Edge(tmp.identifier, 0.3 / num_categories); 
                        tmp.outgoing.add(ed);
                        cat_node.outgoing.add(ed2);
                    }
                }
                
                //creating edges from article to category and vice versa
                for (Map.Entry<String, String> e: article_category.entrySet()) {
                    Node tmp = new Node(e.getKey());
                    article_to_node.put(e.getKey(), tmp);
                    Node cat_node = category_to_node.get(e.getValue());
                    int a_in_c = category_to_articles.get(e.getValue()).size();
                    Edge ed = new Edge(tmp.identifier, 1.0 / a_in_c);
                    Edge ed2 = new Edge(cat_node.identifier, 1.0);
                    cat_node.outgoing.add(ed);
                    tmp.outgoing.add(ed2);
                }

                //get user article likes for those edges
                Table user_liked = dynamoDB.getTable("user_liked_articles");
                items = user_liked.scan(null, 
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
                    //create edges from articles to users
                    int num_a = e.getValue().size(); 
                    Node tmp = username_to_node.get(e.getKey());
                    for (String s : e.getValue()) {
                        Node art = article_to_node.get(s);
                        if (art == null) {
                            continue;
                        }
                        art.outgoing.add(new Edge(tmp.identifier, 1.0));
                        tmp.outgoing.add(new Edge(art.identifier, 0.4 / num_a));
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
                //create edges between users
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
                        tmp.outgoing.add(new Edge(friend.identifier, 0.3 / num_f));
                    }
                }
                //add all nodes to global map for later reference
                idtn = new HashMap<>();
                for (Node n: username_to_node.values()) {
                    nodes.add(n);
                    idtn.put(n.identifier, n);
                }
                for (Node n: category_to_node.values()) {
                    nodes.add(n);
                    idtn.put(n.identifier, n);
                }
                for (Node n: article_to_node.values()) {
                    for (Edge e : n.outgoing) {
                        e.weight = 1.0 / n.outgoing.size();
                    }
                    nodes.add(n);
                    idtn.put(n.identifier, n);
                }
                utn = username_to_node;
                atn = article_to_node;
                //create incoming edges based on outgoing edges for easier implementation of adsorption algorithm
                ArrayList<Tuple2<String, Node>> pairs = new ArrayList<>();
                for (Node n: nodes) {
                    for (Edge e: n.outgoing) {
                        Node other = idtn.get(e.id);
                        other.incoming.add(new Edge(n.identifier, e.weight));
                    }
                    pairs.add(new Tuple2<String, Node>(n.identifier, n));
                }
                //return RDD of all nodes with identifiers
                return context.parallelizePairs(pairs);
            }
            catch (Exception e) {
                    e.printStackTrace(System.out);
                System.out.println("exception???");
                return null;
            }
	}
	

	/**
	 * Main functionality in the program: read and process the social network
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public void run() throws IOException, InterruptedException {
		logger.info("Running");
                JavaPairRDD<String,Node> network = getNetwork();
                HashMap<String, Node> users = this.utn;
                Map<String, Node> idtn_tmp = this.idtn;
                for (int i = 0; i < 15; i++) {
                    final Map<String, Node> id_to_node = idtn_tmp;
                    //map network to next iteration of adsorption algorithm by using incoming edges to get weights
                    network = network.mapValues(node -> {
                        Node n = new Node(node.identifier);
                        for (Edge e: node.incoming) {
                            Node in = id_to_node.get(e.id);
                            for (Map.Entry<String, Double> en: in.weights.entrySet()) {
                                if (!n.weights.containsKey(en.getKey())) {
                                    n.weights.put(en.getKey(), 0.0);
                                }
                                n.weights.put(en.getKey(), n.weights.get(en.getKey()) + e.weight * en.getValue());
                            }
                        }
                        n.incoming = node.incoming;
                        n.outgoing = node.outgoing;
                        n.normalize();
                        if (users.containsKey(n.identifier)) {
                            n.hardcodeUser();
                        }
                        return n;

                    });
                    //update nodes in id to node map with their current weights
                    idtn_tmp = network.collectAsMap();
                }
                ArrayList<String> articles_list = new ArrayList<>(this.atn.keySet());
                HashMap<String, List<String>> articles_for_user = new HashMap<>();
                final Map<String, Node> id_to_node = idtn_tmp;
                for (String s: this.utn.keySet()) {
                    ArrayList<String> tmp_list =(ArrayList<String>) articles_list.clone();
                    tmp_list.sort((a, b) -> {
                        final Node n = id_to_node.get(a);
                        final Node n2 = id_to_node.get(b);
                        return Double.compare(n2.weights.getOrDefault(s, 0.0),n.weights.getOrDefault(s, 0.0));
                    });
                    //get top 10 articles for each user based on label weights
                    List<String> sliced = tmp_list.subList(0, Math.min(10, tmp_list.size()));
                    articles_for_user.put(s, sliced);
                }
                Table feed = dynamoDB.getTable("user_feed_articles");
                //add top articles for each user to dynamodb table, will be shown to user as needed
                for (Map.Entry<String, List<String>> e : articles_for_user.entrySet()) {
                    ArrayList<BigDecimal> tmp_set = new ArrayList<>();
                    for (String s: e.getValue()) {
                        tmp_set.add(new BigDecimal(Long.parseLong(s)));
                    }
                    UpdateItemSpec updateItemSpec = new UpdateItemSpec().withPrimaryKey("username", e.getKey())
                        .withUpdateExpression("set new_articles = :art, seen_articles = if_not_exists(seen_articles, :art2)")
                        .withValueMap(
                            new ValueMap().withList(":art", tmp_set)
                            .withList(":art2", new ArrayList<BigDecimal>())
                        )
                        .withReturnValues("ALL_NEW");
                    //check if user has been recommended articles before, otherwise create attribute in table
                    UpdateItemOutcome outcome =  feed.updateItem(updateItemSpec);  
                    List<BigDecimal> data = outcome.getItem().getList("seen_articles");
                    System.out.println(data);
                    ArrayList<BigDecimal> updated_articles;
                    for (BigDecimal bd : tmp_set) {
                        if (!data.contains(bd)) {
                            data.add(bd);
                            break;
                        }
                    }
                    UpdateItemSpec updateItemSpec2 = new UpdateItemSpec().withPrimaryKey("username", e.getKey())
                        .withUpdateExpression("set seen_articles = :art")
                        .withValueMap(
                            new ValueMap().withList(":art", data)
                        );
                    outcome =  feed.updateItem(updateItemSpec2);  


                }
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

//need Node and Edge to be serializable for spark
class Node implements Serializable{
    public String identifier;
    public ArrayList<Edge> outgoing;
    public ArrayList<Edge> incoming;
    public HashMap<String, Double> weights;
    //public HashMap<String, Double> newWeights;
    public Node(String id) {
        weights = new HashMap<>();
        //newWeights = new HashMap<>();
        outgoing = new ArrayList<>();
        incoming = new ArrayList<>();
        identifier = id;
    }
    private void readObject(ObjectInputStream aInputStream) throws ClassNotFoundException, IOException {
        aInputStream.defaultReadObject();
    }
    private void writeObject(ObjectOutputStream aOutputStream) throws IOException {
        aOutputStream.defaultWriteObject();
    }
    public String toString() {
        return "id: " + identifier + " edges: " + incoming.toString() + "weights: " + weights.toString();
    }
    public void normalize() {
        double sum = 0;
        for (Double d : weights.values()) {
            sum += d;
        }
        for (Map.Entry<String, Double> e : weights.entrySet()) {
            weights.put(e.getKey(), e.getValue() / sum);
        }
    }
    public void hardcodeUser() {
        weights.put(identifier, 1.0);
    }
}
class Edge implements Serializable{
    public String id;
    public double weight;
    public Edge(String ident, double w) {
        id = ident;
        weight = w;
    }
    private void readObject(ObjectInputStream aInputStream) throws ClassNotFoundException, IOException {
        aInputStream.defaultReadObject();
    }
    private void writeObject(ObjectOutputStream aOutputStream) throws IOException {
        aOutputStream.defaultWriteObject();
    }
    public String toString() {
        return "(" + id + ", " + weight + ")";
    }
}
