import { BigNumber, utils } from "ethers";
import { task } from "hardhat/config";
import {
  Factory,
  IERC20,
  IERC20Minimal,
  MarginEngine,
  Periphery,
  VAMM,
} from "../typechain";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function impersonateAccount(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  // It might be a multisig contract, in which case we also need to pretend it has money for gas
  await hre.ethers.provider.send("hardhat_setBalance", [
    acctAddress,
    "0x10000000000000000000",
  ]);
}

async function getSigner(hre: HardhatRuntimeEnvironment, acctAddress: string) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    // We can impersonate the account
    await impersonateAccount(hre, acctAddress);
  }
  return await hre.ethers.getSigner(acctAddress);
}

task("mintLiquidity", "Mints liquidity").setAction(async (_, hre) => {
  // const [wallet] = await (hre.ethers as any).getSigners();

  // TODO: make configurable
  const marginEngineAddress = "0x997e0f4bd76337a59ac0680ad220e819a85ffd14";

  // const factory = (await hre.ethers.getContract("Factory")) as Factory;

  const periphery = (await hre.ethers.getContractAt(
    "Periphery",
    "0x07ceD903E6ad0278CC32bC83a3fC97112F763722"
  )) as Periphery;

  // approve
  // await factory.connect(wallet).setApproval(periphery.address, true);

  // initialize vamm
  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  const vammAddress = await marginEngine.vamm();
  console.log("vamm address", vammAddress);

  // mint liquidity

  // console.log("marginEngineAddress", marginEngineAddress);

  console.log(
    "historical apy",
    utils.formatEther(await marginEngine.callStatic.getHistoricalApy())
  );

  const underlyingTokenAddress = await marginEngine.underlyingToken();
  const underlyingToken = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    underlyingTokenAddress
  )) as IERC20Minimal;

  console.log(
    "balance of trader:",
    (
      await underlyingToken.balanceOf(
        "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1"
      )
    ).toString()
  );

  const author = await getSigner(
    hre,
    "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1"
  );

  {
    const allowance = await underlyingToken.allowance(
      author.address,
      periphery.address
    );

    console.log(
      "allowace:",
      author.address,
      periphery.address,
      allowance.toString()
    );

    if (allowance.lte(BigNumber.from(0))) {
      await underlyingToken
        .connect(author)
        .approve(periphery.address, "1000000000");
    }
  }

  console.log("going to call mintOrBurn");
  await periphery.connect(author).mintOrBurn({
    marginEngine: marginEngineAddress,
    tickLower: -16080,
    tickUpper: 6960,
    notional: "1000000",
    isMint: true,
    marginDelta: "1000000",
  });
});

module.exports = {};
