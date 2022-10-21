import json
import matplotlib.pyplot as plt
import matplotlib.dates as md
import datetime as dt
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

fig, ax = plt.subplots(figsize=(20,7))

xfmt = md.DateFormatter('%Y-%m-%d %H:%M:%S')
ax.xaxis.set_major_formatter(xfmt)

dates=[dt.datetime.fromtimestamp(ts) for ts in df["timestamp"]]
plt.xticks([dates[i] for i in range(0, len(dates), 5)] , rotation=25)

ax.plot(dates, df["position_margin"], label = "Margin")
ax.plot(dates, df["position_requirement_liquidation"], label = "Liquidation threshold")
ax.plot(dates, df["position_requirement_safety"], label = "Safety threshold")


# ax.axvline(x = dt.datetime.fromtimestamp(1661165520), color = 'c', label = 'LP Position initialised')
# ax.axvline(x = dt.datetime.fromtimestamp(1663482587), color = 'r', label = 'LP Position liquidated')

# ax.axvline(x = dt.datetime.fromtimestamp(1661165520), color = 'c', label = 'Trader Position initialised')
# ax.axvline(x = dt.datetime.fromtimestamp(1663482587), color = 'r', label = 'Trader Position liquidated')
# ax.axvline(x = dt.datetime.fromtimestamp(1662105355), color = 'pink', label = 'FT from now onwards')


# ax.axvspan(
#     dt.datetime.fromtimestamp(1662418800), 
#     dt.datetime.fromtimestamp(1662505199), 
#     alpha=0.2, 
#     color='red',
#     label='Spike in borrow_aETH APY'
# )

# ax.axvspan(
#     dt.datetime.fromtimestamp(1662850800), 
#     dt.datetime.fromtimestamp(1663282799), 
#     alpha=0.2, 
#     color='red',
#     label='Spike in borrow_aETH APY'
# )

# ax.axvspan(
#     dt.datetime.fromtimestamp(1661165520), 
#     dt.datetime.fromtimestamp(1662190800), 
#     alpha=0.2, 
#     color='orange',
#     label='LP Position active'
# )

plt.legend()

plt.savefig("position-status/data/{0}/requirements.png".format(ID), bbox_inches = 'tight')