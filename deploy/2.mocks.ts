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
  const mockAaveLendingPool = await ethers.getContract("MockAaveLendingPool");
  const trx1 = await mockAaveLendingPool.setReserveNormalizedIncome(
    mockERC20Deploy.address,
    BigNumber.from(10).pow(27)
  );
  await trx1.wait();
  const trx2 = await mockAaveLendingPool.setFactorPerSecondInRay(
    mockERC20Deploy.address,
    "1000000001000000000000000000" // 0.0000001% per second = ~3.2% APY
  );
  await trx2.wait();
  return true; // Only execute once
};
func.tags = ["Mocks"];
func.id = "Mocks";
export default func;
