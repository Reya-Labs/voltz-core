const sofrPriceFeedAddresses: { [key: string]: string } = {
  avalancheFuji: "0x42Ea045b70856c8cc20784A5B45EA35a80C8aDd9",
};

export const getSofrPriceFeedAddress = (networkName: string): string => {
  if (!Object.keys(sofrPriceFeedAddresses).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} is added to sofr price feed addresses!`
    );
  }

  return sofrPriceFeedAddresses[networkName];
};
