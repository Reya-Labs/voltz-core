import matplotlib.pyplot as plt
import pandas as pd

df = pd.read_csv("test/end_to_end/general_setup/worstCaseApy/behaviour.csv")

plt.plot(df["time"], df["margin"])
plt.plot(df["time"], df["liquidation"])
plt.plot(df["time"], df["safety"])
plt.legend(["Margin", "Liquidation threshold", "Safety threshold"])
plt.savefig("test/end_to_end/general_setup/worstCaseApy/behaviour.jpg")
plt.clf()
