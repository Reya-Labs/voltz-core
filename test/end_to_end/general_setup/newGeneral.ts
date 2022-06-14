import { ethers, waffle } from "hardhat";
import { BigNumber, utils, Wallet } from "ethers";
import { formatRay } from "../../shared/utilities";
import {
  AaveFCM,
  Actor,
  E2ESetup,
  ERC20Mock,
  Factory,
  FixedAndVariableMathTest,
  IFCM,
  IMarginEngine,
  IRateOracle,
  IVAMM,
  MarginCalculatorTest,
  MarginEngine,
  MockAaveLendingPool,
  MockAToken,
  MockWETH,
  Periphery,
  SqrtPriceMathTest,
  TickMathTest,
  VAMM,
} from "../../../typechain";
import { advanceTimeAndBlock, getCurrentTimestamp } from "../../helpers/time";
import { e2eParameters } from "./e2eSetup";
import { extractErrorMessage } from "../../utils/extractErrorMessage";
import { consts } from "../../helpers/constants";
import { toBn } from "evm-bn";

const { provider } = waffle;

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

  // long-term contracts
  factory!: Factory;
  rateOracle!: IRateOracle;
  periphery!: Periphery;
  aaveLendingPool!: MockAaveLendingPool;

  // irs-specific contracts
  fcm!: IFCM;
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

  // file to output logs during e2e scenario
  outputFile!: string;

  constructor(params: e2eParameters, outputFile: string) {
    this.params = params;
    this.outputFile = outputFile;

    const fs = require("fs");
    fs.writeFileSync(this.outputFile, "");
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

    // master fcm
    const masterFCMFactory = await ethers.getContractFactory("AaveFCM");
    const masterFCM = (await masterFCMFactory.deploy()) as AaveFCM;

    // factory
    const factoryFactory = await ethers.getContractFactory("Factory");
    this.factory = (await factoryFactory.deploy(
      masterMarginEngine.address,
      masterVAMM.address
    )) as Factory;

    // Wrapped ETH
    const MockWETHFactory = await ethers.getContractFactory("MockWETH");
    this.weth = (await MockWETHFactory.deploy(
      "Wrapped ETH",
      "WETH"
    )) as MockWETH;

    // underlying token
    if (this.params.isWETH) {
        this.token = this.weth as ERC20Mock;
    }
    else {
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

    // rate oracle
    const rateOracleFactory = await ethers.getContractFactory("AaveRateOracle");
    this.rateOracle = (await rateOracleFactory.deploy(
      this.aaveLendingPool.address,
      this.token.address,
      [],
      []
    )) as IRateOracle;

    // mock aToken
    const mockATokenFactory = await ethers.getContractFactory("MockAToken");
    this.aToken = (await mockATokenFactory.deploy(
      this.aaveLendingPool.address,
      this.token.address,
      "Voltz aUSD",
      "aVUSD"
    )) as MockAToken;

    // initialize aave lending pool
    await this.aaveLendingPool.setReserveNormalizedIncome(
      this.token.address,
      this.getRateInRay(1)
    );

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

    // master fcm
    const UNDERLYING_YIELD_BEARING_PROTOCOL_ID =
      await this.rateOracle.UNDERLYING_YIELD_BEARING_PROTOCOL_ID();

    await this.factory.setMasterFCM(
      masterFCM.address,
      UNDERLYING_YIELD_BEARING_PROTOCOL_ID
    );

    // get dates
    const termStartTimestamp: number = await getCurrentTimestamp(provider);
    const termEndTimestamp: number =
      termStartTimestamp + this.params.duration.toNumber();

    this.termStartTimestamp = toBn(termStartTimestamp.toString());
    this.termEndTimestamp = toBn(termEndTimestamp.toString());

    // periphery
    const peripheryFactory = await ethers.getContractFactory("Periphery");
    this.periphery = (await peripheryFactory.deploy()) as Periphery;
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

    const fcmFactory = await ethers.getContractFactory("AaveFCM");
    this.fcm = fcmFactory.attach(fcmAddress) as IFCM;
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
  }

  async configureE2E() {
    /// set all contracts in E2E
    await this.e2eSetup.setMEAddress(this.marginEngine.address);
    await this.e2eSetup.setVAMMAddress(this.vamm.address);
    await this.e2eSetup.setFCMAddress(this.fcm.address);
    await this.e2eSetup.setRateOracleAddress(this.rateOracle.address);
    await this.e2eSetup.setPeripheryAddress(this.periphery.address);
    await this.e2eSetup.setAaveLendingPool(this.aaveLendingPool.address);

    /// approve tokens to the owner
    await this.mintAndApprove(this.owner.address, MAX_AMOUNT);

    /// spawn up the actors
    this.actors = [];
    for (let i = 0; i < this.params.numActors; i++) {
      const ActorFactory = await ethers.getContractFactory("Actor");
      const actor = (await ActorFactory.deploy()) as Actor;

      /// push new actor
      this.actors.push(actor);
      await this.mintAndApprove(actor.address, MAX_AMOUNT);

      /// set manually the approval of contracts to act on behalf of actors
      for (const ad of [
        this.fcm.address,
        this.periphery.address,
        this.vamm.address,
        this.marginEngine.address,
      ]) {
        await this.token.approveInternal(actor.address, ad, MAX_AMOUNT);
        await this.aToken.approveInternal(actor.address, ad, MAX_AMOUNT);
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
    console.log(`FCM: ${this.fcm.address}`);
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
          console.log("message:", message);
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
          console.log("message:", message);
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
            console.log("message:", message);
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
            console.log("message:", message);
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