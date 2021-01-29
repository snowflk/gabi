docker run -v $(pwd):/app --network=deployment_gabi \
 deployment_sparkmaster /spark/bin/spark-submit \
 --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.0.1 \
 --master spark://sparkmaster:7077 \
 --class price.PriceCandlestick \
 --num-executors 1 \
 --executor-cores 1 \
 --executor-memory 512mb \
 --conf "spark.executorEnv.price.frameName=m1" \
 --deploy-mode cluster \
 --driver-class-path /spark/jars \
 /app/price.jar