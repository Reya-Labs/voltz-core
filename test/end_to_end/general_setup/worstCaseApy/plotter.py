import matplotlib.pyplot as plt
import pandas as pd

dfs = []
for i in range(3):
    dfs.append(pd.read_csv("test/end_to_end/general_setup/worstCaseApy/behaviour_{0}.csv".format(i)))

for i in range(3):
    df = dfs[i]

    plt.plot(df["time"], df["margin"])
    plt.plot(df["time"], df["liquidation"])
    plt.plot(df["time"], df["safety"])
    plt.legend(["Margin", "Liquidation threshold", "Safety threshold"])
    plt.savefig("test/end_to_end/general_setup/worstCaseApy/behaviour_{0}.jpg".format(i))
    plt.clf()

plt.plot(dfs[0]["time"], dfs[0]["safety"])
plt.plot(dfs[1]["time"], dfs[1]["safety"])
plt.plot(dfs[2]["time"], dfs[2]["safety"])
plt.legend(["Current Safety threshold", "Linear-fix Safety threshold", "Exact-fix Safety threshold"])
plt.savefig("test/end_to_end/general_setup/worstCaseApy/safety_thresholds.jpg")
plt.clf()

plt.plot(dfs[0]["time"], dfs[0]["liquidation"])
plt.plot(dfs[1]["time"], dfs[1]["liquidation"])
plt.plot(dfs[2]["time"], dfs[2]["liquidation"])
plt.legend(["Current Liquidation threshold", "Linear-fix Liquidation threshold", "Exact-fix Liquidation threshold"])
plt.savefig("test/end_to_end/general_setup/worstCaseApy/liquidation_thresholds.jpg")
plt.clf()