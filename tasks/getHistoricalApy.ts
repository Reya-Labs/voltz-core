import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";

const lidoMarginEngineAddress = "0x21F9151d6e06f834751b614C2Ff40Fc28811B235";
const rocketMarginEngineAddress = "0xB1125ba5878cF3A843bE686c6c2486306f03E301";
const voltzLidoStartBlock = 14977662;
const voltzRocketStartBlock = 14977668;
// const lidoMarginEngineStartBlock = 15058080; // For first Lido Margin Engine
// const rocketRateOracle1Address = "0xC6E151da56403Bf2eDF68eE586cF78eE5781D45F";
const rocketRateOracle1Address = "0xe38b6847E611e942E6c80eD89aE867F522402e80"; // mainnet_fork
const rocketRateOracle2Address = "0x1dEa21b51CfDd4c62cB67812D454aBE860Be24A2";
// const lidoRateOracle1Address = "0x464c7Dc02a400C2eF5a27B45552877A8D7116361";
const lidoRateOracle1Address = "0xd3FFD73C53F139cEBB80b6A524bE280955b3f4db"; // mainnet_fork
const lidoRateOracle2Address = "0x208eA737deA529bafb3cD77d722c8ec4A4a637c9";
const lidoOracleAddress = "0x442af784a788a5bd6f42a01ebe9f287a871243fb";
const blocksPerDay = 6570; // 13.15 seconds per block

task(
  "getHistoricalApy",
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
  .addFlag(
    "voltzRocket",
    "Get historical APY values from some of our RocketPool rate oracle(s) and margin engine(s)"
  )
  .addFlag(
    "voltzLido",
    "Get historical APY values from some of our Lido rate oracle(s) and margin engine(s)"
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
    }`;
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
