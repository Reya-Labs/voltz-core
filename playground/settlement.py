

import math


ONE_MONTH_IN_SECONDS = 2592000
ONE_YEAR_IN_SECONDS = 12 * ONE_MONTH_IN_SECONDS

data = [{
    "t_a": 1,
    "t_b": ONE_MONTH_IN_SECONDS * 4,
    "t_c": ONE_MONTH_IN_SECONDS * 6,
    "a": 1,
    "b": 1.01,
    "c": 1.02,
    "v": 1000000,
    "fr": 1.5,
}]


def calculate_cashflow(f, v, x, t_x, y, t_y):
    return f * (t_y - t_x) / ONE_YEAR_IN_SECONDS * 0.01 + v * (y / x - 1)


def true_settlement(data):
    t_b = data["t_b"]
    t_c = data["t_c"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    v_u = v
    f_u = v * fr

    return calculate_cashflow(f_u, v_u, b, t_b, c, t_c)


def current_settlement(data):
    t_a = data["t_a"]
    t_b = data["t_b"]
    t_c = data["t_c"]
    a = data["a"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    v_u = v
    f_u = v * fr

    current_excess_settlement = calculate_cashflow(f_u, v_u, a, t_a, b, t_b)
    f_b = f_u - current_excess_settlement / ((t_c - t_a) / ONE_YEAR_IN_SECONDS * 0.01)
    v_b = v_u

    return calculate_cashflow(f_b, v_b, a, t_a, c, t_c)


def next_settlement(data):
    t_a = data["t_a"]
    t_b = data["t_b"]
    t_c = data["t_c"]
    a = data["a"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    v_u = v
    f_u = v * fr

    f_b = f_u - f_u * (t_b - t_a) / (t_c - t_a)
    v_b = v_u - v_u * (1 - a / b)
    gamma = - v_u * (1 - a / b)

    return calculate_cashflow(f_b, v_b, a, t_a, c, t_c) + gamma


def simplified_settlement(data):
    t_b = data["t_b"]
    t_c = data["t_c"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    v_u = v
    f_u = v * fr

    f_b = f_u * (t_c - t_b) / ONE_YEAR_IN_SECONDS * 0.01 - v_u
    v_b = v_u / b
    
    return f_b + v_b * c


for i in range(len(data)):
    t_a = data[i]["t_a"]
    t_b = data[i]["t_b"]
    t_c = data[i]["t_c"]
    a = data[i]["a"]
    b = data[i]["b"]
    c = data[i]["c"]
    v = data[i]["v"]
    fr = data[i]["fr"]

    apy = math.pow((c / b), (ONE_YEAR_IN_SECONDS / (t_c - t_b))) - 1
    print("apy between [b, c]: {0}%".format(apy * 100))

    print("      true settlement:", true_settlement(data[i]))
    print("   current settlement:", current_settlement(data[i]))
    print("      next settlement:", next_settlement(data[i]))
    print("simplified settlement:", simplified_settlement(data[i]))


    true_difference = abs(true_settlement(data[i]) - current_settlement(data[i]))
    difference = abs(v * (b - a) * (c - b) / (a * b))
    print("true difference:", true_difference)
    print("     difference:", difference)
