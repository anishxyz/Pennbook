package edu.upenn.cis.nets2120.hw3.livy;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.URL;
import java.net.URLConnection;
import java.lang.Math;
import java.io.File;
import java.util.Scanner;
import java.util.Map;
import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;
import java.util.Arrays;
import java.util.stream.StreamSupport;
import scala.Tuple2;


import org.apache.livy.Job;
import org.apache.livy.JobContext;
import org.apache.spark.api.java.JavaPairRDD;
import org.apache.spark.api.java.JavaRDD;
import org.apache.spark.api.java.JavaSparkContext;
import org.apache.spark.sql.SparkSession;

import edu.upenn.cis.nets2120.config.Config;
import edu.upenn.cis.nets2120.storage.SparkConnector;
import scala.Tuple2;
import software.amazon.awssdk.services.dynamodb.model.DynamoDbException;

public class SocialRankJob implements Job<List<MyPair<Integer,Double>>> {
	/**
	 * 
	 */
	private static final long serialVersionUID = 1L;

	/**
	 * Connection to Apache Spark
	 */
	SparkSession spark;
	
	JavaSparkContext context;

	private boolean useBacklinks;
        int imax = 25;
        double dmax = 30.0;
        boolean debug = false;

	private String source;
	

	/**
	 * Initialize the database connection and open the file
	 * 
	 * @throws IOException
	 * @throws InterruptedException 
	 * @throws DynamoDbException 
	 */
	public void initialize() throws IOException, InterruptedException {
		System.out.println("Connecting to Spark...");
		spark = SparkConnector.getSparkConnection();
		context = SparkConnector.getSparkContext();
		
		System.out.println("Connected!");
	}
	
	/**
	 * Fetch the social network from the S3 path, and create a (followed, follower) edge graph
	 * 
	 * @param filePath
	 * @return JavaPairRDD: (followed: int, follower: int)
	 */
	JavaPairRDD<Integer,Integer> getSocialNetwork(String filePath) {
            try {
                //Open connection to dataset and load file
                return context.textFile(filePath, Config.PARTITIONS).mapToPair(line -> {
                    String[] tmp = line.split("\\s+");
                    return new Tuple2<Integer, Integer>(Integer.parseInt(tmp[0]), Integer.parseInt(tmp[1]));
                });
                /**URL url = new URL(filePath);
                URLConnection con = url.openConnection();
                InputStream is = con.getInputStream();
                Scanner fileReader = new Scanner(is);

                ArrayList<Tuple2<Integer, Integer>> network = new ArrayList<>();
                long count = 0;
                while(fileReader.hasNextLine()) {
                    count++;
                    String[] edge = fileReader.nextLine().split("\\s+");
                    network.add(new Tuple2<Integer, Integer>(Integer.parseInt(edge[1]), Integer.parseInt(edge[0])));
                    if (count % 100000 == 0) {
                        System.out.println("count is " + count);
                    }
                }
                return context.parallelizePairs(network).distinct();**/
            }
            catch (Exception e) {
                System.out.println("exception???");
                return null;
            }
	}
	
	private JavaRDD<Integer> getSinks(JavaPairRDD<Integer,Integer> network) {
            //sink is any followed node that doesnt follow anyone else
            return network.keys().distinct().subtract(network.values().distinct());
	}

	/**
	 * Main functionality in the program: read and process the social network
	 * 
	 * @throws IOException File read, network, and other errors
	 * @throws DynamoDbException DynamoDB is unhappy with something
	 * @throws InterruptedException User presses Ctrl-C
	 */
	public List<MyPair<Integer,Double>> run() throws IOException, InterruptedException {
		System.out.println("Running");

		// Load the social network
                
                //followed, follower
		JavaPairRDD<Integer, Integer> network = getSocialNetwork(this.source);
                System.out.println("got initial network rdd");
                //get followers for each node
                JavaPairRDD<Integer, List<Integer>> followers = network.groupByKey().mapValues(iter -> {List<Integer> nodes = new ArrayList<>(); iter.forEach(nodes::add); return nodes;});

                //get following for each node, need to reverse edges to see
                JavaPairRDD<Integer, Integer> networkReversed = JavaPairRDD.fromJavaRDD(network.rdd().toJavaRDD().map(tuple -> new Tuple2<Integer, Integer>(tuple._2, tuple._1)));
                System.out.println("got reversed network rdd");

                JavaRDD<Integer> all_nodes = network.keys().union(network.values()).distinct();

                System.out.println("This graph contains " + all_nodes.count() + " nodes and " + network.count() + " edges");
                if (this.useBacklinks) {
                    final Map<Integer, Long> followingCount1 = networkReversed.countByKey();
                    long backLinksAdded = 0;
                    JavaPairRDD<Integer, Integer> backLinks = followers.filter(tup -> !(followingCount1.containsKey(tup._1))).flatMapToPair(tup -> {
                        List<Tuple2<Integer, Integer>> list = new ArrayList<>();
                        for (Integer f: tup._2) {
                            list.add(new Tuple2<Integer, Integer>(f, tup._1)); 
                        }
                        return list.iterator();
                    });
                    backLinksAdded = backLinks.count();
                    System.out.println("Added " + backLinksAdded + " backlinks");
                    network = network.union(backLinks);
                    followers = network.groupByKey().mapValues(iter -> {List<Integer> nodes = new ArrayList<>(); iter.forEach(nodes::add); return nodes;});
                    networkReversed = JavaPairRDD.fromJavaRDD(network.rdd().toJavaRDD().map(tuple -> new Tuple2<Integer, Integer>(tuple._2, tuple._1)));
                    System.out.println("recalculated network");
                }

                Map<Integer, List<Integer>> followerMap = followers.collectAsMap();
                
                final Map<Integer, Long> followingCount = networkReversed.countByKey();



                JavaPairRDD<Integer, Double> socialRank = context.parallelizePairs(JavaPairRDD.fromJavaRDD(all_nodes.map(node -> new Tuple2<Integer, Double>(node, 1.0))).collect());
                System.out.println("started social rank");
                Map<Integer, Double> socialRankMap = socialRank.collectAsMap();
                double d = 0.15;
                int rounds = 1; 
                int imax = this.imax;
                double dmax = this.dmax;

                //run one round of socialrank
                JavaPairRDD<Integer, Double> newSocialRank = socialRank.mapPartitionsToPair(iter -> {
                    Iterable<Tuple2<Integer, Double>> iterable = () -> iter;
                    return StreamSupport.stream(iterable.spliterator(), false).map(tup -> {
                        double oldRank = tup._2;
                        double newRank = d;
                        if (followerMap.containsKey(tup._1)) {
                            List<Integer> followersList = followerMap.get(tup._1);
                            for (Integer f: followersList) {
                                newRank += (1.0 - d) * socialRankMap.get(f) / followingCount.get(f);
                            }
                        }
                        
                        return new Tuple2<Integer, Double>(tup._1, newRank);
                    }).iterator();
                });
                if (this.debug) {
                    newSocialRank.foreach(tup -> System.out.println(tup._1 + " " + tup._2)); 
                }


                //continue running until meeting threshold
                while ((!socialRank.join(newSocialRank).filter(tup -> Math.abs(tup._2._1 - tup._2._2) >= dmax).isEmpty()) && rounds < imax) 
                {
                    rounds++;
                    System.out.println("round " + rounds);
                    socialRank = newSocialRank;
                    Map<Integer, Double> socialRankMap2 = socialRank.collectAsMap();
                    newSocialRank = socialRank.mapPartitionsToPair(iter -> {
                        Iterable<Tuple2<Integer, Double>> iterable = () -> iter;
                        return StreamSupport.stream(iterable.spliterator(), false).map(tup -> {
                            double oldRank = tup._2;
                            double newRank = d;
                            if (followerMap.containsKey(tup._1)) {
                                List<Integer> followersList = followerMap.get(tup._1);
                                for (Integer f: followersList) {
                                    newRank += (1.0 - d) * socialRankMap2.get(f) / followingCount.get(f);
                                }
                            }
                            
                            return new Tuple2<Integer, Double>(tup._1, newRank);
                        }).iterator();
                    });
                    if (debug) {
                        newSocialRank.foreach(tup -> System.out.println(tup._1 + " " + tup._2)); 
                    }
                }


                //print output
                List<MyPair<Integer, Double>> ret = new ArrayList<>();
                for (Tuple2<Double, Integer> tup: (JavaPairRDD.fromJavaRDD(newSocialRank.rdd().toJavaRDD().map(tuple -> new Tuple2<Double, Integer>(tuple._2, tuple._1)))).sortByKey(false).take(10)) {
                    System.out.println(tup._2 + " " + tup._1);
                    ret.add(new MyPair(tup._2, tup._1));
                }
		System.out.println("*** Finished social network ranking! ***");
                //return results
                return ret;

	}

	/**
	 * Graceful shutdown
	 */
	public void shutdown() {
		System.out.println("Shutting down");
	}
	
	public SocialRankJob(boolean useBacklinks, String source) {
		System.setProperty("file.encoding", "UTF-8");
		
		this.useBacklinks = useBacklinks;
		this.source = source;
	}

	@Override
	public List<MyPair<Integer,Double>> call(JobContext arg0) throws Exception {
		initialize();
		return run();
	}

}
