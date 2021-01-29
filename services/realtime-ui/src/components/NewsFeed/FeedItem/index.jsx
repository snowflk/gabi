import React from 'react';
import './styles.css';
import moment from "moment";

function FeedItem({item}) {

    return (
        <a href={item.link} target="_blank" rel="noopener noreferrer">
            <div className='news-title'>
                {item.title}
            </div>
            <div className='news-description'>
                {item.content}
            </div>
            <div className='news-footer'>
                <div className='source'>
                    from {item.source}
                </div>
                <div className='news-created_time'>
                    {moment(item.created_at).fromNow()}
                </div>
            </div>

        </a>
    )
}

export default FeedItem;