import {
  Deployment,
  getContractFromDeployment,
  getCreate2Address,
} from "../helpers/deployHelpers";
import { utils } from "ethers";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";

import { Factory } from "../../typechain";
import { getCurrentTimestamp } from "../../test/helpers/time";

const { provider } = waffle;

export async function step1(
  deployer: any,
  hre: any,
  deployment: Deployment,
  consts: any
) {
  const termStartTimestamp: number = await getCurrentTimestamp(provider);
  const termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY;

  const factory: Factory = await getContractFromDeployment(
    hre,
    deployment,
    "Factory"
  );
  await factory.createAMM(
    consts.tokens.USDC.address,
    utils.formatBytes32String("AaveV2"),
    toBn(termEndTimestamp.toString())
  );

  const termStartTimestampBN = toBn((termStartTimestamp + 1).toString());
  const termEndTimestampBN = toBn(termEndTimestamp.toString());

  const ammBytecode = (await ethers.getContractFactory("AMM")).bytecode;
  // const poolAddress = getCreate2Address(factory.address, TEST_ADDRESSES, FeeAmount.MEDIUM, poolBytecode)
  const ammAddress = getCreate2Address(
    factory.address,
    utils.formatBytes32String("AaveV2"),
    consts.tokens.USDC.address,
    termStartTimestampBN,
    termEndTimestampBN,
    ammBytecode
  );
  deployment.contracts.AMM1 = {
    address: ammAddress,
    tx: "", // don't need for the purposes of the deployment?
  };
}
