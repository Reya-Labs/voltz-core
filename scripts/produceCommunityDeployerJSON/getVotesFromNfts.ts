import { task } from "hardhat/config";
import { gql, GraphQLClient } from "graphql-request";
import { exponentialBackoff } from "../../tasks/utils/retry";
import Moralis from "moralis";
import { EvmChain } from "@moralisweb3/common-evm-utils";
import path from "path";
import { getBlockAtTimestamp } from "../../tasks/utils/helpers";

type Badge = {
  id: string;
  mintedTimestamp: string;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const badgesQuery = (lastId: string, deadline: number) => {
  return `
    {
        badges(
        first: 1000,
        orderBy: id,
        orderDirection: asc, 
        where: {
            mintedTimestamp_gt: 0
            , mintedTimestamp_lt: ${deadline}
            , id_gt: "${lastId}"
        }
        )
        {
            id
            mintedTimestamp
        }
    }

`;
};

// Description:
//   This task fetches the community SBTs, genesis NFTs and storyboard NFTs
//      and creates list of address and number of votes available
//
// Example:
//   ``npx hardhat getVotes --network mainnet --community --subgraph https://api.studio.thegraph.com/<path> --deadline 1683648845``

/**
 * @note the deadline only applies to the community badges
 */
task("getVotes", "Creates JSON with address and number of votes")
  .addFlag("genesis", "Include genesis nfts")
  .addFlag("storyboard", "Include storyboard nfts")
  .addFlag("community", "Include community SBTs")
  .addParam("deadline", "Snapshot timestamp for claiming these nfts")
  .setAction(async (taskArgs, hre) => {
    const fs = require("fs");

    const deadlineBlock = await getBlockAtTimestamp(hre, taskArgs.deadline);

    await Moralis.start({
      apiKey: process.env.MORALIS_API_KEY,
    });

    const userVotes = new Map<string, number>();

    // get community badges
    if (taskArgs.community) {
      const subgraphs = [
        "https://api.thegraph.com/subgraphs/name/voltzprotocol/main-badges-season-3-mainnet",
        "https://api.thegraph.com/subgraphs/name/voltzprotocol/main-badges-season-3-arbitrum",
      ];

      for (const subgraph of subgraphs) {
        // connect to subgraph & get badges claimed until deadline
        const client = new GraphQLClient(subgraph);
        let lastId = "";
        while (true) {
          const query = badgesQuery(lastId, taskArgs.deadline);

          const call = async () => {
            return client.request(
              gql`
                ${query}
              `
            );
          };
          const data: { badges: Badge[] } = await exponentialBackoff(call);

          if (!data.badges) throw new Error("Failed to get badges");

          data.badges.forEach((e) => {
            const owner = e.id.split("#")[0];
            userVotes.set(owner, (userVotes.get(owner) ?? 0) + 1);
          });

          if (data.badges.length !== 1000) {
            break;
          }
          const last = data.badges.at(-1);
          if (last) {
            lastId = last.id;
          } else {
            throw new Error("Something went wrong in badges parsing");
          }
        }
      }
    }

    await delay(10000);

    // get storyboard badges
    if (taskArgs.storyboard) {
      // connect to opensea api & get storyboard collection badges owners
      const tokenIds = [
        "112609494121553808227738304253835389972062342885632102145619604953982000168961",
        "112609494121553808227738304253835389972062342885632102145619604955081511796737",
        "112609494121553808227738304253835389972062342885632102145619604956181023424513",
        "112609494121553808227738304253835389972062342885632102145619604957280535052289",
        "112609494121553808227738304253835389972062342885632102145619604958380046680065",
        "112609494121553808227738304253835389972062342885632102145619604959479558307841",
        "112609494121553808227738304253835389972062342885632102145619604960579069935617",
        "112609494121553808227738304253835389972062342885632102145619604961678581563393",
        "112609494121553808227738304253835389972062342885632102145619604944086395518977",
        "112609494121553808227738304253835389972062342885632102145619604945185907146753",
        "112609494121553808227738304253835389972062342885632102145619604946285418774529",
        "112609494121553808227738304253835389972062342885632102145619604947384930402305",
        "112609494121553808227738304253835389972062342885632102145619604948484442030081",
        "112609494121553808227738304253835389972062342885632102145619604949583953657857",
        "112609494121553808227738304253835389972062342885632102145619604950683465285633",
        "112609494121553808227738304253835389972062342885632102145619604951782976913409",
        "112609494121553808227738304253835389972062342885632102145619604942986883891201",
        "112609494121553808227738304253835389972062342885632102145619604952882488541185",
      ];

      const address = "0x495f947276749ce646f68ac8c248420045cb7b5e";
      const chain = EvmChain.ETHEREUM;

      for (const tokenId of tokenIds) {
        const response = await Moralis.EvmApi.nft.getNFTTokenIdOwners({
          address,
          chain,
          tokenId,
        });
        const owner = response.result[0].ownerOf?.lowercase;
        if (owner) {
          userVotes.set(owner, userVotes.get(owner) ?? 0 + 1);
        } else {
          throw new Error(
            `Something whent wrong when fetching storyboard NFT ${tokenId}`
          );
        }

        await delay(10000);
      }

      for (const tokenId of tokenIds) {
        const response = await Moralis.EvmApi.nft.getNFTTransfers({
          address,
          chain,
          tokenId,
        });

        response.result.forEach((transfer) => {
          if (taskArgs.deadline < transfer.blockTimestamp.getTime() / 1000) {
            console.log("Recent Storyboard transfer!!");

            userVotes.set(
              transfer.fromAddress?.lowercase ?? "0",
              (userVotes.get(transfer.fromAddress?.lowercase ?? "0") ?? 0) + 1
            );
            // this can become 0 as well since balance can become negative as well
            if (userVotes.get(transfer.fromAddress?.lowercase ?? "0") === 0) {
              userVotes.delete(transfer.fromAddress?.lowercase ?? "0");
            }

            userVotes.set(
              transfer.toAddress?.lowercase ?? "0",
              (userVotes.get(transfer.toAddress?.lowercase ?? "0") ?? 0) - 1
            );
            if (userVotes.get(transfer.toAddress?.lowercase ?? "0") === 0) {
              userVotes.delete(transfer.toAddress?.lowercase ?? "0");
            }
          }
        });

        await delay(10000);
      }
    }

    await delay(10000);

    // get genesis badges
    if (taskArgs.genesis) {
      const chain = EvmChain.ETHEREUM;
      const address = "0x8C7E68e7706842BFc70053C4cED21500488e73a8";

      // connect to opensea api & get genesis collection badges owners
      let holdersCursor: string | undefined;
      while (true) {
        const response = await Moralis.EvmApi.nft.getNFTOwners({
          address,
          chain,
          format: "decimal",
          mediaItems: false,
          limit: 100,
          cursor: holdersCursor,
        });

        response.result.forEach((e) => {
          userVotes.set(
            e.ownerOf?.lowercase ?? "0",
            (userVotes.get(e.ownerOf?.lowercase ?? "0") ?? 0) + 1
          );
        });

        if (response.result.length < 100) {
          break;
        }

        holdersCursor = response.raw.cursor;

        await delay(10000);
      }

      let transfersCursor: string | undefined;
      while (true) {
        const response = await Moralis.EvmApi.nft.getNFTContractTransfers({
          address,
          chain,
          fromBlock: deadlineBlock,
          limit: 100,
          cursor: transfersCursor,
        });

        response.result.forEach((transfer) => {
          if (taskArgs.deadline < transfer.blockTimestamp.getTime() / 1000) {
            userVotes.set(
              transfer.fromAddress?.lowercase ?? "0",
              (userVotes.get(transfer.fromAddress?.lowercase ?? "0") ?? 0) + 1
            );
            // this can become 0 as well since balance can become negative as well
            if (userVotes.get(transfer.fromAddress?.lowercase ?? "0") === 0) {
              userVotes.delete(transfer.fromAddress?.lowercase ?? "0");
            }
  
            userVotes.set(
              transfer.toAddress?.lowercase ?? "0",
              (userVotes.get(transfer.toAddress?.lowercase ?? "0") ?? 0) - 1
            );
            if (userVotes.get(transfer.toAddress?.lowercase ?? "0") === 0) {
              userVotes.delete(transfer.toAddress?.lowercase ?? "0");
            }
          }
        });

        if (response.result.length < 100) {
          break;
        }

        transfersCursor = response.raw.cursor;

        await delay(10000);
      }
    }

    // output userVotes to JSON
    fs.writeFileSync(
      path.resolve(__dirname, "nftSnapshot.json"),
      JSON.stringify(Object.fromEntries(userVotes), null, 2)
    );
  });

module.exports = {};
