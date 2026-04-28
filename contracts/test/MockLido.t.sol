// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockLido} from "../src/mocks/MockLido.sol";
import {MockStETH} from "../src/mocks/MockStETH.sol";
import {MockWstETH} from "../src/mocks/MockWstETH.sol";

contract MockLidoTest {
    MockStETH private stETH;
    MockWstETH private wstETH;
    MockLido private lido;

    receive() external payable {}

    function setUp() public {
        stETH = new MockStETH();
        wstETH = new MockWstETH(stETH);
        lido = new MockLido(stETH);
        stETH.setMinter(address(lido), true);
    }

    function testSubmitMintsStETHOneToOne() public {
        uint256 amount = 1 ether;

        uint256 minted = lido.submit{value: amount}(address(0));

        require(minted == amount, "minted amount mismatch");
        require(stETH.balanceOf(address(this)) == amount, "stETH balance mismatch");
        require(stETH.totalSupply() == amount, "stETH supply mismatch");
    }

    function testWrapConvertsStETHToWstETHOneToOne() public {
        uint256 amount = 2 ether;

        lido.submit{value: amount}(address(0));
        require(stETH.approve(address(wstETH), amount), "approve failed");

        uint256 wrapped = wstETH.wrap(amount);

        require(wrapped == amount, "wrapped amount mismatch");
        require(stETH.balanceOf(address(this)) == 0, "stETH sender balance mismatch");
        require(stETH.balanceOf(address(wstETH)) == amount, "stETH custody mismatch");
        require(wstETH.balanceOf(address(this)) == amount, "wstETH balance mismatch");
        require(wstETH.totalSupply() == amount, "wstETH supply mismatch");
    }

    function testUnwrapReturnsStETHOneToOne() public {
        uint256 amount = 3 ether;

        lido.submit{value: amount}(address(0));
        stETH.approve(address(wstETH), amount);
        wstETH.wrap(amount);

        uint256 unwrapped = wstETH.unwrap(amount);

        require(unwrapped == amount, "unwrapped amount mismatch");
        require(stETH.balanceOf(address(this)) == amount, "stETH balance mismatch");
        require(stETH.balanceOf(address(wstETH)) == 0, "stETH custody mismatch");
        require(wstETH.balanceOf(address(this)) == 0, "wstETH balance mismatch");
        require(wstETH.totalSupply() == 0, "wstETH supply mismatch");
    }

    function testConfiguredMinterCanMintStETH() public {
        stETH.setMinter(address(this), true);

        stETH.mint(address(this), 1 ether);

        require(stETH.balanceOf(address(this)) == 1 ether, "configured minter did not mint");
    }

    function testSubmitRejectsZeroValue() public {
        try lido.submit{value: 0}(address(0)) returns (uint256) {
            revert("expected zero submit revert");
        } catch {}
    }

    function testWrapRequiresApproval() public {
        uint256 amount = 1 ether;

        lido.submit{value: amount}(address(0));

        try wstETH.wrap(amount) returns (uint256) {
            revert("expected missing approval revert");
        } catch {}
    }

    function testUnsetMinterCannotMint() public {
        stETH.setMinter(address(lido), false);

        try lido.submit{value: 1 ether}(address(0)) returns (uint256) {
            revert("expected unset minter revert");
        } catch {}
    }
}
