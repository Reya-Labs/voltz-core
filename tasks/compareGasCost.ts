import { task } from "hardhat/config";
import { toBn } from "evm-bn";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  BaseRateOracle,
  IERC20Minimal,
  IMarginEngine,
  Periphery,
} from "../typechain";
import { TickMath } from "../test/shared/tickMath";

import {
  TransactionReceipt,
  TransactionResponse,
  // eslint-disable-next-line node/no-extraneous-import
} from "@ethersproject/abstract-provider";
import { Contract, BigNumber, ContractTransaction } from "ethers";

const TICK_SPACING = 60;

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

async function snapshotGasCost(
  x:
    | TransactionResponse
    | Promise<TransactionResponse>
    | ContractTransaction
    | Promise<ContractTransaction>
    | TransactionReceipt
    | Promise<BigNumber>
    | BigNumber
    | Contract
    | Promise<Contract>
): Promise<number> {
  const resolved = await x;
  if ("deployTransaction" in resolved) {
    const receipt = await resolved.deployTransaction.wait();
    return receipt.gasUsed.toNumber();
  } else if ("wait" in resolved) {
    const waited = await resolved.wait();
    return waited.gasUsed.toNumber();
  } else if (BigNumber.isBigNumber(resolved)) {
    return resolved.toNumber();
  }

  return 0;
}

task(
  "compareGasCost",
  "Compares gas costs of the fixed borrowing product to raw swaps on Voltz"
).setAction(async (taskArgs, hre) => {
  const { multisig } = await hre.getNamedAccounts();
  const multisigSigner = await getSigner(hre, multisig);

  const info = {
    periphery: "0x07ceD903E6ad0278CC32bC83a3fC97112F763722",
    newPeripheryImplementation: "0xC976c932092ECcD8f328FfD85066C0c05ED54044",
    marginEngineAddress: "0x33bA6A0B16750206195c777879Edd8706204154B",
  };

  const marginEngine = (await hre.ethers.getContractAt(
    "IMarginEngine",
    info.marginEngineAddress
  )) as IMarginEngine;

  const periphery = (await hre.ethers.getContractAt(
    "Periphery",
    info.periphery
  )) as Periphery;

  const underlyingToken = (await hre.ethers.getContractAt(
    "IERC20Minimal",
    await marginEngine.underlyingToken()
  )) as IERC20Minimal;

  const rateOracle = (await hre.ethers.getContractAt(
    "BaseRateOracle",
    await marginEngine.rateOracle()
  )) as BaseRateOracle;

  await periphery
    .connect(multisigSigner)
    .upgradeTo(info.newPeripheryImplementation);

  await underlyingToken
    .connect(multisigSigner)
    .approve(periphery.address, toBn("4", 6));
  const swapGas = await snapshotGasCost(
    await periphery.connect(multisigSigner).swap({
      marginEngine: info.marginEngineAddress,
      isFT: false,
      notional: toBn("1", 6),
      sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(
        TickMath.MIN_TICK + 1
      ).toString(),
      tickLower: -TICK_SPACING,
      tickUpper: TICK_SPACING,
      marginDelta: toBn("1", 6),
    })
  );

  const variableFactorWad = await rateOracle.callStatic.variableFactor(
    await marginEngine.termStartTimestampWad(),
    await marginEngine.termEndTimestampWad()
  );

  // await periphery
  //   .connect(multisigSigner)
  //   .callStatic.swap({
  //     marginEngine: info.marginEngineAddress,
  //     isFT: false,
  //     notional: toBn("1", 6),
  //     sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(
  //       TickMath.MIN_TICK + 1
  //     ).toString(),
  //     tickLower: -TICK_SPACING,
  //     tickUpper: TICK_SPACING,
  //     marginDelta: toBn("1", 6),
  //   })
  //   .then((result) => {
  //     console.log("unbalanced", parseFloat(utils.formatUnits(result._fixedTokenDeltaUnbalanced, 6)));
  //     console.log("fees", parseFloat(utils.formatUnits(result._cumulativeFeeIncurred, 6)));
  //   });

  const fcVTSwapGas = await snapshotGasCost(
    await periphery.connect(multisigSigner).fullyCollateralisedVTSwap(
      {
        marginEngine: info.marginEngineAddress,
        isFT: false,
        notional: toBn("1", 6),
        sqrtPriceLimitX96: TickMath.getSqrtRatioAtTick(
          TickMath.MIN_TICK + 1
        ).toString(),
        tickLower: -TICK_SPACING,
        tickUpper: TICK_SPACING,
        marginDelta: toBn("0.0109", 6),
      },
      variableFactorWad
    )
  );

  console.log("Swap Gas Cost            :", swapGas);
  console.log("FC VT Swap Gas Cost      :", fcVTSwapGas);
  console.log(
    `Gas cost increase        : ${
      ((fcVTSwapGas.valueOf() - swapGas.valueOf()) / swapGas.valueOf()) * 100
    }%`
  );
});

module.exports = {};
