import { Wallet, BigNumber } from 'ethers'
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from '../typechain/MarginCalculator';
import { toBn } from "evm-bn";
import { div, sub, mul } from "./shared/functions";
import { max } from 'mathjs';


const createFixtureLoader = waffle.createFixtureLoader


describe("Margin Calculator", () => {

    let wallet: Wallet, other: Wallet
    let calculator: MarginCalculator

    const fixture = async () => {
        const marginCalculator = await ethers.getContractFactory("MarginCalculator")
        return (await marginCalculator.deploy()) as MarginCalculator
    }

    let loadFixture: ReturnType<typeof createFixtureLoader>

    
    before('create fixture loader', async () => {
        ;[wallet, other] = await (ethers as any).getSigners()
    
        loadFixture = createFixtureLoader([wallet, other])
    })

    beforeEach('deploy calculator', async () => {
        calculator = await loadFixture(fixture)
    })

    
    describe('#accrual factor is correctly calculated', async () => {
        const testSets = [
            [toBn("4"), toBn("31536000")],
            [toBn("50"), toBn("31536000")],
            [toBn("34536000"), toBn("31536000")],
            [toBn("34537000"), toBn("31536000")],
          ];
        
        testSets.forEach(testSet => {
            const x: BigNumber = testSet[0]
            const y: BigNumber = testSet[1]

            it(`takes ${x} and ${y} and returns the correct value`, async () => {
                const expected: BigNumber = div(x, y)
                expect(await calculator.accrualFact(x)).to.eq(expected)
            })
            
        });

    })


    describe("#ft margin computation works correclty", async () => {

        // uint256 notional, uint256 fixedRate, uint256 timePeriodInSeconds

        // is liquidation margin

        // uint256 public apyUpper = 9 * 10**16; // 0.09, 9%
        // uint256 public apyLower = 1 * 10**16; // 0.01, 1%;
    
        // uint256 public apyUpperMultiplier = 2 * 10**18; // 2.0
        // uint256 public apyLowerMultiplier = 5 * 10**17; // 0.5
    
        // uint256 public minDeltaLM = 125 * 10**14; // 0.0125
        // uint256 public minDeltaIM = 500 * 10**14; // 0.05

        const testSets = [
            [toBn("4000"), toBn("0.04"), toBn("50000")],
        ];
        
        
        testSets.forEach(testSet => {
            
            const notional: BigNumber = testSet[0]
            const fixedRate: BigNumber = testSet[1]
            const timePeriodInSeconds: BigNumber = testSet[2]
            
            it(`takes notional of ${notional}, fixedRate of ${fixedRate} and timePeriodInSeconds of ${timePeriodInSeconds}`, async () => {
                const apyUpper = toBn("0.09")
                const minDeltaLM = toBn("0.0125")
                let rateDelta: BigNumber = sub(apyUpper, fixedRate)
                rateDelta = rateDelta > minDeltaLM ? rateDelta : minDeltaLM

                const accrualFactor = div(timePeriodInSeconds, toBn("31536000"))

                const margin = mul(mul(notional, rateDelta), accrualFactor) 

                expect(await calculator.getFTMarginRequirement(notional, fixedRate, timePeriodInSeconds, true)).to.eq(margin)
            })




            
        })



    })



    
    



})