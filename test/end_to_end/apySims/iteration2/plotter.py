import matplotlib.pyplot as plt
import pandas as pd

apyDataFrame = pd.read_csv("test/end_to_end/general_setup/apySims/iteration2/apys.csv")
marginDataFrame = pd.read_csv("test/end_to_end/general_setup/apySims/iteration2/margins.csv")
    
plt.plot(apyDataFrame["dates"], apyDataFrame["lower apy bound"])
plt.plot(apyDataFrame["dates"], apyDataFrame["historical apy"])
plt.plot(apyDataFrame["dates"], apyDataFrame["upper apy bound"])
plt.plot(apyDataFrame["dates"][apyDataFrame["dates"] >= 30], apyDataFrame["lower fixed rate"][apyDataFrame["dates"] >= 30], linestyle="dashed")
plt.plot(apyDataFrame["dates"][apyDataFrame["dates"] >= 30], apyDataFrame["upper fixed rate"][apyDataFrame["dates"] >= 30], linestyle="dashed")

for d in range(31):
    plt.axvline(d, color='grey')
    
plt.xlabel("pool duration")
plt.ylabel("apy")
plt.title("Apy bounds")
plt.legend(['lower apy bound', 'historical apy', 'upper apy bound', 'lower fixed rate of LP', 'upper fixed rate of LP'])
plt.savefig("test/end_to_end/general_setup/apySims/iteration2/apy_bounds.png")
plt.clf()

plt.plot(apyDataFrame["dates"], apyDataFrame["rni"])
plt.xlabel("pool duration")
plt.ylabel("rni")
plt.title("Reserve normalized income per day")
plt.legend(['Reserve normalized income'])
plt.savefig("test/end_to_end/general_setup/apySims/iteration2/rni.png")
plt.clf()

plt.plot(apyDataFrame["dates"], apyDataFrame["variable factor"])
plt.xlabel("day")
plt.ylabel("variable factor")
plt.title("Variable factor per day")
plt.legend(['variable factor'])
plt.savefig("test/end_to_end/general_setup/apySims/iteration2/variable_factor.png")
plt.clf()

plt.plot(marginDataFrame['dates'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360], marginDataFrame['margin requirement'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360])
plt.plot(marginDataFrame['dates'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360], marginDataFrame['liquidation threshold'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360])
plt.plot(marginDataFrame['dates'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360], marginDataFrame['margin'][apyDataFrame["dates"] >= 30][apyDataFrame["dates"] <= 360])

for d in range(31):
    plt.axvline(d, color='grey')

plt.xlabel("day")
plt.ylabel("margin")
plt.legend(['margin requirement', 'liquidation threshold', 'current margin'])
plt.title("Margin analysis")
plt.savefig("test/end_to_end/general_setup/apySims/iteration2/margin_analysis.png")
plt.clf()