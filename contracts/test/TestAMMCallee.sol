pragma solidity ^0.8.0;

import "../utils/SafeCast.sol";
import "../utils/TickMath.sol";
import "../interfaces/IAMM.sol";


contract TestAMMCallee {
    
    using SafeCast for uint256;

    function mint(
        address amm,
        address recipient,
        int24 tickLower,
        int24 tickUpper,
        uint128 amount
    ) external {
        IAMM(amm).mint(recipient, tickLower, tickUpper, amount, abi.encode(msg.sender));
    }

}