import { ethers, waffle } from "hardhat";
import { BigNumber, utils } from "ethers";
import { TestVAMM } from "../../../typechain/TestVAMM";
import {
  E2ESetupFixture,
  fixedAndVariableMathFixture,
  sqrtPriceMathFixture,
  tickMathFixture,
  // createMetaFixtureE2E,
  marginCalculatorFixture,
} from "../../shared/fixtures";
import { formatRay, TICK_SPACING } from "../../shared/utilities";
import {
  Actor,
  E2ESetup,
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  MarginEngine,
  MockAaveLendingPool,
  SqrtPriceMathTest,
  TestAaveFCM,
  TestRateOracle,
  TickMathTest,
} from "../../../typechain";
import { MarginCalculatorTest } from "../../../typechain/MarginCalculatorTest";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { e2eParameters } from "./e2eSetup";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { toBn } from "../../helpers/toBn";
import { consts } from "../../helpers/constants";

const { provider } = waffle;

export class ScenarioRunner {
  traderTickLower: number = -TICK_SPACING;
  traderTickUpper: number = TICK_SPACING;

  params: e2eParameters;

  owner!: SignerWithAddress;
  factory!: Factory;
  token!: ERC20Mock;
  rateOracleTest!: TestRateOracle;

  termStartTimestampBN!: BigNumber;
  termEndTimestampBN!: BigNumber;

  fcmTest!: TestAaveFCM;
  vammTest!: TestVAMM;
  marginEngineTest!: MarginEngine;
  aaveLendingPool!: MockAaveLendingPool;

  testMarginCalculator!: MarginCalculatorTest;
  marginCalculatorParams: any;

  testFixedAndVariableMath!: FixedAndVariableMathTest;
  testTickMath!: TickMathTest;
  testSqrtPriceMath!: SqrtPriceMathTest;

  e2eSetup!: E2ESetup;
  actors!: Actor[];

  positions: [string, number, number][] = [];

  outputFile!: string;

  // loadFixture!: ReturnType<typeof createFixtureLoader>;

  // global variables (to avoid recomputing them)
  lowerApyBound: BigNumber = toBn("0");
  historicalApyWad: BigNumber = toBn("0");
  upperApyBound: BigNumber = toBn("0");

  variableFactorWad: BigNumber = toBn("0");

  currentTick: number = 0;

  async mintAndApprove(address: string) {
    await this.token.mint(address, BigNumber.from(10).pow(27));
    await this.token.approve(address, BigNumber.from(10).pow(27));
  }

  constructor(params_: e2eParameters, outputFile_: string) {
    this.params = params_;
    this.outputFile = outputFile_;

    const fs = require("fs");
    fs.writeFileSync(this.outputFile, "");
  }

  async exportSnapshot(title: string) {
    const fs = require("fs");
    fs.appendFileSync(
      this.outputFile,
      "----------------------------" + title + "----------------------------\n"
    );

    const currentTimestamp: number = await getCurrentTimestamp(provider);
    fs.appendFileSync(
      this.outputFile,
      "current timestamp: " + currentTimestamp.toString() + "\n"
    );
    fs.appendFileSync(this.outputFile, "\n");

    await this.updateCurrentTick();
    fs.appendFileSync(
      this.outputFile,
      "current tick: " + this.currentTick.toString() + "\n"
    );

    const sqrtPriceAtCurrentTick = await this.testTickMath.getSqrtRatioAtTick(
      this.currentTick
    );
    fs.appendFileSync(
      this.outputFile,
      "sqrt price at current tick: " +
        (
          sqrtPriceAtCurrentTick.div(BigNumber.from(2).pow(64)).toNumber() /
          2 ** 32
        ).toString() +
        "\n"
    );
    fs.appendFileSync(this.outputFile, "\n");

    const currentReseveNormalizedIncome =
      await this.aaveLendingPool.getReserveNormalizedIncome(this.token.address);
    fs.appendFileSync(
      this.outputFile,
      "current reserve normalised income: " +
        formatRay(currentReseveNormalizedIncome).toString() +
        "\n"
    );
    fs.appendFileSync(this.outputFile, "\n");

    const vtBelow = await this.getVT("below");
    const vtAbove = await this.getVT("above");

    fs.appendFileSync(
      this.outputFile,
      "amount of available variable tokens: " +
        vtAbove.toString() +
        " (" +
        "\u2191" +
        ")" +
        " ; " +
        vtBelow.toString() +
        " (" +
        "\u2193" +
        ")" +
        "\n"
    );
    fs.appendFileSync(this.outputFile, "\n");

    if (toBn(currentTimestamp.toString()) < this.termEndTimestampBN) {
      await this.updateAPYbounds();

      fs.appendFileSync(
        this.outputFile,
        "lower apy bound: " +
          utils.formatEther(this.lowerApyBound).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        " historical apy: " +
          utils.formatEther(this.historicalApyWad).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "upper apy bound: " +
          utils.formatEther(this.upperApyBound).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "variable factor: " +
          utils.formatEther(this.variableFactorWad).toString() +
          "\n"
      ); // displayed as zero, investigate
      fs.appendFileSync(this.outputFile, "\n");
    }

    fs.appendFileSync(
      this.outputFile,
      "No of   Actors: " + this.params.numActors.toString() + "\n"
    );
    fs.appendFileSync(
      this.outputFile,
      "No of Positions: " + this.positions.length.toString() + "\n"
    );

    for (let i = 0; i < this.positions.length; i++) {
      const positionHistory = await this.e2eSetup.getPositionHistory(
        this.positions[i][0],
        this.positions[i][1],
        this.positions[i][2]
      );

      console.log("position history:", positionHistory.length);

      let positionInfo = await this.marginEngineTest.getPosition(
        this.positions[i][0],
        this.positions[i][1],
        this.positions[i][2]
      );

      // await this.marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
      //   this.positions[i][0],
      //   this.positions[i][1],
      //   this.positions[i][2],
      //   false
      // );

      // fs.appendFileSync(this.outputFile, "POSITION " + i.toString() + "\n");
      positionInfo = await this.marginEngineTest.getPosition(
        this.positions[i][0],
        this.positions[i][1],
        this.positions[i][2]
      );

      fs.appendFileSync(
        this.outputFile,
        "                       address   : " +
          this.positions[i][0].toString() +
          "\n"
      );

      fs.appendFileSync(
        this.outputFile,
        "                       lower tick: " +
          this.positions[i][1].toString() +
          "\n"
      );

      const sqrtPriceAtLowerTick = await this.testTickMath.getSqrtRatioAtTick(
        this.positions[i][1]
      );
      fs.appendFileSync(
        this.outputFile,
        "         sqrt price at lower tick: " +
          (
            sqrtPriceAtLowerTick.div(BigNumber.from(2).pow(64)).toNumber() /
            2 ** 32
          ).toString() +
          "\n"
      );

      fs.appendFileSync(
        this.outputFile,
        "                       upper tick: " +
          this.positions[i][2].toString() +
          "\n"
      );

      const sqrtPriceAtUpperTick = await this.testTickMath.getSqrtRatioAtTick(
        this.positions[i][2]
      );
      fs.appendFileSync(
        this.outputFile,
        "         sqrt price at upper tick: " +
          (
            sqrtPriceAtUpperTick.div(BigNumber.from(2).pow(64)).toNumber() /
            2 ** 32
          ).toString() +
          "\n"
      );

      fs.appendFileSync(
        this.outputFile,
        "                        liquidity: " +
          utils.formatEther(positionInfo._liquidity).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "                           margin: " +
          utils.formatEther(positionInfo.margin).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "   fixedTokenGrowthInsideLastX128: " +
          (
            positionInfo.fixedTokenGrowthInsideLastX128
              .div(BigNumber.from(2).pow(128 - 32))
              .toNumber() /
            2 ** 32
          ).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "variableTokenGrowthInsideLastX128: " +
          (
            positionInfo.variableTokenGrowthInsideLastX128
              .div(BigNumber.from(2).pow(128 - 32))
              .toNumber() /
            2 ** 32
          ).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "                fixedTokenBalance: " +
          utils.formatEther(positionInfo.fixedTokenBalance).toString() +
          "\n"
      );
      fs.appendFileSync(
        this.outputFile,
        "             variableTokenBalance: " +
          utils.formatEther(positionInfo.variableTokenBalance).toString() +
          "\n"
      );
      // fs.appendFileSync(
      //   this.outputFile,
      //   "          feeGrowthInsideLastX128: " +
      //     (
      //       positionInfo.feeGrowthInsideLastX128.div(BigNumber.from(2).pow(128 - 32)).toNumber() /
      //       2 ** 32
      //     ).toString() +
      //     "\n"
      // );
      fs.appendFileSync(
        this.outputFile,
        "                        isSettled: " +
          positionInfo.isSettled.toString() +
          "\n"
      );

      const settlementCashflow =
        await this.testFixedAndVariableMath.calculateSettlementCashflow(
          positionInfo.fixedTokenBalance,
          positionInfo.variableTokenBalance,
          this.termStartTimestampBN,
          this.termEndTimestampBN,
          this.variableFactorWad
        );
      fs.appendFileSync(
        this.outputFile,
        "             settlement cashflow: " +
          utils.formatEther(settlementCashflow).toString() +
          "\n"
      );
      fs.appendFileSync(this.outputFile, "\n");

      {
        fs.appendFileSync(this.outputFile, "TRADER YBA " + i.toString() + "\n");
        const traderYBAInfo =
          await this.fcmTest.getTraderWithYieldBearingAssets(
            this.positions[i][0]
          );

        fs.appendFileSync(
          this.outputFile,
          "                       address   : " +
            this.positions[i][0].toString() +
            "\n"
        );

        fs.appendFileSync(
          this.outputFile,
          "                           margin: " +
            utils
              .formatEther(traderYBAInfo.marginInScaledYieldBearingTokens)
              .toString() +
            "\n"
        );
        fs.appendFileSync(
          this.outputFile,
          "                fixedTokenBalance: " +
            utils.formatEther(traderYBAInfo.fixedTokenBalance).toString() +
            "\n"
        );
        fs.appendFileSync(
          this.outputFile,
          "             variableTokenBalance: " +
            utils.formatEther(traderYBAInfo.variableTokenBalance).toString() +
            "\n"
        );
        fs.appendFileSync(
          this.outputFile,
          "                        isSettled: " +
            traderYBAInfo.isSettled.toString() +
            "\n"
        );

        const settlementCashflow =
          await this.testFixedAndVariableMath.calculateSettlementCashflow(
            traderYBAInfo.fixedTokenBalance,
            traderYBAInfo.variableTokenBalance,
            this.termStartTimestampBN,
            this.termEndTimestampBN,
            this.variableFactorWad
          );
        fs.appendFileSync(
          this.outputFile,
          "             settlement cashflow: " +
            utils.formatEther(settlementCashflow).toString() +
            "\n"
        );
        fs.appendFileSync(this.outputFile, "\n");
      }
    }
    fs.appendFileSync(this.outputFile, "\n");
  }

  async getAlreadyDeployedContracts() {
    this.factory = (await ethers.getContract("Factory")) as Factory;
    this.token = (await ethers.getContract("ERC20Mock")) as ERC20Mock;
    this.rateOracleTest = (await ethers.getContract(
      "TestRateOracle"
    )) as TestRateOracle;
    this.aaveLendingPool = (await ethers.getContract(
      "MockAaveLendingPool"
    )) as MockAaveLendingPool;
  }

  async init() {
    this.owner = (await ethers.getSigners())[0];
    // this.loadFixture = createFixtureLoader([this.owner]);

    // this.owner = provider.getWallets()[0];
    // provider.getSigner();

    ({ testMarginCalculator: this.testMarginCalculator } =
      await marginCalculatorFixture());
    await this.getAlreadyDeployedContracts();

    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      "1000000000000000000000000000" // 10^27
    );

    // await rateOracleTest.testGrow(100);
    await this.rateOracleTest.increaseObservarionCardinalityNext(100);
    // write oracle entry
    await this.rateOracleTest.writeOracleEntry();
    // advance time after first write to the oracle
    await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      "1008000000000000000000000000" // 10^27 * 1.008
    );

    await this.rateOracleTest.writeOracleEntry();

    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + this.params.duration.toNumber();
    this.termStartTimestampBN = toBn(termStartTimestamp.toString());
    this.termEndTimestampBN = toBn(termEndTimestamp.toString());

    // console.log(`factory: ${this.factory.address}`);
    // console.log(`masterVAMM: ${await this.factory.masterVAMM()}`);
    // console.log(
    //   `masterMarginEngine: ${await this.factory.masterMarginEngine()}`
    // );

    // deploy an IRS instance
    await this.factory.deployIrsInstance(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN,
      this.params.tickSpacing
    );

    // deploy margin engine test
    const marginEngineAddress = await this.factory.getMarginEngineAddress(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN,
      this.params.tickSpacing
    );

    const marginEngineFactory = await ethers.getContractFactory("MarginEngine");

    this.marginEngineTest = marginEngineFactory.attach(
      marginEngineAddress
    ) as MarginEngine;

    // deploy VAMM test
    const vammAddress = await this.factory.getVAMMAddress(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN,
      this.params.tickSpacing
    );

    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    this.vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

    const fcmAddress = await this.factory.getFCMAddress(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN,
      this.params.tickSpacing
    );

    const fcmTestFactory = await ethers.getContractFactory("TestAaveFCM");
    this.fcmTest = fcmTestFactory.attach(fcmAddress) as TestAaveFCM;

    // deploy Fixed and Variable Math test
    ({ testFixedAndVariableMath: this.testFixedAndVariableMath } =
      await fixedAndVariableMathFixture());

    // deploy Tick Math Test
    ({ testTickMath: this.testTickMath } = await tickMathFixture());

    // deploy Sqrt Price Math Test
    ({ testSqrtPriceMath: this.testSqrtPriceMath } =
      await sqrtPriceMathFixture());

    // deploy the setup for E2E testing
    ({ e2eSetup: this.e2eSetup } = await E2ESetupFixture());

    // set the parameters of margin calculator
    this.marginCalculatorParams = this.params.marginCalculatorParams;

    // set margin engine parameters
    await this.marginEngineTest.setVAMM(this.vammTest.address);
    await this.marginEngineTest.setMarginCalculatorParameters(
      this.marginCalculatorParams
    );
    await this.marginEngineTest.setSecondsAgo(this.params.lookBackWindowAPY);

    // set VAMM parameters
    await this.vammTest.initializeVAMM(this.params.startingPrice.toString());
    await this.vammTest.setFeeProtocol(this.params.feeProtocol);
    await this.vammTest.setFee(this.params.fee);

    // set e2e setup parameters
    await this.e2eSetup.setMEAddress(this.marginEngineTest.address);
    await this.e2eSetup.setVAMMAddress(this.vammTest.address);
    await this.e2eSetup.setFCMAddress(this.fcmTest.address);
    await this.e2eSetup.setRateOracleAddress(this.rateOracleTest.address);

    // mint and approve the addresses
    await this.mintAndApprove(this.owner.address);
    await this.mintAndApprove(this.marginEngineTest.address);
    await this.mintAndApprove(this.e2eSetup.address);

    // create the actors
    this.actors = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const ActorFactory = await ethers.getContractFactory("Actor");
      const actor = (await ActorFactory.deploy()) as Actor;
      this.actors.push(actor);
      await this.mintAndApprove(actor.address);

      await this.token.approveInternal(
        actor.address,
        this.fcmTest.address,
        BigNumber.from(10).pow(27)
      );
    }

    await this.token.approveInternal(
      this.e2eSetup.address,
      this.marginEngineTest.address,
      BigNumber.from(10).pow(27)
    );

    await this.token.approveInternal(
      this.e2eSetup.address,
      this.fcmTest.address,
      BigNumber.from(10).pow(27)
    );

    this.positions = [];
    for (const p of this.params.positions) {
      this.positions.push([this.actors[p[0]].address, p[1], p[2]]);
    }

    await this.updateCurrentTick();
  }

  async printPositionInfo(positionInfo: any) {
    console.log(
      "                        liquidity: ",
      utils.formatEther(positionInfo[0])
    );
    console.log(
      "                           margin: ",
      utils.formatEther(positionInfo[1])
    );
    console.log(
      "   fixedTokenGrowthInsideLastX128: ",
      positionInfo[2].div(BigNumber.from(2).pow(128 - 32)).toNumber() / 2 ** 32
    );
    console.log(
      "variableTokenGrowthInsideLastX128: ",
      positionInfo[3].div(BigNumber.from(2).pow(128 - 32)).toNumber() / 2 ** 32
    );
    console.log(
      "                fixedTokenBalance: ",
      utils.formatEther(positionInfo[4])
    );
    console.log(
      "             variableTokenBalance: ",
      utils.formatEther(positionInfo[5])
    );
    console.log(
      "          feeGrowthInsideLastX128: ",
      positionInfo[6].div(BigNumber.from(2).pow(128 - 32)).toNumber() / 2 ** 32
    );
    console.log(
      "                        isSettled: ",
      positionInfo[7].toString()
    );

    const settlementCashflow =
      await this.testFixedAndVariableMath.calculateSettlementCashflow(
        positionInfo[4],
        positionInfo[5],
        this.termStartTimestampBN,
        this.termEndTimestampBN,
        this.variableFactorWad
      );
    console.log(
      "             settlement cashflow: ",
      utils.formatEther(settlementCashflow)
    );

    console.log("");
  }

  // print the trader information
  async printTraderInfo(traderInfo: any) {
    console.log("              margin: ", utils.formatEther(traderInfo[0]));
    console.log("   fixedTokenBalance: ", utils.formatEther(traderInfo[1]));
    console.log("variableTokenBalance: ", utils.formatEther(traderInfo[2]));
    console.log("           isSettled: ", traderInfo[3].toString());

    const settlementCashflow =
      await this.testFixedAndVariableMath.calculateSettlementCashflow(
        traderInfo[1],
        traderInfo[2],
        this.termStartTimestampBN,
        this.termEndTimestampBN,
        this.variableFactorWad
      );
    console.log("settlement cashflow: ", utils.formatEther(settlementCashflow));

    console.log("");
  }

  // print the position and trader information
  async printPositionsInfo() {
    // for (let i = 0; i < this.positions.length; i++) {
    //   await this.marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
    //     this.positions[i][0],
    //     this.positions[i][1],
    //     this.positions[i][2],
    //     false
    //   );
    //   console.log("POSITION: ", i + 1);
    //   console.log("TICK LOWER", this.positions[i][1]);
    //   console.log("TICK UPPER", this.positions[i][2]);
    //   const positionInfo = await this.marginEngineTest.getPosition(
    //     this.positions[i][0],
    //     this.positions[i][1],
    //     this.positions[i][2]
    //   );
    //   await this.printPositionInfo(positionInfo);
    // }
  }

  // print the current normalized income
  async printReserveNormalizedIncome() {
    const currentReseveNormalizedIncome =
      await this.aaveLendingPool.getReserveNormalizedIncome(this.token.address);
    console.log(
      "currentReseveNormalisedIncome",
      formatRay(currentReseveNormalizedIncome)
    ); // in ray
    console.log("");
  }

  async updateAPYbounds() {
    const currentTimestamp: number = await getCurrentTimestamp(provider);
    const currrentTimestampWad: BigNumber = toBn(currentTimestamp.toString());
    this.historicalApyWad =
      await this.marginEngineTest.getHistoricalApyReadOnly();

    this.upperApyBound = await this.testMarginCalculator.computeApyBound(
      this.termEndTimestampBN,
      currrentTimestampWad,
      this.historicalApyWad,
      true,
      this.marginCalculatorParams
    );
    this.lowerApyBound = await this.testMarginCalculator.computeApyBound(
      this.termEndTimestampBN,
      currrentTimestampWad,
      this.historicalApyWad,
      false,
      this.marginCalculatorParams
    );

    this.variableFactorWad = await this.rateOracleTest.variableFactorNoCache(
      this.termStartTimestampBN,
      this.termEndTimestampBN
    );
  }

  // reserveNormalizedIncome format: x.yyyy
  async advanceAndUpdateApy(
    time: BigNumber,
    blockCount: number,
    reserveNormalizedIncome: number
  ) {
    await advanceTimeAndBlock(time, blockCount);
    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      Math.floor(reserveNormalizedIncome * 10000 + 0.5).toString() +
        "0".repeat(23)
    );

    await this.rateOracleTest.writeOracleEntry();

    await this.updateAPYbounds();
  }

  async getAPYboundsAndPositionMargin(_: [string, number, number]) {
    // await this.updateAPYbounds();
    // await this.marginEngineTest.getPositionMarginRequirementTest(
    //   position[0],
    //   position[1],
    //   position[2],
    //   false
    // );
    // const positionMarginRequirement = await this.marginEngineTest.getMargin();
    // console.log(
    //   "position margin requirement: ",
    //   utils.formatEther(positionMarginRequirement)
    // );
    // console.log("");
    // return positionMarginRequirement;
  }

  async getVT(towards: string) {
    await this.updateCurrentTick();

    let totalAmount0 = toBn("0");
    let totalAmount1 = toBn("0");

    for (const p of this.positions) {
      let lowerTick = p[1];
      let upperTick = p[2];

      if (towards === "below") {
        upperTick = Math.min(this.currentTick, p[2]);
      } else if (towards === "above") {
        lowerTick = Math.max(this.currentTick, p[1]);
      } else {
        console.error("direction should be either below or above");
        return 0;
      }

      if (lowerTick >= upperTick) continue;

      const liquidity = (
        await this.marginEngineTest.getPosition(p[0], p[1], p[2])
      )._liquidity;
      const ratioAtLowerTick = await this.testTickMath.getSqrtRatioAtTick(
        lowerTick
      );
      const ratioAtUpperTick = await this.testTickMath.getSqrtRatioAtTick(
        upperTick
      );

      const amount0 = await this.testSqrtPriceMath.getAmount0Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidity,
        true
      );
      const amount1 = await this.testSqrtPriceMath.getAmount1Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidity,
        true
      );

      totalAmount0 = totalAmount0.add(amount0);
      totalAmount1 = totalAmount1.add(amount1);
    }

    return parseFloat(utils.formatEther(totalAmount1));
  }

  async settlePositions() {
    for (const p of this.positions) {
      await this.marginEngineTest.settlePosition(p[1], p[2], p[0]);
    }
  }

  async updateCurrentTick() {
    this.currentTick = (await this.vammTest.vammVars()).tick;
    // this.currentTick = await this.vammTest.getCurrentTick();
  }

  async run() {}
}
