import React, {useEffect, useState} from 'react';
import Message from "./Message";
import "./styles.css"
import eventBus from "../../services/eventBus";


function SystemMessagePanel() {
    const [messages, setMessages] = useState([]);
    useEffect(()=>{
        eventBus.on('system_msg', (msg) => {
            setMessages(msgs => [...msgs, msg])
        })
    }, [])
    return (
        <div className='messages-panel-wrapper'>
            <div className='messages-header'>System messages</div>
            <div className='messages-list'>
                {
                    messages.map(msg =>
                        <Message
                            key={msg.timestamp}
                            timestamp={msg.timestamp}
                            msg={msg.message}
                        />)
                }
            </div>

        </div>
    )
}

export default SystemMessagePanel;