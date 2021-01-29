FROM node:10-alpine3.10

RUN apk add python3
WORKDIR /app

COPY . /app
RUN npm install

CMD ["npm", "start"]