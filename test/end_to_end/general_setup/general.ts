import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { formatRay } from "../../shared/utilities";
import {
  AaveFCM,
  Actor,
  CompoundFCM,
  E2ESetup,
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  IFCM,
  ILidoOracle,
  IMarginEngine,
  IRateOracle,
  IStETH,
  IVAMM,
  MarginCalculatorTest,
  MarginEngine,
  MockAaveLendingPool,
  MockAToken,
  MockCToken,
  MockStEth,
  MockWETH,
  Periphery,
  SqrtPriceMathTest,
  TickMathTest,
  VAMM,
} from "../../../typechain";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { consts } from "../../helpers/constants";
import { toBn } from "evm-bn";
import JSBI from "jsbi";

const { provider } = waffle;

export interface e2eParameters {
  duration: BigNumber;
  lookBackWindowAPY: BigNumber;

  numActors: number;

  marginCalculatorParams: any;

  startingPrice: JSBI;
  tickSpacing: number;

  feeProtocol: number;
  fee: BigNumber;

  positions: [number, number, number][]; // list of [index of actor, lower tick, upper tick]

  isWETH?: boolean;

  noMintTokens?: boolean;

  rateOracle: number;
}

export type InfoPostSwap = {
  marginRequirement: number;
  availableNotional: number;
  fee: number;
  slippage: number;
};

const MAX_AMOUNT = BigNumber.from(10).pow(27);

export class ScenarioRunner {
  // scenario parameters
  params: e2eParameters;

  // wallets
  owner!: Wallet;

  // tokens
  weth!: MockWETH;
  token!: ERC20Mock;
  aToken!: MockAToken;
  cToken!: MockCToken;
  stETH!: IStETH;
  lidoOracle!: ILidoOracle;

  // long-term contracts
  factory!: Factory;
  rateOracle!: IRateOracle;
  periphery!: Periphery;
  aaveLendingPool!: MockAaveLendingPool;

  // irs-specific contracts
  fcm?: IFCM;
  vamm!: IVAMM;
  marginEngine!: IMarginEngine;

  // library contracts
  fixedAndVariableMath!: FixedAndVariableMathTest;
  tickMath!: TickMathTest;
  sqrtPriceMath!: SqrtPriceMathTest;
  marginCalculator!: MarginCalculatorTest;

  // irs-specific variables
  termStartTimestamp!: BigNumber;
  termEndTimestamp!: BigNumber;

  // e2e setup
  e2eSetup!: E2ESetup;
  actors!: Actor[];
  positions: [string, number, number][] = [];

  constructor(params: e2eParameters) {
    this.params = params;
  }

  getRateInRay(rate: number): string {
    return Math.floor(rate * 10000 + 0.5).toString() + "0".repeat(23);
  }

  async deployLongTermContracts() {
    // master margin engine
    const masterMarginEngineFactory = await ethers.getContractFactory(
      "MarginEngine"
    );
    const masterMarginEngine =
      (await masterMarginEngineFactory.deploy()) as MarginEngine;

    // master vamm
    const masterVAMMFactory = await ethers.getContractFactory("VAMM");
    const masterVAMM = (await masterVAMMFactory.deploy()) as VAMM;

    // factory
    const factoryFactory = await ethers.getContractFactory("Factory");
    this.factory = (await factoryFactory.deploy(
      masterMarginEngine.address,
      masterVAMM.address
    )) as Factory;

    // master fcm
    switch (this.params.rateOracle) {
      case 1: {
        const masterFCMFactory = await ethers.getContractFactory("AaveFCM");
        const masterFCM = (await masterFCMFactory.deploy()) as AaveFCM;

        await this.factory.setMasterFCM(masterFCM.address, 1);
        break;
      }

      case 2: {
        const masterFCMFactory = await ethers.getContractFactory("CompoundFCM");
        const masterFCM = (await masterFCMFactory.deploy()) as CompoundFCM;

        await this.factory.setMasterFCM(masterFCM.address, 2);
        break;
      }

      case 3: {
        break;
      }

      case 4: {
        break;
      }

      default: {
        throw new Error("Unrecognized rate oracle");
      }
    }

    // Wrapped ETH
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    this.weth = (await MockWETHFactory.deploy(
      "Wrapped ETH",
      "WETH"
    )) as MockWETH;

    // underlying token
    if (this.params.isWETH) {
      this.token = this.weth as ERC20Mock;
    } else {
      const MockERC20Factory = await ethers.getContractFactory("ERC20Mock");
      this.token = (await MockERC20Factory.deploy(
        "Voltz USD",
        "VUSD"
      )) as ERC20Mock;
    }

    // mock aave lending pool
    const MockAaveLendingPoolFactory = await ethers.getContractFactory(
      "MockAaveLendingPool"
    );
    this.aaveLendingPool =
      (await MockAaveLendingPoolFactory.deploy()) as MockAaveLendingPool;

    // initialize aave lending pool
    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      this.getRateInRay(1)
    );

    // Lido Mocks
    const mockStEthFactory = await ethers.getContractFactory("MockStEth");
    this.stETH = (await mockStEthFactory.deploy()) as IStETH;

    await (this.stETH as MockStEth).setSharesMultiplierInRay(
      this.getRateInRay(1)
    );

    const mockLidoOracleFactory = await ethers.getContractFactory(
      "MockLidoOracle"
    );
    this.lidoOracle = (await mockLidoOracleFactory.deploy(
      this.stETH.address
    )) as ILidoOracle;

    // mock cToken
    const mockCTokenFactory = await ethers.getContractFactory("MockCToken");
    this.cToken = (await mockCTokenFactory.deploy(
      this.token.address,
      "Voltz cUSD",
      "cVUSD"
    )) as MockCToken;
    await this.cToken.setExchangeRate(toBn("1"));

    switch (this.params.rateOracle) {
      case 1: {
        const rateOracleFactory = await ethers.getContractFactory(
          "AaveRateOracle"
        );
        this.rateOracle = (await rateOracleFactory.deploy(
          this.aaveLendingPool.address,
          this.token.address,
          [],
          []
        )) as IRateOracle;

        break;
      }

      case 2: {
        const rateOracleFactory = await ethers.getContractFactory(
          "CompoundRateOracle"
        );
        this.rateOracle = (await rateOracleFactory.deploy(
          this.cToken.address,
          this.params.isWETH || false,
          this.token.address,
          18,
          [],
          []
        )) as IRateOracle;

        break;
      }

      case 3: {
        // To be added
        break;
      }

      case 4: {
        // Lido Rate Oracle
        const rateOracleFactory = await ethers.getContractFactory(
          "LidoRateOracle"
        );
        this.rateOracle = (await rateOracleFactory.deploy(
          this.stETH.address,
          this.lidoOracle.address,
          this.weth.address,
          [],
          []
        )) as IRateOracle;
        break;
      }

      default: {
        throw new Error("Unrecognized rate oracle");
      }
    }

    // mock aToken
    const mockATokenFactory = await ethers.getContractFactory("MockAToken");
    this.aToken = (await mockATokenFactory.deploy(
      this.aaveLendingPool.address,
      this.token.address,
      "Voltz aUSD",
      "aVUSD"
    )) as MockAToken;

    await this.aaveLendingPool.initReserve(
      this.token.address,
      this.aToken.address
    );

    // e2e setup
    const E2ESetupFactory = await ethers.getContractFactory("E2ESetup");
    this.e2eSetup = (await E2ESetupFactory.deploy()) as E2ESetup;

    // initialize the rate oracle
    /// increase the buffer size
    await this.rateOracle.increaseObservationCardinalityNext(1000);
    await this.rateOracle.increaseObservationCardinalityNext(2000);
    await this.rateOracle.increaseObservationCardinalityNext(3000);

    /// write first entry
    await this.rateOracle.writeOracleEntry();

    /// advance time by one year to always have rate look-back window away
    await advanceTimeAndBlock(consts.ONE_YEAR, 4);

    // get dates
    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + this.params.duration.toNumber();

    this.termStartTimestamp = toBn(termStartTimestamp.toString());
    this.termEndTimestamp = toBn(termEndTimestamp.toString());

    // periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");
    this.periphery = (await peripheryFactory.deploy(
      this.weth.address
    )) as Periphery;
  }

  async deployLibraryContracts() {
    // FixedAndVariableMath library exposed as a contract
    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMathTest"
    );
    this.fixedAndVariableMath =
      (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMathTest;

    // SqrtPriceMath library exposed as a contract
    const SqrtPriceMathFactory = await ethers.getContractFactory(
      "SqrtPriceMathTest"
    );
    this.sqrtPriceMath =
      (await SqrtPriceMathFactory.deploy()) as SqrtPriceMathTest;

    // TickMath library exposed as a contract
    const TickMathFactory = await ethers.getContractFactory("TickMathTest");
    this.tickMath = (await TickMathFactory.deploy()) as TickMathTest;

    // MarginCalculator library exposed as a contract
    const MarginCalculatorFactory = await ethers.getContractFactory(
      "MarginCalculatorTest"
    );
    this.marginCalculator =
      (await MarginCalculatorFactory.deploy()) as MarginCalculatorTest;
  }

  async deployIRSContracts() {
    // deploy IRS instance
    const deployTrx = await this.factory.deployIrsInstance(
      this.token.address,
      this.rateOracle.address,
      this.termStartTimestamp,
      this.termEndTimestamp,
      this.params.tickSpacing,
      { gasLimit: 10000000 }
    );

    // infer the IRS transaction event
    const receiptLogs = (await deployTrx.wait()).logs;
    const log = this.factory.interface.parseLog(
      receiptLogs[receiptLogs.length - 3]
    );
    if (log.name !== "IrsInstance") {
      throw Error(
        "IrsInstance log not found! Has it moved to a different position in the array?"
      );
    }

    // get IRS contracts
    const marginEngineAddress = log.args.marginEngine;
    const vammAddress = log.args.vamm;
    const fcmAddress = log.args.fcm;

    const marginEngineFactory = await ethers.getContractFactory("MarginEngine");
    this.marginEngine = marginEngineFactory.attach(
      marginEngineAddress
    ) as IMarginEngine;

    const vammFactory = await ethers.getContractFactory("VAMM");
    this.vamm = vammFactory.attach(vammAddress) as IVAMM;

    switch (this.params.rateOracle) {
      case 1: {
        const fcmFactory = await ethers.getContractFactory("AaveFCM");
        this.fcm = fcmFactory.attach(fcmAddress) as IFCM;

        break;
      }

      case 2: {
        const fcmFactory = await ethers.getContractFactory("CompoundFCM");
        this.fcm = fcmFactory.attach(fcmAddress) as IFCM;

        break;
      }

      case 3: {
        break;
      }

      case 4: {
        break;
      }

      default: {
        throw new Error("Unrecognized rate oracle");
      }
    }
  }

  async configureIRS() {
    // set margin engine parameters
    await this.marginEngine.setVAMM(this.vamm.address);
    await this.marginEngine.setMarginCalculatorParameters(
      this.params.marginCalculatorParams
    );
    await this.marginEngine.setLookbackWindowInSeconds(
      this.params.lookBackWindowAPY
    );

    // set VAMM parameters
    try {
      await this.vamm.setFeeProtocol(this.params.feeProtocol);
    } catch (_) {
      console.log("same protocol fee as before");
    }

    try {
      await this.vamm.setFee(this.params.fee);
    } catch (_) {
      console.log("same fee percentage as before");
    }
  }

  async mintAndApprove(address: string, amount: BigNumber) {
    await this.token.mint(address, amount);
    await this.token.approve(address, amount);

    await this.token.mint(this.aToken.address, amount);
    const rni = await this.aaveLendingPool.getReserveNormalizedIncome(
      this.token.address
    );

    await this.aToken.mint(address, amount, rni);
    await this.aToken.approve(address, amount);

    await this.cToken.mint(address, amount);
    await this.cToken.approve(address, amount);
  }

  async configureE2E() {
    /// set all contracts in E2E
    await this.e2eSetup.setMEAddress(this.marginEngine.address);
    await this.e2eSetup.setVAMMAddress(this.vamm.address);
    await this.e2eSetup.setRateOracleAddress(this.rateOracle.address);
    await this.e2eSetup.setPeripheryAddress(this.periphery.address);
    await this.e2eSetup.setAaveLendingPool(this.aaveLendingPool.address);
    await this.e2eSetup.setCToken(this.cToken.address);

    if (this.fcm) {
      await this.e2eSetup.setFCMAddress(this.fcm.address);
    }

    // eslint-disable-next-line no-empty
    if (this.params.noMintTokens) {
    } else {
      await this.mintAndApprove(this.owner.address, MAX_AMOUNT);
    }

    /// spawn up the actors
    this.actors = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const ActorFactory = await ethers.getContractFactory("Actor");
      const actor = (await ActorFactory.deploy()) as Actor;

      /// push new actor
      this.actors.push(actor);
      // eslint-disable-next-line no-empty
      if (this.params.noMintTokens) {
      } else {
        await this.mintAndApprove(actor.address, MAX_AMOUNT);
      }

      /// set manually the approval of contracts to act on behalf of actors
      for (const ad of [
        this.periphery.address,
        this.vamm.address,
        this.marginEngine.address,
      ]) {
        await this.token.approveInternal(actor.address, ad, MAX_AMOUNT);
        await this.aToken.approveInternal(actor.address, ad, MAX_AMOUNT);
        await this.cToken.approveInternal(actor.address, ad, MAX_AMOUNT);
        await this.e2eSetup.setIntegrationApproval(actor.address, ad, true);
      }

      if (this.fcm) {
        await this.token.approveInternal(
          actor.address,
          this.fcm.address,
          MAX_AMOUNT
        );
        await this.aToken.approveInternal(
          actor.address,
          this.fcm.address,
          MAX_AMOUNT
        );
        await this.cToken.approveInternal(
          actor.address,
          this.fcm.address,
          MAX_AMOUNT
        );
        await this.e2eSetup.setIntegrationApproval(
          actor.address,
          this.fcm.address,
          true
        );
      }
    }

    this.positions = [];
    for (const p of this.params.positions) {
      this.positions.push([this.actors[p[0]].address, p[1], p[2]]);
    }
  }

  async init() {
    this.owner = provider.getWallets()[0];

    // deploy long-term contracts
    await this.deployLongTermContracts();

    await this.deployLibraryContracts();

    console.log(`factory: ${this.factory.address}`);
    console.log(`periphery: ${this.periphery.address}`);
    console.log(`E2E: ${this.e2eSetup.address}`);
    console.log(`masterVAMM: ${await this.factory.masterVAMM()}`);
    console.log(
      `masterMarginEngine: ${await this.factory.masterMarginEngine()}`
    );
    console.log(
      `masterFCM: ${await this.factory.masterFCMs(
        await this.rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID()
      )}`
    );
    console.log();

    // deploy an IRS instance
    await this.deployIRSContracts();
    console.log(`VAMM: ${this.vamm.address}`);
    console.log(`marginEngine: ${this.marginEngine.address}`);
    console.log(`FCM: ${this.fcm ? this.fcm.address : "Undefined"}`);
    console.log();

    // configure the IRS instance
    await this.configureIRS();

    // configure the E2E setup
    await this.configureE2E();

    /// set starting rate
    await this.e2eSetup.setNewRate(this.getRateInRay(1.01));
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
      this.marginEngine.address
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
        if (error.errorSignature.includes("MarginRequirementNotMet")) {
          marginRequirement = BigNumber.from(
            error.errorArgs.marginRequirement.toString()
          );
          tickAfter = parseInt(error.errorArgs.tick.toString());
          fee = BigNumber.from(
            error.errorArgs.cumulativeFeeIncurred.toString()
          );
          availableNotional = BigNumber.from(
            error.errorArgs.variableTokenDelta.toString()
          );
        } else {
          throw new Error("Additional margin amount cannot be established");
        }
      }
    );

    const currentMargin = (
      await this.marginEngine.callStatic.getPosition(
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
      this.marginEngine.address
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
        if (error.errorSignature.includes("MarginRequirementNotMet")) {
          marginRequirement = BigNumber.from(
            error.errorArgs.marginRequirement.toString()
          );
          tickAfter = parseInt(error.errorArgs.tick.toString());
          fee = BigNumber.from(
            error.errorArgs.cumulativeFeeIncurred.toString()
          );
          availableNotional = BigNumber.from(
            error.errorArgs.variableTokenDelta.toString()
          );
        } else {
          throw new Error("Additional margin amount cannot be established");
        }
      }
    );

    const currentMargin = (
      await this.marginEngine.callStatic.getPosition(
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
          if (error.errorSignature.includes("MarginLessThanMinimum")) {
            marginRequirement = BigNumber.from(
              error.errorArgs.marginRequirement.toString()
            );
          } else {
            throw new Error("Additional margin amount cannot be established");
          }
        }
      );

    const currentMargin = (
      await this.marginEngine.callStatic.getPosition(
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
          if (error.errorSignature.includes("MarginLessThanMinimum")) {
            marginRequirement = BigNumber.from(
              error.errorArgs.marginRequirement.toString()
            );
          } else {
            throw new Error("Additional margin amount cannot be established");
          }
        }
      );

    const currentMargin = (
      await this.marginEngine.callStatic.getPosition(
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

  async settlePositions() {
    for (const p of this.positions) {
      await this.e2eSetup.settlePositionViaAMM(p[0], p[1], p[2]);

      await this.e2eSetup.updatePositionMarginViaAMM(
        p[0],
        p[1],
        p[2],
        (
          await this.marginEngine.callStatic.getPosition(p[0], p[1], p[2])
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

  async getVT(towards: string) {
    const currentTick = await this.periphery.getCurrentTick(
      this.marginEngine.address
    );

    let totalAmount0 = toBn("0");
    let totalAmount1 = toBn("0");

    for (const p of this.positions) {
      let lowerTick = p[1];
      let upperTick = p[2];

      if (towards === "below") {
        upperTick = Math.min(currentTick, p[2]);
      } else if (towards === "above") {
        lowerTick = Math.max(currentTick, p[1]);
      } else {
        console.error("direction should be either below or above");
        return 0;
      }

      if (lowerTick >= upperTick) continue;

      const liquidity = (
        await this.marginEngine.callStatic.getPosition(p[0], p[1], p[2])
      )._liquidity;
      const ratioAtLowerTick = await this.tickMath.getSqrtRatioAtTick(
        lowerTick
      );
      const ratioAtUpperTick = await this.tickMath.getSqrtRatioAtTick(
        upperTick
      );

      const amount0 = await this.sqrtPriceMath.getAmount0Delta(
        ratioAtLowerTick,
        ratioAtUpperTick,
        liquidity,
        true
      );
      const amount1 = await this.sqrtPriceMath.getAmount1Delta(
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

  async run() {}
}
