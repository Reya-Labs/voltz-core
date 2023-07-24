import { SinglePool, NetworkPools, Pools } from "./types";

const pools: Pools = {
  mainnet: {
    aUSDC_v1: {
      marginEngine: "0x9ea5Cfd876260eDadaB461f013c24092dDBD531d",
      vamm: "0xae16Bb8Fe13001b61DdB44e2cEae472D6af08755",
      decimals: 6,
      deploymentBlock: 14883716,
      rateOracleID: 1,
    },

    aUSDC_v2: {
      marginEngine: "0x0BC09825Ce9433B2cDF60891e1B50a300b069Dd2",
      vamm: "0x538E4FFeE8AEd76EfE35565c322a7B0d8cDb4CFF",
      decimals: 6,
      deploymentBlock: 15242692,
      rateOracleID: 1,
    },

    aUSDC_v3: {
      marginEngine: "0xB785E7e71F099adA43222E1690Ee0bf701f80396",
      vamm: "0x953E581DD817b0faa69eacAfB2C5709483F39aBa",
      decimals: 6,
      deploymentBlock: 15638356,
      rateOracleID: 1,
    },

    aUSDC_v4: {
      marginEngine: "0x8361bcb0109eA36eE8aE18Bf513F0625F4Ac183b",
      vamm: "0x6Db5e4e8732dd6CB1b6E5fbE39Fd102D8e76c512",
      decimals: 6,
      deploymentBlock: 16221212,
      rateOracleID: 1,
    },

    aUSDC_v5: {
      marginEngine: "0x295891Cc72A230bcB2C2bEa3276Ac4D470495894",
      vamm: "0x368811E781C4300561d1cC204f7333a778d87Ad5",
      decimals: 6,
      deploymentBlock: 16221212,
      rateOracleID: 1,
    },

    aUSDC_v6: {
      marginEngine: "0x3AA060fb2C3432D16c1c0a9a22C6B23f7846Cf71",
      vamm: "0x2913a888C95d1300d66978905331c7F50EbC78b2",
      decimals: 6,
      deploymentBlock: 16519668,
      rateOracleID: 1,
    },

    aUSDC_v7: {
      marginEngine: "0xd1D1254ac96D8C5877372421b1c5E505207c4B21",
      vamm: "0x8773315B21961828d5bdaB9a29881b9aB25147f8",
      decimals: 6,
      deploymentBlock: 16501203,
      rateOracleID: 7,
    },

    aUSDC_v8: {
      marginEngine: "0xe6bA9270Cb517b9236331bc972FE016D0cF1168F",
      vamm: "0x66Ad47d8C8A0beDd32f5692fFB2df85041CD4Bd2",
      decimals: 6,
      deploymentBlock: 16593014,
      rateOracleID: 7,
    },

    aUSDC_v9: {
      marginEngine: "0x3ea1c10A0adC2b2Fc2997A6b2BA5733A7C66C142",
      vamm: "0x47C46765d633B6BC03d31cC224585c6856beeCB2",
      decimals: 6,
      deploymentBlock: 16722019,
      rateOracleID: 1,
    },

    aUSDC_v10: {
      marginEngine: "0x6B9814D4876b6236135853A21e13B15de39EB61B",
      vamm: "0x943309c6D1fD572414A640C68F6F71Ef2113171c",
      decimals: 6,
      deploymentBlock: 16722019,
      rateOracleID: 7,
    },

    aUSDC_v11: {
      marginEngine: "0x640d66494e85574767aac83f9446083218ef06fe",
      vamm: "0x57c2a977b01b8e91ee6ce10d8425c5a43c101e7d",
      decimals: 6,
      deploymentBlock: 16833096,
      rateOracleID: 7,
    },

    aUSDC_v12: {
      marginEngine: "0xfa2ad0f34bc701ba0d65740bc3f833d5aa2b6f3d",
      vamm: "0xf222043c6ebd7cd5d2a055333897dbb215cbbeb7",
      decimals: 6,
      deploymentBlock: 16934269,
      rateOracleID: 1,
    },

    aUSDC_v13: {
      marginEngine: "0x9057460bc74267f0c0953fc95d107b02f9fb2ae7",
      vamm: "0x14441c6dae81d4897921ef0134d119076a0741a7",
      decimals: 6,
      deploymentBlock: 16934269,
      rateOracleID: 7,
    },

    aUSDC_v15: {
      marginEngine: "0x8c25c69D4999a9Bac882E4097ee1a5E2C4bd4166",
      vamm: "0x9206A3c4448637469411DB4FD129223d1B575686",
      decimals: 6,
      deploymentBlock: 17146963,
      rateOracleID: 1,
    },

    borrow_aUSDC_v1: {
      marginEngine: "0x33bA6A0B16750206195c777879Edd8706204154B",
      vamm: "0x0f91a255B5bA8e59f3B97b1EDe91dEC88bcC17eb",
      decimals: 6,
      deploymentBlock: 15373135,
      rateOracleID: 5,
    },

    borrow_aUSDC_v2: {
      marginEngine: "0xd6f2ef8e7f5917beda41136cb4a50e8be7735b4f",
      vamm: "0xb1842fe197320359271d061b42795d7ce4b77513",
      decimals: 6,
      deploymentBlock: 16934269,
      rateOracleID: 5,
    },

    borrow_aUSDC_v3: {
      marginEngine: "0x2aA6aCEBC206a2a5C4bf0ba015C6ce1017726b22",
      vamm: "0xb62d44e1bD91E868B682c09b1792a9026F35B1E4",
      decimals: 6,
      deploymentBlock: 17061888,
      rateOracleID: 9,
    },

    borrow_aUSDC_v4: {
      marginEngine: "0xB3d6ff11dDD6A28Cd7350d453ce502F82BA3E72c",
      vamm: "0x799a0b21114e2E388FaA7D2bd59F817fdb7D350a",
      decimals: 6,
      deploymentBlock: 17146963,
      rateOracleID: 5,
    },

    borrow_aUSDC_v5: {
      marginEngine: "0x74673B269dA1DfE4D174addB6b42ECfA62392acD",
      vamm: "0xF5513Ba2f5C1174C25A408D4072fe92952Ee5393",
      decimals: 6,
      deploymentBlock: 17146963,
      rateOracleID: 9,
    },

    borrow_aUSDC_v6: {
      marginEngine: "0xfdE2837a8eB925C2e17b8AFD323FBa66126c9B2c",
      vamm: "0xd6Fc50C52B198f5017a4bd383C92A3dA753883A3",
      decimals: 6,
      deploymentBlock: 17265084,
      rateOracleID: 9,
    },

    borrow_aUSDC_30Jun23: {
      marginEngine: "0xd47fa3314c9c16ebca3dfe3e0c52c24f1311a22b",
      vamm: "0xe8ddb4676eec36acffdffa6707f422e23a8dfc12",
      decimals: 6,
      deploymentBlock: 17378808,
      rateOracleID: 5,
    },

    borrow_av3USDC_30Jun23: {
      marginEngine: "0x2a778e24c3c7b37472efe8fa448fc92b694e9b25",
      vamm: "0x3ca96c10ac0b7651c9ea78b110db9e2e355893df",
      decimals: 6,
      deploymentBlock: 17378808,
      rateOracleID: 9,
    },

    borrow_aUSDC_31Jul23: {
      marginEngine: "0x7dcd48966eb559dfa6db842ba312c96dce0cb0b2",
      vamm: "0x037c8d42972c3c058224a2e51b5cb9b504f75b77",
      decimals: 6,
      deploymentBlock: 17591482,
      rateOracleID: 5,
    },

    borrow_av3USDC_31Jul23: {
      marginEngine: "0x19654a85a96da7b39aa605259ee1568e55ccb9ba",
      vamm: "0xd9a3f015a4ffd645014ec0f43148685be8754737",
      decimals: 6,
      deploymentBlock: 17591482,
      rateOracleID: 9,
    },

    aDAI_v1: {
      marginEngine: "0x317916f91050Ee7e4F53F7c94e83FBD4eCAdec7e",
      vamm: "0xA1a75F6689949fF413Aa115D300f5e30F35Ba061",
      decimals: 18,
      deploymentBlock: 14883728,
      rateOracleID: 1,
    },

    aDAI_v2: {
      marginEngine: "0x654316A63E68f1c0823f0518570bc108de377831",
      vamm: "0xc75E6d901817B476a9f3B6B79831d2b61673F9f5",
      decimals: 18,
      deploymentBlock: 15242692,
      rateOracleID: 1,
    },

    aDAI_v3: {
      marginEngine: "0x0F533F6b042593C00C9F4A2AD28106F524FCEb94",
      vamm: "0xaD6BbD2eb576A82FC4Ff0399A4Ef2F123BE7cFd2",
      decimals: 18,
      deploymentBlock: 15638356,
      rateOracleID: 1,
    },

    aDAI_v4: {
      marginEngine: "0xBb3583EFc060eD1CFFFFC06A28f6B5381031B601",
      vamm: "0x7DF7Aa512F1EB4dd5C1b69486f45FE895ba41ECe",
      decimals: 18,
      deploymentBlock: 16221212,
      rateOracleID: 1,
    },

    cDAI_v1: {
      marginEngine: "0x641a6e03FA9511BDE6a07793B04Cb00Aba8305c0",
      vamm: "0xE4668BC57b1A73aaA832fb083b121D5b4602F475",
      decimals: 18,
      deploymentBlock: 14883745,
      rateOracleID: 2,
    },

    cDAI_v2: {
      marginEngine: "0xf2ccd85a3428d7a560802b2dd99130be62556d30",
      vamm: "0xd09723a7F4C26f4723aa63bf4a4a4a5daD970a49",
      decimals: 18,
      deploymentBlock: 15242692,
      rateOracleID: 2,
    },

    cDAI_v3: {
      marginEngine: "0x75cDBD0e66Fdf4E2C80334F72B39628105fbeB20",
      vamm: "0x1f0cB00AC15694c810A3326AbF27921eF42D6d6d",
      decimals: 18,
      deploymentBlock: 15638356,
      rateOracleID: 2,
    },

    cDAI_v4: {
      marginEngine: "0x720BE99ee947292Be5d0e8Ef8D8687a7bC542f73",
      vamm: "0xEF05Af8b766B33e8c0FE768278deE326946a4858",
      decimals: 18,
      deploymentBlock: 16221212,
      rateOracleID: 2,
    },

    stETH_v1: {
      marginEngine: "0x21F9151d6e06f834751b614C2Ff40Fc28811B235",
      vamm: "0x3806B99D0A0483E0D07501B31884c10e8E8b1215",
      decimals: 18,
      deploymentBlock: 15058080,
      rateOracleID: 3,
    },

    stETH_v2: {
      marginEngine: "0x626Cf6B2fBF578653f7Fa5424962972161A79de7",
      vamm: "0x05cae5FE1FaAb605F795b018bE6bA979C2c89cdB",
      decimals: 18,
      deploymentBlock: 16221212,
      rateOracleID: 3,
    },

    stETH_v3: {
      marginEngine: "0x3dd093822661bf84a872cc24d73dd42d4e695d4b",
      vamm: "0xb7edbed9c7ec58fb781a972091d94846a25097e9",
      decimals: 18,
      deploymentBlock: 16934269,
      rateOracleID: 3,
    },

    stETH_v4: {
      marginEngine: "0xdafcB84c116E7f3aF2a86d89F2F6D04Cea84deb7",
      vamm: "0x2a07920e78ea904cFBef04d48Deb35E480E6f28E",
      decimals: 18,
      deploymentBlock: 17146963,
      rateOracleID: 3,
    },

    rETH_v1: {
      marginEngine: "0xB1125ba5878cF3A843bE686c6c2486306f03E301",
      vamm: "0x5842254e74510E000D25B5E601bCbC43B52946B4",
      decimals: 18,
      deploymentBlock: 15055872,
      rateOracleID: 4,
    },

    rETH_v2: {
      marginEngine: "0x5E885417968b65fFAC944a2fB975C101566B4aCa",
      vamm: "0xE07324a394aCFfF8fE24A09C3F2e2bD62e929eFb",
      decimals: 18,
      deploymentBlock: 16221212,
      rateOracleID: 4,
    },

    rETH_v3: {
      marginEngine: "0x14e8470af507d46c7a1696c75a183a95bd8f5fe0",
      vamm: "0x0d05e6cf8cd82b0447eff4f2ca732d02308aa848",
      decimals: 18,
      deploymentBlock: 16934269,
      rateOracleID: 4,
    },

    rETH_v4: {
      marginEngine: "0x9E0e377F6567f612b4cf0a86bF759ce725722139",
      vamm: "0xb332c271e90B9fbca53C061aA3590194e8700B1E",
      decimals: 18,
      deploymentBlock: 17146963,
      rateOracleID: 4,
    },

    aETH_v1: {
      marginEngine: "0x6F7ccb0cfD6130E75e88e4c72168fD8A6926c943",
      vamm: "0x5d82B85430d3737D8068248363b4d47395145387",
      decimals: 18,
      deploymentBlock: 15638356,
      rateOracleID: 1,
    },

    borrow_aETH_v1: {
      marginEngine: "0x9b76B4d09229c339B049053F171BFB22cbE50092",
      vamm: "0x682F3e5685Ff51C232cF842840BA27E717C1AE2E",
      decimals: 18,
      deploymentBlock: 15373135,
      rateOracleID: 5,
    },

    borrow_aETH_v2: {
      marginEngine: "0x3d2821E59F330105c1C3aaB8c289Bce15F688f8A",
      vamm: "0x27Ed5d356937213f97C9F9Cb7593D876e5d30F42",
      decimals: 18,
      deploymentBlock: 15638356,
      rateOracleID: 5,
    },

    borrow_aETH_v3: {
      marginEngine: "0x107b152efc8900d8aa2cd45297c620d886558477",
      vamm: "0xf6421486af95c3ea6c4555554d55ef0c3a2048ba",
      decimals: 18,
      deploymentBlock: 16934269,
      rateOracleID: 5,
    },

    borrow_aETH_v4: {
      marginEngine: "0xDD974c237C1f49422ec10f7E273120FFb595c5Da",
      vamm: "0x53064915a5FE121e3d80B9bd0024fE58cd1a8720",
      decimals: 18,
      deploymentBlock: 17146963,
      rateOracleID: 5,
    },

    borrow_cUSDT_v1: {
      marginEngine: "0x111A75E91625142E85193b67B10E53Acf82838cD",
      vamm: "0xcd47347a8C4F40e6877425080d22F4c3115b60A5",
      decimals: 6,
      deploymentBlock: 15373135,
      rateOracleID: 6,
    },

    borrow_cUSDT_v2: {
      marginEngine: "0x5eaa5ff3a0a7c982715feb768be143461fdd4de9",
      vamm: "0x67665a9ed20849b48a89c267a69fe70c4de8af56",
      decimals: 6,
      deploymentBlock: 16934269,
      rateOracleID: 6,
    },

    borrow_cUSDT_v3: {
      marginEngine: "0xb67487b117298a47C0F774F25120b8D7428132da",
      vamm: "0x4e4DDa5eD4f3a47a2DB86a284cC3d26155DA5933",
      decimals: 6,
      deploymentBlock: 17146963,
      rateOracleID: 6,
    },

    borrow_aUSDT_v1: {
      marginEngine: "0xB8A339Cd4eD2e69725d95931a18482269E006FF1",
      vamm: "0x9a37Bcc8fF3055d7223B169BC9c9Fe2157A1b60E",
      decimals: 6,
      deploymentBlock: 16221212,
      rateOracleID: 5,
    },

    borrow_aUSDT_v2: {
      marginEngine: "0x1e2f114b6948946a42574a953dcb7838b2c810ea",
      vamm: "0xacf59c72660d1e6629a721fd958f7a8c64379835",
      decimals: 6,
      deploymentBlock: 16934269,
      rateOracleID: 5,
    },

    borrow_aUSDT_v3: {
      marginEngine: "0x5a3608a066e52349aFF363206faEF92414C8B9F6",
      vamm: "0xb64C6e4AEDe709c0b862fCac6662e2a7bd20855B",
      decimals: 6,
      deploymentBlock: 17146963,
      rateOracleID: 5,
    },
  },

  arbitrum: {
    aUSDC_v1: {
      marginEngine: "0x0ca700b946c446d878a497c50fb98844a85a2dd9",
      vamm: "0x1d7E4d7c1629c9D6E3Bb6a344496b1B782c9ca9a",
      decimals: 6,
      deploymentBlock: 63216317,
      rateOracleID: 7,
    },

    aUSDC_v2: {
      marginEngine: "0x6849d4bda5828db77c7978a145bf9d4b4ae1f3f5",
      vamm: "0x0c6dbf063fd1effe971ecf4091a40064936eae35",
      decimals: 6,
      deploymentBlock: 74969179,
      rateOracleID: 7,
    },

    borrow_aUSDC_v1: {
      marginEngine: "0xb696f408804ccb345040c9b08ea4b7a8750bf70f",
      vamm: "0x8ce24926b49f9e1b97dc21109ed8ab67cf0293c2",
      decimals: 6,
      deploymentBlock: 74969179,
      rateOracleID: 9,
    },

    borrow_aUSDC_v2: {
      marginEngine: "0x6fe3ed5529f77f0bb1b21b7b5f2d8bc67180a3c0",
      vamm: "0xb97191595b38b192e776402a6ed2a23c7cf25582",
      decimals: 6,
      deploymentBlock: 81000196,
      rateOracleID: 9,
    },

    borrow_aUSDC_v3: {
      marginEngine: "0xa1000d63a8f603e9f83356b4fbfc36f11a5100cb",
      vamm: "0xaeb387b339ea6e9e0e57c3718e0bd00637f20a1d",
      decimals: 6,
      deploymentBlock: 85278773,
      rateOracleID: 9,
    },

    borrow_aUSDC_v4: {
      marginEngine: "0x36f62fd95d4abf214a0b9c843ffc69a08d54bdc9",
      vamm: "0x168f5ba6d36737ecd894c13f26405cbaac66a72d",
      decimals: 6,
      deploymentBlock: 85278773,
      rateOracleID: 9,
    },

    borrow_av3USDC_30Jun23: {
      marginEngine: "0xc73a470241168c14d3cd19c94f6f1c46073fba79",
      vamm: "0xa3c0c89ac146b89edd17efd4e9c43cc4fc35ec1e",
      decimals: 6,
      deploymentBlock: 96338929,
      rateOracleID: 9,
    },

    borrow_av3USDC_31Aug23: {
      marginEngine: "0x9b5b9d31c7b4a826cd30c09136a2fdea9c69efcd",
      vamm: "0x3ecf01157e9b1a66197325771b63789d1fb18f1f",
      decimals: 6,
      deploymentBlock: 96338929,
      rateOracleID: 9,
    },

    glpETH_v1: {
      marginEngine: "0xC1a44601a9F141ECA8823f99b0b7fFF55F2A6e17",
      vamm: "0xB69c2b77C844b55F9924242df4299a1598753320",
      decimals: 18,
      deploymentBlock: 60949827,
      rateOracleID: 8,
    },

    glpETH_v2: {
      marginEngine: "0xf9850b06aaabab6be56558d58e94a3fd621b161e",
      vamm: "0x1aac6232b7c7cd6c8479077844eb0302cca0d2af",
      decimals: 18,
      deploymentBlock: 70061963,
      rateOracleID: 8,
    },

    glpETH_v3: {
      marginEngine: "0xbf23844515a0b1f574f2dc6437ea8e1cc98b87a4",
      vamm: "0x034f2b4137ed637c6b6ca9636d5f9fee0998e5f1",
      decimals: 18,
      deploymentBlock: 79959637,
      rateOracleID: 8,
    },

    glpETH_28Jun23: {
      marginEngine: "0xbe958ba49be73d3020cb62e512619da953a2bab1",
      vamm: "0x22393f23f16925d282aeca0a8464dccaf10ee480",
      decimals: 18,
      deploymentBlock: 96338929,
      rateOracleID: 8,
    },
  },

  avalanche: {
    sofrUSDC_30Sep23: {
      marginEngine: "0xc1a44601a9f141eca8823f99b0b7fff55f2a6e17",
      vamm: "0xb69c2b77c844b55f9924242df4299a1598753320",
      decimals: 6,
      deploymentBlock: 30435778,
      rateOracleID: 10,
    },

    sofrUSDC_31Dec23: {
      marginEngine: "0x0ca700b946c446d878a497c50fb98844a85a2dd9",
      vamm: "0x1d7e4d7c1629c9d6e3bb6a344496b1b782c9ca9a",
      decimals: 6,
      deploymentBlock: 30435778,
      rateOracleID: 10,
    },
  },
};

export const getNetworkPools = (networkName: string): NetworkPools => {
  const tmp = pools[networkName as keyof typeof pools];
  if (tmp) {
    return tmp;
  }

  throw new Error("Network not found");
};

export const getPool = (networkName: string, poolName: string): SinglePool => {
  const networkPools = getNetworkPools(networkName);

  const tmp = networkPools[poolName as keyof typeof networkPools];
  if (tmp) {
    return tmp;
  }

  throw new Error("Pool not found");
};
