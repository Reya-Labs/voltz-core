import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers, network } from "hardhat";
import { config } from "./config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  // If our network has a pre-deployed (e.g. by Aave) lending pool, set up a rate oracle for that
  const networkContracts = config[network.name];
  const existingAaveLendingPoolAddress = networkContracts
    ? networkContracts.aaveLendingPool
    : null;
  const testToken = networkContracts ? networkContracts.testToken : null;
  if (existingAaveLendingPoolAddress) {
    const aaveLendingPool = await ethers.getContractAt(
      "IAaveV2LendingPool",
      existingAaveLendingPoolAddress
    );
    const normalizedIncome = await aaveLendingPool.getReserveNormalizedIncome(
      testToken
    );

    if (!normalizedIncome) {
      console.error(
        `Could not find data for token ${testToken} in Aaave contract ${aaveLendingPool.address}. Ignorning.`
      );
    } else {
      const rateOracleDeploy = await deploy("AaveRateOracle", {
        from: deployer,
        args: [aaveLendingPool.address, testToken],
        log: doLogging,
      });
      console.log(
        `Created rate oracle for Aave pool ${aaveLendingPool.address}`
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
    await deploy("AaveRateOracle", {
      from: deployer,
      args: [mockAaveLendingPool.address, mockToken.address],
      log: doLogging,
    });
  }

  // TODO: should probably also grow bugger of all deployed rate oracles, and read first data point
};
func.tags = ["RateOracles"];
export default func;
