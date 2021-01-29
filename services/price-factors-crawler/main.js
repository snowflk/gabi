const EventEmitter = require('events');
const GlobalBus = new EventEmitter();
const kafka = require('kafka-node');
const FXCMCrawler = require('./crawler');
const Log = require('./logger');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const CandleUpdater = require('./candle');

async function main() {
    const crawler = new FXCMCrawler({
        accessToken: process.env.FXCM_TOKEN || '0004ac72171d396154ddaebc87487cf326cfdd1e',
        bus: GlobalBus,
        pairs: ["EUR/USD"],
    });
    const producer = new kafka.Producer(new kafka.KafkaClient({kafkaHost: process.env.KAFKA_SERVER || 'kafka:9092'}));
    producer.on('ready', startMsgForwarding(producer));

    crawler.start();
    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: false}));
    app.get('/candles', async (req, res) => {
        const {offerId, period, ...params} = req.query;
        try {
            const data = await crawler.getCandles(offerId, period, params)
            res.json(data);
        } catch (e) {
            res.json({err: `${e}`});
        }
    });
    app.listen(3000);
}

function startMsgForwarding(producer,) {
    function sendCandleToTopic(topic) {
        return (candle, period) => {
            const msg = {
                topic: topic,
                messages: JSON.stringify({
                    symbol: 'EURUSD',
                    frame: period,
                    ...candle,
                })
            };
            producer.send([msg], err => {
                if (err) {
                    Log.error(`[Kafka] Failed to send candle to the broker`)
                }
            })
        }
    }

    return function () {
        const candleUpdater = new CandleUpdater(
            sendCandleToTopic(process.env.KAFKA_CANDLE_TOPIC || 'dad.candle.0'),
            sendCandleToTopic(process.env.KAFKA_LIVECANDLE_TOPIC || 'dad.livecandle.0')
        );

        GlobalBus.on('price_update', data => {
            Log.info(`[${data.Symbol}] Bid: ${data.Rates[0]}, Ask: ${data.Rates[1]}, High: ${data.Rates[2]}, Low: ${data.Rates[3]}, Updated: ${data.Updated}`);
            const convertedData = {
                symbol: data.Symbol,
                bid: data.Rates[0],
                ask: data.Rates[1],
                high: data.Rates[2],
                low: data.Rates[3],
                updated: data.Updated,
            };
            const msg = {
                topic: process.env.KAFKA_TOPIC || 'dad.price.0',
                messages: JSON.stringify(convertedData),
            };
            candleUpdater.tick(convertedData);
            producer.send([msg], (err) => {
                if (err) {
                    Log.error(`[Kafka] Failed to send price to the broker`)
                }
            });
        });
    }
}

main();