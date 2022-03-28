import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import {
  configDefaults,
  getAaveLendingPoolAddress,
  getAaveTokens,
} from "./config";
import { AaveRateOracle } from "../typechain";

const checkBufferSize = async (r: AaveRateOracle, minSize: number) => {
  const currentSize = (await r.oracleVars())[2];
  // console.log(`currentSize of ${r.address} is ${currentSize}`);

  if (currentSize < minSize) {
    await r.increaseObservationCardinalityNext(minSize);
    console.log(`Increased size of ${r.address}'s buffer to ${minSize}`);
  }
};

const checkMinSecondsSinceLastUpdate = async (
  r: AaveRateOracle,
  minSeconds: number
) => {
  const currentVal = (await r.minSecondsSinceLastUpdate()).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentVal !== minSeconds) {
    await r.setMinSecondsSinceLastUpdate(minSeconds);
    console.log(
      `Updated minSecondsSinceLastUpdate of ${r.address} to ${minSeconds}`
    );
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  // Set up rate oracles for the Aave lending pool, if one exists
  const existingAaveLendingPoolAddress = getAaveLendingPoolAddress();
  const aaveTokens = getAaveTokens();

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
          await deploy(rateOracleIdentifier, {
            contract: "AaveRateOracle",
            from: deployer,
            args: [aaveLendingPool.address, token.address],
            log: doLogging,
          });
          console.log(
            `Created ${token.name} (${token.address}) rate oracle for Aave lending pool ${aaveLendingPool.address}`
          );

          rateOracleContract = (await ethers.getContract(
            rateOracleIdentifier
          )) as AaveRateOracle;

          // Check the buffer size and increase if required
          await rateOracleContract.writeOracleEntry();
        }
      }

      // Ensure the buffer is big enough
      await checkBufferSize(
        rateOracleContract as AaveRateOracle,
        token.rateOracleBufferSize
      );
      await checkMinSecondsSinceLastUpdate(
        rateOracleContract as AaveRateOracle,
        token.minSecondsSinceLastUpdate
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
      args: [mockAaveLendingPool.address, mockToken.address],
      log: doLogging,
    });
    const rateOracleContract = (await ethers.getContract(
      "MockTokenRateOracle"
    )) as AaveRateOracle;
    // Ensure the buffer is big enough
    await checkBufferSize(
      rateOracleContract as AaveRateOracle,
      configDefaults.rateOracleBufferSize
    );
    await checkMinSecondsSinceLastUpdate(
      rateOracleContract as AaveRateOracle,
      configDefaults.rateOracleMinSecondsSinceLastUpdate
    );
  }
};
func.tags = ["RateOracles"];
export default func;
