import { expect } from "../shared/expect";
import { ethers } from "hardhat";
import { CommunityDeployer } from "../../typechain/CommunityDeployer";
import { advanceTimeAndBlock } from "../helpers/time";
import { BigNumber, Wallet } from "ethers";
import { Factory, MockGenesisNFT } from "../../typechain";
import BalanceTree from "./balance-tree";
// import CommunityDeployerJSON from '../../artifacts/contracts/deployer/CommunityDeployer.sol/CommunityDeployer.json';

/// CONSTANTS
const MASTER_VAMM_ADDRESS = "0x067232D22d5bb8DC7cDaBa5A909ac8b089539462"; // dummy value
const MASTER_MARGIN_ENGINE_ADDRESS =
  "0x067232D22d5bb8DC7cDaBa5A909ac8b089539462"; // dummy value
const QUORUM_VOTES = 1;
const ZERO_BYTES32 =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

describe("CommunityDeployer", () => {
  // below tests work under the assumption that the quorum is 1
  // in order to test with the original nft, need to fork mainnet and impersonate
  // add tests (with skip) that check the constants such as quorum, master margin engine and master vamm

  let communityDeployer: CommunityDeployer;
  let mockGenesisNFT: MockGenesisNFT;
  let wallet: Wallet, other: Wallet;

  beforeEach(async () => {
    // deploy mock genesis nft
    const mockGenesisNFTFactory = await ethers.getContractFactory(
      "MockGenesisNFT"
    );
    mockGenesisNFT = (await mockGenesisNFTFactory.deploy()) as MockGenesisNFT;
    [wallet, other] = await (ethers as any).getSigners();

    // deploy community deployer
    const communityDeployerFactory = await ethers.getContractFactory(
      "CommunityDeployer"
    );

    communityDeployer = (await communityDeployerFactory.deploy(
      MASTER_VAMM_ADDRESS,
      MASTER_MARGIN_ENGINE_ADDRESS,
      mockGenesisNFT.address,
      QUORUM_VOTES,
      wallet.address,
      ZERO_BYTES32
    )) as CommunityDeployer;
  });

  it("merkle root: returns zero merkle root", async () => {
    expect(await communityDeployer.merkleRoot()).to.eq(ZERO_BYTES32);
  });

  it("fails to cast for empty proof", async () => {
    await expect(communityDeployer.castVote(0, 1, true, [])).to.be.revertedWith(
      "invalid merkle proof"
    );
  });

  describe("two account tree", () => {
    let tree: BalanceTree;

    beforeEach("setup: two account tree", async () => {
      tree = new BalanceTree([
        { account: wallet.address, amount: BigNumber.from(100) },
        { account: other.address, amount: BigNumber.from(101) },
      ]);

      it("successful vote", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));

        await expect(
          communityDeployer.connect(wallet).castVote(0, 100, true, proof0)
        )
          .to.emit(communityDeployer, "Voted")
          .withArgs(0, wallet.address, 100);

        const proof1 = tree.getProof(0, other.address, BigNumber.from(101));

        await expect(
          communityDeployer.connect(other).castVote(1, 101, true, proof1)
        )
          .to.emit(communityDeployer, "Voted")
          .withArgs(1, other.address, 101);
      });

      it("casts the vote", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        expect(await communityDeployer.yesVoteCount()).to.eq(0);
        await communityDeployer.castVote(0, 100, true, proof0);
        expect(await communityDeployer.yesVoteCount()).to.eq(100);
      });

      it("sets hasVoted", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        expect(await communityDeployer.hasVoted(0)).to.eq(false);
        expect(await communityDeployer.hasVoted(1)).to.eq(false);
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0);
        expect(await communityDeployer.hasVoted(0)).to.eq(true);
        expect(await communityDeployer.hasVoted(1)).to.eq(false);
      });

      it("cannot allow two votes", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0);
        await expect(
          communityDeployer.connect(wallet).castVote(0, 100, true, proof0)
        ).to.be.revertedWith("duplicate vote");
      });

      it("correctly casts a yes vote", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));

        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0);

        const yesVoteCount = await communityDeployer.yesVoteCount();
        const noVoteCount = await communityDeployer.noVoteCount();

        expect(yesVoteCount).to.eq(100);
        expect(noVoteCount).to.eq(0);
      });

      it("correctly casts a no vote", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));

        await communityDeployer.connect(wallet).castVote(0, 100, false, proof0);

        const yesVoteCount = await communityDeployer.yesVoteCount();
        const noVoteCount = await communityDeployer.noVoteCount();

        expect(yesVoteCount).to.eq(0);
        expect(noVoteCount).to.eq(100);
      });

      it("fails to cast a vote once the voting period is over", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));

        await advanceTimeAndBlock(BigNumber.from(172801), 1);
        await expect(
          communityDeployer.connect(wallet).castVote(0, 100, false, proof0)
        ).to.be.revertedWith("voting period over");
      });

      it("unable to queue if voting period is not over", async () => {
        await expect(communityDeployer.queue()).to.be.revertedWith(
          "voting is ongoing"
        );
      });

      it("unable to queue if quorum is not reached", async () => {
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
        await expect(communityDeployer.queue()).to.be.revertedWith(
          "quorum not reached"
        );
      });

      it("unable to queue if no votes >= yes votes", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        const proof1 = tree.getProof(0, other.address, BigNumber.from(101));
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0);
        await communityDeployer.connect(other).castVote(1, 101, false, proof1);
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
        await expect(communityDeployer.queue()).to.be.revertedWith("no >= yes");
      });

      it("unable to deploy if not queued", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0); // true --> yes vote
        const yesVoteCount = await communityDeployer.yesVoteCount();
        expect(yesVoteCount).to.eq(100); // the quorum is reached
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
        await expect(communityDeployer.deploy()).to.be.revertedWith(
          "not queued"
        );
      });

      it("unable to deploy if timelock period is not over", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0); // true --> yes vote
        const yesVoteCount = await communityDeployer.yesVoteCount();
        expect(yesVoteCount).to.eq(100); // the quorum is reached
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
        await communityDeployer.queue();
        await expect(communityDeployer.deploy()).to.be.revertedWith(
          "timelock is ongoing"
        );
      });

      it("voltz factory is successfully deployed", async () => {
        const proof0 = tree.getProof(0, wallet.address, BigNumber.from(100));
        await communityDeployer.connect(wallet).castVote(0, 100, true, proof0); // true --> yes vote
        const yesVoteCount = await communityDeployer.yesVoteCount();
        expect(yesVoteCount).to.eq(100); // the quorum is reached
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
        await communityDeployer.queue();
        await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the timelock is over
        await communityDeployer.deploy();
        const factoryAddress = await communityDeployer.voltzFactory();
        expect(factoryAddress).to.not.eq("0");
        const factory = (await ethers.getContractAt(
          "Factory",
          factoryAddress
        )) as Factory;
        const factoryOwner = await factory.owner();
        expect(factoryOwner).to.eq(wallet.address);
        const masterMarginEngineAddress = await factory.masterMarginEngine();
        expect(masterMarginEngineAddress).to.eq(MASTER_MARGIN_ENGINE_ADDRESS);
        const masterVAMMAddress = await factory.masterVAMM();
        expect(masterVAMMAddress).to.eq(MASTER_VAMM_ADDRESS);
      });

      // other unit tests include
      // cannot vote for address other than proof
      // cannot vote more than proof
      // gas consumption test
      // larger trees
    });
  });
});
