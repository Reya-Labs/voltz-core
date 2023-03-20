const pausers: { [key: string]: string[] } = {
  mainnet: [
    "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700",
    "0x4a02c244dCED6797d864B408F646Afe470147159",
    "0xA73d7b822Bfad43500a26aC38956dfEaBD3E066d",
    "0x140d001689979ee77C2FB4c8d4B5F3E209135776",
  ],
  goerli: [
    "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700",
    "0x4a02c244dCED6797d864B408F646Afe470147159",
    "0xA73d7b822Bfad43500a26aC38956dfEaBD3E066d",
    "0x140d001689979ee77C2FB4c8d4B5F3E209135776",
  ],
  arbitrum: [
    "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700",
    "0x4a02c244dCED6797d864B408F646Afe470147159",
    "0xA73d7b822Bfad43500a26aC38956dfEaBD3E066d",
    "0x140d001689979ee77C2FB4c8d4B5F3E209135776",
  ],
  arbitrumGoerli: [
    "0x44A62Dd868534422C29Eb781Fd259FEEC17DF700",
    "0x4a02c244dCED6797d864B408F646Afe470147159",
    "0xA73d7b822Bfad43500a26aC38956dfEaBD3E066d",
    "0x140d001689979ee77C2FB4c8d4B5F3E209135776",
  ],
};

export const getNetworkPausers = (networkName: string): string[] => {
  if (!Object.keys(pausers).includes(networkName)) {
    throw new Error(
      `Unrecognized error. Check that ${networkName} pausers are added!`
    );
  }

  return pausers[networkName];
};
