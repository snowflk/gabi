import json
import csv
from datetime import timezone, datetime
import w3lib.html
import scrapy
# from kafka import KafkaProducer
import os
from scrapy.crawler import CrawlerRunner
from twisted.internet import reactor
import re
import dateutil.parser

from twisted.python.log import startLogging
from sys import stdout

startLogging(stdout)

# topic = os.environ['TOPIC']
# kafka = os.environ['KAFKA']
pages = 100
schedule = 100
symbol = 'EUR/USD'
SEP = '$$$$'


# producer = KafkaProducer(bootstrap_servers=[kafka],
#                         value_serializer=lambda x:
#                         json.dumps(x).encode('utf-8'))


class WSJSpider(scrapy.Spider):
    name = "wsj_news"
    last_crawl = None
    crawl_page = 0
    start_urls = []
    for i in range(pages):
        start_urls.append(
            'https://www.wsj.com/news/types/foreign-exchange?page={}'.format(i + 1))

    def __init__(self, news_callback=None, **kwargs):
        self.news_callback = news_callback
        super().__init__(**kwargs)

    def parse_news(self, response):
        """
        Get actual news text
        :param response:
        :return:
        """
        item = response.request.meta['item']

        content_dom = response.css('.ArticleBodyWrapper')[0]
        content = []
        for p in content_dom.css('p[class*="Paragraph-"]'):
            content.append(clean(p.extract()))
        summary = [content[0]]
        news_obj = {
            'title': item['title'],
            'url': item['url'],
            'time': dateutil.parser.parse(item['time']),
            'summary': SEP.join(summary),
            'content': SEP.join(content),
            'symbol': 'EURUSD',
            'source': 'Wall Street Journal',
        }

        # fullcontent = ' '.join(content)

        if self.news_callback is not None:
            self.news_callback(news_obj)

    def parse(self, response):
        """
        Parsing main page to get news title, date and url for further process
        :param response:
        :return:
        """
        print("PARSE")
        list_element = response.css('div#latest-stories')[0]
        print(list_element)
        articles = list_element.css('article')
        news = []
        for article in articles:
            title = article.css('h3::text')[0].get().strip()
            url = article.css('a::attr(href)')[0].get()
            data = {
                'title': title,
                'url':  url,
            }
            print(data)
            news.append(data)

        # Sort news from newest to oldest
        # news = sorted(news, key=lambda x: x['time'], reverse=True)
        #print('Receiving {} articles Sample {}'.format(len(news), news[0]))

        for item in news:
            yield scrapy.Request(url=item['url'], callback=self.parse_news, meta={'item': item})

        WSJSpider.last_crawl = datetime.now()
        WSJSpider.crawl_page = WSJSpider.crawl_page + 1
        print('Updating last crawler to {}'.format(WSJSpider.last_crawl))


def print_news(news):
    print("==========================================================")
    print()
    print("Title:", news['title'].upper())
    print("URL:", news['url'])
    print("Time:", news['time'])
    print("Timestamp:", news['time'].timestamp())
    print()
    print("Summary:", "\n" + '\n'.join(news['summary'].split(SEP)))
    print()
    for c in news['content'].split(SEP):
        print(c)
    print()
    print("==========================================================")


def clean(html_text, require_end=True):
    t = w3lib.html.replace_entities(w3lib.html.remove_tags(html_text))
    if require_end and re.match('[\d\w]', t[-1]):
        t += '.'
    return t


def start_crawling(callback):
    def schedule_next_crawl(null, sleep_time):
        """
        Schedule the next crawl
        """
        reactor.callLater(sleep_time, crawl)

    def crawl():
        """
        A "recursive" function that schedules a crawl 30 seconds after
        each successful crawl.
        """
        # crawl_job() returns a Deferred
        d = crawl_job()
        # call schedule_next_crawl(<scrapy response>, n) after crawl job is complete
        d.addCallback(schedule_next_crawl, 60 * schedule)

    def crawl_job():
        """
        Job to startBackgroundImport spiders.
        Return Deferred, which will execute after crawl has completed.
        """
        runner = CrawlerRunner()
        return runner.crawl(WSJSpider, news_callback=callback)

    crawl()
    reactor.run()


if __name__ == "__main__":
    f = open('wsj_news.tsv', 'w+')
    writer = csv.writer(f, delimiter='\t')
    writer.writerow(['title', 'url', 'time', 'summary', 'content'])
    cnt = 0

    def write_tsv(news):
        global cnt
        cnt += 1
        print(f'[{cnt}] Write news from', news['time'])
        writer.writerow([news['title'], news['url'], int(news['time'].timestamp()), news['summary'], news['content']])


    #start_crawling(write_tsv)
    start_crawling(print_news)
