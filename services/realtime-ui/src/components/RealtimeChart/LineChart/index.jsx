import React, {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {createChart} from 'lightweight-charts';
import BaseChart from "../BaseChart";
import config from "../config";
import moment from "moment";


const LineChart = forwardRef((props, ref) => {
    const chartContainerRef = useRef();
    const [areaSeries, setAreaSeries] = useState([]);
    const [predictionSeries, setPredictionSeries] = useState([]);

    const chart = useRef();

    useImperativeHandle(ref, () => ({
        updateData(price) {
            areaSeries.update({
                time: price.time,
                value: price.close
            })
        },
        setData(data) {
            areaSeries.setData(data.map(d => ({time: d.time, value: d.close})));
        },
        updatePrediction(data) {
            predictionSeries.update(data);
        },
        setPrediction(data) {
            predictionSeries.setData(data);
        },
        reset() {

        }
    }));

    useEffect(() => {
        chart.current = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
            timeScale: {
                // timeVisible: true,
                // secondsVisible: false,

                // tickMarkFormatter: (time) => {
                    // console.log('time', time)
                    //     //const date = new Date(time.year, time.month, time.day);
                    //     //return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
//                    return moment(time).utc().format("HH:mm:ss")
//                     return `${time}`

                // },
                borderColor: '#485c7b',
            },
            ...config.general,
        });

        const areaSeries = chart.current.addAreaSeries({
            ...config.area
        });

        const predictionSeries = chart.current.addLineSeries({
            ...config.prediction
        });

        areaSeries.setData([]);
        setAreaSeries(areaSeries);

        predictionSeries.setData([]);
        setPredictionSeries(predictionSeries);

    }, []);


    return (
        <BaseChart chartRef={chart} containerRef={chartContainerRef}>
        </BaseChart>

    );
});

export default LineChart;