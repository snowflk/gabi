docker run -v $(pwd):/app \
--network=deployment_gabi \
deployment_sparkmaster /spark/bin/spark-submit \
 --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.0.1 \
 --conf spark.executorEnv.frameName=m1 \
 --files /app/models/EURUSD_m1.h5,/app/models/scaler_EURUSD_m1.pkl /app/price.py