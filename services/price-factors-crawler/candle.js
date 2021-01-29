class CandleUpdater {
    constructor(candleCallback, liveCandleCallback) {
        this.allowedDelay = 3;

        this.periods = {
            'm1': 60,
            'm30': 60 * 30,
            'H1': 60 * 60,
        };

        this.lastPublish = {};
        this.currentBid = {};
        this.currentAsk = {};
        this.firstCandle = {};
        for (let p of Object.keys(this.periods)) {
            this.currentBid[p] = {o: 0, h: 0, l: Number.MAX_SAFE_INTEGER, c: 0, ts: 0};
            this.currentAsk[p] = {o: 0, h: 0, l: Number.MAX_SAFE_INTEGER, c: 0, ts: 0};
            this.lastPublish[p] = 0;
            this.firstCandle[p] = true;
        }

        this.callback = candleCallback;
        this.callbackLive = liveCandleCallback;

        this.clock = 0;
        this.timer = null;
    }

    tick(data) {
        data.updated = Math.floor(data.updated / 1000);
        this.clock = data.updated;

        if (this.timer === null) {
            this.timer = setInterval(this._timerLoop.bind(this), 1000);
        }
        for (let p of Object.keys(this.periods)) {
            const bidCandle = this._updateCandle(this.currentBid[p], data.bid, data.updated, this.periods[p]);
            const askCandle = this._updateCandle(this.currentAsk[p], data.ask, data.updated, this.periods[p]);
            if (bidCandle.ts > this.currentBid[p].ts) {
                this._publish(p);
            }
            this._publishLive(p);
            this.currentBid[p] = bidCandle;
            this.currentAsk[p] = askCandle;
        }
    }

    _updateCandle(current, price, time, timeWindow) {
        const candleEndTime = time - (time % timeWindow) + timeWindow;

        const candle = {
            o: current.o,
            h: current.h,
            l: current.l,
            c: price,
            ts: candleEndTime,
        };

        if (price > current.h) {
            candle.h = price;
        }
        if (price < current.l) {
            candle.l = price;
        }

        if (candleEndTime > current.ts) {
            candle.o = price;
            candle.h = price;
            candle.l = price;
            candle.c = price;
        }
        return candle;
    }


    _timerLoop() {
        this.clock += 1;
        for (let p of Object.keys(this.periods)) {
            const timeWindow = this.periods[p];
            const timeDiff = this.clock - (this.lastPublish[p] + timeWindow);
            if (this.lastPublish[p] > 0 && timeDiff > this.allowedDelay && timeDiff < timeWindow) {
                this._publish(p);
            }
        }
    }

    _publish(p) {
        const mergedCandle = {
            openBid: this.currentBid[p].o,
            highBid: this.currentBid[p].h,
            lowBid: this.currentBid[p].l,
            closeBid: this.currentBid[p].c,

            openAsk: this.currentAsk[p].o,
            highAsk: this.currentAsk[p].h,
            lowAsk: this.currentAsk[p].l,
            closeAsk: this.currentAsk[p].c,
            ts: this.currentBid[p].ts,
        };
        this.lastPublish[p] = this.currentBid[p].ts;

        if (this.firstCandle[p]) {
            this.firstCandle[p] = false;
            return;
        }

        this.callback(mergedCandle, p);
    }

    _publishLive(p) {
        const mergedCandle = {
            openBid: this.currentBid[p].o,
            highBid: this.currentBid[p].h,
            lowBid: this.currentBid[p].l,
            closeBid: this.currentBid[p].c,

            openAsk: this.currentAsk[p].o,
            highAsk: this.currentAsk[p].h,
            lowAsk: this.currentAsk[p].l,
            closeAsk: this.currentAsk[p].c,
            ts: this.currentBid[p].ts,
        };
        this.callbackLive(mergedCandle, p);
    }

}

module.exports = CandleUpdater;