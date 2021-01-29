import dateutil.parser
import json
import os
import re
import scrapy
import w3lib.html
from datetime import timezone, datetime
from kafka import KafkaProducer
from scrapy.crawler import CrawlerRunner
from twisted.internet import reactor

topic = os.environ['TOPIC']
kafka = os.environ['KAFKA']
pages = 10
schedule = 10
symbol = 'EUR/USD'
SEP = '\n'

print("Connecting to", topic, kafka)
producer = KafkaProducer(bootstrap_servers=[kafka],
                         value_serializer=lambda x:
                         json.dumps(x).encode('utf-8'))
print("Connected to", topic, kafka)


class NewsSpider(scrapy.Spider):
    name = "news"
    start_urls = []
    last_crawl = None
    crawl_page = 0

    for i in range(pages):
        start_urls.append('https://www.dailyfx.com/market-news/articles/{}'.format(i + 1))

    #
    #
    def get_text_of_the_article(self, response):
        """
        Get actual news text and send to kafka
        :param response:
        :return:
        """
        item = response.request.meta['item']

        contentDom = response.css('.dfx-articleBody__content')[0]
        summary = [clean(li.extract()) for li in contentDom.css('ul.gsstx')[0].css('li')]
        content = []
        for p in contentDom.css('p.gsstx'):
            styles = p.xpath("@style").extract()
            style = '' if len(styles) == 0 else styles[0]
            # ignore chart titles, sources
            if 'bold' in style or 'italic' in style:
                continue
            content.append(clean(p.extract()))

        articleTimeDom = response.css('.dfx-articleHead__displayDate')[0]
        articleTime = dateutil.parser.parse(articleTimeDom.xpath("@data-time").extract()[0])

        news_obj = {
            'title': item['title'],
            'url': item['url'],
            'time': articleTime.timestamp(),
            'summary': SEP.join(summary),
            'content': SEP.join(content),
            'symbol': 'EURUSD',
            'source': 'DailyFX',
        }

        if False:
            print_news(news_obj)

        producer.send(topic, news_obj)
        print('Publishing to kafka.....Time....{} Title ..... {}'.format(item['time'], item['title']))

    def parse(self, response):
        """
        Parsing main page to get news title, date and url for further process
        :param response:
        :return:
        """
        # print('Crawling these pages {} at timestamp {}'.format(self.start_urls, datetime.now()))
        list_element = response.css('div.dfx-articleList')
        articles = list_element.css("a")
        news = []
        for article in articles:
            title = article.css('span::text')[0].get()
            time_str = article.css('span::text')[1].get().strip()
            time_reformat = int(
                datetime.strptime(time_str, '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc).timestamp())
            url = article.css('a::attr(href)')[0].get()
            if "fundamental/article" in url:
                continue
            data = {
                'title': title,
                'time': time_reformat,
                'url': url,
                'symbol': symbol.replace('/', ''),
                'source': 'DailyFX'
            }

            if data not in news:
                news.append(data)
        # Sort news from newest to oldest
        news = sorted(news, key=lambda x: x['time'], reverse=True)
        print('Receiving {} articles Sample {}'.format(len(news), news[0]))
        for item in news:
            # if NewsSpider.last_crawl is None or NewsSpider.crawl_page < pages:
            #    print('This is the first crawling. Last crawl is {} or number of pages have been crawled {}'
            #          .format(NewsSpider.last_crawl, NewsSpider.crawl_page))
            # elif item['time'] < NewsSpider.last_crawl:
            #    print('These news have already read the last time, skip all. Aborting crawling')
            #    break
            yield scrapy.Request(url=item['url'], callback=self.get_text_of_the_article, meta={'item': item})
        NewsSpider.last_crawl = datetime.now()
        NewsSpider.crawl_page = NewsSpider.crawl_page + 1
        print('Updating last crawler to {}'.format(NewsSpider.last_crawl))


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


def clean(htmltext, requireEnd=True):
    t = w3lib.html.replace_entities(w3lib.html.remove_tags(htmltext))
    if requireEnd and re.match('[\d\w]', t[-1]):
        t += '.'
    return t


def crawl_job():
    """
    Job to startBackgroundImport spiders.
    Return Deferred, which will execute after crawl has completed.
    """
    runner = CrawlerRunner()
    return runner.crawl(NewsSpider)


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


if __name__ == "__main__":
    print("Start")
    crawl()
    reactor.run()
