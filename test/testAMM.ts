<<<<<<< HEAD
// import { ethers, waffle } from "hardhat";
// import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
// import { Factory } from "../typechain/Factory";
// import { expect } from "chai";

// import { toBn } from "evm-bn";
// import { div, sub, mul } from "./shared/functions";
// import { FixedAndVariableMath } from "../typechain/FixedAndVariableMath";
// import { Position } from "../typechain/Position";
// import { AMM } from "../typechain/AMM";

// import {
//   MintFunction,
//   createAMMFunctions,
//   getMinTick,
//   getMaxTick,
//   FeeAmount,
//   TICK_SPACINGS,
//   getMaxLiquidityPerTick,
//   encodeSqrtRatioX96,
//   MIN_SQRT_RATIO,
//   MAX_SQRT_RATIO,
//   SwapToPriceFunction,
//   SwapFunction,
// } from "./shared/utilities";
=======
import { ethers, waffle } from "hardhat";
import { Wallet } from "ethers";
import { AMMFactory } from "../typechain/AMMFactory";
import { expect } from "chai";

import { toBn } from "evm-bn";
import { FixedAndVariableMath } from "../typechain/FixedAndVariableMath";
import { AMM } from "../typechain/AMM";

import {
  MintFunction,
  FeeAmount,
  SwapToPriceFunction,
  SwapFunction,
} from "./shared/utilities";
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d

// // import { AMMFixture } from "./shared/fixtures";

// import { TestAMM } from "../typechain/TestAMM";

<<<<<<< HEAD
// import { aave_lending_pool_addr, usdc_mainnet_addr } from "./shared/constants";

// const { provider } = waffle;

// import {
//   getCurrentTimestamp,
//   setTimeNextBlock,
//   evm_snapshot,
//   evm_revert,
//   advanceTime,
//   setTime,
//   mineBlock,
// } from "./helpers/time";

// import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
// import { consts } from "./helpers/constants";

// const createFixtureLoader = waffle.createFixtureLoader;

// type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;

// async function generateFactory(contractName: string) {
//   const fixedAndVariableMathFactory = await ethers.getContractFactory(
//     "FixedAndVariableMath"
//   );

//   const fixedAndVariableMath =
//     (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

//   const TickFactory = await ethers.getContractFactory("Tick");

//   const tick = await TickFactory.deploy();

//   const PositionFactory = await ethers.getContractFactory("Position");

//   const position = (await PositionFactory.deploy()) as Position;

//   const generatedFactory = await ethers.getContractFactory(contractName, {
//     libraries: {
//       FixedAndVariableMath: fixedAndVariableMath.address,
//       Tick: tick.address,
//       Position: position.address,
//     },
//   });

//   return generatedFactory;
// }

// describe("AMM", () => {
//   let wallet: Wallet, other: Wallet;
//   let factory: Factory;
=======
import { aave_lending_pool_addr, usdc_mainnet_addr } from "./shared/constants";

import { getCurrentTimestamp } from "./helpers/time";

import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
import { consts } from "./helpers/constants";
import { PositionTest } from "../typechain";

const { provider } = waffle;

const createFixtureLoader = waffle.createFixtureLoader;

async function generateFactory(contractName: string) {
  const fixedAndVariableMathFactory = await ethers.getContractFactory(
    "FixedAndVariableMath"
  );

  const fixedAndVariableMath =
    (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

  const TickFactory = await ethers.getContractFactory("Tick");

  const tick = await TickFactory.deploy();

  const PositionTestFactory = await ethers.getContractFactory("Position");

  const position = (await PositionTestFactory.deploy()) as PositionTest;

  const generatedFactory = await ethers.getContractFactory(contractName, {
    libraries: {
      FixedAndVariableMath: fixedAndVariableMath.address,
      Tick: tick.address,
      Position: position.address,
    },
  });
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d

//   let fixedAndVariableMath: FixedAndVariableMath;
//   let position: Position;
//   let tick;

<<<<<<< HEAD
//   // let amm: TestAMMCallee;

//   let ammTest: TestAMM;

//   let feeAmount: number;
//   let tickSpacing: number;

//   let minTick: number;
//   let maxTick: number;
=======
describe("AMM", () => {
  let wallet: Wallet, other: Wallet;
  let factory: AMMFactory;

  let fixedAndVariableMath: FixedAndVariableMath;
  // let position: Position;
  let tick;
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d

//   let mint: MintFunction;
//   let swapToLowerPrice: SwapToPriceFunction;
//   let swapToHigherPrice: SwapToPriceFunction;
//   let swapExact0For1: SwapFunction;
//   let swap0ForExact1: SwapFunction;
//   let swapExact1For0: SwapFunction;
//   let swap1ForExact0: SwapFunction;

//   let amm: AMM;

//   let loadFixture: ReturnType<typeof createFixtureLoader>;

//   const factoryFixture = async () => {
//     const fixedAndVariableMathFactory = await ethers.getContractFactory(
//       "FixedAndVariableMath"
//     );

<<<<<<< HEAD
//     fixedAndVariableMath =
//       (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

//     const TickFactory = await ethers.getContractFactory("Tick");

//     const tick = await TickFactory.deploy();

//     const PositionFactory = await ethers.getContractFactory("Position");

//     const position = (await PositionFactory.deploy()) as Position;

//     const FactoryFactory = await ethers.getContractFactory("Factory", {
//       libraries: {
//         FixedAndVariableMath: fixedAndVariableMath.address,
//         Tick: tick.address,
//         Position: position.address,
//       },
//     });

//     return (await FactoryFactory.deploy()) as Factory;
//   };

//   before("create fixture loader", async () => {
//     await createSnapshot(provider);
//     [wallet, other] = await (ethers as any).getSigners();
//     loadFixture = createFixtureLoader([wallet, other]);
//   });

//   after(async () => {
//     // revert back to initial state after all tests pass
//     await restoreSnapshot(provider);
//   });

//   beforeEach("deploy fixture", async () => {
//     await createSnapshot(provider);
//     factory = await loadFixture(factoryFixture);

//     let termStartTimestamp: number = await getCurrentTimestamp(provider);
//     termStartTimestamp += 1;
//     const termEndTimestamp: number =
//       termStartTimestamp + consts.ONE_MONTH.toNumber();

//     await factory.createAMM(
//       usdc_mainnet_addr,
//       aave_lending_pool_addr,
//       toBn(termEndTimestamp.toString()),
//       FeeAmount.MEDIUM
//     );
=======
  let mint: MintFunction;
  let swapToLowerPrice: SwapToPriceFunction;
  let swapToHigherPrice: SwapToPriceFunction;
  let swapExact0For1: SwapFunction;
  let swap0ForExact1: SwapFunction;
  let swapExact1For0: SwapFunction;
  let swap1ForExact0: SwapFunction;

  let amm: AMM;

  let loadFixture: ReturnType<typeof createFixtureLoader>;

  const factoryFixture = async () => {
    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMath"
    );

    fixedAndVariableMath =
      (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

    const TickFactory = await ethers.getContractFactory("Tick");

    const tick = await TickFactory.deploy();

    const PositionTestFactory = await ethers.getContractFactory("PositionTest");

    const position = (await PositionTestFactory.deploy()) as PositionTest;

    const AMMFactoryFactory = await ethers.getContractFactory("AMMFactory", {
      libraries: {
        FixedAndVariableMath: fixedAndVariableMath.address,
        Tick: tick.address,
        Position: position.address,
      },
    });

    const TreasuryFactory = (await ethers.getContractFactory(
      "MockTreasury"
    ));
    
    const Treasury = await TreasuryFactory.deploy();

    const InsuranceFundFactory = (await ethers.getContractFactory(
      "MockInsuranceFund"
    ));

    const InsuranceFund = await InsuranceFundFactory.deploy();

    return (await AMMFactoryFactory.deploy(
      Treasury.address,
      InsuranceFund.address
    )) as AMMFactory;
  };

  before("create fixture loader", async () => {
    await createSnapshot(provider);
    [wallet, other] = await (ethers as any).getSigners();
    loadFixture = createFixtureLoader([wallet, other]);
  });
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d

//     const ammAddress = await factory.getAMMMAp(
//       aave_lending_pool_addr,
//       usdc_mainnet_addr,
//       toBn(termStartTimestamp.toString()),
//       toBn(termEndTimestamp.toString()),
//       FeeAmount.MEDIUM
//     );
//     const TestFactory = await generateFactory("TestAMM");

<<<<<<< HEAD
//     ammTest = (await TestFactory.deploy()) as TestAMM;
//   });

//   afterEach(async () => {
//     await restoreSnapshot(provider);
//   });

//   // it("deploying and retrieving an amm", async () => {

//   //   let termStartTimestamp: number = await getCurrentTimestamp(provider);
//   //   termStartTimestamp += 1;
//   //   const termEndTimestamp: number = termStartTimestamp + consts.ONE_MONTH.toNumber()

//   //   await factory.createAMM(usdc_mainnet_addr, aave_lending_pool_addr, toBn(termEndTimestamp.toString()), FeeAmount.MEDIUM)
=======
  beforeEach("deploy fixture", async () => {
    await createSnapshot(provider);
    factory = await loadFixture(factoryFixture);

    let termStartTimestamp: number = await getCurrentTimestamp(provider);
    termStartTimestamp += 1;
    const termEndTimestamp: number =
      termStartTimestamp + consts.ONE_MONTH.toNumber();

    await factory.createAMM(
      usdc_mainnet_addr,
      aave_lending_pool_addr,
      toBn(termEndTimestamp.toString()),
      FeeAmount.MEDIUM
    );

    const ammAddress = await factory.getAMMMAp(
      aave_lending_pool_addr,
      usdc_mainnet_addr,
      toBn(termStartTimestamp.toString()),
      toBn(termEndTimestamp.toString()),
      FeeAmount.MEDIUM
    );
    const TestAMMFactory = await generateFactory("TestAMM");

    ammTest = (await TestAMMFactory.deploy()) as TestAMM;
  });
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d

//   //   // mapping(address => mapping(address => mapping(uint256 => mapping(uint256 => mapping(uint24 => address))))) public getAMMMAp;

//   //   const ammAddress = await factory.getAMMMAp(aave_lending_pool_addr, usdc_mainnet_addr, toBn(termStartTimestamp.toString()), toBn(termEndTimestamp.toString()), FeeAmount.MEDIUM)
//   //   const AMM = await generateFactory("AMM")
//   //   const amm: AMM = await AMM.attach(ammAddress)

//   //   expect(await amm.factory()).to.eq(factory.address)
//   //   expect(await amm.termStartTimestamp()).to.eq(toBn(termStartTimestamp.toString()))

//   // });

//   it("testAMM correctly pull amm data", async () => {
//     const ammTestFee = await ammTest.getAMMFee(amm.address);

<<<<<<< HEAD
//     expect(amm.fee()).to.eq(ammTestFee);
//   });
// });
=======
  //   const ammAddress = await factory.getAMMMAp(aave_lending_pool_addr, usdc_mainnet_addr, toBn(termStartTimestamp.toString()), toBn(termEndTimestamp.toString()), FeeAmount.MEDIUM)
  //   const AMM = await generateFactory("AMM")
  //   const amm: AMM = await AMM.attach(ammAddress)

  //   expect(await amm.factory()).to.eq(factory.address)
  //   expect(await amm.termStartTimestamp()).to.eq(toBn(termStartTimestamp.toString()))

  // });

  it("testAMM correctly pull amm data", async () => {
    const ammTestFee = await ammTest.getAMMFee(amm.address);

    expect(amm.fee()).to.eq(ammTestFee);
  });
});
>>>>>>> 7e1d12b0eb1c6d26e9f747c622b9aede83b54b4d
