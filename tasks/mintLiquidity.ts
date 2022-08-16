import { utils } from "ethers";
import { task } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { Factory, MarginEngine, Periphery, VAMM } from "../typechain";
import { TickMath } from "../test/shared/tickMath";
import { HardhatRuntimeEnvironment } from "hardhat/types";

async function impersonateAccount(
  hre: HardhatRuntimeEnvironment,
  acctAddress: string
) {
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [acctAddress],
  });
  // // It might be a multisig contract, in which case we also need to pretend it has money for gas
  // await hre.ethers.provider.send("hardhat_setBalance", [
  //   acctAddress,
  //   "0x10000000000000000000",
  // ]);
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
  const marginEngineAddress = "0x2d9571d65c14271a08877daf44f785a2e0d1a123";

  const factory = (await hre.ethers.getContract("Factory")) as Factory;

  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

  // approve
  // await factory.connect(wallet).setApproval(periphery.address, true);

  // initialize vamm
  const marginEngine = (await hre.ethers.getContractAt(
    "MarginEngine",
    marginEngineAddress
  )) as MarginEngine;

  const vammAddress = await marginEngine.vamm();
  console.log("vamm address", vammAddress);

  const vamm = (await hre.ethers.getContractAt("VAMM", vammAddress)) as VAMM;

  let vammVars = await vamm.vammVars();

  console.log("vammVars.sqrtPriceX96", vammVars.sqrtPriceX96.toString());

  vammVars = await vamm.vammVars();

  console.log("vammVars.sqrtPriceX96", vammVars.sqrtPriceX96.toString());

  // mint liquidity

  console.log("marginEngineAddress", marginEngineAddress);

  console.log(
    "historical apy",
    utils.formatEther(await marginEngine.callStatic.getHistoricalApy())
  );

  await periphery
    .connect(await getSigner(hre, "0xF8F6B70a36f4398f0853a311dC6699Aba8333Cc1"))
    .mintOrBurn({
      marginEngine: marginEngineAddress,
      tickLower: -16080,
      tickUpper: 6960,
      notional: "100000000",
      isMint: true,
      marginDelta: "1000000",
    });
});

module.exports = {};
