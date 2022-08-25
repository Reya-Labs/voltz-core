import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

from argparse import ArgumentParser

parser = ArgumentParser()

def parseSettings():
    parser.add_argument("-pools", "--pools", type=str,
                        help="Comma-separated pool names as in poolAddresses/mainnet.json", required=True)
    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    return args["pools"].split(",")

pools = parseSettings()

for pool in pools:

    df = pd.read_csv("position-status/data/analysis_{0}.csv".format(pool))

    a = np.array(df["init_delta"])
    len_a = len(a)
    a = a[a != np.inf]
    a = a[a < 0]

    b = np.array(df["liq_delta"])
    len_b = len(b)
    b = b[b != np.inf]
    b = b[b < 0]

    fig, (ax1, ax2) = plt.subplots(2)

    ax1.hist(a, bins=20)
    ax1.set_xticks(ticks = [-1, -0.8, -0.6, -0.4, -0.2, 0], labels = ["-100%", "-80%", "-60%", "-40%", "-20%", "0%"])
    ax1.legend(["Initial abs. diff. {0}".format(pool)])
    ax2.hist(b, bins=20, color="#ff7f0e")
    ax2.set_xticks(ticks = [-1, -0.8, -0.6, -0.4, -0.2, 0], labels = ["-100%", "-80%", "-60%", "-40%", "-20%", "0%"])
    ax2.legend(["Liquidation abs. diff. {0}".format(pool)])

    plt.savefig("position-status/data/analysis_{0}.jpg".format(pool))
    plt.clf()