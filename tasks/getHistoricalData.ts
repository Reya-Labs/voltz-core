import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { IAaveV2LendingPool, ICToken, IERC20Minimal } from "../typechain";
import { BigNumber } from "ethers";

const lidoStEthMainnetAddress = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const lidoStEthMainnetStartBlock = 11593216;
const rocketEthMainnetAddress = "0xae78736Cd615f374D3085123A210448E74Fc6393";
const rocketEthnMainnetStartBlock = 13326304;
const compoundMainnetStartBlock = 7710760; // cUSDC deployment
const aaveLendingPoolAddress = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
const aaveLendingPoolStartBlock = 11367585;
const cTokenAddresses = {
  cDAI: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
  cUSDC: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  cWBTC: "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
  cWBTC2: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
  cUSDT: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  cTUSD: "0x12392f67bdf24fae0af363c24ac620a2f67dad86",
};
const aTokenUnderlyingAddresses = {
  aDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  aUSDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  aWBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  aUSDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  aTUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
};

task(
  "getHistoricalData",
  "Predicts the IRS addresses used by a not-yet-created IRS instance"
)
  .addParam(
    "fromBlock",
    "Get data from this past block number (up to some larger block number defined by `toBlock`)",
    undefined,
    types.int
  )
  .addParam(
    "blockInterval",
    "Script will fetch data every `blockInterval` blocks (between `fromBlock` and `toBlock`)",
    5760,
    types.int
  )
  .addOptionalParam(
    "toBlock",
    "Get data up to this block (defaults to latest block)",
    undefined,
    types.int
  )
  .addFlag("lido", "Get rates data from Lido for their ETH staking returns")
  .addFlag(
    "rocket",
    "Get rates data from RocketPool for their ETH staking returns"
  )
  .addFlag(
    "compound",
    "Get rates data from Compound (USDC, WBTC, DAI, USDT, TUSD, ETH)"
  )
  .addFlag(
    "aave",
    "Get rates data from Aave (USDC, WBTC, DAI, USDT, TUSD, ETH)"
  )
  .setAction(async (taskArgs, hre) => {
    if (hre.network.name !== "mainnet") {
      console.error("Only mainnet supported");
    }

    const currentBlock = await hre.ethers.provider.getBlock("latest");
    const currentBlockNumber = currentBlock.number;
    let toBlock = currentBlockNumber;
    const fromBlock = taskArgs.fromBlock;

    if (taskArgs.toBlock) {
      toBlock = Math.min(currentBlockNumber, taskArgs.toBlock);
    }

    if (fromBlock >= toBlock) {
      console.error(`Invalid block range: ${fromBlock}-${toBlock}`);
    }

    const stETH = await hre.ethers.getContractAt(
      "IStETH",
      lidoStEthMainnetAddress
    );
    const rocketEth = await hre.ethers.getContractAt(
      "IRocketEth",
      rocketEthMainnetAddress
    );

    let compoundHeader = "";
    const cTokens = new Map<string, ICToken>([]);
    const compoundDecimals = new Map<string, number>([]);

    if (taskArgs.compound) {
      const headers = [];
      for (const key in cTokenAddresses) {
        headers.push(`${key}_rate`);
        const cToken = (await hre.ethers.getContractAt(
          "ICToken",
          cTokenAddresses[key as keyof typeof cTokenAddresses]
        )) as ICToken;
        cTokens.set(key, cToken);
        const underlying = (await hre.ethers.getContractAt(
          "IERC20Minimal",
          await cToken.underlying()
        )) as IERC20Minimal;
        const decimals = await underlying.decimals();
        compoundDecimals.set(key, decimals);
      }
      compoundHeader = "," + headers.join(",");
    }

    let aaveHeader = "";
    if (taskArgs.aave) {
      const headers = [];
      for (const key in aTokenUnderlyingAddresses) {
        headers.push(`${key}_rate`);
      }
      aaveHeader = "," + headers.join(",");
    }

    const headerRow = `block,timestamp,time${
      taskArgs.lido ? ",lido_rate" : ""
    }${taskArgs.rocket ? ",rocket_rate" : ""}${compoundHeader}${aaveHeader}`;
    console.log(headerRow);

    for (
      let b = fromBlock;
      b <= currentBlockNumber;
      b += taskArgs.blockInterval
    ) {
      const rowValues: (BigNumber | null)[] = [];
      const block = await hre.ethers.provider.getBlock(b);
      const timestamp = block.timestamp;
      const timeString = new Date(timestamp * 1000).toISOString();

      // Lido
      if (taskArgs.lido) {
        if (b >= lidoStEthMainnetStartBlock) {
          const r = await stETH.getPooledEthByShares(toBn(1, 27), {
            blockTag: b,
          });
          rowValues.push(r);
        } else {
          rowValues.push(null);
        }
      }

      // Rocket
      if (taskArgs.rocket) {
        if (b >= rocketEthnMainnetStartBlock) {
          const r = await rocketEth.getEthValue(toBn(1, 27), {
            blockTag: b,
          });
          rowValues.push(r);
        } else {
          rowValues.push(null);
        }
      }

      // Compound
      if (taskArgs.compound) {
        for (const key of cTokens.keys()) {
          if (b >= compoundMainnetStartBlock) {
            try {
              const cToken = cTokens.get(key);
              const decimals = compoundDecimals.get(key);
              if (cToken && decimals) {
                let r = await cToken.exchangeRateStored({
                  blockTag: b,
                });
                if (decimals > 17) {
                  r = r.div(BigNumber.from(10).pow(decimals - 17));
                } else if (decimals < 17) {
                  r = r.mul(BigNumber.from(10).pow(17 - decimals));
                }
                rowValues.push(r);
              } else {
                // console.log("Error for cToken: ", key);
                rowValues.push(null);
              }
            } catch (e) {
              // console.log("Could not get rate for cToken: ", key);
              rowValues.push(null);
            }
          } else {
            // Before start block but we need a placeholder to keep things aligned
            rowValues.push(null);
          }
        }
      }

      // Aave
      if (taskArgs.aave) {
        const aavePool = (await hre.ethers.getContractAt(
          "IAaveV2LendingPool",
          aaveLendingPoolAddress
        )) as IAaveV2LendingPool;

        for (const key in aTokenUnderlyingAddresses) {
          if (b >= aaveLendingPoolStartBlock) {
            try {
              const r = await aavePool.getReserveNormalizedIncome(
                aTokenUnderlyingAddresses[
                  key as keyof typeof aTokenUnderlyingAddresses
                ],
                {
                  blockTag: b,
                }
              );
              rowValues.push(r);
            } catch (e) {
              // console.log("Could not get rate for aToken: ", key);
              rowValues.push(null);
            }
          } else {
            // Before start block but we need a placeholder to keep things aligned
            rowValues.push(null);
          }
        }
      }

      if (rowValues.every((element) => element === null)) {
        // Nothing of interest to write - skip this row
      } else {
        // We have some non-null values to write
        const values = rowValues.map((e) => (e ? e.toString() : "-"));
        console.log(`${b},${timestamp},${timeString},${values.join(",")}`);
      }
    }
  });

module.exports = {};
