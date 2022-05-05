import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  getConfigDefaults,
  getAaveLendingPoolAddress,
  getAaveTokens,
  getMaxDurationOfIrsInSeconds,
} from "../deployConfig/config";
import { AaveRateOracle, BaseRateOracle } from "../typechain";
import { BigNumberish } from "ethers";

const MAX_BUFFER_GROWTH_PER_TRANSACTION = 100;
const BUFFER_SIZE_SAFETY_FACTOR = 1.2; // The buffer must last for 1.2x as long as the longest expected IRS

const applyBufferConfig = async (
  r: BaseRateOracle,
  minBufferSize: number,
  minSecondsSinceLastUpdate: number,
  maxIrsDurationInSeconds: number
) => {
  const secondsWorthOfBuffer = minBufferSize * minSecondsSinceLastUpdate;
  if (
    secondsWorthOfBuffer <
    maxIrsDurationInSeconds * BUFFER_SIZE_SAFETY_FACTOR
  ) {
    throw new Error(
      `Buffer config of {size ${minBufferSize}, minGap ${minSecondsSinceLastUpdate}s} ` +
        `does not guarantee adequate buffer for an IRS of duration ${maxIrsDurationInSeconds}s`
    );
  }

  let currentSize = (await r.oracleVars())[2];
  // console.log(`currentSize of ${r.address} is ${currentSize}`);

  while (currentSize < minBufferSize) {
    // Growing the buffer can use a lot of gas so we may split buffer growth into multiple trx
    const newSize = Math.min(
      currentSize + MAX_BUFFER_GROWTH_PER_TRANSACTION,
      minBufferSize
    );
    const trx = await r.increaseObservationCardinalityNext(newSize, {
      gasLimit: 10000000,
    });
    await trx.wait();
    console.log(`Increased size of ${r.address}'s buffer to ${newSize}`);

    currentSize = (await r.oracleVars())[2];
  }

  const currentSecondsSinceLastUpdate = (
    await r.minSecondsSinceLastUpdate()
  ).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentSecondsSinceLastUpdate !== minSecondsSinceLastUpdate) {
    const trx = await r.setMinSecondsSinceLastUpdate(
      minSecondsSinceLastUpdate,
      { gasLimit: 10000000 }
    );
    await trx.wait();
    console.log(
      `Updated minSecondsSinceLastUpdate of ${r.address} to ${minSecondsSinceLastUpdate}`
    );
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;
  const network = hre.network.name;

  // Set up rate oracles for the Aave lending pool, if one exists
  const existingAaveLendingPoolAddress = getAaveLendingPoolAddress(network);
  const aaveTokens = getAaveTokens(network);
  const maxDurationOfIrsInSeconds = getMaxDurationOfIrsInSeconds(network);

  if (existingAaveLendingPoolAddress && aaveTokens) {
    const aaveLendingPool = await ethers.getContractAt(
      "IAaveV2LendingPool",
      existingAaveLendingPoolAddress
    );

    for (const token of aaveTokens) {
      const rateOracleIdentifier = `AaveRateOracle_${token.name}`;
      let rateOracleContract = (await ethers.getContractOrNull(
        rateOracleIdentifier
      )) as AaveRateOracle;

      if (!rateOracleContract) {
        // There is no Aave rate oracle already deployed for this token. Deploy one now.
        // But first, do a sanity check
        const normalizedIncome =
          await aaveLendingPool.getReserveNormalizedIncome(token.address);

        if (!normalizedIncome) {
          throw Error(
            `Could not find data for token ${token.name} (${token.address}) in Aaave contract ${aaveLendingPool.address}.`
          );
        } else {
          let trustedTimestamps: number[] = [];
          let trustedObservationValuesInRay: BigNumberish[] = [];
          console.log(
            `Adding ${
              token.trustedDataPoints ? token.trustedDataPoints.length : 0
            } trusted data points`
          );
          if (token.trustedDataPoints) {
            trustedTimestamps = token.trustedDataPoints.map((e) => e[0]);
            trustedObservationValuesInRay = token.trustedDataPoints.map(
              (e) => e[1]
            );
          }
          await deploy(rateOracleIdentifier, {
            contract: "AaveRateOracle",
            from: deployer,
            args: [
              aaveLendingPool.address,
              token.address,
              trustedTimestamps,
              trustedObservationValuesInRay,
            ],
            log: doLogging,
          });
          console.log(
            `Deployed ${token.name} (${token.address}) rate oracle for Aave lending pool ${aaveLendingPool.address}`
          );

          rateOracleContract = (await ethers.getContract(
            rateOracleIdentifier
          )) as AaveRateOracle;
        }
      }

      // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
      await applyBufferConfig(
        rateOracleContract as unknown as BaseRateOracle,
        token.rateOracleBufferSize,
        token.minSecondsSinceLastUpdate,
        maxDurationOfIrsInSeconds
      );
    }
  }

  // Deploy rate oracle pointing at mocks, if mocks exist
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const mockAaveLendingPool = await ethers.getContractOrNull(
    "MockAaveLendingPool"
  );
  if (mockToken && mockAaveLendingPool) {
    console.log(
      `Deploy rate oracle for mocked {token, aave}: {${mockToken.address}, ${mockAaveLendingPool.address}}`
    );
    await deploy("MockTokenRateOracle", {
      contract: "AaveRateOracle",
      from: deployer,
      args: [mockAaveLendingPool.address, mockToken.address, [], []],
      log: doLogging,
    });
    const rateOracleContract = (await ethers.getContract(
      "MockTokenRateOracle"
    )) as AaveRateOracle;

    // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
    const configDefaults = getConfigDefaults(network);
    await applyBufferConfig(
      rateOracleContract as unknown as BaseRateOracle,
      configDefaults.rateOracleBufferSize,
      configDefaults.rateOracleMinSecondsSinceLastUpdate,
      maxDurationOfIrsInSeconds
    );

    // Fast forward time to ensure that the mock rate oracle has enough historical data
    await hre.network.provider.send("evm_increaseTime", [
      configDefaults.marginEngineLookbackWindowInSeconds,
    ]);
  }
  return false; // This script is safely re-runnable and will reconfigure existing rate oracles if required
};
func.tags = ["AaveRateOracles"];
export default func;
