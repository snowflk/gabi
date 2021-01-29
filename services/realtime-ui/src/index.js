import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import {SocketProvider} from "./SocketProvider";
import {initSocket} from "./socket";

const socket = initSocket("http://localhost:3000");

ReactDOM.render(
    <SocketProvider socket={socket} >
        <App/>
    </SocketProvider>
    ,
    document.getElementById('root')
);

// If you want to startBackgroundImport measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
