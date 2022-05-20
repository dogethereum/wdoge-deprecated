// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;
pragma abicoder v2;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * This contract is meant to override all state mutating
 * functions of WDoge v1 to ensure they revert.
 */
contract FrozenWDoge is Initializable, ERC20Upgradeable, OwnableUpgradeable {
  function isFrozen() external pure returns (bool frozen) {
    return true;
  }

  function transferOwnership(address) public pure override {
    revert();
  }

  function approve(address, uint256) public pure override returns (bool) {
    revert();
  }

  function decreaseAllowance(address, uint256) public pure override returns (bool) {
    revert();
  }

  function increaseAllowance(address, uint256) public pure override returns (bool) {
    revert();
  }

  function renounceOwnership() public pure override {
    revert();
  }

  function transfer(address, uint256) public pure override returns (bool) {
    revert();
  }

  function transferFrom(
    address,
    address,
    uint256
  ) public pure override returns (bool) {
    revert();
  }
}
