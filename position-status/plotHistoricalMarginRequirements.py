import json
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

from argparse import ArgumentParser

parser = ArgumentParser()

def parseSettings():
    parser.add_argument("-pool", "--pool", type=str,
                        help="Pool name as in poolAddresses/mainnet.json", required=True)
    parser.add_argument("-owner", "--owner", type=str,
                        help="Owner address", required=True)
    parser.add_argument("-tickLower", "--tickLower", type=str,
                        help="Lower tick of position", required=True)
    parser.add_argument("-tickUpper", "--tickUpper", type=str,
                        help="Upper tick of position", required=True)
    args = dict((k, v)
                for k, v in vars(parser.parse_args()).items() if v is not None)

    return args["pool"], args["owner"], args["tickLower"], args["tickUpper"]

pool, owner, tickLower, tickUpper = parseSettings()

ID = "{0}#{1}#{2}#{3}".format(pool, owner.lower(), tickLower, tickUpper)

df = pd.read_csv("position-status/data/{0}/progress.csv".format(ID))

plt.plot(df["timestamp"], df["position_margin"])
plt.plot(df["timestamp"], df["position_requirement_liquidation"])
plt.plot(df["timestamp"], df["position_requirement_safety"])
plt.savefig("position-status/data/{0}/requirements.jpg".format(ID))