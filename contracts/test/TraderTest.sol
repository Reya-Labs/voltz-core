// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import "../core_libraries/Trader.sol";

// contract TraderTest {
//     Trader.Info public traders;
//     using Trader for Trader.Info;

//     function updateMargin(int256 marginDelta) public {
//         traders.updateMargin(marginDelta);
//     }

//     function updateBalances(int256 fixedTokenBalanceDelta, int256 variableTokenBalanceDelta) public {
//         traders.updateBalances(fixedTokenBalanceDelta, variableTokenBalanceDelta);
//     }
// }

contract TraderTest {
    Trader.Info public trader;
    // using Trader for mapping(bytes32 => Trader.Info);
    using Trader for Trader.Info;

    // mapping(bytes32 => Trader.Info) public traders;

    function updateMargin(int256 marginDelta) public {
        trader.updateMargin(marginDelta);
    }

    function updateBalances(
        int256 fixedTokenBalanceDelta,
        int256 variableTokenBalanceDelta
    ) public {
        trader.updateBalances(
            fixedTokenBalanceDelta,
            variableTokenBalanceDelta
        );
    }

    // function setTrader(address traderAddress, int256 margin, int256 fixedTokenBalance, int256 variableTokenBalance, bool isSettled) external {
    //     Trader.Info memory trader = Trader.Info({
    //         margin: margin,
    //         fixedTokenBalance: fixedTokenBalance,
    //         variableTokenBalance: variableTokenBalance,
    //         isSettled: isSettled
    //     });

    //     bytes32 traderKey = keccak256(abi.encodePacked(traderAddress));
    //     traders[traderKey] = trader;
    // }

    // function get(address owner) public view returns(Trader.Info memory traders){
    //     return trader.get(owner);
    // }

    //     function updateMargin(address traderAddress, int256 marginDelta) public {
    //         Trader.Info storage trader = traders.get(traderAddress);
    //         trader.updateMargin(marginDelta);
    //     }

    //     function updateBalances(address traderAddress, int256 fixedTokenBalanceDelta, int256 variableTokenBalanceDelta) public {
    //         Trader.Info storage trader = traders.get(traderAddress);
    //         trader.updateBalances(fixedTokenBalanceDelta, variableTokenBalanceDelta);
    //     }
}
