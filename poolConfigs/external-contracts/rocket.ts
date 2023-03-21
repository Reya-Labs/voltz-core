const rocketETHAddresses: { [key: string]: string } = {
  mainnet: "0xae78736Cd615f374D3085123A210448E74Fc6393",
};

const rocketNetworkBalancesEthAddresses: { [key: string]: string } = {
  mainnet: "0x138313f102ce9a0662f826fca977e3ab4d6e5539",
};

export const getRocketETHAddress = (networkName: string): string => {
  if (!Object.keys(rocketETHAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to rETH addresses!`
    );
  }

  return rocketETHAddresses[networkName];
};

export const getRocketNetworkBalancesEthAddress = (
  networkName: string
): string => {
  if (!Object.keys(rocketNetworkBalancesEthAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to rocket network balance addresses!`
    );
  }

  return rocketNetworkBalancesEthAddresses[networkName];
};
