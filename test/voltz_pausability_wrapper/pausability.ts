import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, network } from "hardhat";
import { VAMM, VoltzPausabilityWrapper } from "../../typechain";

describe("Voltz Pausability", async () => {
  const addSigner = async (address: string): Promise<SignerWithAddress> => {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [address],
    });
    await network.provider.send("hardhat_setBalance", [
      address,
      "0x1000000000000000000",
    ]);
    return await ethers.getSigner(address);
  };

  const resetNetwork = async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          chainId: 1,
          forking: {
            jsonRpcUrl: process.env.MAINNET_URL,
            blockNumber: 16871320,
          },
        },
      ],
    });
  };

  const multisigAddress = "0xb527E950fC7c4F581160768f48b3bfA66a7dE1f0";

  describe("Voltz pausability tests", () => {
    let voltzPausability: VoltzPausabilityWrapper;

    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let multisig: SignerWithAddress;

    beforeEach(async () => {
      await resetNetwork();

      const voltzPausabilityFactory = await ethers.getContractFactory(
        "VoltzPausabilityWrapper"
      );

      voltzPausability =
        (await voltzPausabilityFactory.deploy()) as VoltzPausabilityWrapper;

      [alice, bob] = await ethers.getSigners();
      multisig = await addSigner(multisigAddress);

      await voltzPausability.connect(alice).transferOwnership(multisig.address);
    });

    it("ownership", async () => {
      expect(await voltzPausability.owner()).eq(multisig.address);
    });

    it("grantPermission", async () => {
      await expect(
        voltzPausability.connect(alice).grantPermission(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      expect(await voltzPausability.isPauser(bob.address)).to.be.eq(false);
      await voltzPausability.connect(multisig).grantPermission(bob.address);
      expect(await voltzPausability.isPauser(bob.address)).to.be.eq(true);

      await expect(
        voltzPausability.connect(multisig).grantPermission(bob.address)
      ).to.be.revertedWith("Already pauser");
    });

    it("revokePermission", async () => {
      await voltzPausability.connect(multisig).grantPermission(bob.address);
      expect(await voltzPausability.isPauser(bob.address)).to.be.eq(true);

      await expect(
        voltzPausability.connect(alice).revokePermission(bob.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");

      await voltzPausability.connect(multisig).revokePermission(bob.address);
      expect(await voltzPausability.isPauser(bob.address)).to.be.eq(false);

      await expect(
        voltzPausability.connect(multisig).revokePermission(bob.address)
      ).to.be.revertedWith("Already non-pauser");
    });

    it("pauseContracts", async () => {
      const vammIds = [
        "0xae16Bb8Fe13001b61DdB44e2cEae472D6af08755",
        "0x538E4FFeE8AEd76EfE35565c322a7B0d8cDb4CFF",
      ];

      // Set the pausability wrapper as pauser for VAMMs
      for (const vammId of vammIds) {
        const vamm = (await ethers.getContractAt("VAMM", vammId)) as VAMM;
        await vamm
          .connect(multisig)
          .changePauser(voltzPausability.address, true);
      }

      // Expect revert if Bob is not pauser
      await expect(
        voltzPausability.connect(bob).pauseContracts(vammIds)
      ).to.be.revertedWith("No privilege");

      // Make Bob pauser
      await voltzPausability.connect(multisig).grantPermission(bob.address);

      // Let Bob pause the contracts
      await voltzPausability.connect(bob).pauseContracts(vammIds);

      // Check if VAMMs are paused
      for (const vammId of vammIds) {
        const vamm = (await ethers.getContractAt("VAMM", vammId)) as VAMM;
        expect(await vamm.paused()).to.be.eq(true);
      }
    });

    it("unpauseContracts", async () => {
      const vammIds = [
        "0xae16Bb8Fe13001b61DdB44e2cEae472D6af08755",
        "0x538E4FFeE8AEd76EfE35565c322a7B0d8cDb4CFF",
      ];

      // Set the pausability wrapper as pauser for VAMMs
      for (const vammId of vammIds) {
        const vamm = (await ethers.getContractAt("VAMM", vammId)) as VAMM;
        await vamm
          .connect(multisig)
          .changePauser(voltzPausability.address, true);
      }

      // Expect revert if Bob is not pauser
      await expect(
        voltzPausability.connect(bob).unpauseContracts(vammIds)
      ).to.be.revertedWith("No privilege");

      // Make Bob pauser
      await voltzPausability.connect(multisig).grantPermission(bob.address);

      // Let Bob pause the contracts
      await voltzPausability.connect(bob).pauseContracts(vammIds);
      await voltzPausability.connect(bob).unpauseContracts(vammIds);

      // Check if VAMMs are paused
      for (const vammId of vammIds) {
        const vamm = (await ethers.getContractAt("VAMM", vammId)) as VAMM;
        expect(await vamm.paused()).to.be.eq(false);
      }
    });
  });
});
