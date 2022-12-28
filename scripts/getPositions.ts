import { GraphQLClient, gql } from "graphql-request";

import * as dotenv from "dotenv";
dotenv.config();

export interface Position {
  marginEngine: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  positionType: number; // 1 - FT, 2 - VT, 3 - LP
  isSettled: boolean;
}

const WAD_ZEROS = "000000000000000000";

const getPositionsQueryString = (
  lastID: string,
  activeAtTimestamp?: number
): string => `
{
  positions(
    first: 1000, orderBy: id, orderDirection: asc, 
    where: {
      id_gt: "${lastID}"
      createdTimestamp_lte: "${activeAtTimestamp}"
      amm_: {
        termStartTimestamp_lte: "${
          activeAtTimestamp
            ? `${activeAtTimestamp}${WAD_ZEROS}`
            : `10000000000000000000000000000`
        }"
        termEndTimestamp_gte: "${
          activeAtTimestamp ? `${activeAtTimestamp}${WAD_ZEROS}` : 0
        }"
      }
    }
  ) {
    id
    amm {
      marginEngine {
        id
      }
      rateOracle {
        token {
          decimals
        }
      }
      termStartTimestamp
      termEndTimestamp
    }
    owner {
      id
    }
    tickLower
    tickUpper
    liquidity
    positionType
    isSettled
  }
}
`;

export async function getPositions(
  activeAtTimestamp?: number
): Promise<Position[]> {
  const endpoint = process.env.SUBGRAPH_URL || "";
  const graphQLClient = new GraphQLClient(endpoint);

  let lastID = "";
  const positions: Position[] = [];
  while (true) {
    const data = await graphQLClient.request(
      gql`
        ${getPositionsQueryString(lastID, activeAtTimestamp)}
      `
    );

    const positions_batch = JSON.parse(JSON.stringify(data, undefined, 2));

    for (const position of positions_batch.positions) {
      positions.push({
        marginEngine: position.amm.marginEngine.id,
        owner: position.owner.id,
        tickLower: Number(position.tickLower),
        tickUpper: Number(position.tickUpper),
        liquidity: position.liquidity,
        positionType: Number(position.positionType),
        isSettled: position.isSettled,
      });
    }

    if (positions_batch.positions.length !== 1000) {
      break;
    }
    lastID = positions_batch.positions.at(-1).id;
  }

  return positions;
}
