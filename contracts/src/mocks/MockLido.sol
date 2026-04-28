// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockStETH} from "./MockStETH.sol";

/// @title MockLido
/// @notice Minimal Lido-compatible submit surface for Sepolia demos.
contract MockLido {
    MockStETH public immutable stETH;

    event Submitted(
        address indexed sender, address indexed referral, uint256 ethAmount, uint256 stETHAmount
    );

    constructor(MockStETH stETH_) {
        require(address(stETH_) != address(0), "MockLido: zero stETH");
        stETH = stETH_;
    }

    /// @notice Mints mock stETH 1:1 for received ETH.
    /// @param referral Lido-compatible referral address, unused by the mock.
    /// @return mintedAmount Amount of mock stETH minted to msg.sender.
    function submit(address referral) external payable returns (uint256 mintedAmount) {
        require(msg.value > 0, "MockLido: zero value");

        mintedAmount = msg.value;
        stETH.mint(msg.sender, mintedAmount);

        emit Submitted(msg.sender, referral, msg.value, mintedAmount);
    }
}
