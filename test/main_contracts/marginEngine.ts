// mostly new
import { Wallet, BigNumber, utils } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { div, sub, mul, add, sqrt, floor} from "../shared/functions";
import { toBn } from "evm-bn";
import { MarginEngineCallee } from "../../typechain/MarginEngineCallee";
import { MarginEngine } from "../../typechain/MarginEngine";
import { encodeSqrtRatioX96, expandTo18Decimals, accrualFact, fixedFactor } from "../shared/utilities";
// import {FixedAndVariableMath} from "../../typechain/FixedAndVariableMath";
import {getCurrentTimestamp, advanceTime} from "../helpers/time";
import {consts} from "../helpers/constants";
// import { AMM } from "../../typechain/AMM";
// import { ammFixture, factoryFixture } from "./amm";
import { Factory } from "../../typechain";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { getCreate2Address, getCreate2AddressMarginEngine } from "../../scripts/helpers/deployHelpers";

const { provider } = waffle;


const createFixtureLoader = waffle.createFixtureLoader;

async function marginEngineCalleeFixture() {

    const marginEngineCalleeFactory = await ethers.getContractFactory(
        "MarginEngineCallee"
    );
    
    return (await marginEngineCalleeFactory.deploy()) as MarginEngineCallee;

}

async function marginEngineFixture() {
    const timeFactory = await ethers.getContractFactory("Time");

    const timeLibrary = await timeFactory.deploy();

    const factoryFactory = await ethers.getContractFactory(
        "Factory",
        {
            libraries: {
                Time: timeLibrary.address,
            },
        }
    );

    ////////
    const factory: Factory = await factoryFactory.deploy();
    await factory.deployed();
    
    let termStartTimestamp: number = await getCurrentTimestamp(provider);
    let termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();

    await factory.createAMM(
        mainnetConstants.tokens.USDC.address,
        utils.formatBytes32String("AaveV2"),
        toBn(termEndTimestamp.toString())
    );
    
    let termStartTimestampBN = toBn((termStartTimestamp + 1).toString());
    let termEndTimestampBN = toBn(termEndTimestamp.toString());

    let ammBytecode: string;
    ammBytecode = (await ethers.getContractFactory("AMM")).bytecode;

    const ammAddress = getCreate2Address(
        factory.address,
        utils.formatBytes32String("AaveV2"),
        mainnetConstants.tokens.USDC.address,
        termStartTimestampBN,
        termEndTimestampBN,
        ammBytecode
    );

    await factory.createMarginEngine(ammAddress);    
    let marginEngineAddress = await factory.getMarginEngineMap(ammAddress);
    // console.log(`Test: Margin Engine Address is ${marginEngineAddress}`);

    const fixedAndVariableMathFactory = await ethers.getContractFactory(
        "FixedAndVariableMath",
        {
            libraries: {
                Time: timeLibrary.address,
            },
        }
    );

    const fixedAndVariableMath = await fixedAndVariableMathFactory.deploy();

    const marginEngineHelpersFactory = await ethers.getContractFactory(
        "MarginEngineHelpers",
        {
            libraries: {
                Time: timeLibrary.address,
            },
        }
    );

    const marginEngineHelpers = await marginEngineHelpersFactory.deploy();

    const unwindTraderUnwindPositionFactory = await ethers.getContractFactory(
        "UnwindTraderUnwindPosition"
    );

    const unwindTraderUnwindPosition = await unwindTraderUnwindPositionFactory.deploy();

    const marginEngineFactory = await ethers.getContractFactory(
        "MarginEngine",
        {
            libraries: {
                Time: timeLibrary.address,
                FixedAndVariableMath: fixedAndVariableMath.address,
                MarginEngineHelpers: marginEngineHelpers.address,
                UnwindTraderUnwindPosition: unwindTraderUnwindPosition.address
            },
        }
    
    ); 

    const marginEngine: MarginEngine = await marginEngineFactory.attach(marginEngineAddress);
    
    return marginEngine;

}


describe("Margin Engine", () => {

    let wallet: Wallet, other: Wallet;
    // let amm: AMM;
    let marginEngineCallee: MarginEngineCallee;
    let marginEngine: MarginEngine;

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    before("create fixture loader", async () => {
        [wallet, other] = await (ethers as any).getSigners();
  
        loadFixture = createFixtureLoader([wallet, other]);
    });

    beforeEach("deploy margin engine", async () => {
        // amm and margin engine created by different factories
        // amm = await loadFixture(ammFixture);
        // marginEngine = await loadFixture(marginEngineFixture);
        marginEngine = await loadFixture(marginEngineFixture);
        // marginEngineCallee = await loadFixture(marginEngineCalleeFixture);
    });




    describe("Get AMM", async () => {
        it("check the amm address is set", async () => {
            // const realisedAMMAddress = marginEngine.amm();
            // expect(realisedAMMAddress).to.eq(amm.address);
            console.log(`Margin Engine Address is ${marginEngine.address}`);
            const ammAddressMarginEngine = await marginEngine.getAMMAddress();
            console.log(`Margin Engine AMM Address is ${ammAddressMarginEngine}`);

            expect(true).to.eq(false);
        })
    })

    // fails
    // describe("Get AMM", async () => {
    //     it("check the amm address is set", async () => {
    //         console.log(`Test: Margin Engine Address is ${marginEngineAddress}`);
    //         const realisedAMMAddress = marginEngineCallee.getAMMAddressCallee(marginEngineAddress);
    //         expect(realisedAMMAddress).to.eq(amm.address);
    //     })
    // })

    // fails
    // describe("Set AMM", async () => {

    //     it("correctly sets the Margin Engine AMM", async () => {
    //         await marginEngineCallee.setAMMCallee(marginEngineAddress, amm.address);
    //         const realisedAMMAddress = marginEngineCallee.getAMMAddressCallee(marginEngineAddress);
    //         expect(realisedAMMAddress).to.eq(amm.address);
    //     })

    // })



})