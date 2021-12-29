// todo: AB get back to this
// // hybrid of uniswap v3 approach and new
// import { Address } from 'cluster'
// import { Wallet } from 'ethers'
// import { ethers, waffle } from 'hardhat'
// import { Factory } from '../../typechain/Factory'
// import { expect } from '../shared/expect'
// // import snapshotGasCost from './shared/snapshotGasCost'
// import { RATE_ORACLE_ID } from '../shared/utilities'

// const { constants } = ethers

// const TEST_ADDRESS: [string] = [
//     '0x1000000000000000000000000000000000000000',
//   ]
  
//   const createFixtureLoader = waffle.createFixtureLoader

// describe('Factory', () => {
//     let wallet: Wallet, other: Wallet
    
//     let factory: Factory
//     // let poolBytecode: string

//     // makes the following into 
//     let vAMMBytecode: string
//     let MarginEngineBytecode: string
//     let RateOracleAddressBytecode: string

//     const fixture = async () => {
//         const factoryFactory = await ethers.getContractFactory('Factory')
//         return (await factoryFactory.deploy ()) as Factory
//     }

//     let loadFixture: ReturnType<typeof createFixtureLoader>
//     before('create fixture loader', async () => {
//         [wallet, other] = await (ethers as any).getSigners()

//         loadFixture = createFixtureLoader([wallet, other])
//     })
     
//     before('load vAMM bytecode', async () => {
//         vAMMBytecode = (await ethers.getContractFactory('VAMM')).bytecode
//     })

//     before('load MarginEngine bytecode', async () => {
//         MarginEngineBytecode = (await ethers.getContractFactory('Margin Engine')).bytecode
//     })

//     before('load vAMM bytecode', async () => {
//         RateOracleAddressBytecode = (await ethers.getContractFactory('Rate Oracle Address')).bytecode
//     })

//     beforeEach('deploy factory', async () => {
//         factory = await loadFixture(fixture)
//     })

//     it('owner is deployed', async () => {
//         expect(await factory.owner()).to.eq(wallet.address)
//     })

//     it('factory bytecode size', async () => {
//         expect(((await waffle.provider.getCode(factory.address)).length - 2) / 2).to.matchSnapshot()
//     })

//     // it('vAMM bytecode size', async () => {
//     //     await factory.createVAMM(TEST_ADDRESSES[0])
//     //     // const vAMMAddress = getCrea
//     // })

//     // come back to the initialisation

//     // async function createAndCheckVAMM(
//     //     address: Address
//     // ){
//     //     const create = factory.createVAMM(factory.address)

//     //     await expect(create)
//     //         .to.emit(factory, 'vAMM created')
//     //         .withArgs(address)
//     //     await expect(factory.createVAMM('TEST_ADDRESS'))
        
//     // }

//     // describe('#setCalculator', async () => {
//     //     it('updates calculator address', async () => {
//     //         await factory.setCalculator(other.address)
//     //         expect(await factory.calculator()).to.eq(other.address)
//     //     })
//     // })

//     // describe('#setInsuranceFund', async () => {
//     //     it('updates insurance fund address', async () => {
//     //         await factory.setInsuranceFund(other.address)
//     //         expect(await factory.insuranceFund()).to.eq(other.address)
//     //     })     
//     // })

//     // describe('#createVAMM', async () => {
//     //     it('succeeds in creation', async () => {
//     //         const VAMM = factory.createVAMM(other.address)
//     //         expect(VAMM).to.eq(TEST_ADDRESS)
//     //     })    
//     // })

//     // describe('#createMarginEngine', async () => {
//     //     it('succeeds in creation', async () => {
//     //         await createAndCheckMarginEngine(TEST_ADDRESS)
//     //     })
//     // })

//     // describe('#createAMM', async () => {
//     //     it('succeeds in creation', async () => {
//     //         await createAndCheckAMM(address, bytes32, uint256)
//     //     })
//     // })

//     describe('#setOwner', async () => {
//         it('updates owner address', async () => {
//             await factory.setOwner(other.address)
//             expect(await factory.owner()).to.eq(other.address)
//         })
//     })

//     describe('#addRateOracle', async () => {
//         it('updates calculator address', async () => {
//             // await factory.addRateOracle(other.address)
//         })
//     })
// })