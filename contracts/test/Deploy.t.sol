// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Deploy} from "../script/Deploy.s.sol";
import {MarketplaceRegistry} from "../src/MarketplaceRegistry.sol";

contract DeployTest {
    Deploy private deployScript;

    function setUp() public {
        deployScript = new Deploy();
    }

    function testDeployCreatesRegistryWithTestContractAsCurator() public {
        MarketplaceRegistry registry = deployScript.deploy();

        require(address(registry) != address(0), "registry not deployed");
        require(registry.curator() == address(deployScript), "curator should be deploy script");
    }
}
