import dash
import dash_core_components as dcc
import dash_html_components as html
import plotly.express as px
import plotly.graph_objects as go
import os
import pandas as pd
from datetime import datetime
from indicators import *
external_stylesheets = []

app = dash.Dash(__name__, external_stylesheets=external_stylesheets)

colors = {
    'background': '#ffffff',
    'text': '#333333'
}

def select_range(df,start,stop):
    return df[(df['time'] >= start) & (df['time'] <= stop)]

rootdir = '/Users/tran/Documents'
period_name = 'H1'
period_in_secs = 60*60
price_file = os.path.join(rootdir, f'import_EURUSD_{period_name}.csv')
news_file = os.path.join(rootdir, 'reuters_news.tsv')
price_key = 'closeBid'
# Read candlesticks
df = pd.read_csv(price_file)
df['time_aligned'] = pd.to_datetime(df['ts'] - df['ts']%period_in_secs, unit='s')
df['time'] = pd.to_datetime(df['ts'], unit='s')
df = df.drop(['_id','ts'], axis=1)
df = df.sort_values('time', axis=0, ascending=True)
df = df.drop_duplicates()
df = df.set_index('time_aligned')
# Select datetime range
start = datetime.strptime('07/12/2020 00:00:00', '%d/%m/%Y %H:%M:%S')
stop = datetime.strptime('20/12/2020 23:59:59', '%d/%m/%Y %H:%M:%S')
df = select_range(df, start, stop)


df['bbupper'], df['bbmid'], df['bblower'] = bollinger_bands(df[price_key])
data = [
    go.Candlestick(x=df.index,
                    open=df['openBid'],
                    high=df['highBid'],
                    low=df['lowBid'],
                    close=df['closeBid']),
    go.Scatter(x=df.index, y=df['bbmid'], mode='lines'),
    go.Scatter(x=df.index, y=df['bbupper'], mode='lines'),
    go.Scatter(x=df.index, y=df['bblower'], mode='lines'),
]

fig = go.Figure(data=data)

app.layout = html.Div(style={'backgroundColor': colors['background']}, children=[
    html.H1(
        children='Hello Dash',
        style={
            'textAlign': 'center',
            'color': colors['text']
        }
    ),

    html.Div(children='Dash: A web application framework for Python.', style={
        'textAlign': 'center',
        'color': colors['text']
    }),

    dcc.Graph(
        id='candlesticks',
        figure=fig,
        style={'height': '800px'},
    ),
    dcc.Graph(
        id='example-graph-2',
        figure=fig,
        style={'height': '100px'},
    ),
])

if __name__ == '__main__':
    app.run_server(debug=True)
