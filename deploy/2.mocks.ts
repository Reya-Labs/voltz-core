import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;

  // Mock contracts that should/need not be deployed on mainnet
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
  await mockAaveLendingPool.setReserveNormalizedIncome(
    mockERC20Deploy.address,
    BigNumber.from(2).pow(27)
  );
  return true; // Only execute once
};
func.tags = ["Mocks"];
func.id = "Mocks";
export default func;
