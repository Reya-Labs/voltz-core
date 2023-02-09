import pandas as pd
import numpy as np

import datetime

SECONDS_IN_MINUTE = 60
SECONDS_IN_HOUR = 3600
SECONDS_IN_DAY = 86400
SECONDS_IN_WEEK = 604800
SECONDS_IN_YEAR = 31536000


def getPreparedRNIData(df_input, e_format=False):
    # copy data
    df = df_input.copy()

    # ``liquidity index`` is de-scaled (by 10**27)
    floating_rni = []
    for rni in df["liquidityIndex"]:
        rni = str(rni)
        float_rni = rni if e_format else rni[:-27] + "." + rni[-27:]
        floating_rni.append(float(float_rni))

    df["liquidityIndex"] = np.array(floating_rni)

    # return the prepared dataframe
    return df


# """
#    This function returns the rate at some point in time.
#    It requires a prepared RNI DataFrame.
# """
def getRateAt(df_rni, at):
    closest = df_rni["timestamp"].searchsorted(at, side='right') - 1

    if closest + 1 < len(df_rni["timestamp"]):
        t_a = df_rni["timestamp"][closest]
        v_a = df_rni["liquidityIndex"][closest]

        t_b = df_rni["timestamp"][closest+1]
        v_b = df_rni["liquidityIndex"][closest+1]

        if not t_a <= at <= t_b or not v_a <= v_b:
            raise Exception("Incorrect interpolation")

        v_timestamp = ((t_b - at) * v_a + (at - t_a) * v_b) / (t_b - t_a)

        return v_timestamp
    else:
        raise Exception("Trying to get rate at an out-of-bounds timestamp")


# """
#    This function returns the rate between two timestamps.
#    It requires a prepared DataFrame.
# """
def getRateFromTo(df_rni, start, end):
    if start > end:
        raise Exception("Invalid dates (start > end)")

    start_rate = getRateAt(df_rni, start)
    end_rate = getRateAt(df_rni, end)

    return end_rate / start_rate - 1


# """
#    This function returns the apy between two timestamps.
#    It requires a prepared DataFrame.
# """
def getApyFromTo(df_rni, start, end):
    rate = getRateFromTo(df_rni, start, end)

    apy = pow(1 + rate, SECONDS_IN_YEAR / (end - start)) - 1

    return apy


def getDailyApy(df, lookback, frequency):

    start_range = int(df["timestamp"][0]) + lookback + 1
    end_range = (int(df["timestamp"][len(df["timestamp"]) - 1]))

    print("Creating a dataset between {0} and {1}.".format(datetime.datetime.utcfromtimestamp(
        start_range), datetime.datetime.utcfromtimestamp(end_range)))

    if start_range > end_range:
        raise Exception("The dates do not overlap between datasets")

    dates = []
    apys = []
    for date in range(start_range, end_range+1, frequency):
        dates.append(date)

        apys.append(getApyFromTo(df, date - lookback, date))

    df_apy = pd.DataFrame()
    df_apy["timestamp"] = dates
    df_apy["apy"] = apys

    return df_apy