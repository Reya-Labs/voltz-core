
rawParams = {
    "tau_u": 5.000055555555556,
    "tau_d": 0.5465918918918918,
    "gamma_unwind": 0.02011981981981982,
    "dev_lm": 3.7237864864864867,
    "dev_im": 4.834886486486487,
    "r_init_lm": 0.07336363636363637,
    "r_init_im": 0.10954545454545454,
    "alpha": 5.641397147687839e-06,
    "beta": 0.00043938179236386454,
    "sigma_squared": 1.3726890469124058e-05,
    "xi_upper": 39,
    "xi_lower": 98,
    "lookback": 10
}


def getFormattedParams(rawParams):
    print("marginCalculatorParams: {")
    print("  apyUpperMultiplierWad: \"{:.0f}\",".format(
        rawParams["tau_u"] * 1e18))
    print("  apyLowerMultiplierWad: \"{:.0f}\",".format(
        rawParams["tau_d"] * 1e18))
    print("  sigmaSquaredWad: \"{:.0f}\",".format(
        rawParams["sigma_squared"] * 1e18))
    print("  alphaWad: \"{:.0f}\",".format(rawParams["alpha"] * 1e18))
    print("  betaWad: \"{:.0f}\",".format(rawParams["beta"] * 1e18))
    print("  xiUpperWad: \"{:.0f}\",".format(rawParams["xi_upper"] * 1e18))
    print("  xiLowerWad: \"{:.0f}\",".format(rawParams["xi_lower"] * 1e18))
    print("  tMaxWad: \"{0}\",".format("31536000000000000000000000"))
    print("  devMulLeftUnwindLMWad: \"{:.0f}\",".format(
        rawParams["dev_lm"] * 1e18))
    print("  devMulRightUnwindLMWad: \"{:.0f}\",".format(
        rawParams["dev_lm"] * 1e18))
    print("  devMulLeftUnwindIMWad: \"{:.0f}\",".format(
        rawParams["dev_im"] * 1e18))
    print("  devMulRightUnwindIMWad: \"{:.0f}\",".format(
        rawParams["dev_im"] * 1e18))
    print("  fixedRateDeviationMinLeftUnwindLMWad: \"{:.0f}\",".format(
        rawParams["r_init_lm"] * 1e18))
    print("  fixedRateDeviationMinRightUnwindLMWad: \"{:.0f}\",".format(
        rawParams["r_init_lm"] * 1e18))
    print("  fixedRateDeviationMinLeftUnwindIMWad: \"{:.0f}\",".format(
        rawParams["r_init_im"] * 1e18))
    print("  fixedRateDeviationMinRightUnwindIMWad: \"{:.0f}\",".format(
        rawParams["r_init_im"] * 1e18))
    print("  gammaWad: \"{:.0f}\",".format(rawParams["gamma_unwind"] * 1e18))
    print("  minMarginToIncentiviseLiquidators: \"{:.0f}\",".format(0))
    print("}")

    print()

    print("lookbackWindowInSeconds: {:.0f}".format(
        rawParams["lookback"] * 24 * 60 * 60))
    print()


getFormattedParams(rawParams)
