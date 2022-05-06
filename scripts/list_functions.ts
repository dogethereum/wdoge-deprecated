import hre from "hardhat";

async function listFunctions() {
  const contracts = ["DogethereumProxy", "DogeToken"];
  for (const contract of contracts) {
    console.log(`${contract}:`);
    const dogeToken = await hre.ethers.getContractFactory(contract);
    for (const [fName, fragment] of Object.entries(dogeToken.interface.functions)) {
      const fCharacteristic = `${fName} ${fragment.stateMutability}`;
      const outputs = fragment.outputs
        ?.map(({ type, name }) => `${type} ${name ?? "_"}`)
        .join(", ");
      let fDescriptor = `  ${fCharacteristic}`;
      if (outputs !== undefined) {
        fDescriptor += ` returns (${outputs})`;
      }

      console.log(fDescriptor);
    }
    console.log();
  }
}

listFunctions()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
