import os.path
import flask
import numpy as np
from keras.models import load_model
import keras.backend as K
import joblib
import pandas as pd

app = flask.Flask(__name__)
SYMBOLS = ["EURUSD"]
FRAMES = ["m1", "m30", "H1"]
models = {}
scalers = {}


def root_mean_squared_error(y_true, y_pred):
    return K.sqrt(K.mean(K.square(y_pred - y_true)))


def load_local_model(model_name):
    model = None
    if os.path.exists(model_name):
        model = load_model(model_name, compile=False)
        model.compile(optimizer='adam', loss=root_mean_squared_error)
    return model


def df_to_x(df, Np=10):
    Nf = 1  # future ticks
    X = []
    # transform each training record
    dfd = np.array(df)
    mid = (dfd[-1][3] + dfd[-1][0]) / 2
    dfd[:, :-4] = (dfd[:, :-4] - mid)
    dfd[:, :-1] = dfd[:, :-1] * 100000
    for idx, xi in enumerate(dfd):
        xii = np.array(xi)
        X.append(xii)
    return np.array(X)


def find_prediction(prices, model, scaler):
    x = df_to_x(prices)
    x = scaler.transform(x).reshape(-1, 10, 10)
    out = model.predict(x)
    diff = scaler.inverse_transform(out.repeat(10, axis=1))[0][3]
    mid = (prices[-1][3] + prices[-1][0]) / 2
    return round(mid + (round(diff) / 100000), 5)


for symbol in SYMBOLS:
    for frame in FRAMES:
        if symbol not in models:
            models[symbol] = {}
        if symbol not in scalers:
            scalers[symbol] = {}
        models[symbol][frame] = load_local_model("{}_{}.h5".format(symbol, frame))
        scalers[symbol][frame] = joblib.load("scaler_{}_{}.pkl".format(symbol, frame))


@app.route("/predict", methods=['POST'])
def predict():
    # get the request parameters
    params = flask.request.get_json(force=True)

    # if parameters are found, echo the msg parameter
    if params is not None:
        try:
            symbol = params["symbol"]
            frame = params["frame"]
            open_bids = params['o']
            high_bids = params['h']
            low_bids = params['l']
            close_bids = params['c']
            tsx = params['tsx']
        except:
            return '-1', 500

        if open_bids == None or len(open_bids) < 60:
            return '-1', 500
        df = pd.DataFrame.from_dict(
            {'openBid': open_bids, 'highBid': high_bids, 'lowBid': low_bids, 'closeBid': close_bids})
        key = 'closeBid'
        df = df[['openBid', 'highBid', 'lowBid', 'closeBid']]
        df.loc[:, 'bbmid'] = df[key].rolling(window=21).mean()
        df.loc[:, 'bbupper'] = df['bbmid'] + 1.96 * df[key].rolling(window=21).std()
        df.loc[:, 'bblower'] = df['bbmid'] - 1.96 * df[key].rolling(window=21).std()
        df.loc[:, 'bbwidth'] = df['bbupper'] - df['bblower']

        df.loc[:, 'body'] = df['closeBid'] - df['openBid']
        df.loc[:, 'cosign'] = (df['closeBid'] - df['openBid'] > 0).astype(int)
        df.loc[:, 'down'] = (df[['closeBid', 'openBid']].min(axis=1) - df['lowBid'])
        df.loc[:, 'up'] = (df['highBid'] - df[['closeBid', 'openBid']].max(axis=1))

        rsi_n = 14
        df.loc[:, 'delta'] = df['closeBid'].diff()
        df = df.copy().iloc[1:]
        dup, ddown = df['delta'].copy(), df['delta'].copy()
        dup[dup < 0] = 0
        ddown[ddown > 0] = 0
        rolup = dup.rolling(rsi_n).mean()
        roldown = ddown.abs().rolling(rsi_n).mean()
        rs = rolup / roldown
        df.loc[:, 'rsi'] = 100.0 - (100.0 / (1.0 + rs))
        df = df.copy().iloc[21:]
        df.loc[df.rsi.isna(), 'rsi'] = 100

        # reorder columns
        df = df[['openBid',
                 'highBid',
                 'lowBid',
                 'closeBid',
                 'bbupper',
                 'bblower',
                 'body',
                 'up',
                 'down',
                 'rsi']]

        # sdf = df.iloc[-11:-1]
        # x = []
        # for v in zip(open_bids, high_bids, low_bids, close_bids):
        #     x.append(v)
        # x = np.array(x)
        # d = np.diff(x[:, 3]) * 1000
        # x = x[1:]
        # print(x, flush=True)
        # with open('fk_{}.json'.format(tsx[-1]), 'w') as f:
        #     json.dump(params, f)
        if symbol in models and models[symbol][frame] is not None and \
                symbol in scalers and scalers[symbol][frame] is not None:
            sdf = df.iloc[-11:-1]
            prices = sdf.values
            prediction = find_prediction(prices, models[symbol][frame], scalers[symbol][frame])
            print("prediction", prediction, close_bids[-2:], flush=True)
            # x = scalers[symbol][frame].transform(x)
            # x = np.hstack([x, d.reshape(-1, 1)])
            # prediction = models[symbol][frame].predict(x.reshape(1, 10, 5))
            # print('prediction: {}'.format(round(prediction[0][0] / 1000, 5)), flush=True)
            # print('last: {}'.format(float(close_bids_arr[-1]), flush=True))
            # print('final', str(round(prediction[0][0] / 1000 + float(close_bids_arr[-1]), 5)), flush=True)
            return str(prediction), 200
    return '-1', 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True)
