// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockERC20
/// @notice Minimal ERC20 implementation for local/Sepolia demo mocks.
/// @dev This contract is intentionally dependency-free so the Foundry project
///      does not need OpenZeppelin or forge-std installs for the mock phase.
contract MockERC20 {
    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory tokenName, string memory tokenSymbol, uint8 tokenDecimals) {
        name = tokenName;
        symbol = tokenSymbol;
        decimals = tokenDecimals;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 currentAllowance = allowance[from][msg.sender];
        require(currentAllowance >= value, "ERC20: insufficient allowance");

        unchecked {
            allowance[from][msg.sender] = currentAllowance - value;
        }

        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "ERC20: transfer to zero address");

        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: insufficient balance");

        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "ERC20: mint to zero address");

        totalSupply += value;
        balanceOf[to] += value;

        emit Transfer(address(0), to, value);
    }

    function _burn(address from, uint256 value) internal {
        uint256 fromBalance = balanceOf[from];
        require(fromBalance >= value, "ERC20: burn exceeds balance");

        unchecked {
            balanceOf[from] = fromBalance - value;
            totalSupply -= value;
        }

        emit Transfer(from, address(0), value);
    }
}
