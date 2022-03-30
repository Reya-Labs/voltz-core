import { utils } from "ethers";
import { task } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { Factory, MarginEngine, Periphery, VAMM } from "../typechain";
import { TickMath } from "../test/shared/tickMath";

task("mintLiquidity", "Mints liquidity").setAction(async (_, hre) => {
  const [wallet] = await (hre.ethers as any).getSigners();

  // TODO: make configurable
  const marginEngineAddress = "0x75537828f2ce51be7289709686a69cbfdbb714f1";

  const factory = (await hre.ethers.getContract("Factory")) as Factory;

  const periphery = (await hre.ethers.getContract("Periphery")) as Periphery;

  // approve
  await factory.connect(wallet).setApproval(periphery.address, true);

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

  if (vammVars.sqrtPriceX96.toString() === "0") {
    await vamm
      .connect(wallet)
      .initializeVAMM(TickMath.getSqrtRatioAtTick(-1000).toString());
  }

  vammVars = await vamm.vammVars();

  console.log("vammVars.sqrtPriceX96", vammVars.sqrtPriceX96.toString());

  // mint liquidity

  console.log("marginEngineAddress", marginEngineAddress);
  console.log("wallet address", wallet.address);

  console.log(
    "historical apy",
    utils.formatEther(await marginEngine.callStatic.getHistoricalApy())
  );

  await periphery.connect(wallet).mintOrBurn({
    marginEngine: marginEngineAddress,
    tickLower: -7000,
    tickUpper: 0,
    notional: toBn("100000"),
    isMint: true,
    marginDelta: 0,
  });
});

module.exports = {};
