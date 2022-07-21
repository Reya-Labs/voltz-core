import pandas as pd

import matplotlib.pyplot as plt

marginEngineAddress = "0xb1125ba5878cf3a843be686c6c2486306f03e301"

before = pd.read_csv("{0}.csv".format(marginEngineAddress))
after = pd.read_csv("{0}_2.csv".format(marginEngineAddress))

if not len(before) == len(after):
    raise "Unmatched lengths"

n = len(before)

max_lt_delta = 0
max_lt_rel_delta = 0
max_st_delta = 0
max_st_rel_delta = 0

for i in range(n):
    if not before["owner"][i] == after["owner"][i]:
        raise "Unmatched owners"

    if not before["lower_tick"][i] == after["lower_tick"][i]:
        raise "Unmatched lower ticks"

    if not before["upper_tick"][i] == after["upper_tick"][i]:
        raise "Unmatched upper ticks"

    if not before["position_margin"][i] == after["position_margin"][i]:
        raise "Unmatched position margins"

    lt_before = before["position_requirement_liquidation"][i]
    lt_after = after["position_requirement_liquidation"][i]
    lt_delta = lt_after - lt_before

    if abs(lt_delta) > abs(max_lt_delta):
            max_lt_delta = lt_delta

    if lt_before > 0:
        lt_rel_delta = lt_delta / lt_before

        if abs(lt_rel_delta) > abs(max_lt_rel_delta):
            max_lt_rel_delta = lt_rel_delta
    else:
        lt_rel_delta = 0

    st_before = before["position_requirement_safety"][i]
    st_after = after["position_requirement_safety"][i]
    st_delta = st_after - st_before

    if abs(st_delta) > abs(max_st_delta):
            max_st_delta = st_delta

    if st_before > 0:
        st_rel_delta = st_delta / st_before * 100

        if abs(st_rel_delta) > abs(max_st_rel_delta):
            max_st_rel_delta = st_rel_delta
    else:
        st_rel_delta = 0

    status_before = before["status"][i]
    status_after = after["status"][i]

    print("liquidation threshold: {:10.6f} -> {:10.6f} (relative difference: {:10.6f}%)".format(lt_before, lt_after, lt_rel_delta))
    print("     safety threshold: {:10.6f} -> {:10.6f} (relative difference: {:10.6f}%)".format(st_before, st_after, st_rel_delta))
    print("               status: {0} -> {1}".format(status_before, status_after))

    print()

print("         MAXIMUM LIQUIDATION THRESHOLD DIFFERENCE: {:10.6f}".format(max_lt_delta))
print("MAXIMUM LIQUIDATION THRESHOLD RELATIVE DIFFERENCE: {:10.6f}%".format(max_lt_rel_delta))
print("              MAXIMUM SAFETY THRESHOLD DIFFERENCE: {:10.6f}".format(max_st_delta))
print("     MAXIMUM SAFETY THRESHOLD RELATIVE DIFFERENCE: {:10.6f}%".format(max_st_rel_delta))
