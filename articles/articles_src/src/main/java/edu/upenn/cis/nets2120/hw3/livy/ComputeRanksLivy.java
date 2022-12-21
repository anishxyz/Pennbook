package edu.upenn.cis.nets2120.hw3.livy;

import java.util.Set;
import java.util.List;
import java.util.HashSet;
import java.util.ArrayList;
import java.io.File;
import java.io.PrintWriter;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutionException;
import java.util.stream.Collectors;

import org.apache.livy.LivyClient;
import org.apache.livy.LivyClientBuilder;

import edu.upenn.cis.nets2120.config.Config;

public class ComputeRanksLivy {
	public static void main(String[] args) throws IOException, URISyntaxException, InterruptedException, ExecutionException {
		
		LivyClient client = new LivyClientBuilder()
				  .setURI(new URI("http://ec2-100-25-137-116.compute-1.amazonaws.com:8998/"))
				  .build();

		try {
		    String jar = "target/nets2120-hw3-0.0.1-SNAPSHOT.jar";
			
                    System.out.printf("Uploading %s to the Spark context...\n", jar);
                    client.uploadJar(new File(jar)).get();
                    
                    String sourceFile = Config.BIGGER_SOCIAL_NET_PATH;//Config.SOCIAL_NET_PATH;//.BIGGER_SOCIAL_NET_PATH;

                    System.out.printf("Running SocialRankJob with %s as its input...\n", sourceFile);
                    List<MyPair<Integer,Double>> result = client.submit(new SocialRankJob(true, sourceFile)).get();
                    System.out.println("With backlinks: " + result);


                    /**Code for running with smaller data set**/
                    //List<MyPair<Integer,Double>> result2 = client.submit(new SocialRankJob(false, sourceFile)).get();
                    //System.out.println("Without backlinks: " + result2);
                    //Set<Integer> combined = new HashSet<>();
                    //Set<Integer> set1 = new HashSet<>();
                    //for (MyPair<Integer,Double> pair: result) {
                    //    set1.add(pair.getLeft());
                    //    combined.add(pair.getLeft());
                    //}
                    //Set<Integer> set2 = new HashSet<>();
                    //for (MyPair<Integer,Double> pair: result2) {
                    //    set2.add(pair.getLeft());
                    //    combined.add(pair.getLeft());
                    //}
                    //List<Integer> both = new ArrayList<>();
                    //List<Integer> list1 = new ArrayList<>();
                    //List<Integer> list2 = new ArrayList<>();
                    //for (Integer i: combined) {
                    //    if (set1.contains(i) && set2.contains(i)) {
                    //        both.add(i);
                    //    }
                    //    else if (set1.contains(i) && !set2.contains(i)){
                    //        list1.add(i);
                    //    }
                    //    else if (set2.contains(i) && !set1.contains(i)){
                    //        list2.add(i);
                    //    }
                    //}

                    File file = new File ("results2.txt");
                    PrintWriter writer = new PrintWriter(file);
                    writer.println(result);
                    writer.close();

                    /**Code for running with smaller data set**/
                    //writer.print("Nodes in both: ");
                    //writer.println(both.toString());
                    //writer.print("With backlinks exclusive nodes: ");
                    //writer.println(list1.toString());
                    //writer.print("Without backlinks exclusive nodes: ");
                    //writer.println(list2.toString());
                    //writer.close();

		} finally {
		  client.stop(true);
		}
	}

}
