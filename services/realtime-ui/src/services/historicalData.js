import {API_PREFIX, API_URL} from "../constants";

const getHistoricalPrices = (currency, from, to) => {
    let url = `${API_URL}${API_PREFIX}/pairs/${currency}/prices?from=${from}`;
    if (to != null) {
        url += `&to=${to};`
    }
    return fetch(url).then(res => res.json())
}

const getHistoricalCandles = (currency, frame, from, to) => {
    let url = `${API_URL}${API_PREFIX}/pairs/${currency}/candles/${frame}?from=${from}`;
    if (to != null) {
        url += `&to=${to};`
    }
    return fetch(url).then(res => res.json())
}

const getPredictionPrice = (currency, frame, from, to) => {
    let url = `${API_URL}${API_PREFIX}/pairs/${currency}/forecast/${frame}?from=${from}`;
    if (to != null) {
        url += `&to=${to};`
    }
    return fetch(url).then(res => res.json())
}

const getNews = (currency, offset, limit) => {
    let url = `${API_URL}${API_PREFIX}/pairs/${currency}/news`;
    if (offset != null) {
        url += `?offset=${offset};`
    }
    if (limit != null) {
        url += `&limit=${limit}`;
    }
    return fetch(url).then(res => res.json())
}


export {
    getHistoricalPrices,
    getHistoricalCandles,
    getPredictionPrice,
    getNews
};
