
// todo: get back to this once done with TestUniswapV3Calee... 

interface PoolFixture extends TokensAndFactoryFixture {
    swapTargetCallee: TestUniswapV3Callee
    swapTargetRouter: TestUniswapV3Router
    createPool(
      fee: number,
      tickSpacing: number,
      firstToken?: TestERC20,
      secondToken?: TestERC20
    ): Promise<MockTimeUniswapV3Pool>
  }
  
  // Monday, October 5, 2020 9:00:00 AM GMT-05:00
  export const TEST_POOL_START_TIME = 1601906400


export const poolFixture: Fixture<PoolFixture> = async function (): Promise<PoolFixture> {
    const { factory } = await factoryFixture()
    const { token0, token1, token2 } = await tokensFixture()
  
    const MockTimeUniswapV3PoolDeployerFactory = await ethers.getContractFactory('MockTimeUniswapV3PoolDeployer')
    const MockTimeUniswapV3PoolFactory = await ethers.getContractFactory('MockTimeUniswapV3Pool')
  
    const calleeContractFactory = await ethers.getContractFactory('TestUniswapV3Callee')
    const routerContractFactory = await ethers.getContractFactory('TestUniswapV3Router')
  
    const swapTargetCallee = (await calleeContractFactory.deploy()) as TestUniswapV3Callee
    const swapTargetRouter = (await routerContractFactory.deploy()) as TestUniswapV3Router
  
    return {
      token0,
      token1,
      token2,
      factory,
      swapTargetCallee,
      swapTargetRouter,
      createPool: async (fee, tickSpacing, firstToken = token0, secondToken = token1) => {
        const mockTimePoolDeployer = (await MockTimeUniswapV3PoolDeployerFactory.deploy()) as MockTimeUniswapV3PoolDeployer
        const tx = await mockTimePoolDeployer.deploy(
          factory.address,
          firstToken.address,
          secondToken.address,
          fee,
          tickSpacing
        )
  
        const receipt = await tx.wait()
        const poolAddress = receipt.events?.[0].args?.pool as string
        return MockTimeUniswapV3PoolFactory.attach(poolAddress) as MockTimeUniswapV3Pool
      },
    }
  }