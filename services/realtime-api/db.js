const MongoClient = require('mongodb').MongoClient;

class Datastore {
    constructor(url, dbName) {
        this.url = url;
        this.dbName = dbName;
        this.db = null;
        this.connected = false;
        this.ensuredIndicies = {};

        this.putPrice = this.putPrice.bind(this);
        this.putCandle = this.putCandle.bind(this);
        this.putNews = this.putNews.bind(this);

        this.getPrices = this.getPrices.bind(this);
        this.getCandles = this.getCandles.bind(this);
        this.getNews = this.getNews.bind(this);
    }

    async connect() {
        this.client = await MongoClient.connect(this.url, {useUnifiedTopology: true});
        this.db = this.client.db(this.dbName);
        this.connected = true;
    }

    async putCandle(symbol, frame, data) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        const collection = `${symbol}_${frame}`;
        await this._ensureIndex(collection, 'ts');
        //  openBid, closeBid, highBid, lowBid
        // openAsk, closeAsk, highAsk, lowAsk
        return await this.db.collection(collection)
            .updateOne({ts: data['ts']}, {$set: data}, {upsert: true})
    }

    async putPrediction(symbol, frame, data) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        const collection = `${symbol}_${frame}_predict`;
        await this._ensureIndex(collection, 'ts');
        //  openBid, closeBid, highBid, lowBid
        // openAsk, closeAsk, highAsk, lowAsk
        return await this.db.collection(collection)
            .updateOne({ts: data['ts']}, {$set: data}, {upsert: true})
    }


    async putPrice(symbol, data) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        const collection = `${symbol}`;
        await this._ensureIndex(collection, 'updated');
        return await this.db.collection(`${symbol}`)
            .updateOne({updated: data['updated']}, {$set: data}, {upsert: true});
    }

    putNews(symbol, data) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        return this.db.collection(`${symbol}_news`)
            .updateOne({url: data['url']}, {$set: data}, {upsert: true});
    }

    getCandles(symbol, frame, from, to) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        return this._deDuplicate(this._toDocuments(
            this.db.collection(`${symbol}_${frame}`)
                .find({ts: {$gte: from, $lte: to}}).project({_id: 0}).sort({ts: 1})
        ), 'ts');
    }

    getPredictions(symbol, frame, from, to) {
        this._ensureConnection();
        symbol = this._sanitizeSymbol(symbol);
        return this._deDuplicate(this._toDocuments(
            this.db.collection(`${symbol}_${frame}_predict`)
                .find({ts: {$gte: from, $lte: to}}).project({_id: 0}).sort({ts: 1})
        ), 'ts');
    }

    getPrices(symbol, from, to) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        return this._toDocuments(
            this.db.collection(`${symbol}`)
                .find({updated: {$gte: from, $lte: to}}).sort({updated: 1})
        );
    }

    getNews(symbol, offset, limit) {
        this._ensureConnection();

        symbol = this._sanitizeSymbol(symbol);
        return this._toDocuments(
            this.db.collection(`${symbol}_news`)
                .find()
                .sort({time: -1})
                .skip(offset)
                .limit(limit)
        );
    }

    _ensureIndex(collection, key) {
        if (!this.ensuredIndicies.hasOwnProperty(collection)) {
            return this.db.collection(collection).createIndex({[key]: 1}, {unique: true}).then(() => {
                this.ensuredIndicies[collection] = true;
            });
        }
    }

    _toDocuments(results) {
        return new Promise((resolve, reject) => {
            results.toArray((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        })
    }

    _deDuplicate(resultPromise, key) {
        return resultPromise.then((result) => {
            const m = {};
            const distinctVals = [];
            for (let r of result) {
                if (!m.hasOwnProperty(r[key])) {
                    distinctVals.push(r);
                    m[r[key]] = 1;
                }
            }
            return distinctVals;
        })
    }

    _sanitizeSymbol(symbol, toUpper = true) {
        symbol = symbol.replace(/\W/gi, '');
        if (toUpper) return symbol.toUpperCase();
        return symbol;
    }

    _ensureConnection() {
        if (!this.connected) {
            throw Error("not connected to the database");
        }
    }
}

module.exports = Datastore;