import BN from "bn.js";
import { assert, expect } from "chai";
import type ethers from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import hre from "hardhat";

import { deployFixture } from "../deploy";

import { expectFailure, getEvents, isolateEachTest, isolateTests } from "./utils";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// Note that bn.js can't parse MAX_UINT256 as a hex string.
const MAX_UINT256 = new BN(1).shln(256).subn(1);

describe("WDoge", function () {
  let initialHolder: SignerWithAddress,
    recipient: SignerWithAddress,
    anotherAccount: SignerWithAddress;
  let dogeToken: ethers.Contract;

  const name = "Wrapped Doge";
  const symbol = "WDOGE";
  const decimals = "8";

  const initialSupply = 100_000_000;

  isolateTests();
  isolateEachTest();

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
    describe("when the recipient is not the zero address", function () {
      describe("when the sender does not have enough balance", function () {
        it("reverts", async function () {
          await expectFailure(
            () => dogeToken.transfer(recipient.address, initialSupply + 1),
            (error) => assert.include(error.message, `transfer amount exceeds balance`)
          );
        });
      });

      describe("when the sender transfers all balance", function () {
        const amount = initialSupply.toString();

        it("transfers the requested amount", async function () {
          await dogeToken.transfer(recipient.address, amount);

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
          await expectTransfer(tx, initialHolder, recipient, amount);
        });
      });

      describe("when the sender transfers zero tokens", function () {
        const amount = 0;

        it("transfers the requested amount", async function () {
          await dogeToken.transfer(recipient.address, amount);

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
          await expectTransfer(tx, initialHolder, recipient, amount.toString());
        });
      });
    });

    describe("when the recipient is the zero address", function () {
      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.transfer(ZERO_ADDRESS, initialSupply),
          (error) => assert.include(error.message, `transfer to the zero address`)
        );
      });
    });
  });

  describe("transfer from", function () {
    let spender: SignerWithAddress;
    beforeEach(async function () {
      spender = recipient;
    });

    describe("when the token owner is not the zero address", function () {
      let tokenOwner: SignerWithAddress;
      beforeEach(async function () {
        tokenOwner = initialHolder;
      });

      describe("when the recipient is not the zero address", function () {
        let to: SignerWithAddress;
        beforeEach(async function () {
          to = anotherAccount;
        });

        describe("when the spender has enough allowance", function () {
          beforeEach(async function () {
            await dogeToken.approve(spender.address, initialSupply);
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply.toString();

            it("transfers the requested amount", async function () {
              await dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

              expect(
                (await dogeToken.balanceOf(tokenOwner.address)).toString()
              ).to.be.bignumber.equal("0");

              expect((await dogeToken.balanceOf(to.address)).toString()).to.be.bignumber.equal(
                amount
              );
            });

            it("decreases the spender allowance", async function () {
              await dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, amount);

              expect(
                (await dogeToken.allowance(tokenOwner.address, spender.address)).toString()
              ).to.be.bignumber.equal("0");
            });

            it("emits a transfer event", async function () {
              const tx = await dogeToken
                .connect(spender)
                .transferFrom(tokenOwner.address, to.address, amount);
              await expectTransfer(tx, tokenOwner, to, amount);
            });

            it("emits an approval event", async function () {
              const tx = await dogeToken
                .connect(spender)
                .transferFrom(tokenOwner.address, to.address, amount);
              const allowance = (
                await dogeToken.allowance(tokenOwner.address, spender.address)
              ).toString();
              await expectApproval(tx, tokenOwner, spender, allowance);
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = initialSupply;

            beforeEach("reducing balance", async function () {
              await dogeToken.transfer(to.address, 1);
            });

            it("reverts", async function () {
              await expectFailure(
                () =>
                  dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, amount),
                (error) => assert.include(error.message, `transfer amount exceeds balance`)
              );
            });
          });
        });

        describe("when the spender does not have enough allowance", function () {
          const allowance = initialSupply - 1;

          beforeEach(async function () {
            await dogeToken.approve(spender.address, allowance);
          });

          describe("when the token owner has enough balance", function () {
            const amount = initialSupply;

            it("reverts", async function () {
              await expectFailure(
                () =>
                  dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, amount),
                (error) => assert.include(error.message, `insufficient allowance`)
              );
            });
          });

          describe("when the token owner does not have enough balance", function () {
            const amount = allowance;

            beforeEach("reducing balance", async function () {
              await dogeToken.transfer(to.address, 2);
            });

            it("reverts", async function () {
              await expectFailure(
                () =>
                  dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, amount),
                (error) => assert.include(error.message, `transfer amount exceeds balance`)
              );
            });
          });
        });

        describe("when the spender has unlimited allowance", function () {
          beforeEach(async function () {
            await dogeToken.approve(spender.address, MAX_UINT256.toString());
          });

          it("does not decrease the spender allowance", async function () {
            await dogeToken.connect(spender).transferFrom(tokenOwner.address, to.address, 1);

            const allowance = (
              await dogeToken.allowance(tokenOwner.address, spender.address)
            ).toString();
            expect(allowance).to.be.bignumber.equal(MAX_UINT256);
          });

          it("does not emit an approval event", async function () {
            const tx: ethers.ContractTransaction = await dogeToken
              .connect(spender)
              .transferFrom(tokenOwner.address, to.address, 1);
            await expectNoApproval(tx);
          });
        });
      });

      describe("when the recipient is the zero address", function () {
        const amount = initialSupply;
        const to = ZERO_ADDRESS;

        beforeEach(async function () {
          await dogeToken.approve(spender.address, amount);
        });

        it("reverts", async function () {
          await expectFailure(
            () => dogeToken.connect(spender).transferFrom(tokenOwner.address, to, amount),
            (error) => assert.include(error.message, `transfer to the zero address`)
          );
        });
      });
    });

    describe("when the token owner is the zero address", function () {
      const amount = 0;
      const tokenOwner = ZERO_ADDRESS;

      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.connect(spender).transferFrom(tokenOwner, recipient.address, amount),
          (error) => assert.include(error.message, "from the zero address")
        );
      });
    });
  });

  describe("approve", function () {
    describe("when the spender is not the zero address", function () {
      describe("when the sender has enough balance", function () {
        it("emits an approval event", async function () {
          const tx = await dogeToken.approve(recipient.address, initialSupply);
          await expectApproval(tx, initialHolder, recipient, initialSupply.toString());
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await dogeToken.approve(recipient.address, initialSupply);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(initialSupply.toString());
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await dogeToken.approve(recipient.address, 1);
          });

          it("approves the requested amount and replaces the previous one", async function () {
            await dogeToken.approve(recipient.address, initialSupply);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(initialSupply.toString());
          });
        });
      });

      describe("when the sender does not have enough balance", function () {
        const amount = (initialSupply + 1).toString();

        it("emits an approval event", async function () {
          const tx = await dogeToken.approve(recipient.address, amount);
          expectApproval(tx, initialHolder, recipient, amount.toString());
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await dogeToken.approve(recipient.address, amount);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await dogeToken.approve(recipient.address, 1);
          });

          it("approves the requested amount and replaces the previous one", async function () {
            await dogeToken.approve(recipient.address, amount);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(amount);
          });
        });
      });
    });

    describe("when the spender is the zero address", function () {
      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.approve(ZERO_ADDRESS, initialSupply),
          (error) => assert.include(error.message, `approve to the zero address`)
        );
      });
    });
  });

  describe("decrease allowance", function () {
    describe("when the spender is not the zero address", function () {
      function shouldDecreaseApproval(amount: number) {
        describe("when there was no approved amount before", function () {
          it("reverts", async function () {
            await expectFailure(
              () => dogeToken.decreaseAllowance(recipient.address, amount),
              (error) => assert.include(error.message, "ERC20: decreased allowance below zero")
            );
          });
        });

        describe("when the spender had an approved amount", function () {
          const approvedAmount = amount;

          beforeEach(async function () {
            await dogeToken.approve(recipient.address, approvedAmount);
          });

          it("emits an approval event", async function () {
            const tx = await dogeToken.decreaseAllowance(recipient.address, approvedAmount);
            expectApproval(tx, initialHolder, recipient, "0");
          });

          it("decreases the spender allowance subtracting the requested amount", async function () {
            await dogeToken.decreaseAllowance(recipient.address, approvedAmount - 1);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal("1");
          });

          it("sets the allowance to zero when all allowance is removed", async function () {
            await dogeToken.decreaseAllowance(recipient.address, approvedAmount);
            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal("0");
          });

          it("reverts when more than the full allowance is removed", async function () {
            await expectFailure(
              () => dogeToken.decreaseAllowance(recipient.address, approvedAmount + 1),
              (error) => assert.include(error.message, "ERC20: decreased allowance below zero")
            );
          });
        });
      }

      describe("when the sender has enough balance", function () {
        shouldDecreaseApproval(initialSupply);
      });

      describe("when the sender does not have enough balance", function () {
        shouldDecreaseApproval(initialSupply + 1);
      });
    });

    describe("when the spender is the zero address", function () {
      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.decreaseAllowance(ZERO_ADDRESS, initialSupply),
          (error) => assert.include(error.message, "ERC20: decreased allowance below zero")
        );
      });
    });
  });

  describe("increase allowance", function () {
    describe("when the spender is not the zero address", function () {
      describe("when the sender has enough balance", function () {
        it("emits an approval event", async function () {
          const tx = await dogeToken.increaseAllowance(recipient.address, initialSupply);
          expectApproval(tx, initialHolder, recipient, initialSupply.toString());
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await dogeToken.increaseAllowance(recipient.address, initialSupply);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(initialSupply.toString());
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await dogeToken.approve(recipient.address, 1);
          });

          it("increases the spender allowance adding the requested amount", async function () {
            await dogeToken.increaseAllowance(recipient.address, initialSupply);

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal((initialSupply + 1).toString());
          });
        });
      });

      describe("when the sender does not have enough balance", function () {
        const amount = new BN(initialSupply + 1);

        it("emits an approval event", async function () {
          const tx = await dogeToken.increaseAllowance(recipient.address, amount.toString());
          expectApproval(tx, initialHolder, recipient, amount.toString());
        });

        describe("when there was no approved amount before", function () {
          it("approves the requested amount", async function () {
            await dogeToken.increaseAllowance(recipient.address, amount.toString());

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(amount);
          });
        });

        describe("when the spender had an approved amount", function () {
          beforeEach(async function () {
            await dogeToken.approve(recipient.address, 1);
          });

          it("increases the spender allowance adding the requested amount", async function () {
            await dogeToken.increaseAllowance(recipient.address, amount.toString());

            expect(
              (await dogeToken.allowance(initialHolder.address, recipient.address)).toString()
            ).to.be.bignumber.equal(amount.addn(1));
          });
        });
      });
    });

    describe("when the spender is the zero address", function () {
      it("reverts", async function () {
        await expectFailure(
          () => dogeToken.increaseAllowance(ZERO_ADDRESS, initialSupply),
          (error) => assert.include(error.message, "ERC20: approve to the zero address")
        );
      });
    });
  });

  describe("mint", function () {
    const amount = 50;

    describe("for a non zero account", function () {
      let receipt: ethers.ContractTransaction;
      beforeEach("minting", async function () {
        receipt = await dogeToken.mint(amount);
      });

      it("increments totalSupply", async function () {
        const expectedSupply = (initialSupply + amount).toString();
        expect((await dogeToken.totalSupply()).toString()).to.be.bignumber.equal(expectedSupply);
      });

      it("fails when exceeding 10M totalSupply", async function () {
        const expectedSupply = (initialSupply + amount).toString();
        const tenMillion = (new BN(10)).pow(new BN(15)).toString();
        await expectFailure(() => dogeToken.mint(tenMillion), (error) => {
          assert.include(error.message, "MintLimitExceeded()");
        });
      });

      it("increments recipient balance", async function () {
        const tokenAdmin = dogeToken.owner();
        const expectedBalance = (initialSupply + amount).toString();
        expect((await dogeToken.balanceOf(tokenAdmin)).toString()).to.be.bignumber.equal(
          expectedBalance
        );
      });

      it("emits Transfer event", async function () {
        expectTransfer(receipt, ZERO_ADDRESS, recipient, amount.toString());
      });
    });
  });

  describe("burn", function () {
    it("rejects burning more than balance", async function () {
      await expectFailure(
        () => dogeToken.burn(initialSupply + 1),
        (error) => assert.include(error.message, "ERC20: burn amount exceeds balance")
      );
    });

    const describeBurn = function (description: string, amount: number) {
      describe(description, function () {
        let receipt: ethers.ContractTransaction;
        beforeEach("burning", async function () {
          receipt = await dogeToken.burn(amount);
        });

        it("decrements totalSupply", async function () {
          const expectedSupply = (initialSupply - amount).toString();
          expect((await dogeToken.totalSupply()).toString()).to.be.bignumber.equal(expectedSupply);
        });

        it("decrements initialHolder balance", async function () {
          const expectedBalance = (initialSupply - amount).toString();
          expect(
            (await dogeToken.balanceOf(initialHolder.address)).toString()
          ).to.be.bignumber.equal(expectedBalance);
        });

        it("emits Transfer event", async function () {
          expectTransfer(receipt, initialHolder, ZERO_ADDRESS, amount.toString());
        });
      });
    };

    describeBurn("for entire balance", initialSupply);
    describeBurn("for less amount than balance", initialSupply - 1);
  });

  describe("getVersion", function() {
    it("returns 1", async function() {
      const version = await dogeToken.getVersion();
      assert.equal(version, 1);
    });
  });
});

describe("WDoge initialize function", function () {
  isolateTests();

  it("initialize doesn't work in logic contract", async function () {
    const tokenFactory = await hre.ethers.getContractFactory("WDoge");
    const token = await tokenFactory.deploy();
    const validAddress = await tokenFactory.signer.getAddress();
    await expectFailure(
      () => token.initialize(validAddress),
      (error) => {
        assert.include(error.message, "Initializable: contract is already initialized");
      }
    );
  });
});

async function expectTransfer(
  tx: ethers.ContractTransaction,
  from: SignerWithAddress | string,
  to: SignerWithAddress | string,
  amount: string
): Promise<void> {
  if (typeof from !== "string") {
    from = from.address;
  }
  if (typeof to !== "string") {
    to = to.address;
  }

  const { events } = await getEvents(tx, "Transfer");
  assert.lengthOf(events, 1);
  const event = events[0];
  assert.isDefined(event.args);
  assert.strictEqual(event.args!.from, from);
  assert.strictEqual(event.args!.to, to);
  expect(event.args!.value.toString()).to.be.a.bignumber.equal(amount);
}

async function expectApproval(
  tx: ethers.ContractTransaction,
  owner: SignerWithAddress,
  spender: SignerWithAddress,
  amount: string
): Promise<void> {
  const { events } = await getEvents(tx, "Approval");
  assert.lengthOf(events, 1);
  const event = events[0];
  assert.isDefined(event.args);
  assert.strictEqual(event.args!.owner, owner.address);
  assert.strictEqual(event.args!.spender, spender.address);
  expect(event.args!.value.toString()).to.be.a.bignumber.equal(amount);
}

async function expectNoApproval(tx: ethers.ContractTransaction): Promise<void> {
  const { events } = await getEvents(tx, "Approval");
  assert.lengthOf(events, 0);
}
