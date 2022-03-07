import matplotlib.pyplot as plt

position_info = {}
final_position_info = {}
trader_yba = {}
final_trader_yba = {}

lower_apy_bound = {}
historical_apy = {}
upper_apy_bound = {}

with open('test/end_to_end/general_setup/apySims/console.txt') as f:
    lines = f.readlines()
    phases = []
    for l in lines:
        if l.startswith("---"):
            phases.append([])
        phases[-1].append(l)

    for phase in phases:
        # print(phase)
        name = phase[0].replace("-", "")
        name_data = name.strip().split(" ")
        # print(name_data)
        
        # print(name_data[0])
        if name_data[0] == "step":
            day_data = int(name_data[1])
            # print(day_data)
            for i, l in enumerate(phase):
                # print(l)
                if l.startswith("lower apy bound"):
                    lower_apy_bound[day_data] = float(l.split(" ")[-1])
                if l.startswith(" historical apy"):
                    historical_apy[day_data] = float(l.split(" ")[-1])
                if l.startswith("upper apy bound"):
                    upper_apy_bound[day_data] = float(l.split(" ")[-1])
                
                if l.startswith("POSITION"):
                    index_position = int(l.split(" ")[-1])
                    if not index_position in position_info.keys():
                        position_info[index_position] = {}

                    if not day_data in position_info[index_position].keys():
                        position_info[index_position][day_data] = {}

                    j = i + 1
                    while len(phase[j].strip()) > 0:
                        
                        print(phase[j].strip())
                        if "address" in phase[j]:
                            position_info[index_position][day_data]["address"] = phase[j].strip().split(" ")[-1]
                        if "margin" in phase[j]:
                            position_info[index_position][day_data]["margin"] = float(phase[j].strip().split(" ")[-1])
                        j += 1
                
                if l.startswith("TRADER YBA"):
                    index_trader = int(l.split(" ")[-1])
                    trader_yba[day_data] = {}

                    if not index_trader in trader_yba.keys():
                        trader_yba[index_trader] = {}

                    if not day_data in trader_yba[index_trader].keys():
                        trader_yba[index_trader][day_data] = {}

                    j = i + 1
                    while len(phase[j].strip()) > 0:
                        if "address" in phase[j]:
                            trader_yba[day_data]["address"] = phase[j].strip().split(" ")[-1]
                        if "margin" in phase[j]:
                            trader_yba[day_data]["margin"] = float(phase[j].strip().split(" ")[-1])
                        j += 1

        if name_data[0] == "FINAL":
            for i, l in enumerate(phase):
                if l.startswith("POSITION"):
                    index_position = int(l.split(" ")[-1])
                    if not index_position in final_position_info.keys():
                        final_position_info[index_position] = {}
                        
                    j = i + 1
                    while len(phase[j].strip()) > 0:
                        
                        print(phase[j].strip())
                        if "address" in phase[j]:
                            final_position_info[index_position]["address"] = phase[j].strip().split(" ")[-1]
                        if "margin" in phase[j]:
                            final_position_info[index_position]["margin"] = float(phase[j].strip().split(" ")[-1])
                        j += 1
                
                if l.startswith("TRADER YBA"):
                    index_trader = int(l.split(" ")[-1])
                    final_trader_yba[day_data] = {}

                    if not index_trader in final_trader_yba.keys():
                        final_trader_yba[index_trader] = {}

                    j = i + 1
                    while len(phase[j].strip()) > 0:
                        if "address" in phase[j]:
                            final_trader_yba["address"] = phase[j].strip().split(" ")[-1]
                        if "margin" in phase[j]:
                            final_trader_yba["margin"] = float(phase[j].strip().split(" ")[-1])
                        j += 1

fees = {}
with open('test/end_to_end/general_setup/apySims/fees.txt') as f:
    lines = f.readlines()
    for l in lines:
        if not int(l.split(" ")[1]) in fees.keys():
            fees[int(l.split(" ")[1])] = 0.0
        
        fees[int(l.split(" ")[1])] += float(l.split(" ")[-1])

margin_requirements = {}
liquidation_thresholds = {}

with open('test/end_to_end/general_setup/apySims/margin_requirements.txt') as f:
    lines = f.readlines()
    initial_margin = float(lines[0].split(" ")[-1])
    for l in lines[1:]:
        margin_requirements[int(l.split(" ")[1])] = float(l.split(" ")[3])
        liquidation_thresholds[int(l.split(" ")[1])] = float(l.split(" ")[5])

print("final margin of position 0: " + str(final_position_info[0]["margin"]))

current_margin = {}
for day in position_info[0].keys():
    current_margin[day] = position_info[0][day]["margin"]
plt.plot(margin_requirements.keys(), margin_requirements.values())
plt.plot(liquidation_thresholds.keys(), liquidation_thresholds.values())
plt.plot(current_margin.keys(), current_margin.values())
plt.plot(margin_requirements.keys(), [initial_margin for _ in range(len(liquidation_thresholds.values()))])
plt.xlabel("day")
plt.ylabel("margin")
plt.legend(['margin requirement', 'liquidation threshold', 'deposited margin', 'current margin'])
plt.title("Margin analysis")
plt.show()

plt.plot(fees.keys(), fees.values())
plt.xlabel("day")
plt.ylabel("fees to LP")
plt.legend(['fees per day for full trade in both directions'])
plt.title("Fees per day")
plt.show()

plt.plot(lower_apy_bound.keys(), lower_apy_bound.values())
plt.plot(historical_apy.keys(), historical_apy.values())
plt.plot(upper_apy_bound.keys(), upper_apy_bound.values())
plt.xlabel("day")
plt.ylabel("apy")
plt.title("Apy bounds")
plt.legend(['lower apy bound', 'historical apy', 'upper apy bound'])
plt.show()