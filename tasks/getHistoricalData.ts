import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import {
  IAaveV2LendingPool,
  ICToken,
  IERC20Minimal,
  IRocketNetworkBalances,
} from "../typechain";
import { BigNumber } from "ethers";

const lidoStEthMainnetAddress = "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84";
const lidoStEthMainnetStartBlock = 11593216;
const rocketEthMainnetAddress = "0xae78736Cd615f374D3085123A210448E74Fc6393";
const rocketEthnMainnetStartBlock = 13326304;
const RocketNetworkBalancesEthMainnet =
  "0x138313f102ce9a0662f826fca977e3ab4d6e5539";
const compoundMainnetStartBlock = 7710760; // cUSDC deployment
const aaveLendingPoolAddress = "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9";
const aaveLendingPoolStartBlock = 11367585;
const lidoMarginEngineAddress = "0x21F9151d6e06f834751b614C2Ff40Fc28811B235";
const rocketMarginEngineAddress = "0xB1125ba5878cF3A843bE686c6c2486306f03E301";
const voltzLidoStartBlock = 14977662;
const voltzRocketStartBlock = 14977668;
// const lidoMarginEngineStartBlock = 15058080; // For first Lido Margin Engine
const rocketRateOracle1Address = "0xC6E151da56403Bf2eDF68eE586cF78eE5781D45F";
// const rocketRateOracle1Address = "0xe38b6847E611e942E6c80eD89aE867F522402e80"; // mainnet_fork
const rocketRateOracle2Address = "0x1dEa21b51CfDd4c62cB67812D454aBE860Be24A2";
const lidoRateOracle1Address = "0x464c7Dc02a400C2eF5a27B45552877A8D7116361";
// const lidoRateOracle1Address = "0xd3FFD73C53F139cEBB80b6A524bE280955b3f4db"; // mainnet_fork
const lidoRateOracle2Address = "0x208eA737deA529bafb3cD77d722c8ec4A4a637c9";
const lidoOracleAddress = "0x442af784a788a5bd6f42a01ebe9f287a871243fb";
const cTokenAddresses = {
  cDAI: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
  cUSDC: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  cWBTC: "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
  cWBTC2: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
  cUSDT: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
  cTUSD: "0x12392f67bdf24fae0af363c24ac620a2f67dad86",
  cETH: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
};
const aTokenUnderlyingAddresses = {
  aDAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  aUSDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  aWBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  aUSDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  aTUSD: "0x0000000000085d4780B73119b644AE5ecd22b376",
  aWETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
};
const blocksPerDay = 6570; // 13.15 seconds per block

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
    blocksPerDay,
    types.int
  )
  .addParam(
    "lookbackWindow",
    "The lookback window to use, in seconds, when querying data from a RateOracle",
    60 * 60 * 24 * 28, // 28 days
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
    "voltzRocket",
    "Get historical APY values from some of our RocketPool rate oracle(s) and margin engine(s)"
  )
  .addFlag(
    "voltzLido",
    "Get historical APY values from some of our Lido rate oracle(s) and margin engine(s)"
  )
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
    const rocketNetworkBalancesEth = (await hre.ethers.getContractAt(
      "IRocketNetworkBalances",
      RocketNetworkBalancesEthMainnet
    )) as IRocketNetworkBalances;
    const rocketEth = await hre.ethers.getContractAt(
      "IRocketEth",
      rocketEthMainnetAddress
    );
    const lidoMarginEngine = await hre.ethers.getContractAt(
      "MarginEngine",
      lidoMarginEngineAddress
    );
    const rocketMarginEngine = await hre.ethers.getContractAt(
      "MarginEngine",
      rocketMarginEngineAddress
    );
    const rocketRateOracle1 = await hre.ethers.getContractAt(
      "BaseRateOracle",
      rocketRateOracle1Address
    );
    const rocketRateOracle2 = await hre.ethers.getContractAt(
      "BaseRateOracle",
      rocketRateOracle2Address
    );
    const lidoRateOracle1 = await hre.ethers.getContractAt(
      "BaseRateOracle",
      lidoRateOracle1Address
    );
    const lidoRateOracle2 = await hre.ethers.getContractAt(
      "BaseRateOracle",
      lidoRateOracle2Address
    );
    const lidoOracle = await hre.ethers.getContractAt(
      "ILidoOracle",
      lidoOracleAddress
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
        let decimals;
        if (key === "cETH") {
          // There is no underlying ERC20 token for cETH, but we know ETH uses 18 decimals
          decimals = 18;
        } else {
          const underlying = (await hre.ethers.getContractAt(
            "IERC20Minimal",
            await cToken.underlying()
          )) as IERC20Minimal;
          decimals = await underlying.decimals();
        }
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
      taskArgs.voltzLido
        ? ",lido_margin_engine_APY,lido_rate_oracle1_APY,lido_rate_oracle2_APY,lido_frame_epoch_id,lido_frame_start,lido_frame_end,lido_completed_epoch,epochs_per_frame,slots_per_epoch,seconds_per_slot,genesis_time,time_of_last_completed_epoch"
        : ""
    }${taskArgs.lido ? ",lido" : ""}${
      taskArgs.rocket
        ? ",rocket_balances_block,rocket_balances_timestamp,rocket_rate"
        : ""
    }${
      taskArgs.voltzRocket
        ? ",rocket_margin_engine_APY,rocket_rate_oracle1_APY,rocket_rate_oracle2_APY"
        : ""
    }${compoundHeader}${aaveHeader}`;
    console.log(headerRow);

    for (let b = fromBlock; b <= toBlock; b += taskArgs.blockInterval) {
      const rowValues: (BigNumber | null)[] = [];
      const block = await hre.ethers.provider.getBlock(b);
      const timestamp = block.timestamp;
      const timeString = new Date(timestamp * 1000).toISOString();

      // Voltz-Lido
      if (taskArgs.voltzLido) {
        if (b >= voltzLidoStartBlock) {
          try {
            const r_me = await lidoMarginEngine.getHistoricalApyReadOnly({
              blockTag: b,
            });
            rowValues.push(r_me);
          } catch (e) {
            rowValues.push(null);
          }

          const r_ro1 = await lidoRateOracle1.getApyFromTo(
            // block.timestamp - 28 * 60 * 60, // 28 hours
            block.timestamp - taskArgs.lookbackWindow,
            block.timestamp,
            {
              blockTag: b,
            }
          );
          rowValues.push(r_ro1);

          try {
            const r_ro2 = await lidoRateOracle2.getApyFromTo(
              // block.timestamp - 28 * 60 * 60, // 28 hours
              block.timestamp - taskArgs.lookbackWindow,
              block.timestamp,
              {
                blockTag: b,
              }
            );
            rowValues.push(r_ro2);
          } catch (e) {
            rowValues.push(null);
          }

          const frame = await lidoOracle.getCurrentFrame({
            blockTag: b,
          });
          rowValues.push(frame);

          const completedEpoch = await lidoOracle.getLastCompletedEpochId({
            blockTag: b,
          });
          rowValues.push(completedEpoch);

          const { epochsPerFrame, slotsPerEpoch, secondsPerSlot, genesisTime } =
            await lidoOracle.getBeaconSpec({
              blockTag: b,
            });
          rowValues.push(epochsPerFrame);
          rowValues.push(slotsPerEpoch);
          rowValues.push(secondsPerSlot);
          rowValues.push(genesisTime);

          const timeOfLastCompletedEpoch =
            genesisTime.toNumber() +
            completedEpoch.toNumber() *
              slotsPerEpoch.toNumber() *
              secondsPerSlot.toNumber();
          rowValues.push(timeOfLastCompletedEpoch);
        } else {
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
        }
      }

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
          const balancesBlockNumber =
            await rocketNetworkBalancesEth.getBalancesBlock({
              blockTag: b,
            });
          rowValues.push(balancesBlockNumber);

          const balancesBlock = await hre.ethers.provider.getBlock(
            balancesBlockNumber.toNumber()
          );
          rowValues.push(BigNumber.from(balancesBlock.timestamp));

          const r = await rocketEth.getEthValue(toBn(1, 27), {
            blockTag: b,
          });
          rowValues.push(r);
        } else {
          rowValues.push(null);
          rowValues.push(null);
          rowValues.push(null);
        }
      }

      // Voltz-Rocket
      if (taskArgs.voltzRocket) {
        if (b >= voltzRocketStartBlock) {
          try {
            const r_me = await rocketMarginEngine.getHistoricalApyReadOnly({
              blockTag: b,
            });
            rowValues.push(r_me);
          } catch (e) {
            rowValues.push(null);
          }

          const r_ro1 = await rocketRateOracle1.getApyFromTo(
            // block.timestamp - 28 * 60 * 60, // 28 hours
            block.timestamp - taskArgs.lookbackWindow,
            block.timestamp,
            {
              blockTag: b,
            }
          );
          rowValues.push(r_ro1);

          try {
            const r_ro2 = await rocketRateOracle2.getApyFromTo(
              // block.timestamp - 28 * 60 * 60, // 28 hours
              block.timestamp - taskArgs.lookbackWindow,
              block.timestamp,
              {
                blockTag: b,
              }
            );
            rowValues.push(r_ro2);
          } catch (e) {
            rowValues.push(null);
          }
        } else {
          rowValues.push(null);
          rowValues.push(null);
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
