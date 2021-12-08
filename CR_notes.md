# Todos (check for issues and raise if we don't have one?):

- add instructions to readme for installing, running tests
- make (some) tests pass, and remove failing ones so that `hh test` passes
- eliminate global dependencies (if any) to make environment deterministic
- npm audit shows 36 high risk vulnerabilities. May be a non-issue but we should investigate if we haven't already.
- add module to track gas usage
- ensure we have tests that tell us the real world gas usage for things we care about
- add module to track code coverage
- should flesh out our interfaces - some are empty
- should contracts be upgradable? any other mitigations (e.g. pausable contracts) planned to deal with bugs/hacks?
- current contracts are (presumably known to be) vulnerable to mis-use by unauthorised parties. E.g. rate oracle functions are not all locked down to priveleged users.
- should have an issue to deal with code todos if we don't already
- Sort out licensing. Some contracts are BUSL-1.1 and inherit NoDelgateCall, but this seems at odds with Simon's statements on licensing, and in any case there is no license file
- Ideally I should probably do an internal audit of all the code, though I don't think I would have time to a thorough job of this before January even if I did nothing else.

# Questions/discussions:

- how much if any of the code (e.g. in `core_libraries` or `utils`) is copied or adapted from elsewhere and already somewhat trusted / audited?
- I don't know a lot about the inner workings of uniswap v3, so ticks etc. not something I understand yet - presumably worth me spending some time reading up on that? Uniswap docs best starting point?
- Why does AMMDeployer set parameters locally rather than passing them as parameters?
- would be good to go through the rate oracles together and document what calculations they are doing, and how these correspond to the math in the lightpaper (could prob figure this out but easier to run through together)
- npm vs. yarn
- would love to hear more about the plans for snapshot testing
- Any particular resaon for the Factory vs. Deployer split? I guess just copying Uniswap?
- Interesting that IAMM is split into multiple files but AMM is not (yet) - any reason for splitting the interface?
- Trader = rate taker and Position = LP?
- (Maybe dumb question; haven't given it much thought) why does the Postion margin requirement need to know tick info and not just the token balances and rates?

For readme:

- `npm i` to install dependencies
- `npm compile` to compile code and generate typescript bindings
- `npm test` to run all the tests
