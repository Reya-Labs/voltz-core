import math
import pandas as pd

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

    print("POOL:", pool)

    EXPORT_FILE = open("position-status/data/analysis_{0}.csv".format(pool), "w")
    EXPORT_FILE.write("")
    EXPORT_FILE.close()

    EXPORT_FILE = open("position-status/data/analysis_{0}.csv".format(pool), "a")
    header = "owner,tickLower,tickUpper,margin,notional,liquidity,init_delta,liq_delta\n"
    EXPORT_FILE.write(header)

    before = pd.read_csv("position-status/data/before/{0}.csv".format(pool))
    after = pd.read_csv("position-status/data/after/{0}.csv".format(pool))

    before.reset_index(inplace=True)
    after.reset_index(inplace=True)

    if not len(before) == len(after):
        raise "Unmatched lengths"

    n = len(before)

    max_lt_delta = 0
    max_lt_rel_delta = 0
    max_st_delta = 0
    max_st_rel_delta = 0

    for i in range(n):
        if not before["owner"][i] == after["owner"][i]:
            print(i, before["owner"][i], after["owner"][i])
            raise "Unmatched owners"

        if not before["lower_tick"][i] == after["lower_tick"][i]:
            raise "Unmatched lower ticks"

        if not before["upper_tick"][i] == after["upper_tick"][i]:
            raise "Unmatched upper ticks"

        if not before["position_margin"][i] == after["position_margin"][i]:
            raise "Unmatched position margins"
        
        if not before["position_liquidity"][i] == after["position_liquidity"][i]:
            raise "Unmatched position liquidities"

        lt_before = float(before["position_requirement_liquidation"][i])
        lt_after = float(after["position_requirement_liquidation"][i])

        st_before = float(before["position_requirement_safety"][i])
        st_after = float(after["position_requirement_safety"][i])

        status_before = before["status"][i]
        status_after = after["status"][i]

        liquidity_notional = float(before["position_liquidity"][i]) * (math.pow(1.0001, float(before["upper_tick"][i])/2) - math.pow(1.0001, float(before["lower_tick"][i])/2))

        if lt_before < lt_after:
            print(" Liq. margin req. increases: {:.3f} -> {:.3f} where margin = {:.3f}".format(lt_before, lt_after, before["position_margin"][i]))
        
        if st_before < st_after:
            print("Init. margin req. increases: {:.3f} -> {:.3f} where margin = {:.3f}".format(st_before, st_after, before["position_margin"][i]))

        if lt_before == 0:
            if lt_after == 0:
                lt_niu = 0
            else:
                lt_niu = float("inf")
        else:
            lt_niu = (lt_after - lt_before) / lt_before

        if st_before == 0:
            if st_after == 0:
                st_niu = 0
            else:
                st_niu = float("inf")
        else:
            st_niu = (st_after - st_before) / st_before

        EXPORT_FILE.write("{0},{1},{2},{3},{4},{5},{6},{7}\n".format(before["owner"][i], before["lower_tick"][i], before["upper_tick"][i], before["position_margin"][i], before["position_notional"][i], before["position_liquidity"][i], st_niu, lt_niu))

    EXPORT_FILE.close()
    print()