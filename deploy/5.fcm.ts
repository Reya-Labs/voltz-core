import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import { Factory } from "../typechain";
import { getAaveTokens } from "../deployConfig/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deploy } = hre.deployments;
  const { deployer } = await hre.getNamedAccounts();
  const doLogging = true;
  const aaveTokens = getAaveTokens(hre.network.name);
  let rateOracle = await ethers.getContractOrNull("MockTokenRateOracle");
  const factory = (await ethers.getContract("Factory")) as Factory;

  if (!rateOracle && aaveTokens) {
    for (const token of aaveTokens) {
      const rateOracleIdentifier = `AaveRateOracle_${token.name}`;
      rateOracle = await ethers.getContractOrNull(rateOracleIdentifier);

      if (rateOracle) {
        break;
      }
    }
  }

  if (!rateOracle) {
    throw Error("Could not find rate oracle to associate with Aave FCM");
  }

  const masterAaveFCM = await deploy("AaveFCM", {
    from: deployer,
    log: doLogging,
  });

  const underlyingYieldBearingProtocolID =
    await rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

  const trx = await factory.setMasterFCM(
    masterAaveFCM.address,
    underlyingYieldBearingProtocolID
  );
  await trx.wait();
  return true; // Only execute once
};
func.tags = ["FCMs"];
func.id = "FCMs";
export default func;
