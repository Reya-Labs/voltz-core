// hybrid of uniswap v3 approach and new


// mostly new
import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { div, sub, mul, add, sqrt, floor} from "../shared/functions";
import { toBn } from "evm-bn";
import { AMMTest } from "../../typechain/AMMTest";
import { AMM } from "../../typechain/AMM";
import { Factory } from "../../typechain/Factory";
import { encodeSqrtRatioX96, expandTo18Decimals, accrualFact, fixedFactor } from "../shared/utilities";
// import {FixedAndVariableMath} from "../../typechain/FixedAndVariableMath";
import {getCurrentTimestamp, advanceTime} from "../helpers/time";
import {consts} from "../helpers/constants";
import { mainnetConstants } from "../../scripts/helpers/constants";
import { getCreate2Address } from "../../scripts/helpers/deployHelpers";
import { utils } from "ethers";

const { provider } = waffle;

const createFixtureLoader = waffle.createFixtureLoader;


export async function factoryFixture() {

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
    const factory = await factoryFactory.deploy();
    await factory.deployed();

}

export async function ammFixture() {

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
        const factory = await factoryFactory.deploy();
        await factory.deployed();
        
        let termStartTimestamp: number = await getCurrentTimestamp(provider);
        let termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();

        // let ammBytecode: string;
        // ammBytecode = (await ethers.getContractFactory("AMM")).bytecode;
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

        const ammFactory = await ethers.getContractFactory("AMM");

        return (await ammFactory.attach(ammAddress)) as AMM;

}

describe("AMM", () => {

    let wallet: Wallet, other: Wallet;
    let amm: AMM;

    const fixture = async () => {

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
        const factory = await factoryFactory.deploy();
        await factory.deployed();
        
        let termStartTimestamp: number = await getCurrentTimestamp(provider);
        let termEndTimestamp: number = termStartTimestamp + consts.ONE_DAY.toNumber();

        // let ammBytecode: string;
        // ammBytecode = (await ethers.getContractFactory("AMM")).bytecode;
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

        const ammFactory = await ethers.getContractFactory("AMM");

        return (await ammFactory.attach(ammAddress)) as AMM;

    };

    let loadFixture: ReturnType<typeof createFixtureLoader>;

    before("create fixture loader", async () => {
        [wallet, other] = await (ethers as any).getSigners();
  
        loadFixture = createFixtureLoader([wallet, other]);
    });
  
    beforeEach("deploy calculator", async () => {
        amm = await loadFixture(fixture);
    });

    describe("Key AMM variables", async () => {
        it("correctly sets the underlying token", async () => {
            const realisedUnderlyingToken = await amm.underlyingToken();
            expect(realisedUnderlyingToken.toLowerCase()).to.eq(mainnetConstants.tokens.USDC.address.toLowerCase());
        })
    })

})