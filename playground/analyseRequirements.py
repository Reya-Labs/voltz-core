import math
import pandas as pd

marginEngineAddress = "0xB1125ba5878cF3A843bE686c6c2486306f03E301"

ds = pd.read_csv("{0}.csv".format(marginEngineAddress))

print(len(ds))

before = ds.iloc[:len(ds)//2]
after = ds.iloc[len(ds)//2:]

before.reset_index(inplace=True)
after.reset_index(inplace=True)

print(before)
print(after)

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

    if liquidity_notional > 1e-6:
        print("LP with {:.6f} Liquidity".format(liquidity_notional))
    
    if float(before["position_notional"][i]) < 0:
        print("FT with {:.6f} Notional".format(-float(before["position_notional"][i])))

    if float(before["position_notional"][i]) > 0:
        print("VT with {:.6f} Notional".format(float(before["position_notional"][i])))
    
    if lt_before > 0:
        rd = (lt_after - lt_before) / lt_before
        print("liquidation threshold: {:.6f} -> {:.6f} (\u03B7: {:.2%})".format(lt_before, lt_after, rd))
    else:
        print("liquidation threshold: {:.6f} -> {:.6f}".format(lt_before, lt_after))

    if st_before > 0:
        rd = (st_after - st_before) / st_before
        print("safety threshold: {:.6f} -> {:.6f} (\u03B7: {:.2%})".format(st_before, st_after, rd))
    else:
        print("safety threshold: {:.6f} -> {:.6f}".format(st_before, st_after))
    print("               status: {0} -> {1}".format(status_before, status_after))

    print()