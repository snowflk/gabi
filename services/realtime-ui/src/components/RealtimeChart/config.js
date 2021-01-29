import {CrosshairMode} from "lightweight-charts";


export default {
    general: {
        layout: {
            backgroundColor: '#253248',
            textColor: 'rgba(255, 255, 255, 0.9)',
        },
        localization: {
            priceFormatter: (v) => parseFloat(v).toFixed(5),
        },
        grid: {
            vertLines: {
                color: '#334158',
            },
            horzLines: {
                color: '#334158',
            },
        },
        crosshair: {
            mode: CrosshairMode.Normal,
        },
        priceScale: {
            borderColor: '#485c7b',
        },
        // timeScale: {
        //     borderColor: '#485c7b',
        // },
    },
    area: {
        topColor: 'rgba(38, 198, 218, 0.56)',
        bottomColor: 'rgba(38, 198, 218, 0.04)',
        lineColor: 'rgba(38, 198, 218, 1)',
        lineWidth: 2,
        crossHairMarkerVisible: false,
    },
    candlestick: {
        upColor: '#4bffb5',
        downColor: '#ff4976',
        borderDownColor: '#ff4976',
        borderUpColor: '#4bffb5',
        wickDownColor: '#838ca1',
        wickUpColor: '#838ca1',
    },
    prediction: {
        color: 'rgba(4,111,232,1)',
        lineWidth: 2,
    }
}