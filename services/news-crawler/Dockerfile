FROM python:3.7-alpine
RUN apk update && apk add --virtual build-dependencies build-base gcc libffi-dev libxml2-dev libxslt-dev openssl-dev make
RUN pip3 install kafka-python
RUN pip3 install scrapy
RUN pip3 install twisted
RUN pip3 install w3lib
RUN pip3 install python-dateutil
WORKDIR /app

COPY . /app

ENTRYPOINT ["python3", "main.py"]
