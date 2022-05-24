import { BigNumber } from "ethers";
import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  E2ESetup,
  ERC20Mock,
  IFCM,
  IMarginEngine,
  IRateOracle,
  IVAMM,
  MockAaveLendingPool,
  MockAToken,
  Periphery,
} from "../typechain";

const MAX_AMOUNT = BigNumber.from(10).pow(27);

const mintAndApprove = async (
  token: ERC20Mock,
  aToken: MockAToken,
  aaveLendingPool: MockAaveLendingPool,
  address: string,
  amount: BigNumber
) => {
  console.log("in func?");
  await token.mint(address, amount);
  console.log("1");
  await token.approve(address, amount);
  console.log("2");

  await token.mint(aToken.address, amount);
  console.log("3");
  const rni = await aaveLendingPool.getReserveNormalizedIncome(token.address);
  console.log("4", rni.toString());
  await aToken.mint(address, amount, rni);
  console.log("5");
  await aToken.approve(address, amount);
  console.log("6");
};

task("fuzzingPrep", "Prepares an enriched environment for fuzzing").setAction(
  async (_, hre: HardhatRuntimeEnvironment) => {
    const owner = (await hre.ethers.getSigners())[0];
    const e2eSetup = (await hre.ethers.getContractAt(
      "E2ESetup",
      "0x4A679253410272dd5232B3Ff7cF5dbB88f295319"
    )) as E2ESetup;
    const marginEngine = (await hre.ethers.getContractAt(
      "MarginEngine",
      "0x75537828f2ce51be7289709686A69CbFDbB714F1"
    )) as IMarginEngine;
    const vamm = (await hre.ethers.getContractAt(
      "VAMM",
      "0xE451980132E65465d0a498c53f0b5227326Dd73F"
    )) as IVAMM;
    const fcm = (await hre.ethers.getContractAt(
      "AaveFCM",
      "0x5392A33F7F677f59e833FEBF4016cDDD88fF9E67"
    )) as IFCM;
    const rateOracle = (await hre.ethers.getContractAt(
      "AaveRateOracle",
      "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318"
    )) as IRateOracle;
    const periphery = (await hre.ethers.getContractAt(
      "Periphery",
      "0x59b670e9fA9D0A427751Af201D676719a970857b"
    )) as Periphery;
    const aaveLendingPool = (await hre.ethers.getContractAt(
      "MockAaveLendingPool",
      "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"
    )) as MockAaveLendingPool;
    const token = (await hre.ethers.getContractAt(
      "ERC20Mock",
      "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"
    )) as ERC20Mock;
    const aToken = (await hre.ethers.getContractAt(
      "MockAToken",
      "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"
    )) as MockAToken;
    await e2eSetup.setMEAddress(marginEngine.address);
    await e2eSetup.setVAMMAddress(vamm.address);
    await e2eSetup.setFCMAddress(fcm.address);
    await e2eSetup.setRateOracleAddress(rateOracle.address);
    await e2eSetup.setPeripheryAddress(periphery.address);
    await e2eSetup.setAaveLendingPool(aaveLendingPool.address);
    console.log("owner", owner.address);
    await mintAndApprove(
      token,
      aToken,
      aaveLendingPool,
      owner.address,
      MAX_AMOUNT
    );
    const actors = ["0x7a2088a1bFc9d81c55368AE168C2C02570cB814F"];
    for (const actor of actors) {
      await mintAndApprove(token, aToken, aaveLendingPool, actor, MAX_AMOUNT);
      /// set manually the approval of contracts to act on behalf of actors
      for (const ad of [
        fcm.address,
        periphery.address,
        vamm.address,
        marginEngine.address,
      ]) {
        await token.approveInternal(actor, ad, MAX_AMOUNT);
        await aToken.approveInternal(actor, ad, MAX_AMOUNT);
      }
    }
    const positions: [string, number, number][] = [[actors[0], -1200, 1200]];
    // mint
    const p = positions[0];
    const notional = BigNumber.from("1000000000000000000000");
    console.log("marginEngine.address", marginEngine.address);

    await e2eSetup.mintOrBurnViaPeriphery(p[0], {
      marginEngine: marginEngine.address,
      tickLower: p[1],
      tickUpper: p[2],
      notional: notional,
      marginDelta: notional,
      isMint: true,
    });
  }
);

module.exports = {};
