import { expect } from "../shared/expect";
import { ethers } from "hardhat";
import { CommunityDeployer } from "../../typechain/CommunityDeployer";
import { advanceTimeAndBlock } from "../helpers/time";
import { BigNumber } from "ethers";

describe("CommunityDeployer", () => {

    // below tests work under the assumption that the quorum is 1
    // in order to test with the original nft, need to fork mainnet and impersonate

    let communityDeployer: CommunityDeployer;

    beforeEach(async () => {

        const communityDeployerFactory = await ethers.getContractFactory(
            "CommunityDeployer"
        );

        communityDeployer = (await communityDeployerFactory.deploy()) as CommunityDeployer;

    })

    it("correctly casts a yes vote", async () => {
        
        const tokenId = "679616669464162953633912649788656402604891550845";

        await communityDeployer.castVote(tokenId, true); // true --> yes vote

        const yesVoteCount = await communityDeployer.yesVoteCount();

        expect(yesVoteCount).to.eq(1);

    })

    it.skip("correctly casts a no vote", async () => {

        const tokenId = "679616669464162953633912649788656402604891550845";

        await communityDeployer.castVote(tokenId, false); // false --> no vote

        const noVoteCount = await communityDeployer.noVoteCount();

        expect(noVoteCount).to.eq(1);

    })

    it.skip("fails to cast a vote if does not own the genesis nft", async () => {

        const tokenId = "1348980968939277319790359517796813954796348367904";

        await expect(communityDeployer.castVote(tokenId, true)).to.be.revertedWith("only nft owner");
        await expect(communityDeployer.castVote(tokenId, false)).to.be.revertedWith("only nft owner");

    })

    it.skip("fails to cast a duplicate vote", async () => {

        const tokenId = "679616669464162953633912649788656402604891550845";

        await communityDeployer.castVote(tokenId, true); // true --> yes vote

        const yesVoteCount = await communityDeployer.yesVoteCount();

        expect(yesVoteCount).to.eq(1);

        await expect(communityDeployer.castVote(tokenId, true)).to.be.revertedWith("duplicate vote");

    })

    it.skip("fails to cast a vote once the voting period is over", async () => {
        const tokenId = "679616669464162953633912649788656402604891550845";
        await advanceTimeAndBlock(BigNumber.from(172801), 1);
        await expect(communityDeployer.castVote(tokenId, true)).to.be.revertedWith("voting period over");
    })

    // it.skip("unable to queue if voting period is not over", async () => {
    //     await expect(communityDeployer.queue()).to.be.revertedWith("voting is ongoing")
    // })

    // it.skip("unable to queue if quorum is not reached", async () => {
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
    //     await expect(communityDeployer.queue()).to.be.revertedWith("quorum is not reached");
    // })

    // it.skip("unable to queue if no votes >= yes votes", async () => {
    //     const tokenId = "679616669464162953633912649788656402604891550845";
    //     await communityDeployer.castVote(tokenId, true); // true --> yes vote
    //     const yesVoteCount = await communityDeployer.yesVoteCount();
    //     expect(yesVoteCount).to.eq(1); // the quorum is reached

    //     const anotherTokenId = "851623991281074935064194053396682782023750630549";
    //     await communityDeployer.castVote(anotherTokenId, false); // false --> no vote
    //     const noVoteCount = await communityDeployer.noVoteCount();
    //     expect(noVoteCount).to.eq(1);  // number of no votes == number of yes votes
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
    //     await expect(communityDeployer.queue()).to.be.revertedWith("no >= yes");
    // })

    
    // it.skip("unable to deploy if not queued", async () => {
    //     const tokenId = "679616669464162953633912649788656402604891550845";
    //     await communityDeployer.castVote(tokenId, true); // true --> yes vote
    //     const yesVoteCount = await communityDeployer.yesVoteCount();
    //     expect(yesVoteCount).to.eq(1); // the quorum is reached
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
    //     await expect(communityDeployer.deploy()).to.be.revertedWith("not queued");

    // })

    // it.skip("unable to deploy if timelock period is not over", async () => {
    //     const tokenId = "679616669464162953633912649788656402604891550845";
    //     await communityDeployer.castVote(tokenId, true); // true --> yes vote
    //     const yesVoteCount = await communityDeployer.yesVoteCount();
    //     expect(yesVoteCount).to.eq(1); // the quorum is reached
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
    //     await communityDeployer.queue();
    //     await expect(communityDeployer.deploy()).to.be.revertedWith("timelock is ongoing");
    // })

    // it.skip("voltz factory is successfully deployed", async () => {
    //     const tokenId = "679616669464162953633912649788656402604891550845";
    //     await communityDeployer.castVote(tokenId, true); // true --> yes vote
    //     const yesVoteCount = await communityDeployer.yesVoteCount();
    //     expect(yesVoteCount).to.eq(1); // the quorum is reached
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the voting period is over
    //     await communityDeployer.queue();
    //     await advanceTimeAndBlock(BigNumber.from(172801), 1); // make sure the timelock is over
    //     await communityDeployer.deploy();
    //     const factoryAddress = await communityDeployer.factoryAddress();
    //     expect(factoryAddress).to.not.eq("0"); // make sure this test works
    // })

})
