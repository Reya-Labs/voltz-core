
import math

ONE_DAY_IN_SECONDS = 86400
ONE_MONTH_IN_SECONDS = 30 * ONE_DAY_IN_SECONDS
ONE_YEAR_IN_SECONDS = 12 * ONE_MONTH_IN_SECONDS

NOTIONAL = 1000000

dummy_data = [{
    "t_a": 0,
    "t_b": ONE_MONTH_IN_SECONDS * 4,
    "t_c": ONE_MONTH_IN_SECONDS * 6,
    "a": 1,
    "b": 1.01,
    "c": 1.02,
    "v": NOTIONAL,
    "fr": 1.5,
}]


def build_data(rates, fixed_rate):
    data = [
        {
            "t_a": 0,
            "t_b": 0,
            "t_c": ONE_MONTH_IN_SECONDS * 2,
            "a": rates[0],
            "b": rates[0],
            "c": rates[4],
            "v": NOTIONAL,
            "fr": fixed_rate,
        },

        {
            "t_a": 0,
            "t_b": ONE_DAY_IN_SECONDS * 15,
            "t_c": ONE_MONTH_IN_SECONDS * 2,
            "a": rates[0],
            "b": rates[1],
            "c": rates[4],
            "v": NOTIONAL,
            "fr": fixed_rate,
        },

        {
            "t_a": 0,
            "t_b": ONE_DAY_IN_SECONDS * 30,
            "t_c": ONE_MONTH_IN_SECONDS * 2,
            "a": rates[0],
            "b": rates[2],
            "c": rates[4],
            "v": NOTIONAL,
            "fr": fixed_rate,
        },

        {
            "t_a": 0,
            "t_b": ONE_DAY_IN_SECONDS * 45,
            "t_c": ONE_MONTH_IN_SECONDS * 2,
            "a": rates[0],
            "b": rates[3],
            "c": rates[4],
            "v": NOTIONAL,
            "fr": fixed_rate,
        },
    ]

    return data


def get_aUSDC_data():
    rate_0_4 = 1.075645583759689861270905102
    rate_1_4 = 1.076123628830413945682809417
    rate_2_4 = 1.076459523130830871452870013
    rate_3_4 = 1.076696710813436931828966223

    estimated_apy = 0.007725799667912758
    rate_4_4 = math.pow(estimated_apy + 1, 1/24) * rate_3_4

    fixed_rate = 1

    data = build_data([rate_0_4, rate_1_4, rate_2_4, rate_3_4, rate_4_4], fixed_rate)

    return data


def get_aDAI_data():
    rate_0_4 = 1.072608530744597402085925098
    rate_1_4 = 1.073309214220627980700553877
    rate_2_4 = 1.073964244687381644929883797
    rate_3_4 = 1.074272279743553167920101530

    estimated_apy = 0.01206190584544531
    rate_4_4 = math.pow(estimated_apy + 1, 1/24) * rate_3_4

    fixed_rate = 1.5

    data = build_data([rate_0_4, rate_1_4, rate_2_4, rate_3_4, rate_4_4], fixed_rate)

    return data


def get_cDAI_data():
    rate_0_4 = 0.022011868094875068175761306
    rate_1_4 = 0.022020586657388378353114265
    rate_2_4 = 0.022030629148798637264823547
    rate_3_4 = 0.022037389042537810741058113

    estimated_apy = 0.009161526352621245
    rate_4_4 = math.pow(estimated_apy + 1, 1/24) * rate_3_4

    fixed_rate = 1.3

    data = build_data([rate_0_4, rate_1_4, rate_2_4, rate_3_4, rate_4_4], fixed_rate)

    return data


def calculate_cashflow(f, v, x, t_x, y, t_y):
    return f * (t_y - t_x) / ONE_YEAR_IN_SECONDS * 0.01 + v * (y / x - 1)


def true_settlement(data):
    t_b = data["t_b"]
    t_c = data["t_c"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    v_u = -v
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

    v_u = -v
    f_u = v * fr

    current_excess_settlement = calculate_cashflow(f_u, v_u, a, t_a, b, t_b)
    f_b = f_u - current_excess_settlement / ((t_c - t_a) / ONE_YEAR_IN_SECONDS * 0.01)
    v_b = v_u

    return calculate_cashflow(f_b, v_b, a, t_a, c, t_c)


data = get_aUSDC_data()
for data in data:
    t_a = data["t_a"]
    t_b = data["t_b"]
    t_c = data["t_c"]
    a = data["a"]
    b = data["b"]
    c = data["c"]
    v = data["v"]
    fr = data["fr"]

    if t_b > t_a:
        print(ONE_YEAR_IN_SECONDS / (t_b - t_a))
        print(b/a)
        apy_ab = math.pow((b / a), (ONE_YEAR_IN_SECONDS / (t_b - t_a))) - 1
        print("   apy between [a, b]: {0}%".format(apy_ab * 100))

    if t_c > t_b:
        apy_bc = math.pow((c / b), (ONE_YEAR_IN_SECONDS / (t_c - t_b))) - 1
        print("   apy between [b, c]: {0}%".format(apy_bc * 100))

    ts = true_settlement(data)
    cs = current_settlement(data)

    print("      true settlement:", ts)
    print("   current settlement:", cs)
    # print("      next settlement:", next_settlement(data))
    # print("simplified settlement:", simplified_settlement(data))
    # print()


    delta = abs(ts - cs)
    # difference = abs(v * (b - a) * (c - b) / (a * b))
    print("           difference: {0}%".format(delta / ts * 100))
    # print("     difference:", difference)
    print()
    print()