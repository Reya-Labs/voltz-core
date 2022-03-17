import { BigNumber, utils } from "ethers";
import { task } from "hardhat/config";
import { IRateOracle, MarginEngine, MockAaveLendingPool } from "../typechain";

task("updateAPYFor15Days", "updateAPYFor15Days").setAction(async (_, hre) => {
  const aaveLendingPool = (await hre.ethers.getContractAt(
    "MockAaveLendingPool",
    "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
  )) as MockAaveLendingPool;

  const rateOracle = (await hre.ethers.getContractAt(
    "IRateOracle",
    "0x0165878A594ca255338adfa4d48449f69242Eb8F"
  )) as IRateOracle;

  for (let i = 0; i < 15; i++) {
    await hre.network.provider.send("evm_increaseTime", [86400]);
    for (let j = 0; j < 2; j++) {
      await hre.network.provider.send("evm_mine", []);
    }

    const rni =
      Math.floor((1 + (i + 1) / 3650) * 10000 + 0.5).toString() +
      "0".repeat(23);
    console.log(rni);
    await aaveLendingPool.setReserveNormalizedIncome(
      "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
      rni
    );

    await rateOracle.writeOracleEntry();
  }

  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    "0x75537828f2ce51be7289709686a69cbfdbb714f1"
  )) as MarginEngine;

  await marginEngine.setCacheMaxAgeInSeconds(BigNumber.from(86400));
  await marginEngine.setSecondsAgo(BigNumber.from(86400 * 7));

  await marginEngine.getHistoricalApy();
  console.log(
    "historical apy",
    utils.formatEther(await marginEngine.getHistoricalApyReadOnly())
  );
});

module.exports = {};
