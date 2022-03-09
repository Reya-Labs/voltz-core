import { BigNumber, Wallet } from "ethers";
import { task, types } from "hardhat/config";
import { toBn } from "../test/helpers/toBn";
import { Factory, IRateOracle, MarginEngine, Periphery, VAMM } from "../typechain";
import { TickMath } from "../test/shared/tickMath";


task(
  "mintLiquidity",
  "Mints liquidity"
)
  .addParam(
    "meaddress",
    "Margin Engine Address"
  )
  .setAction(async (taskArgs, hre) => {

    let wallet: Wallet, other: Wallet;

    [wallet, other] = await (hre.ethers as any).getSigners();

    const marginEngineAddress = taskArgs.meaddress;

    const factory = await hre.ethers.getContract("Factory") as Factory; 

    const periphery = await hre.ethers.getContract("Periphery") as Periphery;
    
    // approve
    await factory.connect(wallet).setApproval(periphery.address, true);

    // initialize vamm
    const marginEngine = await hre.ethers.getContractAt(
        "MarginEngine",
        marginEngineAddress
    ) as MarginEngine;

    const vammAddress = await marginEngine.vamm();
    console.log("vamm address", vammAddress);

    const vamm = await hre.ethers.getContractAt(
        "VAMM",
        vammAddress
    ) as VAMM;

    let vammVars = await vamm.vammVars()

    console.log("vammVars.sqrtPriceX96", vammVars.sqrtPriceX96.toString())

    if (vammVars.sqrtPriceX96.toString() == "0") {
        await vamm.connect(wallet).initializeVAMM(TickMath.getSqrtRatioAtTick(-1000).toString())
    }

    vammVars = await vamm.vammVars()

    console.log("vammVars.sqrtPriceX96", vammVars.sqrtPriceX96.toString())

    // mint liquidity

    console.log("marginEngineAddress", marginEngineAddress);
    console.log("wallet address", wallet.address);

    await periphery.mintOrBurn(
        {
            marginEngineAddress: marginEngineAddress,
            recipient: wallet.address,
            tickLower: -1000,
            tickUpper: 1000,
            notional: toBn("10"),
            isMint: true
        }
    )

  });

module.exports = {};
