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

  const mockAaveLendingPoolDeployment = await deploy("MockAaveLendingPool", {
    from: deployer,
    log: doLogging,
  });

  const mockATokenDeploy = await deploy("MockAToken", {
    from: deployer,
    log: doLogging,
    args: [
      mockAaveLendingPoolDeployment.address,
      mockERC20Deploy.address,
      "Voltz aUSDC",
      "aVUSD",
    ],
  });

  await deploy("MockCToken", {
    from: deployer,
    log: doLogging,
    args: [mockERC20Deploy.address, "Voltz cDAI", "cVDAI"],
  });

  const mockAaveLendingPool = await ethers.getContract("MockAaveLendingPool");

  await (
    await mockAaveLendingPool.initReserve(
      mockERC20Deploy.address,
      mockATokenDeploy.address,
      { gasLimit: 10000000 }
    )
  ).wait();

  await (
    await mockAaveLendingPool.setReserveNormalizedIncome(
      mockERC20Deploy.address,
      BigNumber.from(10).pow(27),
      { gasLimit: 10000000 }
    )
  ).wait();

  await (
    await mockAaveLendingPool.setFactorPerSecondInRay(
      mockERC20Deploy.address,
      "1000000001000000000000000000", // 0.0000001% per second = ~3.2% APY
      { gasLimit: 10000000 }
    )
  ).wait();

  return true; // Only execute once
};
func.tags = ["Mocks"];
func.id = "Mocks";
export default func;
