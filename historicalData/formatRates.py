import pandas as pd

from argparse import ArgumentParser
parser = ArgumentParser()

def parseSettings():
    parser.add_argument("-asset", "--asset", type=str,
                        help="Asset for plotter (e.g. --asset rETH)", required=True)

    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    return args["asset"]

def formatHistoricalRates():
    df_input = pd.read_csv("historicalData/rates/{0}.csv".format(ASSET))
    for i in range(0, len(df_input["timestamp"])):
        print("[{0}, \"{1}\"],".format(df_input["timestamp"][i], df_input["rate"][i]))

ASSET = parseSettings()
formatHistoricalRates()