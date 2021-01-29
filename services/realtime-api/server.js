const KafkaConsumer = require('./consumer');
const DataStore = require('./db');
const RealtimeSocket = require('./socket');
const CandleImporter = require('./importer');
const apiServer = require('./api');

const port = process.env.PORT || 3000;
const dbUrl = process.env.DB_URL || "mongodb://root:example@mongo:27017";
const dbName = process.env.DB_NAME || "gabi";
const fxcmToken = process.env.FXCM_TOKEN || '0004ac72171d396154ddaebc87487cf326cfdd1e';


async function main() {
    let importStarted = false;
    let lastPredictedTimestamp = {}

    const store = new DataStore(dbUrl, dbName);
    await store.connect();

    apiServer.datastore = store;

    const rtSocket = new RealtimeSocket(apiServer);
    const consumer = new KafkaConsumer({
        hosts: "kafka:9092",
        priceTopic: "dad.price.0",
        candleTopic: "dad.candle.0",
        newsTopic: "dad.news.0",
        liveCandleTopic: "dad.livecandle.0",
        predictionTopic: "dad.predictioncandle.0"
    });
    const candleImporter = new CandleImporter({
        accessToken: fxcmToken,
        url: dbUrl,
        dbName: dbName,
    });

    const onCandle = (candleUpdate) => {
        const {symbol, frame, ...data} = candleUpdate;
        console.debug(`[${new Date(Date.now()).toISOString()}]: Candle received [${symbol}_${frame}] open: ${data.openBid}, high: ${data.highBid}, low: ${data.lowBid}, close: ${data.closeBid}, ts: ${data.ts}`);

        store.putCandle(symbol, frame, data);
        rtSocket.publishCandle(symbol, frame, data);
        if (!importStarted) {
            importStarted = true;
            candleImporter.start(data.ts);
        }
    };

    const onLiveCandle = (candleUpdate) => {
        const {symbol, frame, ...data} = candleUpdate;
        console.debug(`[${new Date(Date.now()).toISOString()}]: Live candle received [${symbol}_${frame}] open: ${data.openBid}, high: ${data.highBid}, low: ${data.lowBid}, close: ${data.closeBid}, ts: ${data.ts}`);

        rtSocket.publishLiveCandle(symbol, frame, data);
        if (!importStarted) {
            importStarted = true;
            candleImporter.start(data.ts);
        }
    };

    const onPredictionCandle = (data) => {
        const {symbol, frame, prediction, ts} = data;
        console.debug(`[${new Date(Date.now()).toISOString()}]: Prediction received [${symbol}_${frame}] prediction: ${prediction}, ts: ${ts}`);
        if (symbol && frame && prediction && ts) {
            const key = `${symbol}_${frame}`;
            if (!lastPredictedTimestamp.hasOwnProperty(key)) {
                lastPredictedTimestamp[key] = 0
            }
            const t = {ts, closeBid: prediction.toString()};
            if (lastPredictedTimestamp[key] < t.ts) {
                console.log('Publish prediction')
                store.putPrediction(symbol, frame, t);
                rtSocket.publishPredictionCandle(symbol, frame, t);
                lastPredictedTimestamp[key] = t.ts;
            }
        }
    }

    const onNews = (newsUpdate) => {
        const {symbol, ...data} = newsUpdate;
        store.putNews(symbol, data);
        rtSocket.publishNews(symbol, data);
    };

    const onPriceUpdate = (priceUpdate) => {
        const {symbol, ...data} = priceUpdate;
        store.putPrice(symbol, data);
        rtSocket.publishPrice(symbol, data);
    };

    consumer.startConsuming(onPriceUpdate, onCandle, onNews, onLiveCandle, onPredictionCandle);
    rtSocket.startListening(port);
}

main();