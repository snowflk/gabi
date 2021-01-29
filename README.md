# GABI - Forex

This repository contains code and documentation for our project in DAD course WS2021

## Table of contents
- [GABI - Forex](#gabi---forex)
    + [Architecture](#architecture)
    + [Development](#development)
    + [Preparation](#preparation)
      - [Price crawler](#price-crawler)
    + [Deployment](#deployment)

## Architecture
![](docs/arch.png)

## Development
We use `docker-compose` for local development environment
```bash
cd deployment
docker-compose up
```

## Preparation

### Price crawler
1. You need a FXCM Demo account. You can apply for a demo account here: https://www.fxcm.com/uk/forex-trading-demo/
2. Generate a persistent token. Go to https://tradingstation.fxcm.com, login, then click on `User Account > Token Management`.
3. Set your token as environment variable `FXCM_TOKEN` in `deployment/docker-compose.yml`


## Deployment
WIP.