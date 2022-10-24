import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { getConfig } from "../deployConfig/config";
import { applyBufferConfig } from "../deployConfig/utils";
import { BaseRateOracle } from "../typechain";
import { BigNumber } from "ethers";

const MOCK_RATE_ORACLE_CONFIG_DEFAULTS = {
  minSecondsSinceLastUpdate: 60 * 60, // 1 hour
  rateOracleBufferSize: 1000,
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;
  const network = hre.network.name;
  const config = getConfig(network);
  const mockRateOracles: {
    oracle: BaseRateOracle;
    rateOracleBufferSize: number; // For mock token oracle or platforms with only a single token
    rateOracleMinSecondsSinceLastUpdate: number; // For mock token oracle or platforms with only a single token
  }[] = [];

  // Deploy rate oracle pointing at mocks, if mocks exist
  const mockToken = await ethers.getContractOrNull("ERC20Mock");
  const mockAaveLendingPool = await ethers.getContractOrNull(
    "MockAaveLendingPool"
  );
  const mockCToken = await ethers.getContractOrNull("MockCToken");
  const mockStEth = await ethers.getContractOrNull("MockStEth");
  const mockRocketEth = await ethers.getContractOrNull("MockRocketEth");

  if (config.aaveConfig && mockToken && mockAaveLendingPool) {
    console.log(
      `Deploy rate oracle for mocked {token, aave}: {${mockToken.address}, ${mockAaveLendingPool.address}}`
    );
    await deploy("MockAaveRateOracle", {
      contract: "AaveRateOracle",
      from: deployer,
      args: [mockAaveLendingPool.address, mockToken.address, [], []],
      log: doLogging,
    });
    mockRateOracles.push({
      oracle: (await ethers.getContract(
        "MockAaveRateOracle"
      )) as BaseRateOracle,
      rateOracleBufferSize:
        MOCK_RATE_ORACLE_CONFIG_DEFAULTS.rateOracleBufferSize,
      rateOracleMinSecondsSinceLastUpdate:
        MOCK_RATE_ORACLE_CONFIG_DEFAULTS.minSecondsSinceLastUpdate,
    });
  }

  if (config.compoundConfig && mockToken && mockCToken) {
    const decimals = await mockToken.decimals();
    console.log(
      `Deploy compound rate oracle for mocks: {${mockToken.address}, ${mockCToken.address}, ${decimals}}`
    );

    await deploy("MockCompoundRateOracle", {
      contract: "CompoundRateOracle",
      from: deployer,
      args: [mockCToken.address, false, mockToken.address, decimals, [], []],
      log: doLogging,
    });
    mockRateOracles.push({
      oracle: (await ethers.getContract(
        "MockCompoundRateOracle"
      )) as BaseRateOracle,
      rateOracleBufferSize:
        MOCK_RATE_ORACLE_CONFIG_DEFAULTS.rateOracleBufferSize,
      rateOracleMinSecondsSinceLastUpdate:
        MOCK_RATE_ORACLE_CONFIG_DEFAULTS.minSecondsSinceLastUpdate,
    });
  }

  if (config.rocketPoolConfig && mockRocketEth) {
    await deploy("MockRocketPoolRateOracle", {
      contract: "RocketPoolRateOracle",
      from: deployer,
      args: [mockRocketEth.address, [], []],
      log: doLogging,
    });
    mockRateOracles.push({
      oracle: (await ethers.getContract(
        "MockRocketPoolRateOracle"
      )) as BaseRateOracle,
      rateOracleBufferSize:
        config.rocketPoolConfig.defaults.rateOracleBufferSize,
      rateOracleMinSecondsSinceLastUpdate:
        config.rocketPoolConfig.defaults.minSecondsSinceLastUpdate,
    });
  }

  if (config.lidoConfig && mockStEth) {
    await deploy("MockLidoRateOracle", {
      contract: "LidoRateOracle",
      from: deployer,
      args: [mockStEth.address, [], []],
      log: doLogging,
    });
    mockRateOracles.push({
      oracle: (await ethers.getContract(
        "MockLidoRateOracle"
      )) as BaseRateOracle,
      rateOracleBufferSize: config.lidoConfig.defaults.rateOracleBufferSize,
      rateOracleMinSecondsSinceLastUpdate:
        config.lidoConfig.defaults.minSecondsSinceLastUpdate,
    });
  }

  for (const rateOracleInstance of mockRateOracles) {
    // Ensure the buffer is big enough. We must do this before writing any more rates or they may get overridden
    await applyBufferConfig(
      rateOracleInstance.oracle as unknown as BaseRateOracle,
      BigNumber.from(rateOracleInstance.rateOracleBufferSize).toNumber(),
      rateOracleInstance.rateOracleMinSecondsSinceLastUpdate,
      config.maxIrsDurationInSeconds
    );

    // Fast forward time to so that the mock rate oracle has some historical data
    await hre.network.provider.send("evm_increaseTime", [
      60 * 60 * 6, // 6 hours
    ]);
  }

  return true; // Only execute once
};
func.tags = ["MockRateOracles"];
func.id = "MockRateOracles";
func.dependencies = ["Mocks"];
export default func;
