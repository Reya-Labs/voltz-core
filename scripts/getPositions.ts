import { GraphQLClient, gql } from "graphql-request";

export interface Position {
  marginEngine: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
}

const getPositionsQueryString = `
  {
    positions(first: firstCount, skip: skipCount) {
      amm {
        marginEngine {
          id
        }
      }
      owner {
        id
      }
      tickLower
      tickUpper
    }
  }
`;

export async function getPositions(): Promise<Position[]> {
  const endpoint =
    "https://api.thegraph.com/subgraphs/name/voltzprotocol/mainnet-v1";
  const graphQLClient = new GraphQLClient(endpoint);

  const firstCount = 1000;
  let skipCount = 0;
  const positions: Position[] = [];
  while (true) {
    const data = await graphQLClient.request(
      gql`
        ${getPositionsQueryString
          .replace("firstCount", firstCount.toString())
          .replace("skipCount", skipCount.toString())}
      `
    );

    const positions_batch = JSON.parse(JSON.stringify(data, undefined, 2));

    for (const position of positions_batch.positions) {
      positions.push({
        marginEngine: position.amm.marginEngine.id,
        owner: position.owner.id,
        tickLower: Number(position.tickLower),
        tickUpper: Number(position.tickUpper),
      });
    }

    skipCount += firstCount;

    if (positions_batch.positions.length !== firstCount) {
      break;
    }
  }

  return positions;
}
