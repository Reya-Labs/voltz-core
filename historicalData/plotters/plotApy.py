import pandas as pd
import numpy as np

import datetime

import matplotlib.pyplot as plt

from utils import SECONDS_IN_DAY, SECONDS_IN_HOUR, SECONDS_IN_MINUTE, getDailyApy, getPreparedRNIData

from argparse import ArgumentParser
parser = ArgumentParser()


def parseSettings():
    parser.add_argument("-asset", "--asset", type=str,
                        help="Asset for plotter (e.g. --asset rETH)", default="aUSDC")
    parser.add_argument("-borrow", "--borrow", help="Is it a borrow market?", action='store_true', default=False)
    parser.add_argument("-linear", "--linear", help="Is it a linear rate?", action='store_true', default=False)

    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    ASSET = args["asset"]
    IS_BORROW = args["borrow"]
    IS_LINEAR = args["linear"]

    # lookback windows in seconds (six entries)
    LOOKBACK_WINDOWS = [1 * SECONDS_IN_MINUTE, 1 * SECONDS_IN_HOUR, 6 * SECONDS_IN_HOUR,
                        24 * SECONDS_IN_HOUR, 7 * SECONDS_IN_DAY, 3 * 7 * SECONDS_IN_DAY]
    LOOKBACK_WINDOW_LABELS = ["1 minute", "1 hour", "6 hours", "1 day", "1 week", "3 weeks"]

    # how frequent the apy should be (in seconds)
    APY_FREQUENCY = 5 * SECONDS_IN_MINUTE

    # apy limits for plots
    APY_LIMITS = [0, 1]

    return ASSET, IS_BORROW, IS_LINEAR, LOOKBACK_WINDOWS, LOOKBACK_WINDOW_LABELS, APY_FREQUENCY, APY_LIMITS


def getDatasets():
    prefix = "f"
    if (IS_BORROW): 
        prefix += "_borrow"
    file_name = "historicalData/rates/"+prefix+"_{0}.csv"
    df_input = pd.read_csv(file_name.format(ASSET))

    dataset_range_in_seconds = df_input.loc[:, "timestamp"].iloc[-1] - df_input.loc[:, "timestamp"].iloc[0]
    valid_lookback_windows = [lookback_window for lookback_window in LOOKBACK_WINDOWS if lookback_window < dataset_range_in_seconds]

    rnis = getPreparedRNIData(df_input, False)
    apys = [getDailyApy(rnis, lookback=lookback, frequency=APY_FREQUENCY, linear=IS_LINEAR)
            for lookback in valid_lookback_windows]
    # apy_df = pd.DataFrame(apys)
    # apy_df.to_csv("historicalData/rates/{0}_APY.csv".format(ASSET), index=False)

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
    axs[0, 0].plot(rnis["timestamp"], rnis["liquidityIndex"])

    indices = [[0, 0, 1], [1, 0, 2], [2, 1, 0], [3, 1, 1], [4, 1, 2]]

    indices = indices[:len(apys)]

    for [t, i, j] in indices:
        start_timestamp = apys[t]["timestamp"][0]
        end_timestamp = apys[t]["timestamp"][len(apys[t]["timestamp"]) - 1]

        axs[i, j].set_title("APY over {0}".format(LOOKBACK_WINDOW_LABELS[t]))

        axs[i, j].set_xticks([start_timestamp, end_timestamp])
        axs[i, j].set_xticklabels([datetime.date.fromtimestamp(
            start_timestamp), datetime.date.fromtimestamp(end_timestamp)])

        # 5 day granularity of date lables
        # axs[i, j].set_xticks(np.arange(start_timestamp,end_timestamp, 432000))
        # axs[i, j].set_xticklabels([datetime.date.fromtimestamp(i) for i in np.arange(start_timestamp,end_timestamp, 432000)],
        #     rotation=20, horizontalalignment = 'right')

        axs[i, j].set_ylim(APY_LIMITS)

        yticks = [i for i in np.linspace(APY_LIMITS[0], APY_LIMITS[1], 6)]
        axs[i, j].set_yticks(yticks)
        axs[i, j].set_yticklabels(
            ['{0}%'.format(int(100 * i)) for i in yticks])

        axs[i, j].plot(apys[t]["timestamp"], apys[t]["apy"])

    fig.tight_layout()
    plt.savefig("historicalData/rates/{0}.jpg".format(ASSET))
    plt.show()


ASSET, IS_BORROW, IS_LINEAR, LOOKBACK_WINDOWS, LOOKBACK_WINDOW_LABELS, APY_FREQUENCY, APY_LIMITS = parseSettings()
rnis, apys = getDatasets()
plot(rnis, apys)