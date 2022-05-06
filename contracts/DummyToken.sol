// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;
pragma abicoder v2;

import "./WDoge.sol";

contract DummyToken is WDoge {
  event Migration(uint256 version);

  function migrate(uint256 version) public {
    emit Migration(version);
  }

}
