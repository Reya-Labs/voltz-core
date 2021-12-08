// import { Wallet, BigNumber } from "ethers";
// import { expect } from "chai";
// import { ethers, waffle } from "hardhat";
// import { AaveRateOracle } from "../typechain/AaveRateOracle";
// import { toBn } from "evm-bn";
// import { div, sub } from "./shared/functions";
// // import { aaveV2Fixture, AaveV2Fixture } from './fixtures/aaveV2';
// import {FixedAndVariableMath} from "../typechain/FixedAndVariableMath";
// import "./shared/aaveMath";
// import {getCurrentTimestamp,
//         advanceTime} from "./helpers/time";

// import { createSnapshot, restoreSnapshot } from "./helpers/snapshots";
// import { consts } from "./helpers/constants";

// const { provider } = waffle;
// const createFixtureLoader = waffle.createFixtureLoader;


// // async function variableFactorAtMaturity(underlyingToken: string, rateOracle: AaveRateOracle){
        
// //         // check code below

// //         // const rateTermStartTimestamp = await rateOracle.rates(underlyingToken, toBn(termStartTimestamp.toString()))
// //         // const rateTermEndTimestamp = await rateOracle.rates(underlyingToken, toBn(termEndTimestamp.toString()))

// //         // let currentRateRay: BigNumberJs = new BigNumberJs(rateTermEndTimestamp[2].toString()) 
// //         // let previousRateRay: BigNumberJs = new BigNumberJs(rateTermStartTimestamp[2].toString())

// //         // let aaveIndex = currentRateRay.rayDiv(previousRateRay) // in rays

// //         // let rateFromPoolStartToMaturity: BigNumber = sub(toBn(aaveIndex.toString()), toBn("1000000000000000000000000000"))
// //         // rateFromPoolStartToMaturity = div(rateFromPoolStartToMaturity, toBn("1000000000000000000"))

// //         return [rateFromPoolStartToMaturity, termStartTimestamp, termEndTimestamp];
      
// // }


// describe("Aave Rate Oracle", () => {
//         let wallet: Wallet, other: Wallet;
//         let rateOracle: AaveRateOracle;
//         let fixedAndVariableMath: FixedAndVariableMath;
//         // let lendingPool: IAaveLendingPool;

        
//         let loadFixture: ReturnType<typeof createFixtureLoader>;
      
//         const fixture = async () => {
      
//           const fixedAndVariableMathFactory = await ethers.getContractFactory(
//             "FixedAndVariableMath"
//           );
      
//           fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;
      
//           const rateOracleFactory = await ethers.getContractFactory(
//             "AaveRateOracle", {
//               libraries: {
//                 FixedAndVariableMath: fixedAndVariableMath.address
//               }
//             }
//           );
      
//           return (await rateOracleFactory.deploy()) as AaveRateOracle;
//         };
      
      
//         // const fixtureTest = async () => {
      
//         //   const fixedAndVariableMathFactory = await ethers.getContractFactory(
//         //     "FixedAndVariableMath"
//         //   );
      
//         //   fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;
      
//         //   const rateOracleTestFactory = await ethers.getContractFactory(
//         //     "AaveRateOracleTest", {
//         //       libraries: {
//         //         FixedAndVariableMath: fixedAndVariableMath.address
//         //       }
//         //     }
//         //   );
      
//         //   return (await rateOracleTestFactory.deploy()) as AaveRateOracleTest;
//         // };

//         before(async () => {
//                 // snapshot initial state
//                 await createSnapshot(provider) ;
//                 loadFixture = createFixtureLoader([wallet, other]);
//                 [wallet, other] = await (ethers as any).getSigners();
//         })

//         after(async () => {
//                 // revert back to initial state after all tests pass
//                 await restoreSnapshot(provider);
//         });


//         describe("variable factor", () => {

//                 beforeEach(async () => {
//                         // await network.provider.send("evm_setAutomine", [false]);
//                         await createSnapshot(provider);
//                         rateOracle = await loadFixture(fixture);
//                         rateOracleTest = await loadFixture(fixtureTest)
//                 });

//                 afterEach(async () => {
//                         await restoreSnapshot(provider);
//                 });


//                 // it("should correctly calculate the variable factor", async () => {

//                 //   const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";                  

//                 //   const timestampExpected: number = await getCurrentTimestamp(provider);
//                 //   const timestampRealised: BigNumber = await rateOracleTest.getCurrentTimestamp();

//                 //   expect(toBn(timestampExpected.toString())).to.eq(timestampRealised.toString());

//                 // })

//                 // it("should correctly set the rates", async () => {

//                 //   const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
                  
//                 //   // update the rate for term start and end timestamps
//                 //   const termStartTimestamp: number = await getCurrentTimestamp(provider);
//                 //   await rateOracleTest.updateRateTest(daiAddress, true)
//                 //   advanceTime(consts.ONE_MONTH) 
//                 //   const termEndTimestamp: number = await getCurrentTimestamp(provider);       
//                 //   await rateOracleTest.updateRateTest(daiAddress, false)

                  
//                 //   // pull rates data after updates
//                 //   // const rateTermStartTimestamp = await rateOracle.rates(daiAddress, toBn(termStartTimestamp.toString()))
//                 //   // const rateTermEndTimestamp = await rateOracle.rates(daiAddress, toBn(termEndTimestamp.toString()))

//                 //   const rateTermStartTimestamp = await rateOracleTest.startRate()
//                 //   const rateTermEndTimestamp = await rateOracleTest.endRate()


//                 //   expect(rateTermStartTimestamp[0]).to.eq(rateTermEndTimestamp[0])

//                 // })

//                 // it("rate timestamp values should match with the typescript values", async () => {

//                 //   const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
                  
//                 //   // update the rate for term start and end timestamps
//                 //   let termStartTimestamp: number = await getCurrentTimestamp(provider);
//                 //   // todo: find a more elegant solution
//                 //   termStartTimestamp += 1
//                 //   await rateOracleTest.updateRateTest(daiAddress, true)
//                 //   await advanceTime(consts.ONE_MONTH) 
//                 //   let termEndTimestamp: number = await getCurrentTimestamp(provider);
//                 //   termEndTimestamp += 1    
//                 //   await rateOracleTest.updateRateTest(daiAddress, false)

                
//                 //   const rateTermStartTimestamp = await rateOracleTest.startRate()
//                 //   const rateTermEndTimestamp = await rateOracleTest.endRate()


//                 //   expect(rateTermStartTimestamp[1]).to.eq(toBn(termStartTimestamp.toString()))
//                 //   expect(rateTermEndTimestamp[1]).to.eq(toBn(termEndTimestamp.toString()))

//                 // })


//                 // it("rate timestamp values can be pulled from the contract after they are set", async () => {

//                 //   const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
                  
//                 //   // update the rate for term start and end timestamps
//                 //   let termStartTimestamp: number = await getCurrentTimestamp(provider);
//                 //   // todo: find a more elegant solution
//                 //   termStartTimestamp += 1
//                 //   await rateOracleTest.updateRateTest(daiAddress, true)
//                 //   await advanceTime(consts.ONE_MONTH) 
//                 //   let termEndTimestamp: number = await getCurrentTimestamp(provider);
//                 //   termEndTimestamp += 1    
//                 //   await rateOracleTest.updateRateTest(daiAddress, false)

                
//                 //   const rateTermStartTimestamp = await rateOracleTest.rates(daiAddress, toBn(termStartTimestamp.toString()))
//                 //   const rateTermEndTimestamp = await rateOracleTest.rates(daiAddress, toBn(termEndTimestamp.toString()))


//                 //   expect(rateTermStartTimestamp[1]).to.eq(toBn(termStartTimestamp.toString()))
//                 //   expect(rateTermEndTimestamp[1]).to.eq(toBn(termEndTimestamp.toString()))

//                 // })

//                 it("it should correctly calculate the variable factor", async () => {
                  

//                   // todo: stopped here

//                   const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
                  
//                   // update the rate for term start and end timestamps
//                   let termStartTimestamp: number = await getCurrentTimestamp(provider);
//                   // todo: find a more elegant solution
//                   termStartTimestamp += 1
//                   await rateOracleTest.updateRateTest(daiAddress, true)
//                   await advanceTime(consts.ONE_MONTH) 
//                   let termEndTimestamp: number = await getCurrentTimestamp(provider);
//                   termEndTimestamp += 1    
//                   await rateOracleTest.updateRateTest(daiAddress, false)

                
//                   const rateTermStart = await rateOracleTest.rates(daiAddress, toBn(termStartTimestamp.toString()))
//                   const rateTermEnd = await rateOracleTest.rates(daiAddress, toBn(termEndTimestamp.toString()))

//                   await rateOracleTest.variableFactorTest(true, daiAddress, rateTermStart[1], rateTermEnd[1])
//                   const realisedVariableFactor: BigNumber = await rateOracleTest.mostRecentVariableFactor()
//                   let expectedVariableFactor: BigNumber = div(rateTermEnd[2], rateTermStart[2])
//                   expectedVariableFactor = sub(expectedVariableFactor, toBn("1"))
                  
//                   expect(realisedVariableFactor).to.eq(expectedVariableFactor)
          

//                 })


//                 // it("should correctly calculate the variable factor", async () => {

//                 //         const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
                        
//                 //         // update the rate for term start and end timestamps
//                 //         const termStartTimestamp: number = await getCurrentTimestamp(provider);
//                 //         await rateOracle.updateRate(daiAddress)
//                 //         advanceTime(consts.ONE_MONTH) 
//                 //         const termEndTimestamp: number = await getCurrentTimestamp(provider);       
//                 //         await rateOracle.updateRate(daiAddress)

                        
//                 //         // pull rates data after updates
//                 //         const rateTermStartTimestamp = await rateOracle.rates(daiAddress, toBn(termStartTimestamp.toString()))
//                 //         const rateTermEndTimestamp = await rateOracle.rates(daiAddress, toBn(termEndTimestamp.toString()))

                        
//                 //         // ray math
//                 //         let currentRateRay: BigNumberJs = new BigNumberJs(rateTermEndTimestamp[2].toString()) 
//                 //         let previousRateRay: BigNumberJs = new BigNumberJs(rateTermStartTimestamp[2].toString())
//                 //         let aaveIndex = currentRateRay//.rayDiv(previousRateRay) // in rays
                        
                        
//                 //         let rateFromPoolStartToMaturity: BigNumber = sub(toBn(aaveIndex.toString()), toBn("1000000000000000000000000000"))
//                 //         rateFromPoolStartToMaturity = div(rateFromPoolStartToMaturity, toBn("1000000000000000000"))

//                 //         // realised value and expect
//                 //         await rateOracleTest.variableFactorTest(true, daiAddress, termStartTimestamp, termEndTimestamp)
//                 //         const realisedVariableFactor: BigNumber = await rateOracleTest.mostRecentVariableFactor()
                        
//                 //         expect(realisedVariableFactor).to.eq(rateFromPoolStartToMaturity)

//                 // })


//         })


// })



