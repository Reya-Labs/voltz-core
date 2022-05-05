import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  getCompoundTokens,
  getConfigDefaults,
  getMaxDurationOfIrsInSeconds,
} from "../deployConfig/config";
import { CompoundRateOracle } from "../typechain/CompoundRateOracle";
import { BaseRateOracle, ERC20 } from "../typechain";
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
    const trx = await r.increaseObservationCardinalityNext(newSize);
    await trx.wait();
    console.log(`Increased size of ${r.address}'s buffer to ${newSize}`);

    currentSize = (await r.oracleVars())[2];
  }

  const currentSecondsSinceLastUpdate = (
    await r.minSecondsSinceLastUpdate()
  ).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentSecondsSinceLastUpdate !== minSecondsSinceLastUpdate) {
    const trx = await r.setMinSecondsSinceLastUpdate(minSecondsSinceLastUpdate);
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

  // Set up rate oracles for the supported Compound CTokens, if defined
  const compoundTokens = getCompoundTokens(network);
  const maxDurationOfIrsInSeconds = getMaxDurationOfIrsInSeconds(network);

  if (compoundTokens) {
    for (const cTokenDefinition of compoundTokens) {
      const rateOracleIdentifier = `CompoundRateOracle_${cTokenDefinition.name}`;
      let rateOracleContract = (await ethers.getContractOrNull(
        rateOracleIdentifier
      )) as CompoundRateOracle;

      if (!rateOracleContract) {
        // There is no Compound rate oracle already deployed for this token. Deploy one now.
        // But first, do a sanity check
        const cToken = await ethers.getContractAt(
          "ICToken",
          cTokenDefinition.address
        );
        const exchangeRate = await cToken.exchangeRateStored();

        const underlying = (await ethers.getContractAt(
          "@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20",
          await cToken.underlying()
        )) as ERC20;

        if (!exchangeRate) {
          throw Error(
            `Could not find data for token ${cTokenDefinition.name} (${cTokenDefinition.address})`
          );
        } else {
          let trustedTimestamps: number[] = [];
          let trustedObservationValuesInRay: BigNumberish[] = [];
          console.log(
            `Adding ${
              cTokenDefinition.trustedDataPoints
                ? cTokenDefinition.trustedDataPoints.length
                : 0
            } trusted data points`
          );
          if (cTokenDefinition.trustedDataPoints) {
            trustedTimestamps = cTokenDefinition.trustedDataPoints.map(
              (e) => e[0]
            );
            trustedObservationValuesInRay =
              cTokenDefinition.trustedDataPoints.map((e) => e[1]);
          }
          const decimals = await underlying.decimals();

          await deploy(rateOracleIdentifier, {
            contract: "CompoundRateOracle",
            from: deployer,
            args: [
              cToken.address,
              underlying.address,
              decimals,
              trustedTimestamps,
              trustedObservationValuesInRay,
            ],
            log: doLogging,
          });
          console.log(
            `Deployed compound rate oracle(${cToken.address}, ${underlying.address}, ${decimals})`
          );

          rateOracleContract = (await ethers.getContract(
            rateOracleIdentifier
          )) as CompoundRateOracle;
        }
      }

      // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
      await applyBufferConfig(
        rateOracleContract as unknown as BaseRateOracle,
        cTokenDefinition.rateOracleBufferSize,
        cTokenDefinition.minSecondsSinceLastUpdate,
        maxDurationOfIrsInSeconds
      );
    }
  }

  // Deploy rate oracle pointing at mocks, if mocks exist
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const mockCToken = await ethers.getContractOrNull("MockCToken");
  if (mockToken && mockCToken) {
    const decimals = await mockToken.decimals();
    console.log(
      `Deploy compound rate oracle for mocks: {${mockToken.address}, ${mockCToken.address}, ${decimals}}`
    );

    await deploy("MockCTokenRateOracle", {
      contract: "CompoundRateOracle",
      from: deployer,
      args: [mockCToken.address, mockToken.address, decimals, [], []],
      log: doLogging,
    });
    const rateOracleContract = (await ethers.getContract(
      "MockCTokenRateOracle"
    )) as CompoundRateOracle;

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
func.tags = ["CompoundRateOracles"];
export default func;
