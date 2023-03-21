const aaveV3LendingPoolAddresses: { [key: string]: string } = {
  mainnet: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  arbitrum: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
};

export const getAaveV3LendingPoolAddress = (networkName: string): string => {
  if (!Object.keys(aaveV3LendingPoolAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to aave v3 lending pools!`
    );
  }

  return aaveV3LendingPoolAddresses[networkName];
};

const aaveV2LendingPoolAddresses: { [key: string]: string } = {
  mainnet: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
};

export const getAaveV2LendingPoolAddress = (networkName: string): string => {
  if (!Object.keys(aaveV2LendingPoolAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to aave v2 lending pools!`
    );
  }

  return aaveV2LendingPoolAddresses[networkName];
};
