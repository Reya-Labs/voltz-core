# Voltz Core

![](<.gitbook/assets/whitepaper_banner (1).jpg>)

## Introduction

Voltz is a noncustodial automated market maker for Interest Rate Swaps (IRS). Voltz uses a Concentrated Liquidity Virtual AMM (vAMM) for price discovery only, with the management of the underlying assets performed by the Margin Engine. The combined impact of these modules enables counterparties to create and trade fixed and variable rates through a mechanism that is up to 3,000x more capital efficient than alternative interest rate swap models, whilst also providing Liquidity Providers and Traders with significant control and flexibility over their positions.

This repository contains the smart contracts that power Voltz Protocol. Over time, the Voltz Protocol will be governed by the VoltzDAO, so that the protocol is owned and managed by the community that uses it. Decentralising ownership is critical to ensure the strength of the ecosystem we are all looking to build and to provide control to those that use the system. However, Voltz will initially be controlled by the Voltz Multisigs whilst the VoltzDAO is being developed.

We would love to see how you can build and improve upon what we've built here at Voltz.

## How it works

All supporting documentation of Voltz Protocol can be accessed [here](https://github.com/voltzprotocol/voltz-core/tree/main/docs).

## Code Contributions

We welcome and are extremely excited to support individuals and teams that wish to contribute to the Voltz core contracts. If you wish to propose changes to the current codebase, make sure you do it in accordance with the contribution guidelines. Before starting to work on major contributions make sure to discuss them with the Voltz community and the core team to make sure they are in alignment with our roadmap and long-term vision. In case you have any questions or just want to have a discussion feel free to jump into the dev channel of our [discord](https://discord.com/invite/KVWtUGRumk).

## Build and Test

### Getting Started

[Install Npm](https://nodejs.org/en/download/)

[Install and Setup Hardhat](https://hardhat.org)

### Setup

```
git clone https://github.com/voltzprotocol/voltz-core.git
cd voltz-core
npm install
```

### Compile

```
npx hardhat compile
```

### Test

```
npx hardhat test
```

## Contracts

We detail a few of the core contracts in the Voltz Protocol \[TODO].
