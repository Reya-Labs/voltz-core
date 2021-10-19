
import { BigNumber, BigNumberish, constants, Contract, ContractTransaction, utils, Wallet } from 'ethers'


export enum FeeAmount {
    LOW = 500,
    MEDIUM = 3000,
    HIGH = 10000,
}


export const TICK_SPACINGS: { [amount in FeeAmount]: number } = {
    [FeeAmount.LOW]: 10,
    [FeeAmount.MEDIUM]: 60,
    [FeeAmount.HIGH]: 200,
}

export function getCreate2Address(
    factoryAddress: string,
    underlyingToken: string,
    underlyingPool: string,
    termInDays: number,
    termStartTimestamp: number,
    fee: number,
    bytecode: string
  ): string {
    
    const constructorArgumentsEncoded = utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint256', 'uint256', 'uint24'],
      [underlyingToken, underlyingPool, termInDays, termStartTimestamp, fee]
    )

    const create2Inputs = [
      '0xff',
      factoryAddress,
      // salt
      utils.keccak256(constructorArgumentsEncoded),
      // init code. bytecode + constructor arguments
      utils.keccak256(bytecode),
    ]
    const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join('')}`
    return utils.getAddress(`0x${utils.keccak256(sanitizedInputs).slice(-40)}`)
  }


  export type MintFunction = (
    recipient: string,
    tickLower: BigNumberish,
    tickUpper: BigNumberish,
    liquidity: BigNumberish
  ) => Promise<ContractTransaction>