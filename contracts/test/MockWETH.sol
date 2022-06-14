// SPDX-License-Identifier: Apache-2.0

pragma solidity =0.8.9;

import "contracts/interfaces/IWETH.sol";
import "contracts/test/ERC20Mock.sol";

contract MockWETH is ERC20Mock, IWETH {
    constructor(string memory name, string memory symbol)
        payable
        ERC20Mock(name, symbol) {}

    function deposit() public override payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) public override {
        _burn(msg.sender, amount);
        payable(msg.sender).transfer(amount);
    }
}