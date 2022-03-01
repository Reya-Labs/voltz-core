import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getAaveLendingPoolAddress, getAaveTokens } from "./config";

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
      const alreadyDeployed = await ethers.getContractOrNull(
        rateOracleIdentifier
      );

      if (!alreadyDeployed) {
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
        }
      }
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
    await deploy("TestRateOracle", {
      from: deployer,
      args: [mockAaveLendingPool.address, mockToken.address],
      log: doLogging,
    });
  }

  // TODO: should probably also grow bugger of all deployed rate oracles, and read first data point
};
func.tags = ["RateOracles"];
export default func;
