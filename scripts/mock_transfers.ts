import hre from "hardhat";
import { deployFixture } from "../deploy";

async function mockTransfers() {
  const deployment = await deployFixture(hre);

  // dogecoin has 8 decimals so 10^15 units = 10^7 dogetokens
  const totalSupply = hre.ethers.BigNumber.from(10).pow(15);
  const dogeToken = deployment.dogeToken.contract.connect(deployment.dogeToken.tokenAdmin);
  await dogeToken.mint(totalSupply);

  const accounts = await hre.ethers.getSigners();
  const userA = accounts[3];
  const userB = accounts[4];
  const fiftyDoges = 5e9;
  await dogeToken.transfer(userA.address, fiftyDoges);
  await dogeToken.transfer(userB.address, fiftyDoges);
  await dogeToken.burn(fiftyDoges * 2);
}

mockTransfers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
