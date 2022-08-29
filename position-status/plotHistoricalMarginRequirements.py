import json
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

from argparse import ArgumentParser

parser = ArgumentParser()

def parseSettings():
    parser.add_argument("-ID", "--ID", type=str,
                        help="ID of the position", required=True)
    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    return args["ID"]

ID = parseSettings()

df = pd.read_csv("position-status/data/{0}/progress.csv".format(ID))

plt.plot(df["timestamp"], df["position_margin"])
plt.plot(df["timestamp"], df["position_requirement_liquidation"])
plt.plot(df["timestamp"], df["position_requirement_safety"])
plt.legend(["Margin, Liquidation threshold, Safety threshold"])
plt.savefig("position-status/data/{0}/requirements.jpg".format(ID))