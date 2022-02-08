import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { TestVAMM } from "../../typechain/TestVAMM";
import {
  E2ESetupFixture,
  fixedAndVariableMathFixture,
  sqrtPriceMathFixture,
  tickMathFixture,
  createMetaFixtureE2E,
} from "../shared/fixtures";
import {
  getMaxLiquidityPerTick,
  formatRay,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
  decodePriceSqrt,
} from "../shared/utilities";
import { toBn } from "evm-bn";
import { TestMarginEngine } from "../../typechain/TestMarginEngine";
import {
  E2ESetup,
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  MockAaveLendingPool,
  SqrtPriceMathTest,
  TestRateOracle,
  TickMathTest,
} from "../../typechain";
import { consts } from "../helpers/constants";
import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../helpers/time";
import { Minter } from "../../typechain/Minter";
import { Swapper } from "../../typechain/Swapper";
import { e2eParameters, e2eScenarios } from "../shared/e2eSetup";

const createFixtureLoader = waffle.createFixtureLoader;

const { provider } = waffle;

const scenarios_to_run = [0];

class ScenarioRunner {
  params: e2eParameters;

  owner!: Wallet;
  factory!: Factory;
  token!: ERC20Mock;
  rateOracleTest!: TestRateOracle;

  termStartTimestampBN!: BigNumber;
  termEndTimestampBN!: BigNumber;

  vammTest!: TestVAMM;
  marginEngineTest!: TestMarginEngine;
  aaveLendingPool!: MockAaveLendingPool;

  testMarginCalculator!: MarginCalculatorTest;
  marginCalculatorParams: any;

  testFixedAndVariableMath!: FixedAndVariableMathTest;
  testTickMath!: TickMathTest;
  testSqrtPriceMath!: SqrtPriceMathTest;

  e2eSetup!: E2ESetup;
  minters!: Minter[];
  swappers!: Swapper[];

  positions: [string, number, number][] = [];
  traders: string[] = [];

  loadFixture!: ReturnType<typeof createFixtureLoader>;

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

  constructor(params_: e2eParameters) {
    this.params = params_;
  }

  async init() {
    this.owner = provider.getWallets()[0];
    provider.getSigner();

    this.loadFixture = createFixtureLoader([this.owner]);

    ({
      factory: this.factory,
      token: this.token,
      rateOracleTest: this.rateOracleTest,
      aaveLendingPool: this.aaveLendingPool,
      termStartTimestampBN: this.termStartTimestampBN,
      termEndTimestampBN: this.termEndTimestampBN,
      testMarginCalculator: this.testMarginCalculator,
    } = await this.loadFixture(await createMetaFixtureE2E(this.params)));

    // deploy an IRS instance
    await this.factory.deployIrsInstance(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN
    );

    // deploy margin engine test
    const marginEngineAddress = await this.factory.getMarginEngineAddress(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN
    );

    const marginEngineTestFactory = await ethers.getContractFactory(
      "TestMarginEngine"
    );

    this.marginEngineTest = marginEngineTestFactory.attach(marginEngineAddress);

    // deploy VAMM test
    const vammAddress = await this.factory.getVAMMAddress(
      this.token.address,
      this.rateOracleTest.address,
      this.termStartTimestampBN,
      this.termEndTimestampBN
    );

    const vammTestFactory = await ethers.getContractFactory("TestVAMM");
    this.vammTest = vammTestFactory.attach(vammAddress);

    // deploy Fixed and Variable Math test
    ({ testFixedAndVariableMath: this.testFixedAndVariableMath } =
      await this.loadFixture(fixedAndVariableMathFixture));

    // deploy Tick Math Test
    ({ testTickMath: this.testTickMath } = await this.loadFixture(
      tickMathFixture
    ));

    // deploy Sqrt Price Math Test
    ({ testSqrtPriceMath: this.testSqrtPriceMath } = await this.loadFixture(
      sqrtPriceMathFixture
    ));

    // deploy the setup for E2E testing
    ({ e2eSetup: this.e2eSetup } = await this.loadFixture(E2ESetupFixture));

    // set the parameters of margin calculator
    this.marginCalculatorParams = this.params.marginCalculatorParams;

    // set margin engine parameters
    await this.marginEngineTest.setVAMMAddress(this.vammTest.address);
    await this.marginEngineTest.setMarginCalculatorParameters(
      this.marginCalculatorParams
    );
    await this.marginEngineTest.setSecondsAgo(this.params.lookBackWindowAPY);

    // set VAMM parameters
    await this.vammTest.initializeVAMM(this.params.startingPrice.toString());
    await this.vammTest.setMaxLiquidityPerTick(
      getMaxLiquidityPerTick(this.params.tickSpacing)
    );
    await this.vammTest.setTickSpacing(this.params.tickSpacing);
    await this.vammTest.setFeeProtocol(this.params.feeProtocol);
    await this.vammTest.setFee(this.params.fee);

    // set e2e setup parameters
    await this.e2eSetup.setMEAddress(this.marginEngineTest.address);
    await this.e2eSetup.setVAMMAddress(this.vammTest.address);
    await this.e2eSetup.setRateOracleAddress(this.rateOracleTest.address);

    // mint and approve the addresses
    await this.mintAndApprove(this.owner.address);
    await this.mintAndApprove(this.marginEngineTest.address);
    await this.mintAndApprove(this.e2eSetup.address);

    // create the minters and swappers
    this.minters = [];
    for (let i = 0; i < this.params.numMinters; i++) {
      const MinterFactory = await ethers.getContractFactory("Minter");
      const minter = await MinterFactory.deploy();
      this.minters.push(minter);
      await this.mintAndApprove(minter.address);
    }

    this.swappers = [];
    for (let i = 0; i < this.params.numSwappers; i++) {
      const SwapperFactory = await ethers.getContractFactory("Swapper");
      const swapper = await SwapperFactory.deploy();
      this.swappers.push(swapper);
      await this.mintAndApprove(swapper.address);
    }

    await this.token.approveInternal(
      this.e2eSetup.address,
      this.marginEngineTest.address,
      BigNumber.from(10).pow(27)
    );

    this.positions = [];
    for (const p of this.params.positions) {
      this.positions.push([this.minters[p[0]].address, p[1], p[2]]);
    }

    this.traders = [];
    for (const t of this.params.traders) {
      this.traders.push(this.swappers[t].address);
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
  async printPositionsAndTradersInfo(
    positions: [string, number, number][],
    traders: string[]
  ) {
    for (let i = 0; i < positions.length; i++) {
      await this.marginEngineTest.updatePositionTokenBalancesAndAccountForFeesTest(
        positions[i][0],
        positions[i][1],
        positions[i][2]
      );

      console.log("POSITION: ", i + 1);
      console.log("TICK LOWER", positions[i][1]);
      console.log("TICK UPPER", positions[i][2]);
      const positionInfo = await this.marginEngineTest.getPosition(
        positions[i][0],
        positions[i][1],
        positions[i][2]
      );

      await this.printPositionInfo(positionInfo);
    }

    for (let i = 0; i < traders.length; i++) {
      console.log("TRADER: ", i + 1);
      const traderInfo = await this.marginEngineTest.traders(traders[i]);
      await this.printTraderInfo(traderInfo);
    }
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
    this.historicalApyWad = await this.marginEngineTest.getHistoricalApy();

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

    console.log(" historical apy:", utils.formatEther(this.historicalApyWad));
    console.log("upper apy bound:", utils.formatEther(this.upperApyBound));
    console.log("lower apy bound:", utils.formatEther(this.lowerApyBound));
    console.log("variable factor:", utils.formatEther(this.variableFactorWad)); // displayed as zero, investigate
    console.log("");
  }

  // reserveNormalizedIncome format: x.yyyy
  async advanceAndUpdateApy(
    time: BigNumber,
    blockCount: number,
    reserveNormalizedIncome: number
  ) {
    await advanceTimeAndBlock(time, blockCount);

    console.log(
      "reserveNormalizedIncome in 1e27",
      reserveNormalizedIncome.toString().replace(".", "") + "0".repeat(23)
    );
    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      Math.floor(reserveNormalizedIncome * 10000).toString() + "0".repeat(23)
    );

    await this.rateOracleTest.writeOracleEntry();

    await this.printReserveNormalizedIncome();

    await this.updateAPYbounds();
  }

  async printAPYboundsAndPositionMargin(
    position: [string, number, number],
    liquidity: BigNumber
  ) {
    await this.updateAPYbounds();

    this.currentTick = await this.vammTest.getCurrentTick();
    console.log("current tick: ", this.currentTick);

    const positionInfo = await this.marginEngineTest.getPosition(
      position[0],
      position[1],
      position[2]
    );

    const position_margin_requirement_params = {
      owner: position[0],
      tickLower: position[1],
      tickUpper: position[2],
      isLM: false,
      currentTick: this.currentTick,
      termStartTimestampWad: this.termStartTimestampBN,
      termEndTimestampWad: this.termEndTimestampBN,
      liquidity: liquidity.add(positionInfo._liquidity),
      fixedTokenBalance: positionInfo.fixedTokenBalance,
      variableTokenBalance: positionInfo.variableTokenBalance,
      variableFactorWad: this.variableFactorWad,
      historicalApyWad: this.historicalApyWad,
    };

    const positionMarginRequirement =
      await this.testMarginCalculator.getPositionMarginRequirementTest(
        position_margin_requirement_params,
        this.marginCalculatorParams
      );

    console.log(
      "position margin requirement: ",
      utils.formatEther(positionMarginRequirement)
    );
    console.log("");

    return positionMarginRequirement;
  }

  async printAPYboundsAndTraderMargin(trader: Wallet) {
    await this.updateAPYbounds();

    const traderInfo = await this.marginEngineTest.traders(trader.address);

    const trader_margin_requirement_params = {
      fixedTokenBalance: traderInfo.fixedTokenBalance,
      variableTokenBalance: traderInfo.variableTokenBalance,
      termStartTimestampWad: this.termStartTimestampBN,
      termEndTimestampWad: this.termEndTimestampBN,
      isLM: false,
      historicalApyWad: this.historicalApyWad,
    };

    const traderMarginRequirement =
      await this.testMarginCalculator.getTraderMarginRequirement(
        trader_margin_requirement_params,
        this.marginCalculatorParams
      );

    console.log(
      "trader margin requirement: ",
      utils.formatEther(traderMarginRequirement)
    );

    console.log("");

    return traderMarginRequirement;
  }

  async printAmounts(
    lowerTick: number,
    upperTick: number,
    liquidityBn: BigNumber
  ) {
    const ratioAtLowerTick = await this.testTickMath.getSqrtRatioAtTick(
      lowerTick
    );
    const ratioAtUpperTick = await this.testTickMath.getSqrtRatioAtTick(
      upperTick
    );

    const amount0 = await this.testSqrtPriceMath.getAmount0Delta(
      ratioAtLowerTick,
      ratioAtUpperTick,
      liquidityBn,
      true
    );
    const amount1 = await this.testSqrtPriceMath.getAmount1Delta(
      ratioAtLowerTick,
      ratioAtUpperTick,
      liquidityBn,
      true
    );

    console.log(
      "PRICE at LOWER tick: ",
      decodePriceSqrt(BigNumber.from(ratioAtLowerTick.toString()))
    );
    console.log(
      "PRICE at UPPER tick: ",
      decodePriceSqrt(BigNumber.from(ratioAtUpperTick.toString()))
    );
    console.log("           AMOUNT 0: ", BigNumber.from(amount0.toString()));
    console.log("           AMOUNT 1: ", BigNumber.from(amount1.toString()));

    return [
      parseFloat(utils.formatEther(amount0)),
      parseFloat(utils.formatEther(amount1)),
    ];
  }

  async settlePositionsAndTraders(
    positions: [string, number, number][],
    traders: string[]
  ) {
    for (let i = 0; i < positions.length; i++) {
      await this.marginEngineTest.settlePosition({
        owner: positions[i][0],
        tickLower: positions[i][1],
        tickUpper: positions[i][2],
        liquidityDelta: toBn("0"),
      });
    }

    for (let i = 0; i < traders.length; i++) {
      await this.marginEngineTest.settleTrader(traders[i]);
    }
  }

  async updateCurrentTick() {
    this.currentTick = await this.vammTest.getCurrentTick();
    console.log("current tick: ", this.currentTick);
  }

  async run() {}
}

class ScenarioRunnerInstance extends ScenarioRunner {
  override async run() {
    console.log(
      "----------------------------START----------------------------"
    );

    await this.printReserveNormalizedIncome();

    // add 1,000,000 liquidity to Position 0
    // {
    // print the position margin requirement
    await this.printAPYboundsAndPositionMargin(
      this.positions[0],
      toBn("1000000")
    );

    // update the position margin with 210
    await this.e2eSetup.updatePositionMargin(
      {
        owner: this.positions[0][0],
        tickLower: this.positions[0][1],
        tickUpper: this.positions[0][2],
        liquidityDelta: toBn("0"),
      },
      toBn("210")
    );

    // add 1,000,000 liquidity to Position 0
    await this.e2eSetup.mint(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );
    // }

    // two days pass and set reserve normalised income
    await this.advanceAndUpdateApy(consts.ONE_DAY.mul(2), 1, 1.0081); // advance 2 days

    // Trader 0 engages in a swap that (almost) consumes all of the liquidity of Position 0
    // {
    console.log(
      "----------------------------BEFORE FIRST SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);

    // update the trader margin with 1,000
    await this.e2eSetup.updateTraderMargin(this.traders[0], toBn("1000"));

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.printAmounts(
      this.positions[0][1],
      this.currentTick,
      toBn("1000000")
    );

    // Trader 0 buys 2,995 VT
    await this.e2eSetup.swap({
      recipient: this.traders[0],
      isFT: false,
      amountSpecified: toBn("-2995"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isUnwind: false,
      isTrader: true,
      tickLower: 0,
      tickUpper: 0,
    });

    console.log(
      "----------------------------AFTER FIRST SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);
    // }

    await this.updateCurrentTick();

    // one week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.01);
    await this.printReserveNormalizedIncome();

    // add 5,000,000 liquidity to Position 1
    // {
    // print the position margin requirement
    await this.printAPYboundsAndPositionMargin(
      this.positions[1],
      toBn("5000000")
    );

    // update the position margin with 2,000
    await this.e2eSetup.updatePositionMargin(
      {
        owner: this.positions[1][0],
        tickLower: this.positions[1][1],
        tickUpper: this.positions[1][2],
        liquidityDelta: 0,
      },
      toBn("2000")
    );

    // add 5,000,000 liquidity to Position 1
    await this.e2eSetup.mint(
      this.positions[1][0],
      this.positions[1][1],
      this.positions[1][2],
      toBn("5000000")
    );
    // }

    // a week passes
    await this.advanceAndUpdateApy(consts.ONE_WEEK, 2, 1.0125);

    // Trader 1 engages in a swap
    // {
    console.log(
      "----------------------------BEFORE SECOND SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);

    // update the trader margin with 1,000
    await this.e2eSetup.updateTraderMargin(this.traders[1], toBn("1000"));

    // print the maximum amount given the liquidity of Position 0
    await this.updateCurrentTick();

    await this.printAmounts(
      this.positions[0][1],
      this.currentTick,
      toBn("1000000")
    );
    await this.printAmounts(
      this.positions[1][1],
      this.currentTick,
      toBn("5000000")
    );

    // Trader 1 buys 15,000 VT
    await this.e2eSetup.swap({
      recipient: this.traders[1],
      isFT: false,
      amountSpecified: toBn("-15000"),
      sqrtPriceLimitX96: BigNumber.from(MIN_SQRT_RATIO.add(1)),
      isUnwind: false,
      isTrader: true,
      tickLower: 0,
      tickUpper: 0,
    });

    console.log(
      "----------------------------AFTER SECOND SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);
    // }

    // Trader 0 engages in a reverse swap
    // {
    console.log(
      "----------------------------BEFORE THIRD (REVERSE) SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);

    // Trader 0 sells 10,000 VT
    await this.e2eSetup.swap({
      recipient: this.traders[0],
      isFT: true,
      amountSpecified: toBn("10000"),
      sqrtPriceLimitX96: BigNumber.from(MAX_SQRT_RATIO.sub(1)),
      isUnwind: false,
      isTrader: true,
      tickLower: 0,
      tickUpper: 0,
    });

    console.log(
      "----------------------------AFTER THIRD (REVERSE) SWAP----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);
    // }

    await this.updateCurrentTick();

    // two weeks pass
    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(2), 2, 1.013); // advance two weeks

    // burn all liquidity of Position 0
    // {
    await this.e2eSetup.burn(
      this.positions[0][0],
      this.positions[0][1],
      this.positions[0][2],
      toBn("1000000")
    );
    // }

    await this.advanceAndUpdateApy(consts.ONE_WEEK.mul(8), 4, 1.0132); // advance eight weeks (4 days before maturity)

    await advanceTimeAndBlock(consts.ONE_DAY.mul(5), 2); // advance 5 days to reach maturity

    // settle positions and traders
    await this.settlePositionsAndTraders(this.positions, this.traders);

    console.log(
      "----------------------------FINAL----------------------------"
    );
    await this.printPositionsAndTradersInfo(this.positions, this.traders);
  }
}

for (const i of scenarios_to_run) {
  console.log("scenario", i);
  const e2eParams = e2eScenarios[i];
  const scenario = new ScenarioRunnerInstance(e2eParams);

  it("test", async () => {
    await scenario.init();
    await scenario.run();
  });
}
