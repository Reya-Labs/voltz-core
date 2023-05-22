import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  // Mock contracts that must/need not be deployed on mainnet
  const mockERC20Deploy = await deploy("ERC20Mock", {
    from: deployer,
    args: ["Voltz USD", "VUSD"],
    log: doLogging,
  });

  await deploy("MockAaveV3LendingPool", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockAaveLendingPool", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockCToken", {
    from: deployer,
    log: doLogging,
    args: [mockERC20Deploy.address, "Voltz cDAI", "cVDAI"],
  });

  await deploy("MockWETH", {
    from: deployer,
    log: doLogging,
    args: ["Voltz WETH", "VWETH"],
  });

  const mockStEth = await deploy("MockStEth", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockLidoOracle", {
    from: deployer,
    log: doLogging,
    args: [mockStEth.address],
  });

  const mockRocketEth = await deploy("MockRocketEth", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockRocketNetworkBalances", {
    from: deployer,
    log: doLogging,
    args: [mockRocketEth.address],
  });

  const mockAaveLendingPool = await ethers.getContract("MockAaveLendingPool");
  {
    const trx = await mockAaveLendingPool.setReserveNormalizedIncome(
      mockERC20Deploy.address,
      BigNumber.from(10).pow(27),
      { gasLimit: 10000000 }
    );
    await trx.wait();
  }
  {
    const trx = await mockAaveLendingPool.setReserveNormalizedVariableDebt(
      mockERC20Deploy.address,
      BigNumber.from(10).pow(27),
      { gasLimit: 10000000 }
    );
    await trx.wait();
  }
  // trx = await mockAaveLendingPool.setFactorPerSecondInRay(
  //   mockERC20Deploy.address,
  //   "1000000001000000000000000000", // 0.0000001% per second = ~3.2% APY
  //   { gasLimit: 10000000 }
  // );
  // await trx.wait();

  const mockCToken = await ethers.getContract("MockCToken");
  // Starting exchange rate = 0.02, expressed using 10 ^ (18 + underlyingDecimals - cTokenDecimals)
  //  = 0.02 * 10 ^ (18 + 18 - 8)
  //  = 0.02 * 10 ^ 28
  //  = 2 * 10^26
  {
    const trx = await mockCToken.setExchangeRate(
      BigNumber.from(10).pow(26).mul(2)
    );
    await trx.wait();
  }

  // set initial borrow index
  let trx = await mockCToken.setBorrowIndex(BigNumber.from(10).pow(18));
  await trx.wait();

  const blocksPerYear = BigNumber.from(31536000).div(13);
  const wad = BigNumber.from(10).pow(18);
  const ratePerYearInWad = BigNumber.from(2).mul(wad).div(100); // 2%
  const ratePerBlock = ratePerYearInWad.div(blocksPerYear);
  trx = await mockCToken.setBorrowRatePerBlock(ratePerBlock);
  await trx.wait();

  // Mock PERIPHERY

  /* const dummyPeriphery = await deploy("PeripheryOld", {
    from: deployer,
    log: doLogging,
    args: [weth.address],
  });

  const dummyPeripheryContract = await ethers.getContractAt(
    "PeripheryOld",
    dummyPeriphery.address
  );

  // set periphery in factory
  const factory = (await ethers.getContract("Factory")) as Factory;
  trx = await factory.setPeriphery(dummyPeripheryContract.address, {
    gasLimit: 10000000,
  });
  await trx.wait(); */

  // mock Glp Rate Oracle

  await deploy("GlpOracleDependencies", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockRedstonePriceFeed1", {
    contract: "MockRedstonePriceFeed",
    from: deployer,
    log: doLogging,
  });

  await deploy("MockRedstonePriceFeed2", {
    contract: "MockRedstonePriceFeed",
    from: deployer,
    log: doLogging,
  });

  return true; // Only execute once
};
func.tags = ["Mocks"];
func.id = "Mocks";
export default func;
