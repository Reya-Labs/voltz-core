# Voltz Core

![](<.gitbook/assets/whitepaper_banner (1).jpg>)

## Introduction

Voltz is a noncustodial automated market maker for Interest Rate Swaps (IRS). Voltz uses a Concentrated Liquidity Virtual AMM (vAMM) for price discovery only, with the management of the underlying assets performed by the Margin Engine. The combined impact of these modules enables counterparties to create and trade fixed and variable rates through a mechanism that is up to 3,000x more capital efficient than alternative interest rate swap models, whilst also providing Liquidity Providers and Traders with significant control and flexibility over their positions.

This repository contains the smart contracts that power Voltz Protocol. Over time, Voltz Protocol will be governed by the DAO, so that the protocol is owned and managed by the community that uses it. Decentralizing ownership is critical to ensure the strength of the ecosystem we are all looking to build and to provide control to those that use the system. However, Voltz will initially be controlled by the Voltz Multisigs whilst the DAO is being created.

We would love to see how you can build and improve upon what we've built here at Voltz.

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

[Install Npm](https://nodejs.org/en/download/)

[Install and Setup Hardhat](https://hardhat.org)

### Setup

```
git clone https://github.com/voltzprotocol/voltz-core.git
cd voltz-core
npm install
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

The most important is `npm run check`, which will fix any formatting and linting issues and then run the entire codebase through the linter. You should always run this before merging any code into `main`.

By default, we install a pre-push hook to run `npm run check` before each push. If you need to override this, you can pass the `--no-verify` flag:

    git push -u origin my-fancy-branch --no-verify

#### Linting

- `npm run lint` - Lint the entire codebase.
- `npm run lint:sol` - Lint Solidity files.
- `npm run lint:ts` - Lint TypeScript files.
- `npm run lint:sol:fix` - Fix Solidity files.
- `npm run lint:ts:fix` - Fix TypeScript files.
- `npm run lint:fix` - Fix linting errors across the entire codebase.

#### Formatting

- `npm run format` - Format the entire codebase.
- `npm run format:sol` - Format Solidity files.
- `npm run format:ts` - Format TypeScript files.
- `npm run format:sol:check` - Check the formatting of all Solidity files.
- `npm run format:ts:check` - Check the formatting of all TypeScript files.
- `npm run format:check` - Check the formatting of all files.

### Deployment and Testing

#### Create a local deployment for testing

To start a local blockchain (hardhat node) and deploy our contracts to it, run:

`npm run deploy:localhost`

#### Deploy to kovan

To deploy our contracts to the kovan testnet, first check the configuration for kovan in [the deployment config](./deployConfig/config.ts), and once it is correct run:

`npm run deploy:kovan`

To verify the deployed contracts in etherscan, ensure that you have a valid `ETHERSCAN_API_KEY` value defined in your `.env` file and then run:

`npx hardhat --network kovan etherscan-verify --solc-input`

(At the time of writing the `--solc-input` flag is required due to some solidity issues. The result is somewhat unsatisfactory because all known contract code is displayed in etherscan for each contract, rather than just the relevant contracts. See [here](https://github.com/wighawag/hardhat-deploy/issues/263) for some discussion, but note that for us it seems to fail even with solc 0.8.9. See )

#### Mint tokens for testing

There is a task for this. Run `npx hardhat help mintTestTokens` for task usage.

#### Deploy an IRS Instance

Run: `npx hardhat createIrsInstance --network <networkName> --rate-oracle <rateOracleName> [--tick-spacing <tickSpacingValue>]`

Where `rateOracleName` is the name of a rate oracle instance as defined in the `deployments/<networkName>` directory. E.g. it might be "MockTestRateOracle" on localhost, or "AaveRateOracle_USDT" on kovan.

#### List IRS Instances

`npx hardhat listIrsInstances --network <networkName>`

For humans, some post-processing can be useful to make the output more readable. E.g. in bash:

`npx hardhat listIrsInstances --network <networkName> | column -s, -t`

## Terms and Conditions

The Voltz Protocol, and any products or services associated therewith, is offered only to persons (aged 18 years or older) or entities who are not residents of, citizens of, are incorporated in, or have a registered office in any “Restricted Territory.”

The term Restricted Territory includes the United States of America (including its territories), Algeria, Bangladesh, Bolivia, Belarus, Myanmar (Burma), Côte d’Ivoire (Ivory Coast), Egypt, Republic of Crimea, Cuba, Democratic Republic of the Congo, Iran, Iraq, Liberia, Libya, Mali, Morocco, Nepal, North Korea, Oman, Qatar, Somalia, Sudan, Syria, Tunisia, Venezuela, Yemen, Zimbabwe; or any jurisdictions in which the sale of cryptocurrencies are prohibited, restricted or unauthorized in any form or manner whether in full or in part under the laws, regulatory requirements or rules in such jurisdiction; or any state, country, or region that is subject to sanctions enforced by the United States, such as the Specially Designed Nationals and Blocked Persons List (“SDN List”) and Consolidated Sanctions List (“Non-SDN Lists”), the United Kingdom, or the European Union.
