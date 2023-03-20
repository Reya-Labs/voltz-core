const glpManagerAddresses: { [key: string]: string } = {
  arbitrum: "0x321F653eED006AD1C29D174e17d96351BDe22649",
};

export const getGlpManagerAddress = (networkName: string): string => {
  if (!Object.keys(glpManagerAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to GLP manager addresses!`
    );
  }

  return glpManagerAddresses[networkName];
};

const glpRewardTrackerAddresses: { [key: string]: string } = {
  arbitrum: "0x4e971a87900b931fF39d1Aad67697F49835400b6",
};

export const getGlpRewardTrackerAddress = (networkName: string): string => {
  if (!Object.keys(glpRewardTrackerAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to GLP reward tracker addresses!`
    );
  }

  return glpRewardTrackerAddresses[networkName];
};

const glpVaultAddresses: { [key: string]: string } = {
  arbitrum: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
};

export const getGlpVaultAddress = (networkName: string): string => {
  if (!Object.keys(glpVaultAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to GLP vault addresses!`
    );
  }

  return glpVaultAddresses[networkName];
};

const glpTokenAddresses: { [key: string]: string } = {
  arbitrum: "0x4277f8F2c384827B5273592FF7CeBd9f2C1ac258",
};

export const getGlpTokenAddress = (networkName: string): string => {
  if (!Object.keys(glpTokenAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to GLP token addresses!`
    );
  }

  return glpTokenAddresses[networkName];
};
