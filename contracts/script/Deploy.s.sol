// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketplaceRegistry} from "../src/MarketplaceRegistry.sol";

interface Vm {
    function startBroadcast() external;

    function stopBroadcast() external;
}

contract Deploy {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function deploy() public returns (MarketplaceRegistry registry) {
        registry = new MarketplaceRegistry();
    }

    function run() external returns (MarketplaceRegistry registry) {
        vm.startBroadcast();
        registry = deploy();
        vm.stopBroadcast();
    }
}
