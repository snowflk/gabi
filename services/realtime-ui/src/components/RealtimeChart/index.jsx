import React, {useEffect, useRef, useState} from 'react';
import LineChart from "./LineChart";
import CandlestickChart from "./CandlestickChart";

import HeaderToolbar from "./HeaderToolbar";
import {getHistoricalCandles, getPredictionPrice} from "../../services/historicalData";

const ChartTypes = {
    'candles': CandlestickChart,
    'line': LineChart,
};

const frameMap = {
    'm1': {
        id: 'm1', name: '1 Minute', interval: 60
    },
    'm30': {
        id: 'm30', name: '30 Minutes', interval: 60 * 30
    },
    'H1': {
        id: 'H1', name: '1 Hour', interval: 60 * 60
    }
}

function RealtimeChart({socket}) {
    const [currChartType, setChartType] = useState(Object.keys(ChartTypes)[0]);
    const [CurrentChart, setCurrentChart] = useState();
    const chartRef = useRef();
    const [currency, setCurrency] = useState('EURUSD');
    const [currentFrame, setCurrentFrame] = useState('m1');
    const [currentCandle, setCurrentCandle] = useState({time: 0, open: 0, high: 0, low: 9999, close: 0});
    const [currentPrediction, setCurrentPrediction] = useState({time: 0, value: 0});


    useEffect(() => setCurrentChart(ChartTypes[currChartType]), [currChartType]);

    const getChart = () => {
        return chartRef.current;
    };

    // const updateCandleHandler = (data) => {
    //     if (!data) return;
    //     console.log("Price", data);
    //     if (data.updated < currentCandle.time) return;
    //     setCurrentCandle(old => calculateNewCandle(old, data, 60));
    // };
    const fetchData = (currency, frame) => {
        const from = Math.round((new Date().getTime() - frameMap[frame].interval * 1000 * 240 * 20) / 1000);
        getHistoricalCandles(currency, frame, from).then(res => {
            const data = res.map(item => {
                return {
                    time: item.ts,
                    open: item.openBid,
                    high: item.highBid,
                    low: item.lowBid,
                    close: item.closeBid,
                }
            });
            if (getChart()) {
                getChart().setData(data);
            }
            setCurrentCandle(data[data.length - 1]);
        });
        getPredictionPrice(currency, frame, from).then(res => {
            const data = res.map(item => {
                return {
                    // time: item.ts,
                    time: item.ts,
                    value: item.closeBid
                }
            });
            if (getChart()) {
                getChart().setPrediction(data);
            }
        });
    }

    useEffect(() => {
        fetchData(currency, currentFrame);
        socket.on('predictioncandle', prediction => {
            if (prediction.ts > currentPrediction.time) {
                setCurrentPrediction({
                    // time: prediction.ts,
                    time: prediction.ts,
                    value: prediction.closeBid
                })
            }
        });

        socket.on('livecandle', candle => {
            setCurrentCandle({
                time: candle.ts,
                open: candle.openBid,
                high: candle.highBid,
                low: candle.lowBid,
                close: candle.closeBid,
            });
        });
        socket.emit('subscribe', `EURUSD_${currentFrame}`);
        socket.on('candle', item => {
            if (item.ts <= currentCandle.time) return;

            setCurrentCandle({
                time: item.ts,
                open: item.openBid,
                high: item.highBid,
                low: item.lowBid,
                close: item.closeBid,
            });
        });
    }, [socket, currChartType, currentFrame]);

    useEffect(() => {
        if (!CurrentChart || (currentCandle && currentCandle.time === 0)) return;
        getChart().updateData(currentCandle);
    }, [currentCandle]);

    useEffect(() => {
        if (!CurrentChart || (currentPrediction && currentPrediction.time === 0)) return;
        getChart().updatePrediction(currentPrediction);
    }, [currentPrediction])

    const resetData = (currency, frame) => {
        getChart().reset();
        setCurrentCandle({time: 0, open: 0, high: 0, low: 9999, close: 0});
        setCurrentPrediction({time: 0, value: 0});
        fetchData(currency, frame);

    }

    const handleChangeCurrency = currency => {
        setCurrency(currency);
        resetData(currency, currentFrame);
    };

    const handleChangeFrame = frame => {
        socket.emit('unsubscribe', `EURUSD_${currentFrame}`)
        setCurrentFrame(frame);
        resetData(currency, frame);
    };

    const handleChangeChartType = chartType => {
        setChartType(chartType);
        // resetData(currency, currentFrame);
    };

    return (
        <>
            <HeaderToolbar
                frames={Object.values(frameMap)}
                currency={currency}
                chartType={currChartType}
                frame={currentFrame}
                onChangeCurrency={handleChangeCurrency}
                onChangeFrame={handleChangeFrame}
                onChangeChartType={handleChangeChartType}
            />
            {CurrentChart &&
            <CurrentChart ref={chartRef}/>
            }
        </>

    );
}

export default React.memo(RealtimeChart);