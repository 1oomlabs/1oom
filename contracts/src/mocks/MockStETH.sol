// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// @title MockStETH
/// @notice Mintable stETH-style token used by the Sepolia Lido mock flow.
contract MockStETH is MockERC20 {
    address public owner;
    mapping(address => bool) public minters;

    event OwnerTransferred(address indexed previousOwner, address indexed newOwner);
    event MinterUpdated(address indexed minter, bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "MockStETH: only owner");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "MockStETH: only minter");
        _;
    }

    constructor() MockERC20("Mock stETH", "mstETH", 18) {
        owner = msg.sender;
        emit OwnerTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "MockStETH: zero owner");

        address previousOwner = owner;
        owner = newOwner;
        emit OwnerTransferred(previousOwner, newOwner);
    }

    function setMinter(address minter, bool enabled) external onlyOwner {
        require(minter != address(0), "MockStETH: zero minter");

        minters[minter] = enabled;
        emit MinterUpdated(minter, enabled);
    }

    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
}
