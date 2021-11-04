pragma solidity ^0.8.0;

import "./interfaces/IAaveRateOracle.sol";
import "./interfaces/underlyingPool/IAaveLendingPool.sol";
// import {ILendingPool} from "@aave/protocol-v2/contracts/interfaces/ILendingPool.sol";
// import "@aave/protocol-v2/contracts/protocol/libraries/math/WadRayMath.sol";
import "./utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol"; //


// todo: fixed point math
contract AaveRateOracle is IAaveRateOracle {

    using SafeMath for uint256; // todo: remove and do fpm

    IAaveLendingPool public override lendingPool;
    mapping(address => mapping(uint256 => Rate)) public override rates;

    address constant aaveLendingPoolAddress = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9; // mainnet


    constructor() public {
        lendingPool = IAaveLendingPool(aaveLendingPoolAddress);
    }

    
    function updateRate(address underlying) public override {
        // note that getReserveNormalizedIncome() from aave returns an index,
        // where the value 10**27 indicates zero interest
        uint256 res = lendingPool.getReserveNormalizedIncome(underlying);
        require(res != 0, "Oracle only supports active Aave-V2 assets");
        
        rates[underlying][block.timestamp] = Rate(true, block.timestamp, res);
        
        // emit RateUpdate(
        //     underlying,
        //     block.timestamp,
        //     rates[underlying][block.timestamp].rateValue,
        //     msg.sender
        // );
    }


    function getRateAtTimestamp(address underlying, uint256 timestamp)
        public override
        returns (uint256)
    {
        Rate memory rate = rates[underlying][timestamp];
        require(rate.isSet, "Oracle does not have a rate");
        return rate.rateValue.sub(10**27);
    }

    
    function getRateFromTo(
        address underlying,
        uint256 from,
        uint256 to
    ) public override returns (uint256) {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, i.e. index 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25
        Rate memory rateFrom = rates[underlying][from];
        Rate memory rateTo = rates[underlying][to];
        require(rateFrom.isSet, "Oracle does not have rateFrom");
        require(rateTo.isSet, "Oracle doesn not have rateTo");
        return
            WadRayMath.rayDiv(rateTo.rateValue, rateFrom.rateValue).sub(
                10**27
            );
    }
}