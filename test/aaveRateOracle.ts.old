import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle, network } from "hardhat";
import { AaveRateOracle } from "../typechain/AaveRateOracle";
import { AaveRateOracleTest } from "../typechain/AaveRateOracleTest";
import { toBn } from "evm-bn";
import { div, sub, mul } from "./shared/functions";
// import { div, sub, mul } from "./shared/functions";
import { encodeSqrtRatioX96, expandTo18Decimals } from "./shared/utilities";
import {FixedAndVariableMath} from "../typechain/FixedAndVariableMath";
import { BigNumber as BigNumberJs } from "bignumber.js";
import "./shared/aaveMath";


// todo: pull aave rates data via v2 sdk
// import {v2} from "@aave/protocol-js";
// import Web3 from 'web3';
// import { TxBuilderV2, Network, Market } from '@aave/protocol-js'
// import LendingPoolInterface from "@aave/protocol-js/dist/tx-builder/interfaces/v2/LendingPool"


// bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp
async function variableFactorAtMaturity(underlyingToken: string, termStartTimestamp: BigNumber, termEndTimestamp: BigNumber, rateOracle: AaveRateOracle) : Promise<BigNumber> {

  await network.provider.send("evm_setNextBlockTimestamp", [termStartTimestamp.toNumber()]);
  await rateOracle.updateRate(underlyingToken)
  await network.provider.send("evm_setNextBlockTimestamp", [termEndTimestamp.toNumber()]);
  await rateOracle.updateRate(underlyingToken) 

  const rateTermStartTimestamp = await rateOracle.rates(underlyingToken, termStartTimestamp)
  const rateTermEndTimestamp = await rateOracle.rates(underlyingToken, termEndTimestamp)
  
  let currentRateRay: BigNumberJs = new BigNumberJs(rateTermEndTimestamp[2].toString()) 
  let previousRateRay: BigNumberJs = new BigNumberJs(rateTermStartTimestamp[2].toString())

  let aaveIndex = currentRateRay.rayDiv(previousRateRay) // in rays

  let rateFromPoolStartToMaturity: BigNumber = sub(toBn(aaveIndex.toString()), toBn("1000000000000000000000000000"))
  rateFromPoolStartToMaturity = div(rateFromPoolStartToMaturity, toBn("1000000000000000000"))

  return rateFromPoolStartToMaturity

}

// index based rate calculation
// https://github.com/aave/aave-js/blob/v2/src/helpers/pool-math.ts#L124

const createFixtureLoader = waffle.createFixtureLoader;

describe("Aave Rate Oracle", () => {
  let wallet: Wallet, other: Wallet;
  let rateOracle: AaveRateOracle;
  let fixedAndVariableMath: FixedAndVariableMath;
  let rateOracleTest: AaveRateOracleTest;
  // let lendingPool: LendingPoolInterface;

  const fixture = async () => {

    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMath"
    );

    fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

    const rateOracleFactory = await ethers.getContractFactory(
      "AaveRateOracle", {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address
        }
      }
    );

    return (await rateOracleFactory.deploy()) as AaveRateOracle;
  };


  const fixtureTest = async () => {

    const fixedAndVariableMathFactory = await ethers.getContractFactory(
      "FixedAndVariableMath"
    );

    fixedAndVariableMath = (await fixedAndVariableMathFactory.deploy()) as FixedAndVariableMath;

    const rateOracleTestFactory = await ethers.getContractFactory(
      "AaveRateOracleTest", {
        libraries: {
          FixedAndVariableMath: fixedAndVariableMath.address
        }
      }
    );

    return (await rateOracleTestFactory.deploy()) as AaveRateOracleTest;
  };


  let loadFixture: ReturnType<typeof createFixtureLoader>;

  before("create fixture loader", async () => {

    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);

    // aave lending pool
    
    // const txBuilder = new TxBuilderV2(Network.mainnet, waffle.provider);

    // lendingPool = txBuilder.getLendingPool("0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9");

  });

  beforeEach("deploy calculator", async () => {
    await network.provider.send("evm_setNextBlockTimestamp", [BLOCK_TIMESTAMP])
    rateOracle = await loadFixture(fixture);
    rateOracleTest = await loadFixture(fixtureTest)
  });

  describe("#time", () => {

    it("correctly gets the current block timestamp", async () => {

      const currentBlockTimestamp = toBn(BLOCK_TIMESTAMP.toString())
      expect(await fixedAndVariableMath.blockTimestampScaled()).to.eq(currentBlockTimestamp)
      

    })

  })


  describe("#updateRate", async () => {

      // todo: check how to execute multiple functions in one block (timestamp?)
      // how is block.timestamp calculated?
      
      it("correctly updates the rate", async () => {

        const currentBlockTimestamp = toBn(BLOCK_TIMESTAMP.toString())

        const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";

        await rateOracle.updateRate(daiAddress)

        const reserveNormalisedIncome: BigNumber = await rateOracle.getReserveNormalizedIncome(daiAddress);
      
        const updatedRate = await rateOracle.rates(daiAddress, currentBlockTimestamp)

        // const mostRecentTimestamp = await rateOracle.mostRecentTimestamp( )

        expect(updatedRate[2]).to.eq(reserveNormalisedIncome)

        // todo: why does the block timestamp change, how do other protocols take care of this?
        // expect(mostRecentTimestamp).to.eq(currentBlockTimestamp)

      })

      it("gets rate from:to", async () => {
        // +1 from the previous one  
        
        const previousBlockTimestamp = toBn(BLOCK_TIMESTAMP.toString())

        const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";

        await rateOracle.updateRate(daiAddress);

        await network.provider.send("evm_setNextBlockTimestamp", [BLOCK_TIMESTAMP+2]);

        const currentBlockTimestamp = toBn((BLOCK_TIMESTAMP+1).toString())

        await rateOracle.updateRate(daiAddress)

        const previousRate = await rateOracle.rates(daiAddress, previousBlockTimestamp) // from
         
        const currentRate = await rateOracle.rates(daiAddress, currentBlockTimestamp) // to

        let currentRateRay: BigNumberJs = new BigNumberJs(currentRate[2].toString()) 
        let previousRateRay: BigNumberJs = new BigNumberJs(previousRate[2].toString())
        // todo: bring ray one

        let aaveIndex = currentRateRay.rayDiv(previousRateRay) // in rays
        
        // let aaveIndexWei = div(toBn(aaveIndex.toString()), toBn("1000000000"))
        // todo, figure out a neater way to test
        let expected = sub(toBn(aaveIndex.toString()), toBn("1000000000000000000000000000"))
        expected = div(expected, toBn("1000000000000000000"))

        
        const result = await rateOracle.getRateFromTo(daiAddress, previousBlockTimestamp, currentBlockTimestamp)
        expect(result.toString()).to.eq(expected.toString())

      })

  })


  describe("#variableFactor", async () => {
    // todo: finish this asap
    // bool atMaturity, address underlyingToken, uint256 termStartTimestamp, uint256 termEndTimestamp
    
    it("at maturity", async () => {

      const daiAddress: string = "0x6b175474e89094c44da98b954eedeac495271d0f";
      const termStartTimestamp: BigNumber = toBn("1636909871")
      const termEndTimestamp: BigNumber = toBn("1644685871")

      const expectedVariableFactor: BigNumber = await variableFactorAtMaturity(daiAddress, termStartTimestamp, termEndTimestamp, rateOracle);
      await rateOracleTest.variableFactorTest(true, daiAddress, termStartTimestamp, termEndTimestamp)
      const realisedVariableFactor: BigNumber = await rateOracleTest.mostRecentVariableFactor()
      
      expect(realisedVariableFactor).to.eq(expectedVariableFactor)
    
    })
    


  })

  

});
