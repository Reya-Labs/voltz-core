import { GraphQLClient, gql } from "graphql-request";

export interface Swap {
  createdTimestamp: string;
  fixedTokenDelta: string;
  variableTokenDelta: string;
  fixedTokenDeltaUnbalanced: string;
}

function getSwapQueryString(
  owner: string,
  tickLower: number,
  tickUpper: number,
  marginEngine: string
): string {
  return `
  {
    swaps(first: firstCount, skip: skipCount,
      where: {
        position_: {
          owner: "${owner}", 
          tickLower: "${tickLower}",
          tickUpper: "${tickUpper}"
        },
        amm_: {
          marginEngine: "${marginEngine}"
        }
      }
    ) {
      transaction {
        createdTimestamp
      }
      fixedTokenDelta
      variableTokenDelta
      fixedTokenDeltaUnbalanced
    }
  }
`;
}

export async function getSwaps(
  owner: string,
  tickLower: number,
  tickUpper: number,
  marginEngine: string
): Promise<Swap[]> {
  const endpoint =
    "https://api.thegraph.com/subgraphs/name/voltzprotocol/mainnet-v1";
  const graphQLClient = new GraphQLClient(endpoint);

  const firstCount = 1000;
  let skipCount = 0;
  const swaps: Swap[] = [];
  while (true) {
    const data = await graphQLClient.request(
      gql`
        ${getSwapQueryString(owner, tickLower, tickUpper, marginEngine)
          .replace("firstCount", firstCount.toString())
          .replace("skipCount", skipCount.toString())}
      `
    );

    const swaps_batch = JSON.parse(JSON.stringify(data, undefined, 2));

    for (const swap of swaps_batch.swaps) {
      swaps.push({
        createdTimestamp: swap.transaction.createdTimestamp,
        fixedTokenDelta: swap.fixedTokenDelta,
        variableTokenDelta: swap.variableTokenDelta,
        fixedTokenDeltaUnbalanced: swap.fixedTokenDeltaUnbalanced,
      });
    }

    skipCount += firstCount;

    if (swaps_batch.swaps.length !== firstCount) {
      break;
    }
  }

  return swaps;
}
