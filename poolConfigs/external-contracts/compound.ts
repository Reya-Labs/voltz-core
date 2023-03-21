const cTokenAddresses: { [key: string]: { [key: string]: string } } = {
  mainnet: {
    cDAI: "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643",
    cUSDC: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
    cWBTC: "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
    cWBTC2: "0xccf4429db6322d5c611ee964527d42e5d685dd6a",
    cUSDT: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9",
    cTUSD: "0x12392f67bdf24fae0af363c24ac620a2f67dad86",
    cETH: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  },
};

export const getCTokenAddress = (
  networkName: string,
  tokenName: string
): string => {
  const asset = `c${tokenName}`;

  if (!Object.keys(cTokenAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to cToken addresses!`
    );
  }

  if (!Object.keys(cTokenAddresses[networkName]).includes(asset)) {
    throw new Error(
      `Unrecognized error. Check that ${asset} is added to compound addresses!`
    );
  }

  return cTokenAddresses[networkName][asset];
};
