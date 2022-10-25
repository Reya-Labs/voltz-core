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


# ----------------------- EVENTS -----------------------
# events = [
#     (1661165520, None, 'LP Position initialised', None),
#     (1663482587, None, 'LP Position liquidated', 'r'),
#     (1662418800, 1662505199, 'Spike in borrow_aETH APY', 'y')
# ]

# for event, color in zip(events, plt.cm.rainbow(np.linspace(0, 1, 100))):
#     if event[1] is None:        # single point event   
#         ax.axvline(
#             x = dt.datetime.fromtimestamp(event[0]), 
#             color = color if (event[3] is None) else event[3],
#             label = event[1]
#         )
#     else:
#         ax.axvspan(
#             dt.datetime.fromtimestamp(event[0]), 
#             dt.datetime.fromtimestamp(event[1]), 
#             color = color if (event[3] is None) else event[3],
#             label = event[2],
#             alpha = 0.2, 
#         )

plt.legend()
plt.savefig(
    "position-status/data/{0}/requirements.png".format(ID), 
    bbox_inches = 'tight'
)