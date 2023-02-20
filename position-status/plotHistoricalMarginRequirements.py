import matplotlib.pyplot as plt
import matplotlib.dates as md
import datetime as dt
import pandas as pd

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

df_mints = pd.read_csv("position-status/data/{0}/mints.csv".format(ID))
df_swaps = pd.read_csv("position-status/data/{0}/swaps.csv".format(ID))

fig, ax = plt.subplots(figsize=(20, 7))

xfmt = md.DateFormatter('%Y-%m-%d %H:%M:%S')
ax.xaxis.set_major_formatter(xfmt)

dates = [dt.datetime.fromtimestamp(ts) for ts in df["timestamp"]]
plt.xticks([dates[i] for i in range(0, len(dates), 5)], rotation=25)

# Draw vertical lines when swaps happen (green - long, red - short)
len_swaps = len(df_swaps['notional'].values)
for i in range(len_swaps):
    notional = df_swaps['notional'].values[i]
    time = df_swaps['timestamp'].values[i]

    color = 'r' if notional < 0 else 'g'

    ax.axvline(
        x = dt.datetime.fromtimestamp(time), 
        color = color,
        alpha = 0.7, 
    )

# Draw vertical lines when mints happen (green - long, red - short)
len_mints = len(df_mints['notional'].values)
for i in range(len_mints):
    notional = df_mints['notional'].values[i]
    time = df_mints['timestamp'].values[i]

    color = 'r' if notional < 0 else 'g'

    ax.axvline(
        x = dt.datetime.fromtimestamp(time), 
        color = color,
        alpha = 0.7, 
    )

# Draw margin requirement plots
ax.plot(dates, df["position_margin"], label="Margin")
ax.plot(dates, df["position_requirement_liquidation"],
        label="Liquidation threshold")
ax.plot(dates, df["position_requirement_safety"], label="Safety threshold")

plt.legend()
plt.savefig(
    "position-status/data/{0}/requirements.png".format(ID),
    bbox_inches='tight'
)
