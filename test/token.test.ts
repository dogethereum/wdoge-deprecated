import { assert, expect } from "chai";
import type ethers from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from "hardhat";

import { deployFixture } from "../deploy";

import { expectFailure, getEvents, isolateEachTest, isolateTests } from "./utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("DogeToken", function () {
  let initialHolder: SignerWithAddress,
    recipient: SignerWithAddress,
    anotherAccount: SignerWithAddress;
  let dogeToken: ethers.Contract;

  const name = "DogeToken";
  const symbol = "DOGE";
  const decimals = "8";

  const initialSupply = 100_000_000;

  isolateTests();

  before(async function () {
    const deploy = await deployFixture(hre);
    initialHolder = deploy.dogeToken.tokenAdmin;
    dogeToken = deploy.dogeToken.contract.connect(initialHolder);
    await dogeToken.mint(initialSupply);
    const accounts = await hre.ethers.getSigners();
    recipient = accounts[3];
    anotherAccount = accounts[4];
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

  describe("total supply", function () {
    it("returns the total amount of tokens", async function () {
      expect((await dogeToken.totalSupply()).toString()).to.be.bignumber.equal(
        initialSupply.toString()
      );
    });
  });

  describe("balanceOf", function () {
    describe("when the requested account has no tokens", function () {
      it("returns zero", async function () {
        expect(
          (await dogeToken.balanceOf(anotherAccount.address)).toString()
        ).to.be.bignumber.equal("0");
      });
    });

    describe("when the requested account has some tokens", function () {
      it("returns the total amount of tokens", async function () {
        expect((await dogeToken.balanceOf(initialHolder.address)).toString()).to.be.bignumber.equal(
          initialSupply.toString()
        );
      });
    });
  });

  describe("transfer", function () {
    isolateEachTest();

    describe("when the recipient is not the zero address", function () {
      describe("when the sender does not have enough balance", function () {
        const amount = initialSupply + 1;

        it("reverts", async function () {
          await expectFailure(
            () => dogeToken.connect(initialHolder).transfer(recipient.address, amount),
            (error) => assert.include(error.message, `transfer amount exceeds balance`)
          );
        });
      });

      describe("when the sender transfers all balance", function () {
        const amount = initialSupply.toString();

        it("transfers the requested amount", async function () {
          await dogeToken.connect(initialHolder).transfer(recipient.address, amount);

          expect(
            (await dogeToken.balanceOf(initialHolder.address)).toString()
          ).to.be.bignumber.equal("0");

          expect((await dogeToken.balanceOf(recipient.address)).toString()).to.be.bignumber.equal(
            amount
          );
        });

        it("emits a transfer event", async function () {
          const tx: ethers.ContractTransaction = await dogeToken
            .connect(initialHolder)
            .transfer(recipient.address, amount);
          const { events } = await getEvents(tx, "Transfer");
          assert.lengthOf(events, 1);
          const event = events[0];
          assert.isDefined(event.args);
          assert.strictEqual(event.args!.from, initialHolder.address);
          assert.strictEqual(event.args!.to, recipient.address);
          expect(event.args!.value.toString()).to.be.a.bignumber.equal(amount);
        });
      });

      describe("when the sender transfers zero tokens", function () {
        const amount = 0;

        it("transfers the requested amount", async function () {
          await dogeToken.connect(initialHolder).transfer(recipient.address, amount);

          expect(
            (await dogeToken.balanceOf(initialHolder.address)).toString()
          ).to.be.bignumber.equal(initialSupply.toString());

          expect((await dogeToken.balanceOf(recipient.address)).toString()).to.be.bignumber.equal(
            "0"
          );
        });

        it("emits a transfer event", async function () {
          const tx: ethers.ContractTransaction = await dogeToken
            .connect(initialHolder)
            .transfer(recipient.address, amount);
          const { events } = await getEvents(tx, "Transfer");
          assert.lengthOf(events, 1);
          const event = events[0];
          assert.isDefined(event.args);
          assert.strictEqual(event.args!.from, initialHolder.address);
          assert.strictEqual(event.args!.to, recipient.address);
          expect(event.args!.value.toString()).to.be.a.bignumber.equal(amount.toString());
        });
      });
    });

    describe("when the recipient is the zero address", function () {
      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.connect(initialHolder).transfer(ZERO_ADDRESS, initialSupply),
          (error) => assert.include(error.message, `transfer to the zero address`)
        );
      });
    });
  });
});
