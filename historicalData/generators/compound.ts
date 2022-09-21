import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ICToken, IERC20Minimal } from "../../typechain";
import { BlockSpec, Datum, blocksPerDay } from "./common";

export interface CompoundDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  cToken: ICToken;
  borrow: boolean;
  decimals: number;
}

// Generator function for Compound data
async function* compoundDataGenerator(
  spec: CompoundDataSpec
): AsyncGenerator<Datum> {
  const { hre, cToken, decimals } = spec;

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);
      let rate: BigNumber;

      if (spec.borrow) {
        const borrowRateMantissa = await cToken.borrowRatePerBlock({
          blockTag: b,
        });
        const accrualBlockNumber = await cToken.accrualBlockNumber({
          blockTag: b,
        });
        const blockDelta = BigNumber.from(b).sub(accrualBlockNumber);
        const simpleInterestFactor = borrowRateMantissa.mul(
          BigNumber.from(blockDelta)
        );
        const borrowIndexPrior = await cToken.borrowIndex({
          blockTag: b,
        });
        rate = simpleInterestFactor
          .mul(borrowIndexPrior)
          .div(BigNumber.from(10).pow(18)) // all the above are in wad
          .add(borrowIndexPrior)
          .mul(BigNumber.from(10).pow(9)); // scale to ray
      } else {
        rate = await cToken.exchangeRateStored({
          blockTag: b,
        });
        if (decimals > 17) {
          rate = rate.div(BigNumber.from(10).pow(decimals - 17));
        } else if (decimals < 17) {
          rate = rate.mul(BigNumber.from(10).pow(17 - decimals));
        }
      }
      yield {
        blockNumber: b,
        timestamp: block.timestamp,
        rate,
        error: null,
      };
    } catch (e: unknown) {
      yield {
        blockNumber: b,
        timestamp: 0,
        rate: BigNumber.from(0),
        error: e,
      };
    }
  }
}

export async function buildCompoundDataGenerator(
  hre: HardhatRuntimeEnvironment,
  cTokenAddress: string,
  lookbackDays?: number,
  borrow = false,
  isEther = false,
  overrides?: Partial<CompoundDataSpec>
): Promise<AsyncGenerator<Datum, any, unknown>> {
  // calculate from and to blocks
  const currentBlock = await hre.ethers.provider.getBlock("latest");
  const cToken = (await hre.ethers.getContractAt(
    "ICToken",
    cTokenAddress
  )) as ICToken;

  let decimals;
  if (isEther) {
    decimals = 18;
  } else {
    const underlying = (await hre.ethers.getContractAt(
      "IERC20Minimal",
      await cToken.underlying()
    )) as IERC20Minimal;

    decimals = await underlying.decimals();
  }

  const defaults = {
    fromBlock: lookbackDays
      ? currentBlock.number - blocksPerDay * lookbackDays
      : 7710760, // 7710760 = cUSDC deployment
    blockInterval: blocksPerDay,
    toBlock: currentBlock.number,
    hre,
    borrow,
    decimals,
    cToken,
  };

  return compoundDataGenerator({
    ...defaults,
    ...overrides,
  });
}
