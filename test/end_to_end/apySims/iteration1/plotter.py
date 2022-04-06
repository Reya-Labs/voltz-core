import matplotlib.pyplot as plt
import pandas as pd

apyDataFrame = pd.read_csv("test/end_to_end/apySims/iteration1/apys.csv")
marginDataFrame = pd.read_csv("test/end_to_end/apySims/iteration1/margins.csv")

plt.plot(apyDataFrame["dates"], apyDataFrame["lower apy bound"])
plt.plot(apyDataFrame["dates"], apyDataFrame["historical apy"])
plt.plot(apyDataFrame["dates"], apyDataFrame["upper apy bound"])
plt.plot(apyDataFrame["dates"],
         apyDataFrame["lower fixed rate"], linestyle="dashed")
plt.plot(apyDataFrame["dates"],
         apyDataFrame["upper fixed rate"], linestyle="dashed")
plt.xlabel("pool duration")
plt.ylabel("apy")
plt.title("Apy bounds")
plt.legend(['lower apy bound', 'historical apy', 'upper apy bound',
           'lower fixed rate of LP', 'upper fixed rate of LP'])
plt.savefig("test/end_to_end/apySims/iteration1/apy_bounds.png")
plt.clf()

plt.plot(apyDataFrame["dates"], apyDataFrame["rni"])
plt.xlabel("pool duration")
plt.ylabel("rni")
plt.title("Reserve normalized income per day")
plt.legend(['Reserve normalized income'])
plt.savefig("test/end_to_end/apySims/iteration1/rni.png")
plt.clf()

plt.plot(apyDataFrame["dates"], apyDataFrame["variable factor"])
plt.xlabel("day")
plt.ylabel("variable factor")
plt.title("Variable factor per day")
plt.legend(['variable factor'])
plt.savefig("test/end_to_end/apySims/iteration1/variable_factor.png")
plt.clf()

plt.plot(marginDataFrame['dates'], marginDataFrame['margin requirement'])
plt.plot(marginDataFrame['dates'], marginDataFrame['liquidation threshold'])
plt.plot(marginDataFrame['dates'], marginDataFrame['margin'])
plt.xlabel("day")
plt.ylabel("margin")
plt.legend(['margin requirement', 'liquidation threshold', 'current margin'])
plt.title("Margin analysis")
plt.savefig("test/end_to_end/apySims/iteration1/margin_analysis.png")
plt.clf()
