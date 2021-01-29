FROM python:3.7-alpine

RUN pip3 install kafka-python
RUN pip3 install tweepy

WORKDIR /app

COPY . /app

#ENV TOPIC="tweet"
#ENV KAFKA="localhost:9092"
#ENV DEBUG="y"

ENTRYPOINT ["python3", "tweet-crawler.py"]
