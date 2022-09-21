import { BaseRateOracle } from "../typechain";

const MAX_BUFFER_GROWTH_PER_TRANSACTION = 100;
const BUFFER_SIZE_SAFETY_FACTOR = 1.2; // The buffer must last for 1.2x as long as the longest expected IRS

export interface RateOracleConfigForTemplate {
  rateOracleAddress: string;
  increaseRateOracleBufferSize?: { value: number };
  setMinSecondsSinceLastUpdate?: { value: number };
  last?: boolean; // Used to tell the mustache templating engine to stop adding commas once the last transaction is defined
}

export const applyBufferConfig = async (
  r: BaseRateOracle,
  minBufferSize: number,
  minSecondsSinceLastUpdate: number,
  maxIrsDurationInSeconds: number,
  ownedByMultisig = false
): Promise<RateOracleConfigForTemplate[]> => {
  const secondsWorthOfBuffer = minBufferSize * minSecondsSinceLastUpdate;
  const multisigConfig: RateOracleConfigForTemplate[] = [];
  if (
    secondsWorthOfBuffer <
    maxIrsDurationInSeconds * BUFFER_SIZE_SAFETY_FACTOR
  ) {
    throw new Error(
      `Buffer config of {size ${minBufferSize}, minGap ${minSecondsSinceLastUpdate}s} ` +
        `does not guarantee adequate buffer for an IRS of duration ${maxIrsDurationInSeconds}s`
    );
  }

  let currentSize = (await r.oracleVars())[2];
  // console.log(`currentSize of ${r.address} is ${currentSize}`);

  if (currentSize < minBufferSize) {
    if (ownedByMultisig) {
      multisigConfig.push({
        rateOracleAddress: r.address,
        increaseRateOracleBufferSize: { value: minBufferSize },
      });
    } else {
      process.stdout.write(
        `Increasing size of ${r.address}'s buffer to ${minBufferSize}.`
      );

      while (currentSize < minBufferSize) {
        // Growing the buffer can use a lot of gas so we may split buffer growth into multiple trx
        const newSize = Math.min(
          currentSize + MAX_BUFFER_GROWTH_PER_TRANSACTION,
          minBufferSize
        );

        const trx = await r.increaseObservationCardinalityNext(newSize);
        await trx.wait();

        process.stdout.write(`.`);
        currentSize = (await r.oracleVars())[2];
      }

      console.log(" Done.");
    }
  }

  const currentSecondsSinceLastUpdate = (
    await r.minSecondsSinceLastUpdate()
  ).toNumber();
  // console.log( `current minSecondsSinceLastUpdate of ${r.address} is ${currentVal}` );

  if (currentSecondsSinceLastUpdate !== minSecondsSinceLastUpdate) {
    if (ownedByMultisig) {
      multisigConfig.push({
        rateOracleAddress: r.address,
        setMinSecondsSinceLastUpdate: { value: minSecondsSinceLastUpdate },
      });
      console.log(
        `ATTENTION: you should manually call setMinSecondsSinceLastUpdate(${minSecondsSinceLastUpdate}) on the rate oracle at ${r.address}.`
      );
    } else {
      const trx = await r.setMinSecondsSinceLastUpdate(
        minSecondsSinceLastUpdate
      );
      await trx.wait();
      console.log(
        `Updated minSecondsSinceLastUpdate of ${r.address} to ${minSecondsSinceLastUpdate}`
      );
    }
  }

  return multisigConfig;
};
