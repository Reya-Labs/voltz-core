import { BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ERC20, ICToken } from "../../typechain";
import { BlockSpec, Datum } from "./common";

export interface CompoundDataSpec extends BlockSpec {
  hre: HardhatRuntimeEnvironment;
  cTokenAddress: string;
  borrow: boolean;
  isEther: boolean;
}

// Generator function for Compound data
async function* compoundDataGenerator(
  spec: CompoundDataSpec
): AsyncGenerator<Datum> {
  const { hre, cTokenAddress, isEther } = spec;

  // Fetch cToken contract
  const cToken = (await hre.ethers.getContractAt(
    "ICToken",
    cTokenAddress
  )) as ICToken;

  // Fetch underlying token decimals
  let decimals = 18;

  if (!isEther) {
    const underlying = (await hre.ethers.getContractAt(
      "IERC20Minimal",
      await cToken.underlying()
    )) as ERC20;

    decimals = await underlying.decimals();
  }

  for (let b = spec.fromBlock; b <= spec.toBlock; b += spec.blockInterval) {
    try {
      const block = await hre.ethers.provider.getBlock(b);
      let rate: BigNumber;

      // Fetch rate for borrowing
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
        // Fetch rate for lending
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
  spec: CompoundDataSpec
): Promise<AsyncGenerator<Datum, any, unknown>> {
  return compoundDataGenerator(spec);
}
