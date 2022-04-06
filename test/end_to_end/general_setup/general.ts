import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../../typechain/TestVAMM";
import {
  E2ESetupFixture,
  fixedAndVariableMathFixture,
  sqrtPriceMathFixture,
  tickMathFixture,
  createMetaFixtureE2E,
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
  MockAToken,
  Periphery,
  SqrtPriceMathTest,
  TestAaveFCM,
  TestRateOracle,
  TickMathTest,
} from "../../../typechain";
import { MarginCalculatorTest } from "../../../typechain/MarginCalculatorTest";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { e2eParameters } from "./e2eSetup";
import { toBn } from "../../helpers/toBn";
import { consts } from "../../helpers/constants";
import { createFixtureLoader } from "ethereum-waffle";
import { extractErrorMessage } from "../../utils/extractErrorMessage";

const { provider } = waffle;

export type InfoPostSwap = {
  marginRequirement: number;
  availableNotional: number;
  fee: number;
  slippage: number;
};

export class ScenarioRunner {
  traderTickLower: number = -TICK_SPACING;
  traderTickUpper: number = TICK_SPACING;

  params: e2eParameters;

  owner!: Wallet;
  factory!: Factory;
  token!: ERC20Mock;
  aToken!: MockAToken;
  rateOracleTest!: TestRateOracle;

  termStartTimestampBN!: BigNumber;
  termEndTimestampBN!: BigNumber;
  periphery!: Periphery;

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

  loadFixture!: ReturnType<typeof createFixtureLoader>;

  // global variables (to avoid recomputing them)
  lowerApyBound: BigNumber = toBn("0");
  historicalApyWad: BigNumber = toBn("0");
  upperApyBound: BigNumber = toBn("0");

  variableFactorWad: BigNumber = toBn("0");

  currentTick: number = 0;

  async mintAndApprove(address: string) {
    // consider adding an extra argument to this function amount so that the amount minted and approved is not hardcoded for more granular tests
    await this.token.mint(address, BigNumber.from(10).pow(27));
    await this.token.approve(address, BigNumber.from(10).pow(27));

    await this.token.mint(this.aToken.address, BigNumber.from(10).pow(27));
    const rni = await this.aaveLendingPool.getReserveNormalizedIncome(
      this.token.address
    );

    await this.aToken.mint(address, BigNumber.from(10).pow(27), rni);
    await this.aToken.approve(address, BigNumber.from(10).pow(27));
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
    fs.appendFileSync(
      this.outputFile,
      "  start timestamp: " +
        utils.formatEther(this.termStartTimestampBN) +
        "\n"
    );
    fs.appendFileSync(
      this.outputFile,
      "    end timestamp: " + utils.formatEther(this.termEndTimestampBN) + "\n"
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
      );
      fs.appendFileSync(this.outputFile, "\n");
    } else {
      fs.appendFileSync(this.outputFile, "lower apy bound: 0.0" + "\n");
      fs.appendFileSync(this.outputFile, " historical apy: 0.0" + "\n");
      fs.appendFileSync(this.outputFile, "upper apy bound: 0.0" + "\n");
      fs.appendFileSync(this.outputFile, "variable factor: 0.0" + "\n");
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
      let positionInfo = await this.marginEngineTest.callStatic.getPosition(
        this.positions[i][0],
        this.positions[i][1],
        this.positions[i][2]
      );

      fs.appendFileSync(this.outputFile, "POSITION " + i.toString() + "\n");
      positionInfo = await this.marginEngineTest.callStatic.getPosition(
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
      if (toBn(currentTimestamp.toString()) < this.termEndTimestampBN) {
        const current_margin_requirement =
          await this.marginEngineTest.callStatic.getPositionMarginRequirement(
            this.positions[i][0],
            this.positions[i][1],
            this.positions[i][2],
            false
          );
        fs.appendFileSync(
          this.outputFile,
          "              margin requirement: " +
            utils.formatEther(current_margin_requirement).toString() +
            "\n"
        );

        const liquidation_threshold =
          await this.marginEngineTest.callStatic.getPositionMarginRequirement(
            this.positions[i][0],
            this.positions[i][1],
            this.positions[i][2],
            true
          );
        fs.appendFileSync(
          this.outputFile,
          "           liquidation threshold: " +
            utils.formatEther(liquidation_threshold).toString() +
            "\n"
        );
        fs.appendFileSync(this.outputFile, "\n");
      } else {
        fs.appendFileSync(
          this.outputFile,
          "              margin requirement: 0.0" + "\n"
        );

        fs.appendFileSync(
          this.outputFile,
          "           liquidation threshold: 0.0" + "\n"
        );
        fs.appendFileSync(this.outputFile, "\n");
      }

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

  async init(isProd: boolean = false) {
    this.owner = provider.getWallets()[0];

    if (!isProd) {
      this.loadFixture = createFixtureLoader([this.owner]);
      // manually do the prerequsite deployments for the scenario
      ({
        factory: this.factory,
        mockAToken: this.aToken,
        token: this.token,
        rateOracleTest: this.rateOracleTest,
        aaveLendingPool: this.aaveLendingPool,
        termStartTimestampBN: this.termStartTimestampBN,
        termEndTimestampBN: this.termEndTimestampBN,
        testMarginCalculator: this.testMarginCalculator,
      } = await this.loadFixture(await createMetaFixtureE2E(this.params)));

      console.log(`factory: ${this.factory.address}`);
      console.log(`masterVAMM: ${await this.factory.masterVAMM()}`);
      console.log(
        `masterMarginEngine: ${await this.factory.masterMarginEngine()}`
      );
    } else {
      await this.getAlreadyDeployedContracts();
      const termStartTimestamp: number = await getCurrentTimestamp(provider);
      const termEndTimestamp: number =
        termStartTimestamp + this.params.duration.toNumber();
      this.termStartTimestampBN = toBn(termStartTimestamp.toString());
      this.termEndTimestampBN = toBn(termEndTimestamp.toString());
      ({ testMarginCalculator: this.testMarginCalculator } =
        await marginCalculatorFixture());
      // partial repetition of createMetaFixtureE2E (needs to be more DRY)
      await this.aaveLendingPool.setReserveNormalizedIncome(
        this.token.address,
        "1000000000000000000000000000" // 10^27
      );

      // await rateOracleTest.testGrow(100);
      await this.rateOracleTest.increaseObservationCardinalityNext(100);
      // write oracle entry
      await this.rateOracleTest.writeOracleEntry();
      // advance time after first write to the oracle
      await advanceTimeAndBlock(consts.ONE_MONTH, 2); // advance by one month

      await this.aaveLendingPool.setReserveNormalizedIncome(
        this.token.address,
        "1008000000000000000000000000" // 10^27 * 1.008
      );

      await this.rateOracleTest.writeOracleEntry();
    }

    // deploy an IRS instance
    const deployTrx = await this.factory.deployIrsInstance(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN,
      this.params.tickSpacing
    );

    const receiptLogs = (await deployTrx.wait()).logs;
    const log = this.factory.interface.parseLog(
      receiptLogs[receiptLogs.length - 3]
    );
    if (log.name !== "IrsInstance") {
      throw Error(
        "IrsInstance log not found! Has it moved to a different position in the array?"
      );
    }

    const marginEngineAddress = log.args.marginEngine;
    const vammAddress = log.args.vamm;
    const fcmAddress = log.args.fcm;

    const marginEngineFactory = await ethers.getContractFactory("MarginEngine");

    this.marginEngineTest = marginEngineFactory.attach(
      marginEngineAddress
    ) as MarginEngine;

    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    this.vammTest = vammTestFactory.attach(vammAddress) as TestVAMM;

    const fcmTestFactory = await ethers.getContractFactory("TestAaveFCM");
    this.fcmTest = fcmTestFactory.attach(fcmAddress) as TestAaveFCM;

    // deploy the periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");
    this.periphery = (await peripheryFactory.deploy()) as Periphery;

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
    await this.marginEngineTest.setLookbackWindowInSeconds(
      this.params.lookBackWindowAPY
    );

    // set VAMM parameters
    await this.vammTest.initializeVAMM(this.params.startingPrice.toString());

    if (this.params.feeProtocol !== 0) {
      await this.vammTest.setFeeProtocol(this.params.feeProtocol);
    }

    if (this.params.fee.toString() !== "0") {
      await this.vammTest.setFee(this.params.fee);
    }

    // set e2e setup parameters
    await this.e2eSetup.setMEAddress(this.marginEngineTest.address);
    await this.e2eSetup.setVAMMAddress(this.vammTest.address);
    await this.e2eSetup.setFCMAddress(this.fcmTest.address);
    await this.e2eSetup.setRateOracleAddress(this.rateOracleTest.address);
    await this.e2eSetup.setPeripheryAddress(this.periphery.address);

    // mint and approve the addresses
    await this.mintAndApprove(this.owner.address);
    // await this.mintAndApprove(this.marginEngineTest.address);
    // await this.mintAndApprove(this.e2eSetup.address);

    // create the actors
    this.actors = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const ActorFactory = await ethers.getContractFactory("Actor");
      const actor = (await ActorFactory.deploy()) as Actor;
      this.actors.push(actor);
      await this.mintAndApprove(actor.address);

      // ab: why do we need to do it via the approveInternal function call>
      await this.token.approveInternal(
        actor.address,
        this.fcmTest.address,
        BigNumber.from(10).pow(27)
      );

      await this.token.approveInternal(
        actor.address,
        this.periphery.address,
        BigNumber.from(10).pow(27)
      );

      await this.aToken.approveInternal(
        actor.address,
        this.fcmTest.address,
        BigNumber.from(10).pow(27)
      );

      await this.token.approveInternal(
        actor.address,
        this.e2eSetup.address,
        BigNumber.from(10).pow(27)
      );

      await this.token.approveInternal(
        actor.address,
        this.marginEngineTest.address,
        BigNumber.from(10).pow(27)
      );

      // set approval for the periphery to act on belalf of the actor
      await actor.setIntegrationApproval(
        this.marginEngineTest.address,
        this.periphery.address,
        true
      );

      await actor.setIntegrationApproval(
        this.marginEngineTest.address,
        this.e2eSetup.address,
        true
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

  public async getInfoSwapViaAMM(swapParams: {
    recipient: string;
    amountSpecified: BigNumber;
    sqrtPriceLimitX96: BigNumber;
    tickLower: number;
    tickUpper: number;
  }): Promise<InfoPostSwap> {
    const tickBefore = await this.periphery.getCurrentTick(
      this.marginEngineTest.address
    );

    let tickAfter = 0;
    let marginRequirement: BigNumber = BigNumber.from(0);
    let fee = BigNumber.from(0);
    let availableNotional = BigNumber.from(0);

    await this.e2eSetup.callStatic.swapViaAMM(swapParams).then(
      (result: any) => {
        availableNotional = result[1];
        fee = result[2];
        marginRequirement = result[4];
        tickAfter = parseInt(result[5]);
      },
      (error: any) => {
        const message = extractErrorMessage(error);

        if (!message) {
          throw new Error("Cannot decode additional margin amount");
        }

        if (message.includes("MarginRequirementNotMet")) {
          const args: string[] = message
            .split("MarginRequirementNotMet")[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          marginRequirement = BigNumber.from(args[0]);
          tickAfter = parseInt(args[1]);
          fee = BigNumber.from(args[4]);
          availableNotional = BigNumber.from(args[3]);
        } else {
          throw new Error("Additional margin amount cannot be established");
        }
      }
    );

    const currentMargin = (
      await this.marginEngineTest.callStatic.getPosition(
        swapParams.recipient,
        swapParams.tickLower,
        swapParams.tickUpper
      )
    ).margin;

    const scaledCurrentMargin = parseFloat(utils.formatEther(currentMargin));
    const scaledFee = parseFloat(utils.formatEther(fee));
    const scaledAvailableNotional = parseFloat(
      utils.formatEther(availableNotional)
    );
    const scaledMarginRequirement = parseFloat(
      utils.formatEther(marginRequirement)
    );

    const suggestedMargin = (scaledMarginRequirement + scaledFee) * 1.01;

    const additionalMargin =
      suggestedMargin > scaledCurrentMargin
        ? suggestedMargin - scaledCurrentMargin
        : 0;

    return {
      marginRequirement: additionalMargin,
      availableNotional: scaledAvailableNotional,
      fee: scaledFee,
      slippage: tickAfter - tickBefore,
    };
  }

  public async getInfoSwapViaPeriphery(
    trader: string,
    swapParams: {
      marginEngine: string;
      isFT: boolean;
      notional: BigNumber;
      sqrtPriceLimitX96: BigNumber;
      tickLower: number;
      tickUpper: number;
      marginDelta: BigNumber;
    }
  ): Promise<InfoPostSwap> {
    const tickBefore = await this.periphery.getCurrentTick(
      this.marginEngineTest.address
    );

    let tickAfter = 0;
    let marginRequirement: BigNumber = BigNumber.from(0);
    let fee = BigNumber.from(0);
    let availableNotional = BigNumber.from(0);

    await this.e2eSetup.callStatic.swapViaPeriphery(trader, swapParams).then(
      (result: any) => {
        availableNotional = result[1];
        fee = result[2];
        marginRequirement = result[4];
        tickAfter = parseInt(result[5]);
      },
      (error: any) => {
        const message = extractErrorMessage(error);

        if (!message) {
          throw new Error("Cannot decode additional margin amount");
        }

        if (message.includes("MarginRequirementNotMet")) {
          const args: string[] = message
            .split("MarginRequirementNotMet")[1]
            .split("(")[1]
            .split(")")[0]
            .replaceAll(" ", "")
            .split(",");

          marginRequirement = BigNumber.from(args[0]);
          tickAfter = parseInt(args[1]);
          fee = BigNumber.from(args[4]);
          availableNotional = BigNumber.from(args[3]);
        } else {
          console.log(message);
          throw new Error("Additional margin amount cannot be established");
        }
      }
    );

    const currentMargin = (
      await this.marginEngineTest.callStatic.getPosition(
        trader,
        swapParams.tickLower,
        swapParams.tickUpper
      )
    ).margin;

    const scaledCurrentMargin = parseFloat(utils.formatEther(currentMargin));
    const scaledFee = parseFloat(utils.formatEther(fee));
    const scaledAvailableNotional = parseFloat(
      utils.formatEther(availableNotional)
    );
    const scaledMarginRequirement = parseFloat(
      utils.formatEther(marginRequirement)
    );

    const suggestedMargin = (scaledMarginRequirement + scaledFee) * 1.01;

    const additionalMargin =
      suggestedMargin > scaledCurrentMargin
        ? suggestedMargin - scaledCurrentMargin
        : 0;

    return {
      marginRequirement: additionalMargin,
      availableNotional: scaledAvailableNotional,
      fee: scaledFee,
      slippage: tickAfter - tickBefore,
    };
  }

  public async getMintInfoViaAMM(
    recipient: string,
    tickLower: number,
    tickUpper: number,
    amount: BigNumber
  ): Promise<number> {
    let marginRequirement = BigNumber.from("0");
    await this.e2eSetup.callStatic
      .mintViaAMM(recipient, tickLower, tickUpper, amount)
      .then(
        (result) => {
          marginRequirement = BigNumber.from(result);
        },
        (error) => {
          const message = extractErrorMessage(error);

          if (!message) {
            throw new Error("Cannot decode additional margin amount");
          }

          if (message.includes("MarginLessThanMinimum")) {
            const args: string[] = message
              .split("MarginLessThanMinimum")[1]
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = BigNumber.from(args[0]);
          } else {
            throw new Error("Additional margin amount cannot be established");
          }
        }
      );

    const currentMargin = (
      await this.marginEngineTest.callStatic.getPosition(
        recipient,
        tickLower,
        tickUpper
      )
    ).margin;

    const scaledCurrentMargin = parseFloat(utils.formatEther(currentMargin));
    const scaledMarginRequirement = parseFloat(
      utils.formatEther(marginRequirement)
    );

    const suggestedMargin = scaledMarginRequirement * 1.01;
    const additionalMargin =
      suggestedMargin > scaledCurrentMargin
        ? suggestedMargin - scaledCurrentMargin
        : 0;

    return additionalMargin;
  }

  public async getMintInfoViaPeriphery(
    trader: string,
    mintParams: {
      marginEngine: string;
      tickLower: number;
      tickUpper: number;
      notional: BigNumber;
      isMint: boolean;
      marginDelta: BigNumber;
    }
  ): Promise<number> {
    let marginRequirement = BigNumber.from("0");
    await this.e2eSetup.callStatic
      .mintOrBurnViaPeriphery(trader, mintParams)
      .then(
        (result) => {
          marginRequirement = BigNumber.from(result);
        },
        (error) => {
          const message = extractErrorMessage(error);

          if (!message) {
            throw new Error("Cannot decode additional margin amount");
          }

          if (message.includes("MarginLessThanMinimum")) {
            const args: string[] = message
              .split("MarginLessThanMinimum")[1]
              .split("(")[1]
              .split(")")[0]
              .replaceAll(" ", "")
              .split(",");

            marginRequirement = BigNumber.from(args[0]);
          } else {
            throw new Error("Additional margin amount cannot be established");
          }
        }
      );

    const currentMargin = (
      await this.marginEngineTest.callStatic.getPosition(
        trader,
        mintParams.tickLower,
        mintParams.tickUpper
      )
    ).margin;

    const scaledCurrentMargin = parseFloat(utils.formatEther(currentMargin));
    const scaledMarginRequirement = parseFloat(
      utils.formatEther(marginRequirement)
    );

    const suggestedMargin = scaledMarginRequirement * 1.01;
    const additionalMargin =
      suggestedMargin > scaledCurrentMargin
        ? suggestedMargin - scaledCurrentMargin
        : 0;

    return additionalMargin;
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
    console.log(
      "rni:",
      Math.floor(reserveNormalizedIncome * 10000 + 0.5).toString() +
        "0".repeat(23)
    );
    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      Math.floor(reserveNormalizedIncome * 10000 + 0.5).toString() +
        "0".repeat(23)
    );

    await this.rateOracleTest.writeOracleEntry();

    await this.updateAPYbounds();
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
        await this.marginEngineTest.callStatic.getPosition(p[0], p[1], p[2])
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
      await this.e2eSetup.settlePositionViaAMM(p[0], p[1], p[2]);

      await this.e2eSetup.updatePositionMarginViaAMM(
        p[0],
        p[1],
        p[2],
        (
          await this.marginEngineTest.callStatic.getPosition(p[0], p[1], p[2])
        ).margin
          .mul(-1)
          .add(1)
      );
    }

    for (const p of this.positions) {
      try {
        await this.e2eSetup.settleYBATrader(p[0]);
      } catch (_) {}
    }
  }

  async updateCurrentTick() {
    this.currentTick = (await this.vammTest.vammVars()).tick;
  }

  async run() {}
}
