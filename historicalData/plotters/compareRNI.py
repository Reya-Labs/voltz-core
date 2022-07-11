import pandas as pd
import numpy as np

import matplotlib.pyplot as plt

from utils import getPreparedRNIData

from argparse import ArgumentParser
parser = ArgumentParser()

def parseSettings():
    parser.add_argument("-asset", "--asset", type=str,
                        help="Asset for plotter (e.g. --asset rETH)", required=True)
    
    parser.add_argument("-ro", "--rate-oracle-address", type=str, help="Rate Oracle address for comparison", required=True)

    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    return args["asset"], args["rate_oracle_address"]


def getDatasets():
    df_input = pd.read_csv("historicalData/rates/{0}.csv".format(ASSET))

    rnis = getPreparedRNIData(df_input, False)

    return rnis


def plotRnis(rnis):
    rocket_rni = pd.read_csv("historicalData/rateOracleRates/{0}.csv".format(RATE_ORACLE_ADDRESS))
    rocket_rni = getPreparedRNIData(rocket_rni)

    print(rocket_rni)

    # plt.xlim([rocket_rni["timestamp"][0] - 86400, rocket_rni["timestamp"][len(rocket_rni["timestamp"]) - 1] + 86400])
    plt.plot(rocket_rni['timestamp'], rocket_rni['rate'], 'ro')
    plt.plot(rnis['timestamp'], rnis['rate'], 'g+')
    plt.show()



ASSET, RATE_ORACLE_ADDRESS = parseSettings()
rnis = getDatasets()
plotRnis(rnis)