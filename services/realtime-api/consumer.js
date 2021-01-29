const kafka = require('kafka-node');

class KafkaConsumer {
    constructor({hosts, candleTopic, priceTopic, newsTopic, liveCandleTopic, predictionTopic, deserializer}) {
        this.client = new kafka.KafkaClient({
            kafkaHost: hosts
        });
        this.candleTopic = candleTopic;
        this.priceTopic = priceTopic;
        this.newsTopic = newsTopic;
        this.liveCandleTopic = liveCandleTopic;
        this.predictionTopic = predictionTopic;

        this.consumer = new kafka.Consumer(this.client, [
            {topic: candleTopic, partition: 0},
            {topic: priceTopic, partition: 0},
            {topic: newsTopic, partition: 0},
            {topic: liveCandleTopic, partition: 0},
            {topic: predictionTopic, partition: 0}
        ], {
            autoCommit: true
        });
        this.deserializer = deserializer;
        if (deserializer == null) {
            this.deserializer = v => {
                try {
                    const json = JSON.parse(v);
                    return json;
                } catch (e) {
                    return {};
                }

            }
        }
        this.priceTransform = (json) => {
            try {
                const priceKeys = [
                    'bid', 'lowBid', 'highBid', 'openBid', 'closeBid',
                    'ask', 'lowAsk', 'highAsk', 'openAsk', 'closeAsk',
                    'high', 'low',
                ];
                for (let k of Object.keys(json)) {
                    if (priceKeys.indexOf(k) > -1) {
                        json[k] = json[k].toFixed(5);
                    }
                }
                return json
            } catch (e) {
                return {}
            }

        }
    }


    startConsuming(onPriceUpdate, onCandle, onNews, onLiveCandle, onPredictionCandles) {
        this.consumer.on('message', (message) => {
            if (message.topic === this.candleTopic) {
                onCandle(this.priceTransform(this.deserializer(message.value)));
            } else if (message.topic === this.priceTopic) {
                onPriceUpdate(this.priceTransform(this.deserializer(message.value)));
            } else if (message.topic === this.newsTopic) {
                onNews(this.deserializer(message.value))
            } else if (message.topic === this.liveCandleTopic) {
                onLiveCandle(this.priceTransform(this.deserializer(message.value)));
            } else if (message.topic === this.predictionTopic) {
                onPredictionCandles(this.priceTransform(this.deserializer(message.value)))
            }
        });
    }
}

module.exports = KafkaConsumer;