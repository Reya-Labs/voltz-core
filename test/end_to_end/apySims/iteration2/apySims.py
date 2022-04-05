import json
from operator import index
import pandas as pd
import numpy as np

SECONDS_IN_YEAR = 31536000
DAYS_IN_YEAR = 365

def ParsePhase(phase):
    phase_info = {}
    name = phase[0].replace("-", "").strip()
    phase_info["position info"] = {}
    phase_info["trader yba info"] = {}

    for i, l in enumerate(phase):
        # print(l)
        if "current timestamp" in l:
            phase_info["current timestamp"] = float(l.split(" ")[-1])
        if "start timestamp" in l:
            phase_info["start timestamp"] = float(l.split(" ")[-1])
        if "end timestamp" in l:
            phase_info["end timestamp"] = float(l.split(" ")[-1])
        if "sqrt price at current tick" in l:
            phase_info["sqrt price at current tick"] = float(l.split(" ")[-1])
        if "current reserve normalised income" in l:
            phase_info["rni"] = float(l.split(" ")[-1])
        if "lower apy bound" in l:
            phase_info["lower apy bound"] = float(l.split(" ")[-1])
        if " historical apy" in l:
            phase_info["historical apy"] = float(l.split(" ")[-1])
        if "upper apy bound" in l:
            phase_info["upper apy bound"] = float(l.split(" ")[-1])
        if "variable factor" in l:
            phase_info["variable factor"] = float(l.split(" ")[-1])
                
        if "POSITION" in l:
            index_position = int(l.split(" ")[-1])
            phase_info["position info"][index_position] = {}
            # print(index_position)

            j = i + 1
            while len(phase[j].strip()) > 0:            
                # print(phase[j].strip())
                if "address" in phase[j]:
                    phase_info["position info"][index_position]["address"] = phase[j].strip().split(" ")[-1]
                if "liquidity" in phase[j]:
                    phase_info["position info"][index_position]["liquidity"] = float(phase[j].strip().split(" ")[-1])
                if "margin" in phase[j] and not "requirement" in phase[j]:
                    phase_info["position info"][index_position]["margin"] = float(phase[j].strip().split(" ")[-1])
                if "margin requirement" in phase[j]:
                    phase_info["position info"][index_position]["margin requirement"] = float(phase[j].strip().split(" ")[-1])
                if "liquidation threshold" in phase[j]:
                    phase_info["position info"][index_position]["liquidation threshold"] = float(phase[j].strip().split(" ")[-1])
                if "sqrt price at lower tick" in phase[j]:
                    phase_info["position info"][index_position]["sqrt price at lower tick"] = float(phase[j].strip().split(" ")[-1])
                if "sqrt price at upper tick" in phase[j]:
                    phase_info["position info"][index_position]["sqrt price at upper tick"] = float(phase[j].strip().split(" ")[-1])
                j += 1
                
        if l.startswith("TRADER YBA"):
            index_trader = int(l.split(" ")[-1])
            phase_info["trader yba info"][index_trader] = {}

            j = i + 1
            while len(phase[j].strip()) > 0:
                if "address" in phase[j]:
                    phase_info["trader yba info"][index_trader]["address"] = phase[j].strip().split(" ")[-1]
                if "margin" in phase[j]:
                    phase_info["trader yba info"][index_trader]["margin"] = float(phase[j].strip().split(" ")[-1])
                j += 1

    date = (phase_info["current timestamp"] - phase_info["start timestamp"]) / SECONDS_IN_YEAR * DAYS_IN_YEAR
    return name, date, phase_info

phase_information = {}

with open('test/end_to_end/general_setup/apySims/iteration2/console.txt') as f:
    lines = f.readlines()
    phases = []
    for l in lines:
        if l.startswith("---"):
            phases.append([])
        phases[-1].append(l)

    for phase in phases:
        name, date, phase_info = ParsePhase(phase)
        # print(name)
        phase_information[name] = phase_info
        phase_information[name]["date"] = date


file = open("test/end_to_end/general_setup/apySims/iteration2/sim_info.json", "w")
file = json.dump(phase_information, file)
# file = open("test/end_to_end/general_setup/apySims/iteration2/sim_info.json", "r")
# phase_information = json.load(file)

dates = []
historical_apy = []
lower_apy_bound = []
upper_apy_bound = []
rni = []
variable_factor = []
position_margin = []
margin_requirement = []
liquidation_threshold = []
lower_fixed_rate = []
upper_fixed_rate = []
position_margin = []
margin_requirement = []
liquidation_threshold = []

for name in phase_information.keys():
    print(name)
    if phase_information[name]["current timestamp"] < phase_information[name]["end timestamp"]:
        dates.append(phase_information[name]["date"])
        historical_apy.append(phase_information[name]["historical apy"])
        lower_apy_bound.append(phase_information[name]["lower apy bound"])
        upper_apy_bound.append(phase_information[name]["upper apy bound"])
        rni.append(phase_information[name]["rni"])
        variable_factor.append(phase_information[name]["variable factor"])

        i = 0
        # print(phase_information[name]["position info"].keys())
        for j in phase_information[name]["position info"].keys():
            if j >= 2:
                if j > i:
                    i = j
        # print(i)
        position_margin.append(phase_information[name]["position info"][i]["margin"])
        margin_requirement.append(phase_information[name]["position info"][i]["margin requirement"])
        liquidation_threshold.append(phase_information[name]["position info"][i]["liquidation threshold"])
        lower_fixed_rate.append(1 / (phase_information[name]["position info"][i]["sqrt price at upper tick"] ** 2) / 100)
        upper_fixed_rate.append(1 / (phase_information[name]["position info"][i]["sqrt price at lower tick"] ** 2) / 100)
   
apyDataFrame = pd.DataFrame()
apyDataFrame["dates"] = np.array(dates)
apyDataFrame["historical apy"] = np.array(historical_apy)
apyDataFrame["lower apy bound"] = np.array(lower_apy_bound)
apyDataFrame["upper apy bound"] = np.array(upper_apy_bound)
apyDataFrame["variable factor"] = np.array(variable_factor)
apyDataFrame["lower fixed rate"] = np.array(lower_fixed_rate)
apyDataFrame["upper fixed rate"] = np.array(upper_fixed_rate)
apyDataFrame["rni"] = np.array(rni)
apyDataFrame.to_csv('test/end_to_end/general_setup/apySims/iteration2/apys.csv')       

marginDataFrame = pd.DataFrame()
marginDataFrame["dates"] = np.array(dates)
marginDataFrame["margin"] = np.array(position_margin)
marginDataFrame["margin requirement"] = np.array(margin_requirement)
marginDataFrame["liquidation threshold"] = np.array(liquidation_threshold)
marginDataFrame.to_csv('test/end_to_end/general_setup/apySims/iteration2/margins.csv')
