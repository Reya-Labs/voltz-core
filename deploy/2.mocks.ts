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
  await deploy("MockAaveLendingPool", {
    from: deployer,
    log: doLogging,
  });

  await deploy("MockCToken", {
    from: deployer,
    log: doLogging,
    args: [mockERC20Deploy.address, "Voltz cDAI", "cVDAI"],
  });

  const mockAaveLendingPool = await ethers.getContract("MockAaveLendingPool");
  let trx = await mockAaveLendingPool.setReserveNormalizedIncome(
    mockERC20Deploy.address,
    BigNumber.from(10).pow(27),
    { gasLimit: 10000000 }
  );
  await trx.wait();
  trx = await mockAaveLendingPool.setFactorPerSecondInRay(
    mockERC20Deploy.address,
    "1000000001000000000000000000", // 0.0000001% per second = ~3.2% APY
    { gasLimit: 10000000 }
  );
  await trx.wait();

  const mockCToken = await ethers.getContract("MockCToken");
  // Starting exchange rate = 0.02, expressed using 10 ^ (18 + underlyingDecimals - cTokenDecimals)
  //  = 0.02 * 10 ^ (18 + 18 - 8)
  //  = 0.02 * 10 ^ 28
  //  = 2 * 10^26
  trx = await mockCToken.setExchangeRate(BigNumber.from(10).pow(26).mul(2));
  await trx.wait();

  return true; // Only execute once
};
func.tags = ["Mocks"];
func.id = "Mocks";
export default func;
