'use strict';
const io = require('socket.io-client');
const axios = require('axios');
const querystring = require('querystring');
const _ = require('lodash');
const Log = require('./logger');

/**
 * Crawler for FXCM Broker
 * This API is a mix of HTTP Rest and Socket REST
 * API Documentation here: https://fxcm.github.io/rest-api-docs
 */
class FXCMCrawler {
    /**
     * @param accessToken is the access token for FXCM API
     * @param bus is an EventEmitter instance for this crawler to emit the events into
     * @param pairs is an array of strings containing currency pairs, such as "EUR/USD", "USD/JPY", etc.
     */
    constructor({accessToken, bus, pairs}) {
        this.socket = null;
        this.token = accessToken;
        this.baseUrl = "https://api-demo.fxcm.com";
        this.headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'request',
        };
        this.pairs = {}; // pair => subscribed
        this.lastUpdate = {}; // pair => timestamp
        for (let p of pairs) {
            this.pairs[p] = false;
            this.lastUpdate[p] = 0;
        }
        this.bus = bus;
        this.isConnecting = false;
        this.reconnectionDelay = 500;
        this.checkInterval = 5 * 1000;
        this.maxTimeGap = 30 * 1000;
        this.offerTable = {
            1: "EUR/USD",
            2: "USD/JPY",
            3: "EUR/JPY",
        };

    }

    /**
     * Start the crawling job. This is the ONLY function the user should use
     * @returns {Promise<void>}
     */
    start() {
        this._loop();
        setInterval(this._loop.bind(this), this.checkInterval);
    }

    async _loop() {
        Log.debug("Health check");
        try {
            if (this.isConnecting) return;

            // If connection is closed, try to establish a new one
            if (this.socket == null) {
                await this._connect();
                return;
            }
            // If there is no update since the last minute, perhaps something is wrong,
            // or the market is closed due to weekend
            // Anyway, we will not check whether it's weekend or not. We just let it retry.
            const timestamp = getUnixSeconds();
            for (let p of _.keys(this.lastUpdate)) {
                const gap = timestamp - this.lastUpdate[p];
                if (gap > this.maxTimeGap) {
                    Log.debug(`There is no update since ${gap} seconds. The market data stream seems to be closed. Weekend?`);
                    // Just close the connection. It will reconnect automatically
                    this.socket.disconnect();
                    return;
                }
            }
        } catch (e) {
        }
    }

    _connect() {
        return new Promise(((resolve, reject) => {
            this.isConnecting = true;
            this.socket = io(this.baseUrl, {
                query: querystring.stringify({access_token: this.token}),
                reconnection: true,
                secure: true,
                reconnectionDelay: this.reconnectionDelay,
            });
            Log.info(`Connecting to broker: ${this.baseUrl}`);
            this.socket.on('connect', async () => {
                Log.info("Connected");
                Log.debug(`Socket.IO session has been opened: ${this.socket.id}`);
                await this._onConnected();
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                Log.error(`Socket.IO session connect error: ${error}`);
                this._onDisconnect();
                reject(error);
            });
            this.socket.on('error', (error) => {
                Log.error(`Socket.IO session error: ${error}`);
                this._onDisconnect();
                reject(error);
            });
            this.socket.on('disconnect', () => {
                this._onDisconnect();
                Log.debug('Socket disconnected, terminating client.');
            });
        }));
    }

    async _onConnected() {
        this.isConnecting = false;
        this.headers['Authorization'] = `Bearer ${this.socket.id}${this.token}`;
        await this._subscribe();
    }

    async _subscribe() {
        if (this.socket == null) {
            throw Error("Not connected");
        }
        Log.debug('Subscribing to market data');
        const response = await axios.post(`${this.baseUrl}/subscribe`, {pairs: Object.keys(this.pairs)}, {headers: this.headers});
        if (response.status !== 200) {
            Log.debug(`An error occured while subscribing: ${response}`);
            return;
        }
        const {data} = response;
        if (!data.response.executed) {
            Log.debug(`Error: The request was not executed by the server: ${data}`);
            Log.debug("Headers:", this.headers);
            return;
        }
        for (let p of data.pairs) {
            this.socket.on(p.Symbol, this._onUpdate.bind(this));
            this.pairs[p.Symbol] = true;
        }
    }

    _onUpdate(rawPayload) {
        try {
            const payload = JSON.parse(rawPayload);
            payload.Rates = payload.Rates.map(function (v) {
                return v
            });
            this.bus.emit('price_update', payload);
            this.lastUpdate[payload.Symbol] = getUnixSeconds();
        } catch (e) {
            Log.debug(`Error while processing price update: ${e}`);
        }
    }

    _onDisconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.socket = null;
        this.isConnecting = false;
        for (let p of Object.keys(this.pairs)) {
            this.pairs[p] = false;
        }
    }

    async getCandles(offerId, period, params) {
        console.log('Getting historical candles from market data', offerId, period, params);
        const query = querystring.stringify(params);
        const url = `${this.baseUrl}/candles/${offerId}/${period}?` + query;
        console.log('url', url)
        const response = await axios.get(`${this.baseUrl}/candles/${offerId}/${period}?` + query, {headers: this.headers});
        if (response.status !== 200) {
            console.debug(`An error occured while subscribing: ${response}`);
            return;
        }
        const {data} = response;
        if (!data.response.executed) {
            console.debug(`Error: The request was not executed by the server: ${JSON.stringify(data)}`);
            return;
        }
        console.log('Historical candles for', offerId, period, params, data.candles.length)
        return data.candles.map(candle => ({
            openBid: candle[1],
            closeBid: candle[2],
            highBid: candle[3],
            lowBid: candle[4],
            openAsk: candle[5],
            closeAsk: candle[6],
            highAsk: candle[7],
            lowAsk: candle[8],
            volume: candle[9],
            ts: candle[0],
            frame: period,
            symbol: this.offerTable[offerId],
        }));
    }

}

function getUnixSeconds() {
    const d = new Date();
    return Math.round(d.getTime() / 1000);
}

module.exports = FXCMCrawler;