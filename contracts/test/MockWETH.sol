// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "contracts/interfaces/IWETH.sol";

contract MockWETH is IWETH {
    uint8 public decimals = 18;

    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;

    function deposit() public payable {
        balanceOf[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) public {
        require(balanceOf[msg.sender] >= amount, "WETH: Withdrawal exceeds balance");
        balanceOf[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    function totalSupply() public view returns (uint256) {
        return address(this).balance;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        return transferFrom(msg.sender, to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        returns (bool)
    {
        require(balanceOf[from] >= amount, "WETH: Insufficient balance");

        if (from != msg.sender) {
            require(allowance[from][msg.sender] >= amount, "WETH: Amount not approved");
            allowance[from][msg.sender] -= amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        return true;
    }
}