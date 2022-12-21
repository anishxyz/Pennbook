package g26;
import java.io.*;
import java.lang.*;
import java.util.*;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.apache.spark.api.java.*;
import org.apache.spark.sql.SparkSession;
import com.google.gson.*;
import com.amazonaws.auth.*;
import com.amazonaws.client.builder.AwsClientBuilder;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClientBuilder;
import com.amazonaws.services.dynamodbv2.document.*;
import com.amazonaws.services.dynamodbv2.model.*;
import scala.Tuple2;
import java.util.concurrent.ThreadLocalRandom;



// import com.amazonaws.services.dynamodbv2.local.main.ServerRunner;
// import com.amazonaws.services.dynamodbv2.local.server.DynamoDBProxyServer;


public final class LoadArticles {
    public static SparkSession spark;
    public static JavaSparkContext context;
    static Logger logger = LogManager.getLogger(LoadArticles.class);

    public static void load(String articlesPath) throws FileNotFoundException {
        Scanner s = new Scanner(new File(articlesPath));
        Gson gson = new Gson();
        ArrayList<Tuple2<Long,Map>> arr = new ArrayList<>();
        Random random = new Random();
        while (s.hasNext()){
            arr.add(new Tuple2<Long, Map>(ThreadLocalRandom.current().nextLong(9223372036854775807L), gson.fromJson(s.nextLine(), Map.class)));
        }

        JavaPairRDD<Long, Map> articles = context.parallelizePairs(arr, 5);//context.textFile(articlesPath).map(line -> {Gson gson = new Gson(); gson.fromJson(line, Map.class}));
        // for (Object obj: file.take(5)) {
        //     System.out.println(obj);
        // }
        articles.foreachPartition(iter -> {
            ArrayList<Item> items = new ArrayList<>();
            DynamoDB curDB = getDynamoDB();
            int c = 0;
            while (iter.hasNext()) {
                c+= 1;
                Tuple2<Long, Map> tmp = iter.next();
                Map articleData = tmp._2;
                String[] dateSplit = ((String)articleData.get("date")).split("-");
                long year = (Long.parseLong(dateSplit[0])+5) * 10000L;
                long month = Long.parseLong(dateSplit[1]) * 100L;
                long day = Long.parseLong(dateSplit[2]);

                Item it = new Item().withPrimaryKey("article_id", tmp._1, "date", year+month+day)
                                    .withString("link", (String) articleData.get("link"))
                                    .withString("headline", (String) articleData.get("headline"))
                                    .withString("category", (String) articleData.get("category"))
                                    .withString("short_description", (String) articleData.get("short_description"))
                                    .withString("authors", (String) articleData.get("authors"));
                items.add(it);
                if (items.size() == 25) {

                    TableWriteItems twi = new TableWriteItems("articles").withItemsToPut(items);
                    BatchWriteItemOutcome o = curDB.batchWriteItem(twi);
                    
                    //write any remaining unprocessed items
                    Map<String,List<WriteRequest>> up;
                    while ((up=o.getUnprocessedItems()).size() != 0) {
                        o = curDB.batchWriteItemUnprocessed(up);
                    }
                    items.clear();
                    logger.info("cur count " + c);

                }
            }
            if (items.size() > 0) {

                TableWriteItems twi = new TableWriteItems("articles").withItemsToPut(items);
                BatchWriteItemOutcome o = curDB.batchWriteItem(twi);
                
                //write any remaining unprocessed items
                Map<String,List<WriteRequest>> up;
                while ((up=o.getUnprocessedItems()).size() != 0) {
                    o = curDB.batchWriteItemUnprocessed(up);
                }
                items.clear();
            }
        });
    }   
    public static void main(String[] args) throws FileNotFoundException {
        spark = getSparkConnection();
		context = getSparkContext();


        // context.setLogLevel("ERROR");

        LoadArticles.load("News_Category_Dataset_v3.json");
    }

    public static DynamoDB getDynamoDB() {
        DynamoDB client = new DynamoDB(AmazonDynamoDBClientBuilder.standard()
        .withEndpointConfiguration(new AwsClientBuilder.EndpointConfiguration(
            "https://dynamodb.us-east-1.amazonaws.com", "us-east-1"))
        .withCredentials(new DefaultAWSCredentialsProviderChain())
        .build());
        return client;
    }

    public static SparkSession getSparkConnection() {
		return getSparkConnection(null);
	}
	
	public static synchronized SparkSession getSparkConnection(String host) {
		if (spark == null) {
			if (System.getenv("HADOOP_HOME") == null) {
				File workaround = new File(".");
				
				System.setProperty("hadoop.home.dir", workaround.getAbsolutePath() + "/native-libs");
			}
			
			if (host != null && !host.startsWith("spark://"))
				host = "spark://" + host + ":7077";
			
		    spark = SparkSession
		            .builder()
		            .appName("PennBook")
		            .master((host == null) ? "local[*]" : host)
		            .getOrCreate();
		}
		spark.sparkContext().setLogLevel("ERROR");
	    return spark;
	}

	public static synchronized JavaSparkContext getSparkContext() {
		if (context == null)
			context = new JavaSparkContext(getSparkConnection().sparkContext());
		
		return context;
	}

}