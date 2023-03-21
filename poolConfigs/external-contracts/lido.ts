const lidoStETHAddresses: { [key: string]: string } = {
  mainnet: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
};

const lidoOracleAddresses: { [key: string]: string } = {
  mainnet: "0x442af784a788a5bd6f42a01ebe9f287a871243fb",
};

export const getLidoStETHAddress = (networkName: string): string => {
  if (!Object.keys(lidoStETHAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to lido stETH addresses!`
    );
  }

  return lidoStETHAddresses[networkName];
};

export const getLidoOracleAddress = (networkName: string): string => {
  if (!Object.keys(lidoOracleAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to lido oracle addresses!`
    );
  }

  return lidoOracleAddresses[networkName];
};
