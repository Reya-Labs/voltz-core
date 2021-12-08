// import { Factory } from "../../typechain/Factory";
// import { Fixture } from "ethereum-waffle";
// import { ethers } from "hardhat";
// import { TestAMMCallee } from "../../typechain/TestAMMCallee";
// import { MockTimeAMM } from "../../typechain/MockTimeAMM";
// import { MockTimeDeployer } from "../../typechain/MockTimeDeployer";
// import { BigNumber } from "@ethersproject/bignumber";

// import {FixedAndVariableMath} from "../../typechain/FixedAndVariableMath";
// import {Position} from "../../typechain/Position";
// // import {Tick} from "../../typechain/Tick"; todo: fix this

// interface FactoryFixture {
//   factory: Factory;
// }

// async function factoryFixture(): Promise<FactoryFixture> {

//   const fixedAndVariableMathFactory = await ethers.getContractFactory(
//     "FixedAndVariableMath"
//   );

//   const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;


//   const TickFactory = await ethers.getContractFactory(
//     "Tick"
//   );

//   const tick = (await TickFactory.deploy());

//   const PositionFactory = await ethers.getContractFactory(
//     "Position"
//   );

//   const position = (await PositionFactory.deploy()) as Position;

//   const factoryFactory = await ethers.getContractFactory(
//     "Factory", {
//       libraries: {
//         FixedAndVariableMath: fixedAndVariableMath.address,
//         Tick: tick.address,
//         Position: position.address
//       }
//     }
//   );
//   const factory = (await factoryFactory.deploy()) as Factory;
//   return { factory };
// }

// interface AMMFixture extends FactoryFixture {
//   swapTargetCallee: TestAMMCallee;
// }


// async function dependencyDeploymentAddresses() {
//    // linking
//   const fixedAndVariableMathFactory = await ethers.getContractFactory(
//     "FixedAndVariableMath"
//   );

//   const fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;


//   const TickFactory = await ethers.getContractFactory(
//     "Tick"
//   );

//   const tick = (await TickFactory.deploy());

//   const PositionFactory = await ethers.getContractFactory(
//     "Position"
//   );

//   const position = (await PositionFactory.deploy()) as Position;

//   return (fixedAndVariableMath.address, tick.address, position.address)
  
// }


// export const AMMFixture: Fixture<AMMFixture> =
//   async function (): Promise<AMMFixture> {


//   };
