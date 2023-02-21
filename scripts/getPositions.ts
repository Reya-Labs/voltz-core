import { GraphQLClient, gql } from "graphql-request";
import { getProtocolSubgraphURL } from "./getProtocolSubgraphURL";

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
      ${
        activeAtTimestamp
          ? `
      createdTimestamp_lte: "${activeAtTimestamp}"
      amm_: {
        termStartTimestamp_lte: "${activeAtTimestamp}${WAD_ZEROS}"
        termEndTimestamp_gte: "${activeAtTimestamp}${WAD_ZEROS}"
      }
      `
          : ""
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

// TODO: getPositions(...) should be replaced by querying subgraph-data
export async function getPositions(
  networkName: string,
  activeAtTimestamp?: number
): Promise<Position[]> {
  const endpoint = getProtocolSubgraphURL(networkName);
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
