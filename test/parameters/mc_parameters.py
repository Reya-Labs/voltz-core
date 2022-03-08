import math
import matplotlib.pyplot as plt

def analyse(alpha, beta, gamma_squared, normalized_time_to_maturity, xi_l, xi_u, historical_apy):
    k = 4 * alpha / gamma_squared
    time_factor = math.exp(-beta * normalized_time_to_maturity)
    one_minus_time_factor = 1 - time_factor
    rho = gamma_squared * one_minus_time_factor / (4 * beta)
    lamda = 4 * beta * time_factor * historical_apy / gamma_squared / one_minus_time_factor

    c = math.sqrt(2 * (k + 2 * lamda))
    v_lower = max(rho * (k + lamda - xi_l * c), 0)
    v_upper = rho * (k + lamda + xi_u * c)

    return v_lower, v_upper

alpha = 0.04
beta = 0.01
gamma_squared = 0.15
normalized_time_to_maturity = 1
xi_l = 2
xi_u = 3

x = []
v_lowers = []
v_uppers = []
for historical_apy in [0.001 * i for i in range(100000)]:
    x.append(historical_apy)
    v_l, v_u = analyse(alpha, beta, gamma_squared, normalized_time_to_maturity, xi_l, xi_u, historical_apy)
    v_lowers.append(v_l)
    v_uppers.append(v_u)

plt.plot(x, v_lowers)
plt.plot(x, x)
plt.plot(x, v_uppers)
plt.legend(["lower bound", "historical apy", "upper bound"])
plt.show()


