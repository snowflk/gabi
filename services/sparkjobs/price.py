mround = round
import os
import cloudpickle
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *
import json
import joblib
import pandas as pd
import numpy as np
from keras.models import load_model
from pyspark import SparkFiles
import pyspark.serializers

pyspark.serializers.cloudpickle = cloudpickle

SYMBOL = "EURUSD"
# FRAMES = {
#     "m1": "1 minute",
#     "m30": "30 minutes",
#     "H1": "1 hour",
#     # "H4": "4 hours",
#     # "D1": "1 day",
#     # "W1": "1 week"
# }


def load_local_model(model_name):
    model = load_model(model_name, compile=False)
    model.compile(optimizer='adam', loss='mse')
    return model


def sliding_windows(symbol, frame, df, decimal_places=5):
    return df.withWatermark("timestamp", "0 day") \
        .filter((df['frame'] == frame) &
                (df['symbol'] == symbol) &
                (df['ts'] > unix_timestamp(current_timestamp()) - 3 * 60 * 60))


def df_to_x(df, Np=10):
    Nf = 1  # future ticks
    X = []
    # transform each training record
    dfd = np.array(df)
    mid = (dfd[-1][3] + dfd[-1][0]) / 2
    dfd[:, :-4] = (dfd[:, :-4] - mid)
    dfd[:, :-1] = dfd[:, :-1] * 100000
    for idx, xi in enumerate(dfd):
        xii = np.array(xi)
        X.append(xii)
    return np.array(X)


def find_prediction(prices, model, scaler):
    x = df_to_x(prices)
    x = scaler.transform(x).reshape(-1, 10, 10)
    out = model.predict(x)
    diff = scaler.inverse_transform(out.repeat(10, axis=1))[0][3]
    mid = (prices[-1][3] + prices[-1][0]) / 2
    return mround(mid + (mround(diff) / 100000), 5)


def prepare_df(openBids, highBids, lowBids, closeBids):
    dfd = pd.DataFrame.from_dict(
        {'openBid': openBids, 'highBid': highBids, 'lowBid': lowBids, 'closeBid': closeBids})
    key = 'closeBid'

    dfd = dfd[['openBid', 'highBid', 'lowBid', 'closeBid']]
    dfd.loc[:, 'bbmid'] = dfd[key].rolling(window=21).mean()
    dfd.loc[:, 'bbupper'] = dfd['bbmid'] + 1.96 * dfd[key].rolling(window=21).std()
    dfd.loc[:, 'bblower'] = dfd['bbmid'] - 1.96 * dfd[key].rolling(window=21).std()
    dfd.loc[:, 'bbwidth'] = dfd['bbupper'] - dfd['bblower']

    dfd.loc[:, 'body'] = dfd['closeBid'] - dfd['openBid']
    dfd.loc[:, 'cosign'] = (dfd['closeBid'] - dfd['openBid'] > 0).astype(int)
    dfd.loc[:, 'down'] = (dfd[['closeBid', 'openBid']].min(axis=1) - dfd['lowBid'])
    dfd.loc[:, 'up'] = (dfd['highBid'] - dfd[['closeBid', 'openBid']].max(axis=1))

    rsi_n = 14
    dfd.loc[:, 'delta'] = dfd['closeBid'].diff()
    dfd = dfd.copy().iloc[1:]
    dup, ddown = dfd['delta'].copy(), dfd['delta'].copy()
    dup[dup < 0] = 0
    ddown[ddown > 0] = 0
    rolup = dup.rolling(rsi_n).mean()
    roldown = ddown.abs().rolling(rsi_n).mean()
    rs = rolup / roldown
    dfd.loc[:, 'rsi'] = 100.0 - (100.0 / (1.0 + rs))
    dfd = dfd.copy().iloc[21:]
    dfd.loc[dfd.rsi.isna(), 'rsi'] = 100

    # reorder columns
    return dfd[['openBid',
                'highBid',
                'lowBid',
                'closeBid',
                'bbupper',
                'bblower',
                'body',
                'up',
                'down',
                'rsi']].iloc[-11:-1]


def predict(symbol, frame, openBids, highBids, lowBids, closeBids, timestamps):
    try:
        tsx = timestamps[-2:]
        o = openBids[-61:]
        h = highBids[-61:]
        l = lowBids[-61:]
        c = closeBids[-61:]
        print('o', len(o), o, flush=True)
        if len(o) < 61:
            return {}

        dfd = pd.DataFrame.from_dict(
            {'openBid': o, 'highBid': h, 'lowBid': l, 'closeBid': c})
        key = 'closeBid'

        dfd = dfd[['openBid', 'highBid', 'lowBid', 'closeBid']]
        dfd.loc[:, 'bbmid'] = dfd[key].rolling(window=21).mean()
        dfd.loc[:, 'bbupper'] = dfd['bbmid'] + 1.96 * dfd[key].rolling(window=21).std()
        dfd.loc[:, 'bblower'] = dfd['bbmid'] - 1.96 * dfd[key].rolling(window=21).std()
        dfd.loc[:, 'bbwidth'] = dfd['bbupper'] - dfd['bblower']

        dfd.loc[:, 'body'] = dfd['closeBid'] - dfd['openBid']
        dfd.loc[:, 'cosign'] = (dfd['closeBid'] - dfd['openBid'] > 0).astype(int)
        dfd.loc[:, 'down'] = (dfd[['closeBid', 'openBid']].min(axis=1) - dfd['lowBid'])
        dfd.loc[:, 'up'] = (dfd['highBid'] - dfd[['closeBid', 'openBid']].max(axis=1))

        rsi_n = 14
        dfd.loc[:, 'delta'] = dfd['closeBid'].diff()
        dfd = dfd.copy().iloc[1:]
        dup, ddown = dfd['delta'].copy(), dfd['delta'].copy()
        dup[dup < 0] = 0
        ddown[ddown > 0] = 0
        rolup = dup.rolling(rsi_n).mean()
        roldown = ddown.abs().rolling(rsi_n).mean()
        rs = rolup / roldown
        dfd.loc[:, 'rsi'] = 100.0 - (100.0 / (1.0 + rs))
        dfd = dfd.copy().iloc[21:]
        dfd.loc[dfd.rsi.isna(), 'rsi'] = 100

        # reorder columns
        dfd = dfd[['openBid',
                   'highBid',
                   'lowBid',
                   'closeBid',
                   'bbupper',
                   'bblower',
                   'body',
                   'up',
                   'down',
                   'rsi']].iloc[-11:-1]

        prices = dfd.values

        scaler = joblib.load(SparkFiles.get("scaler_{}_{}.pkl".format(SYMBOL, frame)))
        model = load_model(SparkFiles.get("{}_{}.h5".format(SYMBOL, frame)))

        X = []
        # transform each training record
        dfd = np.array(prices)
        mid = (dfd[-1][3] + dfd[-1][0]) / 2
        dfd[:, :-4] = (dfd[:, :-4] - mid)
        dfd[:, :-1] = dfd[:, :-1] * 100000
        for idx, xi in enumerate(dfd):
            xii = np.array(xi)
            X.append(xii)
        x = np.array(X)

        # Finding prediction
        x = scaler.transform(x).reshape(-1, 10, 10)
        out = model.predict(x)
        diff = scaler.inverse_transform(out.repeat(10, axis=1))[0][3]
        mid = (prices[-1][3] + prices[-1][0]) / 2
        prediction =  mround(mid + (mround(diff) / 100000), 5)
        print('prediction', prediction, flush=True)

        last_timestamp = tsx[-1] + 60
        res = {'symbol': symbol, 'frame': frame, 'prediction': prediction, 'ts': last_timestamp}
        return json.dumps(res)
    except Error as e:
        print('Errr',e, flush=True)
    return {}


brokers = os.getenv("KAFKA_BROKERS", "kafka:9092")
jarsPkgs = ['org.apache.spark:spark-sql-kafka-0-10_2.12:3.0.1']
SUBMIT_ARGS = f"--packages {','.join(jarsPkgs)} pyspark-shell"
os.environ["PYSPARK_SUBMIT_ARGS"] = SUBMIT_ARGS

spark = SparkSession.builder \
    .master('local[*]') \
    .appName('PriceCandlesticks') \
    .config("spark.sql.shuffle.partitions", '1') \
    .getOrCreate()
spark.sparkContext.setLogLevel("WARN")

spark.udf.register("predict", predict, StringType())

schema = StructType() \
    .add("symbol", StringType()) \
    .add("bid", DoubleType()) \
    .add("ask", DoubleType()) \
    .add("high", DoubleType()) \
    .add("low", DoubleType()) \
    .add("updated", LongType())

#     df = spark.readStream.format('kafka') \
#         .option('kafka.bootstrap.servers', brokers) \
#         .option('subscribe', 'dad.price.0') \
#         .option("startingOffsets", "earliest") \
#         .load() \
#         .selectExpr("CAST(key AS STRING)", "CAST(value AS STRING)") \
#         .select(from_json("value", schema).alias("data")).select("data.*") \
#         .withColumn('timestamp', to_timestamp(round(col("updated") / 1000))) \
#         .withColumn('avg', (col("bid") + col("ask")) / 2)
schema_candles = StructType() \
    .add("_id", LongType()) \
    .add("symbol", StringType()) \
    .add("frame", StringType()) \
    .add("openBid", DoubleType()) \
    .add("closeBid", DoubleType()) \
    .add("highBid", DoubleType()) \
    .add("lowBid", DoubleType()) \
    .add("openAsk", DoubleType()) \
    .add("closeAsk", DoubleType()) \
    .add("highAsk", DoubleType()) \
    .add("lowAsk", DoubleType()) \
    .add("ts", LongType())

df = spark.readStream.format('kafka') \
    .option('kafka.bootstrap.servers', brokers) \
    .option('subscribe', 'dad.candle.0') \
    .option("startingOffsets", "earliest") \
    .load() \
    .selectExpr("CAST(key AS STRING)", "CAST(value AS STRING)") \
    .select(from_json("value", schema_candles).alias("data")).select("data.*") \
    .withColumn('timestamp', to_timestamp(col('ts'))) \
    .dropDuplicates(['timestamp', 'frame', 'symbol'])

windows = []

df = sliding_windows(SYMBOL, 'm1', df)

df = df.groupBy(df['symbol'], df['frame']) \
    .agg(collect_list(df['openBid']).alias('openBids'),
         collect_list(df['highBid']).alias('highBids'),
         collect_list(df['lowBid']).alias('lowBids'),
         collect_list(df['closeBid']).alias('closeBids'),
         collect_list(df['ts']).alias('tsx'))

df = df.select(
    udf(predict, StringType())(df['symbol'], df['frame'],
                               df['openBids'], df['highBids'], df['lowBids'],
                               df['closeBids'], df['tsx']).alias('value')
)

if False:
    query_debug = df.writeStream \
        .format('console') \
        .outputMode('complete') \
        .start() \
        .awaitTermination()
else:
    df.writeStream \
        .format('kafka') \
        .option('kafka.bootstrap.servers', brokers) \
        .option('topic', 'dad.predictioncandle.0') \
        .option('checkpointLocation', 'checkpoint') \
        .option('maxOffsetsPerTrigger', 100) \
        .outputMode('complete') \
        .start() \
        .awaitTermination()
