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

# topic = os.environ['TOPIC']
# kafka = os.environ['KAFKA']
pages = 1500
schedule = 100
symbol = 'EUR/USD'
SEP = '$$$$'


# producer = KafkaProducer(bootstrap_servers=[kafka],
#                         value_serializer=lambda x:
#                         json.dumps(x).encode('utf-8'))


class DailyFXSpider(scrapy.Spider):
    name = "dailyfx_news"
    last_crawl = None
    crawl_page = 0
    start_urls = []
    for i in range(pages):
        start_urls.append('https://www.dailyfx.com/market-news/articles/{}'.format(i + 1))

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

        content_dom = response.css('.dfx-articleBody__content')[0]
        summary = [clean(li.extract()) for li in content_dom.css('ul.gsstx')[0].css('li')]
        content = []
        for p in content_dom.css('p.gsstx'):
            styles = p.xpath("@style").extract()
            style = '' if len(styles) == 0 else styles[0]
            # ignore chart titles, sources
            if 'bold' in style or 'italic' in style:
                continue
            content.append(clean(p.extract()))

        time_dom = response.css('.dfx-articleHead__displayDate')[0]
        article_time = dateutil.parser.parse(time_dom.xpath("@data-time").extract()[0])

        news_obj = {
            'title': item['title'],
            'url': item['url'],
            'time': article_time,
            'summary': SEP.join(summary),
            'content': SEP.join(content),
            'symbol': 'EURUSD',
            'source': 'DailyFX',
        }

        fullcontent = ' '.join(content)

        if self.news_callback is not None and ('EUR/USD' in fullcontent or 'EURUSD' in fullcontent):
            self.news_callback(news_obj)

    def parse(self, response):
        """
        Parsing main page to get news title, date and url for further process
        :param response:
        :return:
        """
        list_element = response.css('div.dfx-articleList')
        articles = list_element.css("a")
        news = []
        for article in articles:
            title = article.css('span::text')[0].get()
            time_str = article.css('span::text')[1].get().strip()
            time_reformat = int(
                datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp())
            url = article.css('a::attr(href)')[0].get()
            if "fundamental" in url:
                continue
            data = {
                'title': title,
                'time': time_reformat,
                'url': url,
            }
            if data not in news:
                news.append(data)

        # Sort news from newest to oldest
        news = sorted(news, key=lambda x: x['time'], reverse=True)
        print('Receiving {} articles Sample {}'.format(len(news), news[0]))

        for item in news:
            item['f'] = f
            yield scrapy.Request(url=item['url'], callback=self.parse_news, meta={'item': item})

        DailyFXSpider.last_crawl = datetime.now()
        DailyFXSpider.crawl_page = DailyFXSpider.crawl_page + 1
        print('Updating last crawler to {}'.format(DailyFXSpider.last_crawl))


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
        return runner.crawl(DailyFXSpider, news_callback=callback)

    crawl()
    reactor.run()


if __name__ == "__main__":
    f = open('news.tsv', 'w+')
    writer = csv.writer(f, delimiter='\t')
    writer.writerow(['title', 'url', 'time', 'summary', 'content'])
    cnt = 0


    def write_tsv(news):
        global cnt
        cnt += 1
        print(f'[{cnt}] Write news from', news['time'])
        writer.writerow([news['title'], news['url'], int(news['time'].timestamp()), news['summary'], news['content']])


    start_crawling(write_tsv)
