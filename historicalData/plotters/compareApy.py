import pandas as pd
import numpy as np

import datetime

import matplotlib.pyplot as plt

from argparse import ArgumentParser

from utils import getPreparedRNIData, getDailyApy
parser = ArgumentParser()


def parseSettings():
    parser.add_argument("-asset", "--asset", type=str,
                        help="Asset for plotter (e.g. --asset rETH)", required=True)

    parser.add_argument("-lw", "--lookback-window", type=int,
                        help="Lookback window that was used for getting apy in rate oracle", required=True)

    parser.add_argument("-freq", "--samping-frequency", type=int,
                        help="Sampling Frequency", default=2300)
    
    parser.add_argument("-ro", "--rate-oracle-address", type=str, help="Rate Oracle address for comparison", required=True)

    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    # apy limits for plots
    APY_LIMITS = [0, 0.1]

    return args["asset"], args["rate_oracle_address"], args["lookback_window"], args["samping_frequency"], APY_LIMITS


def compareApys(lookback_window, frequency):
    df_input = pd.read_csv("historicalData/rates/{0}.csv".format(ASSET))
    rnis = getPreparedRNIData(df_input, False)

    true_apys = getDailyApy(rnis, lookback=lookback_window, frequency=frequency)
    rate_oracle_apy = pd.read_csv(
        "historicalData/rateOracleApy/{0}.csv".format(RATE_ORACLE_ADDRESS))

    start_timestamp = max(true_apys["timestamp"][0], rate_oracle_apy["timestamp"][0]) 
    end_timestamp = min(true_apys["timestamp"][len(true_apys["timestamp"]) - 1], rate_oracle_apy["timestamp"][len(rate_oracle_apy["timestamp"]) - 1])

    plt.title("APY over {0}s".format(LOOKBACK_WINDOW))

    plt.xlim([start_timestamp, end_timestamp])

    plt.xticks([start_timestamp, end_timestamp], [datetime.date.fromtimestamp(
        start_timestamp), datetime.date.fromtimestamp(end_timestamp)])

    plt.ylim(APY_LIMITS)

    yticks = [i for i in np.linspace(APY_LIMITS[0], APY_LIMITS[1], 6)]
    plt.yticks(yticks, ['{0}%'.format(int(100 * i)) for i in yticks])

    plt.plot(true_apys["timestamp"], true_apys["apy"])
    plt.plot(rate_oracle_apy["timestamp"], rate_oracle_apy["apy"])
    
    plt.legend(["True APYs (Risk Engine)", "Rate oracle APYs"])
    plt.show()


ASSET, RATE_ORACLE_ADDRESS, LOOKBACK_WINDOW, SAMPLING_FREQUENCY, APY_LIMITS = parseSettings()

compareApys(lookback_window = LOOKBACK_WINDOW, frequency = SAMPLING_FREQUENCY)