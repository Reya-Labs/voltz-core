import { BigNumber } from "ethers";

const WAD = BigNumber.from(10).pow(18);
const SECONDS_IN_YEAR = BigNumber.from(31536000);
const ONE_HUNDRED = BigNumber.from(100);

export const accrualFactWad = (
  termStartTimestampWad: BigNumber,
  termEndTimestampWad: BigNumber
): BigNumber => {
  return termEndTimestampWad.sub(termStartTimestampWad).div(SECONDS_IN_YEAR);
};

const fixedFactorWad = (
  termStartTimestampWad: BigNumber,
  termEndTimestampWad: BigNumber
): BigNumber => {
  return accrualFactWad(termStartTimestampWad, termEndTimestampWad).div(
    ONE_HUNDRED
  );
};

export const calculateSettlementCashflow = (
  fixedTokenBalance: BigNumber,
  variableTokenBalance: BigNumber,
  termStartTimestampWad: BigNumber,
  termEndTimestampWad: BigNumber,
  variableFactorToMaturityWad: BigNumber
): BigNumber => {
  const fixedCashflowWad = fixedTokenBalance.mul(
    fixedFactorWad(termStartTimestampWad, termEndTimestampWad)
  );
  const variableCashflowWad = variableTokenBalance.mul(
    variableFactorToMaturityWad
  );
  const cashflowWad = fixedCashflowWad.add(variableCashflowWad);
  return cashflowWad.div(WAD);
};
