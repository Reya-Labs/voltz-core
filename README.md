# Voltz Core

![](<.gitbook/assets/whitepaper_banner (1).jpg>)

## Introduction

Voltz is a noncustodial automated market maker for Interest Rate Swaps (IRS). Voltz uses a Concentrated Liquidity Virtual AMM (vAMM) for price discovery only, with the management of the underlying assets performed by the Margin Engine. The combined impact of these modules enables counterparties to create and trade fixed and variable rates through a mechanism that is up to 3,000x more capital efficient than alternative interest rate swap models, whilst also providing Liquidity Providers and Traders with significant control and flexibility over their positions.

This repository contains the smart contracts that power Voltz Protocol. Over time, Voltz Protocol will be governed by the DAO, so that the protocol is owned and managed by the community that uses it. Decentralizing ownership is critical to ensure the strength of the ecosystem we are all looking to build and to provide control to those that use the system. However, Voltz will initially be controlled by the Voltz Multisigs whilst the DAO is being created.

We would love to see how you can build and improve upon what we've built here at Voltz.

## Community Deployment

Community Deployer Address Kovan: 0x9ff64338E09F46708Af86d72Dc9F0E226B07a279

## Active LP Optimization

In order to test out a simple Active LP Optimizer on top of Voltz Protocol, head over to [Active LP Simulation](https://github.com/Voltz-Protocol/voltz-core/blob/main/test/active_lp_management_strategy/active_lp_management_strategy.ts).

Refer to [Active LP Strategy](https://github.com/Voltz-Protocol/voltz-core/blob/main/contracts/test/TestActiveLPManagementStrategy.sol) to check out a simple active lp strategy contract implementation.

## Liquidator Bot (example)

In order to test out a simple liquidator bot simulation on top of Voltz, head over to [Liquidator Bot Simulation](https://github.com/Voltz-Protocol/voltz-core/blob/main/test/liquidator_bot/liquidator_bot.ts).

Refer to [LiquidatorBot](https://github.com/Voltz-Protocol/voltz-core/blob/main/contracts/test/TestLiquidatorBot.sol) to check out a simple liquidator bot implementation.

To run a liquidator bot simulation: run:

`npx hardhat test test/liquidator_bot/liquidator_bot.ts`

## Bug Bounty

Alongside third-party auditors we want help from the community in ensuring Voltz Protocol remains secure. As a result, we have a generous bug-bounty program on [Immunifi](https://immunefi.com/bounty/voltz/). We look forward to your help in creating one of the most important lego-blocks of a new financial system!

## Uniswap v3 Additional Use Grant

There are a large number of innovative design decisions required to create Voltz Protocol, including the use of concentrated liquidity pioneered in [Uniswap v3](https://uniswap.org/whitepaper-v3.pdf). However, Uniswap v3 is subject to a [Business Source License](https://github.com/Uniswap/v3-core/blob/main/LICENSE), meaning Uniswap v3 code can only be used in another protocol if that protocol is provided with an “Additional Use Grant” by the Uniswap community.

[Voltz was provided an Additional Use Grant](https://app.ens.domains/name/v3-core-license-grants.uniswap.eth/details), executed following an [on-chain governance vote](https://app.uniswap.org/#/vote/2/11?chain=mainnet) by the Uniswap Community. This means Uniswap v3 code can be used within Voltz Protocol. However, if another project wishes to use this code they will also need to get an Additional Use Grant from Uniswap Governance in accordance with the Business Source License.

The Uniswap v3 code subject to the Business Source License can be identified by the “SPDX-License-Identifier: BUSL-1.1” at the top of each library or smart contract.

## Code Contributions

We are extremely excited to have the support of individuals and teams that wish to contribute to Voltz core contracts. Before starting to work on major contributions make sure to discuss them with the Voltz community to make sure they are in alignment with our roadmap and long-term vision. If you have any questions or just want to have a discussion feel free to jump into our [discord](https://discord.com/invite/KVWtUGRumk).

## Build and Test

### Getting Started

[Install Yarn](https://yarnpkg.com/getting-started/install)

[Install and Setup Hardhat](https://hardhat.org)

### Setup

```
git clone https://github.com/voltzprotocol/voltz-core.git
cd voltz-core
yarn
npx husky install
```

### Compile

```
npx hardhat compile
```

### Test

```
npx hardhat test
```

### Linting

We use [eslint](https://eslint.org/), [solhint](https://protofire.github.io/solhint/) and [prettier](https://prettier.io/) to handle linting.

`package.json` contains a few scripts to help you with linting and formatting.

The most important is `yarn run check`, which will fix any formatting and linting issues and then run the entire codebase through the linter. You should always run this before merging any code into `main`.

By default, we install a pre-push hook to run `yarn run check` before each push. If you need to override this, you can pass the `--no-verify` flag:

    git push -u origin my-fancy-branch --no-verify

#### Linting

- `yarn lint` - Lint the entire codebase.
- `yarn lint:sol` - Lint Solidity files.
- `yarn lint:ts` - Lint TypeScript files.
- `yarn lint:sol:fix` - Fix Solidity files.
- `yarn lint:ts:fix` - Fix TypeScript files.
- `yarn lint:fix` - Fix linting errors across the entire codebase.

#### Formatting

- `yarn format` - Format the entire codebase.
- `yarn format:sol` - Format Solidity files.
- `yarn format:ts` - Format TypeScript files.
- `yarn format:sol:check` - Check the formatting of all Solidity files.
- `yarn format:ts:check` - Check the formatting of all TypeScript files.
- `yarn format:check` - Check the formatting of all files.

### Deployment and Testing

#### Create a local deployment for testing

To start a local blockchain (hardhat node) and deploy our contracts to it, run:

`yarn deploy:localhost`

#### Fork mainnet for testing

To fork third party contracts (e.g. Aave, Compound, Lido, Rocket, ...) from mainnet to a local blockchain (hardhat node) for testing, run:

`yarn deploy:mainnet_fork`

(If you want to fork mainnet at a specific block, e.g. before some event happened on chain, you can specify `blockNumber` in the `forking` section of `hardhat.config.ts`.)

This command will deploy a new system of the latest Voltz contracts on top of those third party contracts. You can interact with this system using `--network localhost`.

To instead test / simulate / expirment with the Voltz mainnet deployment on your local blockchain, you can subsequently run:

`rm -rf deployments/localhost && cp -p -r deployments/mainnet deployments/localhost`

You can now interact with a fork of the current mainnet system using `--network localhost`.

To change the block production cadence of the local blockchain (sometimes useful to mirror timing on mainnet), see commented out lines in `deploy/0.factory.ts`

#### Deploy to kovan

To deploy our contracts to the kovan testnet, first check the configuration for kovan in [the deployment config](./deployConfig/config.ts), and once it is correct run:

`yarn deploy:kovan`

#### Deploy to mainnet

To deploy our contracts to the kovan testnet, first check the configuration for kovan in [the deployment config](./deployConfig/config.ts), and once it is correct run:

`yarn deploy:kovan`

#### Source code verification

To verify the deployed contracts in etherscan, ensure that you have a valid `ETHERSCAN_API_KEY` value defined in your `.env` file, and ensure that your repo state matches the state at which the contracts in question were deployed, and then run:

`npx hardhat --network <network> etherscan-verify`

Sometimes this can fail, particularly if verification is not done at the same time as the contract deployment. (Seemingly innocuous changes to unrelated contracts can affect the compilation / bytecode verification.)

If it does fail, there are two other approaches we can try:

1. Add a --solc-input flag: `npx hardhat --network <network> etherscan-verify --solc-input`. This sends all known contract code to etherscan and makes it less clear for users, but it is more likely to work. However, we have also seen that sometimes the volume of data gets too large and causes a failure.
2. Use the `verify` task instead of the `etherscan-verify` task. See usage for details.
   - This takes a little more effort and you must specify the (space separated) constructor params after the contract address, e.g: `npx hardhat --network mainnet verify --contract contracts/Factory.sol:VoltzERC1967Proxy 0x682F3e5685Ff51C232cF842840BA27E717C1AE2E 0x7380df8abb0c44617c2a64bf2d7d92caa852f03f 0x`
   - If the constructor params are complex, they can be imported from a file using the `--constructor-args` flag

#### Verify on Arbitrum Goelri

Make sure you have the Arbiscan Api Key in the env variables.
Due to a Hardhat bug, we have to replace the Etherscan key with the Arbiscan one, otherwise, it would say the key is wrong.

`npx hardhat --network arbitrumGoerli etherscan-verify --api-url https://api-goerli.arbiscan.io/`

#### Mint tokens for testing

There is a task for this. Run `npx hardhat help mintTestTokens` for task usage.

#### Deploy an IRS Instance

Run: `npx hardhat createIrsInstance --network <networkName> --rate-oracle <rateOracleName> [--tick-spacing <tickSpacingValue>]`

Where `rateOracleName` is the name of a rate oracle instance as defined in the `deployments/<networkName>` directory. E.g. it might be "MockTestRateOracle" on localhost, or "AaveRateOracle_USDT" on kovan.

#### List IRS Instances

`npx hardhat listIrsInstances --network <networkName>`

For humans, some post-processing can be useful to make the output more readable. E.g. in bash:

`npx hardhat listIrsInstances --network <networkName> | column -s, -t`

#### Upgrading contracts

See usage for upgrade tasks, e.g.:

- `npx hardhat deployUpdatedImplementations --help`
- `npx hardhat updateRateOracle --help`
- `npx hardhat upgradeVAMM --help`

## Python package management

When running the python scripts use the pipenv virtual environment and pip3 package manager. To do this you need to make sure that you have a clean installation of python3, pip3, and pipenv. You can python3 with brew which also installs pip3 with it. You can then install pipenv using `pip3 install pipenv`.

Next, open a terminal in the VS Code repo you want and run `pipenv shell`, creating a python virtual environment. You can then
use `pipenv install [package name]` to install packages like `pandas`. This creates 2 files, a Pipfile and a Piplock file. These keep track of the packages and can be treated like the package.json and package.lock files for a node projecty.

## Terms and Conditions

The Voltz Protocol, and any products or services associated therewith, is offered only to persons (aged 18 years or older) or entities who are not residents of, citizens of, are incorporated in, owned or controlled by a person or entity in, located in, or have a registered office or principal place of business in any “Restricted Territory.”

The term Restricted Territory includes the United States of America (including its territories), Algeria, Bangladesh, Bolivia, Belarus, Myanmar (Burma), Côte d’Ivoire (Ivory Coast), Egypt, Republic of Crimea, Cuba, Democratic Republic of the Congo, Iran, Iraq, Liberia, Libya, Mali, Morocco, Nepal, North Korea, Oman, Qatar, Somalia, Sudan, Syria, Tunisia, Venezuela, Yemen, Zimbabwe; or any jurisdictions in which the sale of cryptocurrencies are prohibited, restricted or unauthorized in any form or manner whether in full or in part under the laws, regulatory requirements or rules in such jurisdiction; or any state, country, or region that is subject to sanctions enforced by the United States, such as the Specially Designed Nationals and Blocked Persons List (“SDN List”) and Consolidated Sanctions List (“Non-SDN Lists”), the United Kingdom, or the European Union.
