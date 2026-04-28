// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";
import {MockStETH} from "./MockStETH.sol";

/// @title MockWstETH
/// @notice Wraps mock stETH into mock wstETH at a fixed 1:1 demo exchange rate.
contract MockWstETH is MockERC20 {
    MockStETH public immutable stETH;

    event Wrapped(address indexed account, uint256 stETHAmount, uint256 wstETHAmount);
    event Unwrapped(address indexed account, uint256 wstETHAmount, uint256 stETHAmount);

    constructor(MockStETH stETH_) MockERC20("Mock wrapped stETH", "mwstETH", 18) {
        require(address(stETH_) != address(0), "MockWstETH: zero stETH");
        stETH = stETH_;
    }

    function wrap(uint256 stETHAmount) external returns (uint256 wstETHAmount) {
        require(stETHAmount > 0, "MockWstETH: zero amount");

        wstETHAmount = stETHAmount;
        require(
            stETH.transferFrom(msg.sender, address(this), stETHAmount),
            "MockWstETH: transfer failed"
        );
        _mint(msg.sender, wstETHAmount);

        emit Wrapped(msg.sender, stETHAmount, wstETHAmount);
    }

    function unwrap(uint256 wstETHAmount) external returns (uint256 stETHAmount) {
        require(wstETHAmount > 0, "MockWstETH: zero amount");

        stETHAmount = wstETHAmount;
        _burn(msg.sender, wstETHAmount);
        require(stETH.transfer(msg.sender, stETHAmount), "MockWstETH: transfer failed");

        emit Unwrapped(msg.sender, wstETHAmount, stETHAmount);
    }
}
