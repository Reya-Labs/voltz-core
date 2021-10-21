import { Wallet, BigNumber } from 'ethers'
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { MarginCalculator } from '../typechain/MarginCalculator';
import { toBn } from "evm-bn";
import { div } from "./shared/functions";


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

    describe('#divison works as it should', async () => {
        const testSets = [
            [toBn("4"), toBn("2")],
            [toBn("22"), toBn("7")],
            [toBn("100.135"), toBn("100.134")],
            [toBn("772.05"), toBn("199.98")],

          ];
        
        testSets.forEach(testSet => {
            const x: BigNumber = testSet[0]
            const y: BigNumber = testSet[1]

            it(`takes ${x} and ${y} and returns the correct value`, async () => {
                const expected: BigNumber = div(x, y)
                expect(await calculator.doDiv(x, y)).to.eq(expected)
            })
            
        });

    })

    
    describe('#accrual factor is correctly calculated', async () => {
        const testSets = [
            [toBn("4"), toBn("31536000")],
            [toBn("50"), toBn("31536000")],
            [toBn("34536000"), toBn("31536000")],
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
    
    



})