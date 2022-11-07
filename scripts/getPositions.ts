import { ethers } from "ethers";
import { GraphQLClient, gql } from "graphql-request";

import * as dotenv from "dotenv";
dotenv.config();

export interface Position {
  marginEngine: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
}

const getPositionsQueryString = `
{
  positions(first: firstCount, skip: skipCount, orderBy: createdTimestamp) {
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
  }
}
`;

export async function getPositions(
  onlyActivePositions: boolean = false
): Promise<Position[]> {
  const endpoint = process.env.SUBGRAPH_URL || "";
  console.log(endpoint);
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

    const currentTimestamp = Math.floor(Date.now() / 1000);
    for (const position of positions_batch.positions) {
      const termEndTimestamp = Number(
        ethers.utils.formatEther(position.amm.termEndTimestamp)
      );
      if (!onlyActivePositions || termEndTimestamp > currentTimestamp) {
        positions.push({
          marginEngine: position.amm.marginEngine.id,
          owner: position.owner.id,
          tickLower: Number(position.tickLower),
          tickUpper: Number(position.tickUpper),
        });
      }
    }

    skipCount += firstCount;

    if (positions_batch.positions.length !== firstCount) {
      break;
    }
  }

  return positions;
}
