import pandas as pd
import numpy as np

import datetime

import matplotlib.pyplot as plt

from argparse import ArgumentParser
parser = ArgumentParser()

# constants

SECONDS_IN_MINUTE = 60
SECONDS_IN_HOUR = 3600
SECONDS_IN_DAY = 86400
SECONDS_IN_WEEK = 604800
SECONDS_IN_YEAR = 31536000


def parseSettings():
    parser.add_argument("-asset", "--asset", type=str,
                        help="Asset for plotter (e.g. --asset rETH)", required=True)

    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    ASSET = args["asset"]

    # lookback windows in seconds (five entries)
    LOOKBACK_WINDOWS = [1 * SECONDS_IN_HOUR, 6 * SECONDS_IN_HOUR,
                        24 * SECONDS_IN_HOUR, 7 * SECONDS_IN_DAY, 3 * 7 * SECONDS_IN_DAY]
    LOOKBACK_WINDOW_LABELS = [
        "1 hour", "6 hours", "1 day", "1 week", "3 weeks"]

    # how frequent the apy should be (in seconds)
    APY_FREQUENCY = 5 * SECONDS_IN_MINUTE

    # apy limits for plots
    APY_LIMITS = [0, 0.1]

    return ASSET, LOOKBACK_WINDOWS, LOOKBACK_WINDOW_LABELS, APY_FREQUENCY, APY_LIMITS


def getPreparedRNIData(df_input, e_format=False):
    # copy data
    df = df_input.copy()

    # ``liquidity index`` is de-scaled (by 10**27)
    floating_rni = []
    for rni in df["rate"]:
        float_rni = rni if e_format else rni[:-27] + "." + rni[-27:]
        floating_rni.append(float(float_rni))

    df["rate"] = np.array(floating_rni)

    # return the prepared dataframe
    return df


def getRateAt(df_rni, at, check_increasing=False):
    if check_increasing:
        if not df_rni["timestamp"].is_monotonic_increasing:
            raise Exception("RNI DF dates are not increasing")

    closest = df_rni["timestamp"].searchsorted(at, side='right') - 1

    if closest + 1 < len(df_rni["timestamp"]):
        t_a = df_rni["timestamp"][closest]
        v_a = df_rni["rate"][closest]

        t_b = df_rni["timestamp"][closest+1]
        v_b = df_rni["rate"][closest+1]

        if not t_a <= at <= t_b or not v_a <= v_b:
            raise Exception("Incorrect interpolation")

        v_timestamp = ((t_b - at) * v_a + (at - t_a) * v_b) / (t_b - t_a)

        return v_timestamp
    else:
        raise Exception("Trying to get rate at an out-of-bounds timestamp")

# """
#    This function returns the rate between two timestamps.
#    It requires a prepared DataFrame.
# """


def getRateFromTo(df_rni, start, end):
    if start > end:
        raise Exception("Invalid dates (start > end)")

    start_rate = getRateAt(df_rni, start)
    end_rate = getRateAt(df_rni, end)

    return end_rate / start_rate - 1

# """
#    This function returns the apy between two timestamps.
#    It requires a prepared DataFrame.
# """


def getApyFromTo(df_rni, start, end):
    rate = getRateFromTo(df_rni, start, end)

    apy = pow(1 + rate, SECONDS_IN_YEAR / (end - start)) - 1

    return apy

# """
#    This function returns the rate between two timestamps.
# """


def getDailyApy(df, lookback, frequency):

    start_range = int(df["timestamp"][0]) + lookback + 1
    end_range = (int(df["timestamp"][len(df["timestamp"]) - 1]))

    print("Creating a dataset between {0} and {1}.".format(datetime.datetime.utcfromtimestamp(
        start_range), datetime.datetime.utcfromtimestamp(end_range)))

    if start_range > end_range:
        raise Exception("The dates do not overlap between datasets")

    dates = []
    apys = []
    for date in range(start_range, end_range+1, frequency):
        dates.append(date)

        apys.append(getApyFromTo(df, date - lookback, date))

    df_apy = pd.DataFrame()
    df_apy["timestamp"] = dates
    df_apy["apy"] = apys

    return df_apy


def getDatasets():
    df_input = pd.read_csv("historicalData/{0}.csv".format(ASSET))

    rnis = getPreparedRNIData(df_input, False)
    apys = [getDailyApy(rnis, lookback=lookback, frequency=APY_FREQUENCY)
            for lookback in LOOKBACK_WINDOWS]

    return rnis, apys


def plot(rnis, apys):
    fig, axs = plt.subplots(2, 3)
    fig.set_size_inches(20, 6)
    fig.suptitle("Historical data for {0}".format(ASSET))
    fig.canvas.manager.set_window_title(
        "Historical data for {0}".format(ASSET))

    axs[0, 0].set_title("Raw rates")
    axs[0, 0].set_xticks(
        [rnis["timestamp"][0], rnis["timestamp"][len(rnis["timestamp"]) - 1]])
    axs[0, 0].set_xticklabels([datetime.date.fromtimestamp(
        rnis["timestamp"][0]), datetime.date.fromtimestamp(rnis["timestamp"][len(rnis["timestamp"]) - 1])])
    axs[0, 0].plot(rnis["timestamp"], rnis["rate"])

    indices = [[0, 0, 1], [1, 0, 2], [2, 1, 0], [3, 1, 1], [4, 1, 2]]

    for [t, i, j] in indices:
        start_timestamp = apys[t]["timestamp"][0]
        end_timestamp = apys[t]["timestamp"][len(apys[t]["timestamp"]) - 1]

        axs[i, j].set_title("APY over {0}".format(LOOKBACK_WINDOW_LABELS[t]))

        axs[i, j].set_xticks([start_timestamp, end_timestamp])
        axs[i, j].set_xticklabels([datetime.date.fromtimestamp(
            start_timestamp), datetime.date.fromtimestamp(end_timestamp)])

        axs[i, j].set_ylim(APY_LIMITS)

        yticks = [i for i in np.linspace(APY_LIMITS[0], APY_LIMITS[1], 6)]
        axs[i, j].set_yticks(yticks)
        axs[i, j].set_yticklabels(
            ['{0}%'.format(int(100 * i)) for i in yticks])

        axs[i, j].plot(apys[t]["timestamp"], apys[t]["apy"])

    fig.tight_layout()
    plt.savefig("historicalData/{0}.jpg".format(ASSET))
    plt.show()


def plotOneHourApys():
    df_input = pd.read_csv("historicalData/{0}.csv".format(ASSET))
    rnis = getPreparedRNIData(df_input, False)

    true_apys = getDailyApy(rnis, lookback=86400, frequency=23000)
    current_rate_oracles_apy = pd.read_csv(
        "historicalData/rateOracleData/0x1dEa21b51CfDd4c62cB67812D454aBE860Be24A2.csv")
    new_rate_oracles_apy = pd.read_csv(
        "historicalData/rateOracleData/0xa513E6E4b8f2a923D98304ec87F64353C4D5C853.csv")

    start_timestamp = max(true_apys["timestamp"][0], current_rate_oracles_apy["timestamp"][0], new_rate_oracles_apy["timestamp"][0]) 
    end_timestamp = min(true_apys["timestamp"][len(true_apys["timestamp"]) - 1], current_rate_oracles_apy["timestamp"][len(current_rate_oracles_apy["timestamp"]) - 1], new_rate_oracles_apy["timestamp"][len(new_rate_oracles_apy["timestamp"]) - 1])

    plt.title("APY over one hour")

    plt.xlim([start_timestamp, end_timestamp])

    plt.xticks([start_timestamp, end_timestamp], [datetime.date.fromtimestamp(
        start_timestamp), datetime.date.fromtimestamp(end_timestamp)])

    plt.ylim(APY_LIMITS)

    yticks = [i for i in np.linspace(APY_LIMITS[0], APY_LIMITS[1], 6)]
    plt.yticks(yticks, ['{0}%'.format(int(100 * i)) for i in yticks])

    plt.plot(true_apys["timestamp"], true_apys["apy"])
    plt.plot(current_rate_oracles_apy["timestamp"], current_rate_oracles_apy["apy"])
    plt.plot(new_rate_oracles_apy["timestamp"], new_rate_oracles_apy["apy"])
    
    plt.legend(["True APYs (Risk Engine)", "Current (mainnet) Rocket Rate Oracle", "Newly developed Rocket Rate Oracle"])
    plt.show()


def formatHistoricalRates():
    df_input = pd.read_csv("historicalData/{0}.csv".format(ASSET))
    for i in range(0, len(df_input["timestamp"])):
        print("[{0}, \"{1}\"],".format(df_input["timestamp"][i], df_input["rate"][i]))


def plotRnis(rnis):
    rocket_rni = pd.read_csv("historicalData/0xa513E6E4b8f2a923D98304ec87F64353C4D5C853.csv")
    rocket_rni = getPreparedRNIData(rocket_rni)

    print(rocket_rni)

    plt.xlim([rocket_rni["timestamp"][0], rocket_rni["timestamp"][len(rocket_rni["timestamp"]) - 1]])
    plt.plot(rocket_rni['timestamp'], rocket_rni['rate'], 'ro')
    plt.plot(rnis['timestamp'], rnis['rate'], 'g+')
    plt.show()

ASSET, LOOKBACK_WINDOWS, LOOKBACK_WINDOW_LABELS, APY_FREQUENCY, APY_LIMITS = parseSettings()
rnis, apys = getDatasets()
# plot(rnis, apys)

plotOneHourApys()

# plotRnis(rnis)

# formatHistoricalRates()