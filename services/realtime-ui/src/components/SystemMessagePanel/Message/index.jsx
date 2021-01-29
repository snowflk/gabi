import React from 'react';
import "./styles.css";
import moment from "moment";

function Message({msg, timestamp}) {
    return (
        <div className='message'>
            [{moment(timestamp).format("DD/MM/YYYY HH:mm:ss")}] {msg}
        </div>
    )
}

export default Message;