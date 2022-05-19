import { isAddress } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { BaseRateOracle, IFCM, IMarginEngine, IVAMM } from "../typechain";

export async function getRateOracleByNameOrAddress(
  hre: HardhatRuntimeEnvironment,
  _addressOrname: string
): Promise<BaseRateOracle> {
  let rateOracle;
  if (isAddress(_addressOrname)) {
    rateOracle = (await hre.ethers.getContractAt(
      "BaseRateOracle",
      _addressOrname
    )) as BaseRateOracle;
  } else {
    rateOracle = (await hre.ethers.getContract(
      _addressOrname
    )) as BaseRateOracle;
  }
  return rateOracle;
}
interface IrsInstance {
  marginEngine: IMarginEngine;
  vamm: IVAMM;
  fcm: IFCM;
}

export async function getIRSByMarginEngineAddress(
  hre: HardhatRuntimeEnvironment,
  _marginEngineAddress: string
): Promise<IrsInstance> {
  const marginEngine = (await hre.ethers.getContractAt(
    "IMarginEngine",
    _marginEngineAddress
  )) as IMarginEngine;
  const vammAddress = await marginEngine.vamm();
  const fcmAddress = await marginEngine.fcm();

  const vamm = (await hre.ethers.getContractAt("IVAMM", vammAddress)) as IVAMM;
  const fcm = (await hre.ethers.getContractAt("IFCM", fcmAddress)) as IFCM;
  return { marginEngine, vamm, fcm };
}
