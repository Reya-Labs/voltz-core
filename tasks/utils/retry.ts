// It introduces a delay of ms milliseconds
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// It returns a random number between [0, max-1]
function getRandomNumber(max: number): number {
  return Math.floor(Math.random() * max);
}

// It retries a call for a few times while waiting an exponential time before each new attempt.
// You pass the query and the number of attempts you want to use and it performs as follows:
// 1. Initiates the waiting time to 1s
// 2. Tries to fetch the data
// 3.1. If it succeeds, it returns the data
// 3.2. If it fails, it waits, it doubles the waiting time and go to point 2. if the number of attemps is not reached
export const exponentialBackoff = async <T = any>(
  query: () => Promise<T>,
  attempts = 5,
  factor = 2
): Promise<T> => {
  let waitingTime = 1000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const data = await query();

      return data;
    } catch (error) {
      console.error(`Retry failed. [attempt: ${attempt}/${attempts}]`);

      if (attempt + 1 === attempts) {
        console.error(`All attempts failed with ${error}`);

        throw error;
      }
    }

    await delay(waitingTime + getRandomNumber(100));
    waitingTime *= factor;
  }

  throw new Error("Retry loop failed unexpectedly");
};
