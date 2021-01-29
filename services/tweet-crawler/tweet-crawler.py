import os
from kafka import KafkaProducer
from tweepy import Stream, OAuthHandler
from tweepy.streaming import StreamListener

consumer_key = "nkoqHvi3YvpMikHG0WFBF6zha"  # api key
consumer_secret = 'FFKZxArzlSgXecI7PuHj1VzX7TVBSR5gNrngjFB2oS3lUXVJyL'  # api secret key
access_token = '2514597780-Nb00AN9uBodQPk4UIaV9VTgZWunmESlqZPQOvsT'
access_token_secret = 'yq9eqnYywHEDbleKlKTOBAm4ZeEEPl92quxkBzoQ439MA'

hashtag = '#eurusd'
topic = os.environ['TOPIC']
kafka = os.environ['KAFKA']
debug = os.environ['DEBUG']


def print_debug(s):
    if debug == 'y':
        print(s)


class StdOutListener(StreamListener):
    def on_data(self, data):
        print_debug('Receving data and publishing data to {}'.format(topic))
        print_debug(type(data))
        producer.send(topic, data)
        return True

    def on_error(self, status):
        print (status)


auth = OAuthHandler(consumer_key, consumer_secret)
auth.set_access_token(access_token, access_token_secret)
producer = KafkaProducer(bootstrap_servers=[kafka], value_serializer=lambda x: x.encode('utf-8'))
l = StdOutListener()
stream = Stream(auth, l)
stream.filter(track=hashtag)
