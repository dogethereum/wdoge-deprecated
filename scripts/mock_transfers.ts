import hre from "hardhat";
import { deployFixture } from "../deploy";

async function mockTransfers() {
  const deployment = await deployFixture(hre);

  // dogecoin has 8 decimals so 10^15 units = 10^7 wDoges
  const totalSupply = hre.ethers.BigNumber.from(10).pow(15);
  const wDoge = deployment.wDoge.contract.connect(deployment.wDoge.tokenAdmin);
  await wDoge.mint(totalSupply);

  const accounts = await hre.ethers.getSigners();
  const userA = accounts[3];
  const userB = accounts[4];
  const fiftyDoges = 5e9;
  await wDoge.transfer(userA.address, fiftyDoges);
  await wDoge.transfer(userB.address, fiftyDoges);
  await wDoge.burn(fiftyDoges * 2);
}

mockTransfers()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
