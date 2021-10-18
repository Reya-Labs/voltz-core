import { expect } from "chai";
import { ethers } from "hardhat";

describe("Greeter", function () {
  it("Should return the new greeting once it's changed", async function () {
    const Greeter = await ethers.getContractFactory("Greeter");
    const greeter = await Greeter.deploy("Hello, world!");
    await greeter.deployed();

    expect(await greeter.greet()).to.equal("Hello, world!");

    const setGreetingTx = await greeter.setGreeting("Hola, mundo!");

    // wait until the transaction is mined
    await setGreetingTx.wait();

    expect(await greeter.greet()).to.equal("Hola, mundo!");
  });


  it("Initialise the vAMM", async function() {

    


  });

  it("Should deposit liquidity", async function() {

    const AMM = await ethers.getContractFactory("AMM");
    const amm = await AMM.deploy();
    await amm.deployed();

    const depositLiquidityTx = await amm.depositLiquidity();

    // check positions array


  });

});
