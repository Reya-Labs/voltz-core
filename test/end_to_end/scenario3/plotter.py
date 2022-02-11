import matplotlib.pyplot as plt

# points_in_time = []
# position_margin_requirements = []

# i = 1
# with open('test/end_to_end/scenario3/positionMarginRequirements.txt') as f:
#     for line in f: # read rest of lines
#         array = [float(x) for x in line.split()]
#         position_margin_requirements.append(array[0])
#         points_in_time.append(i)
#         i += 1

# plt.title("Position margin requirements per day over 90 days")
# plt.plot(points_in_time[:-1], position_margin_requirements[:-1], '-')
# plt.show()

# points_in_time = []
# trader_1_margin_requirements = []
# trader_2_margin_requirements = []

# i = 1
# with open('test/end_to_end/scenario3/traderMarginRequirements.txt') as f:
#     for line in f: # read rest of lines
#         array = [float(x) for x in line.split()]
#         if i % 2 == 1:
#             trader_1_margin_requirements.append(array[0])
#             points_in_time.append((i+1)//2)
#         else:
#             trader_2_margin_requirements.append(array[0])
#         i += 1


# plt.title("Trader margin requirements per day over 90 days with 2000 VT")
# plt.plot(points_in_time[:-1], trader_1_margin_requirements[:-1], '-')
# plt.show()

# plt.title("Trader margin requirements per day over 90 days with -3000 VT")
# plt.plot(points_in_time[:-1], trader_2_margin_requirements[:-1], '-')
# plt.show()

points_in_time = []
apy_lower_bounds = []
historical_apy = []
apy_upper_bounds = []

i = 1
with open('test/end_to_end/scenario3/apybounds.txt') as f:
    for line in f: # read rest of lines
        array = [x for x in line.split()]
        if len(points_in_time) > 0 and float(array[0]) == points_in_time[-1]:
            continue
        points_in_time.append(float(array[0]))
        apy_lower_bounds.append(float(array[1]))
        historical_apy.append(float(array[2]))
        apy_upper_bounds.append(float(array[3]))

# plt.tick_params(
#     axis='x',          # changes apply to the x-axis
#     which='both',      # both major and minor ticks are affected
#     bottom=False,      # ticks along the bottom edge are off
#     top=False,         # ticks along the top edge are off
#     labelbottom=False) # labels along the bottom edge are off

plt.plot(points_in_time, apy_lower_bounds)
plt.plot(points_in_time, historical_apy)
plt.plot(points_in_time, apy_upper_bounds)
plt.show()