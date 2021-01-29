import React, {useEffect, useState} from 'react'
import FeedItem from "./FeedItem";
import './styles.css';
import {getNews} from "../../services/historicalData";

function NewsFeed() {
    const [news, setNews] = useState([]);
    useEffect(() => {
        getNews('EURUSD', 0, 20).then(res => {
            const news = res.map(item => {
                return {
                    id: item._id,
                    title: item.title,
                    content: item.summary.substr(0, 200),
                    link: item.url,
                    source: item.source,
                    created_at: item.time * 1000
                }
            });
            setNews(news);
        })
    }, []);
    return (
        <div style={{height: '100%'}}>
            <div className='title-wrapper'>
                <div className='title'>Headlines</div>
            </div>
            <div className='feed-list'>
                <ul>
                    {news.map((item, idx) =>
                        <FeedItem key={idx} item={item}/>
                    )}
                </ul>
            </div>
        </div>
    )
}

export default NewsFeed;