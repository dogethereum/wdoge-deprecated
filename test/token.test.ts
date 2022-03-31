import { expect } from "chai";
import type ethers from "ethers";
import hre from "hardhat";

import { deployFixture } from "../deploy";

import { isolateTests } from "./utils";


describe("DogeToken", function () {
  let initialHolder: string, recipient: string, anotherAccount: string;
  let dogeToken: ethers.Contract;

  const name = "DogeToken";
  const symbol = "DOGE";
  const decimals = "8";

  const initialSupply = 100_000_000;

  isolateTests();

  before(async function () {
    const deploy = await deployFixture(hre);
    dogeToken = deploy.dogeToken.contract;
  });

  it(`has ${name} name`, async function () {
    expect(await dogeToken.name()).to.equal(name);
  });

  it(`has ${symbol} symbol`, async function () {
    expect(await dogeToken.symbol()).to.equal(symbol);
  });

  it(`has ${decimals} decimals`, async function () {
    expect((await dogeToken.decimals()).toString()).to.be.bignumber.equal(decimals);
  });
});
