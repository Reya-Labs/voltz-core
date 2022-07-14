import json

positions = []
for skip in range(0, 1201, 100):
  with open('positions-skip{}.json'.format(skip), 'r') as f:
    positions_batch = json.load(f)['data']['positions']
    positions_batch = [{
      'marginEngine': position['amm']['marginEngine']['id'],
      'owner': position['owner']['id'],
      'tickLower': position['tickLower'],
      'tickUpper': position['tickUpper'] 
    } for position in positions_batch]

    positions += positions_batch

assert(len(positions) == len(set([(position['marginEngine'], position['owner'], position['tickLower'], position['tickUpper']) for position in positions])))

with open('positions-ALL.json', 'w') as f :
  json.dump({
    'positions': positions
  }, f)

print(positions[432])
print(positions[496])