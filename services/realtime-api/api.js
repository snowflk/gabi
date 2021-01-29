const express = require('express');
const app = express();

const cors = require('cors');
const bodyParser = require('body-parser');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.get('/api/v1/pairs/:pair/forecast/:frame', async (req, res) => {
    const {pair, frame} = req.params;
    let {from, to} = req.query;
    if (from == null) {
        res.status(400).json({
            err: 'a time window must be provided'
        });
        return;
    }
    if (to == null) {
        to = Math.floor(new Date().getTime() / 1000 + 60);
    }
    try {
        from = parseInt(from);
        to = parseInt(to);
    } catch (e) {
        res.status(400).json({err: 'invalid time window', e: `${e}`});
        return;
    }

    const data = await app.datastore.getPredictions(pair, frame, from, to);
    res.json(data);
});

app.get('/api/v1/pairs/:pair/candles/:frame', async (req, res) => {
    console.log('request candles')
    const {pair, frame} = req.params;
    let {from, to} = req.query;
    if (from == null) {
        res.status(400).json({
            err: 'a time window must be provided'
        });
        return;
    }
    if (to == null) {
        to = Math.floor(new Date().getTime() / 1000 + 60);
    }
    try {
        from = parseInt(from);
        to = parseInt(to);
    } catch (e) {
        res.status(400).json({err: 'invalid time window', e: `${e}`});
        return;
    }
    console.log('getCandles', frame, from, to)
    const data = await app.datastore.getCandles(pair, frame, from, to);
    res.json(data);
});

app.get('/api/v1/pairs/:pair/prices', async (req, res) => {
    const {pair} = req.params;
    let {from, to} = req.query;
    if (from == null) {
        res.status(400).json({
            err: 'a time window must be provided'
        });
        return;
    }
    if (to == null) {
        to = new Date().getTime() + 600000;
    }
    try {
        from = parseInt(from);
        to = parseInt(to);
    } catch (e) {
        res.status(400).json({err: 'invalid time window'});
        return;
    }

    const data = await app.datastore.getPrices(pair, from, to);
    res.json(data);
});

app.get('/api/v1/pairs/:pair/news', async (req, res) => {
    const {pair} = req.params;
    let {offset, limit} = req.query;
    if (offset == null) {
        offset = 0;
        // res.status(400).json({
        //     err: 'a time window must be provided'
        // });
        // return;
    }
    if (limit == null) {
        limit = 20;
    }
    try {
        offset = parseInt(offset);
        limit = parseInt(limit);
    } catch (e) {
        res.status(400).json({err: 'invalid time window'});
        return;
    }

    const data = await app.datastore.getNews(pair, offset, limit);
    res.json(data);
});


module.exports = app;