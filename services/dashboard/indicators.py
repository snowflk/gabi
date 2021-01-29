def RSI(price_col, length=14):
    """
    Calculate the Relative Strength Index
    :param price_col: A series of prices
    :param length: Window length
    :return: A series of RSI
    """
    delta = price_col.diff()
    dup, ddown = delta.copy(), delta.copy()
    dup[dup < 0] = 0
    ddown[ddown > 0] = 0
    rolup = dup.rolling(length).mean()
    roldown = ddown.abs().rolling(length).mean()
    rs = rolup / roldown
    return 100.0 - (100.0 / (1.0 + rs))


def MACD(price_col, fast=12, slow=29, smoothing=9):
    """
    Moving Average Convergence Divergence indicator
    :param price_col: A series of prices
    :param fast: Fast length
    :param slow: Slow length
    :param smoothing: Signal smoothing
    :return:
    """
    exp1 = price_col.ewm(span=fast, adjust=False).mean()
    exp2 = price_col.ewm(span=slow, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=smoothing, adjust=False).mean()
    return macd, signal


def bollinger_bands(price_col, length=20, std=1.96):
    """
    Calculate Bollinger Bands
    :param price_col: A series of prices
    :param length: Window length
    :param std: Standard deviation
    :return: A 3-tuple (upper band, mid, lower band)
    """
    mid = price_col.rolling(window=length).mean()
    upper = mid + std * price_col.rolling(window=length).std()
    lower = mid - std * price_col.rolling(window=length).std()
    return upper, mid, lower
