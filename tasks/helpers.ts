import { isAddress } from "ethers/lib/utils";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BaseRateOracle,
  Factory,
  IFCM,
  IMarginEngine,
  IVAMM,
} from "../typechain";
import { utils } from "ethers";

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

export async function getIrsInstanceEvents(
  hre: HardhatRuntimeEnvironment
): Promise<utils.LogDescription[]> {
  const factory = (await hre.ethers.getContract("Factory")) as Factory;
  // console.log(`Listing IRS instances created by Factory ${factory.address}`);

  const logs = await factory.queryFilter(factory.filters.IrsInstance());
  const events = logs.map((l) => factory.interface.parseLog(l));
  return events;
}
