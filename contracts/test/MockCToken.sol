pragma solidity ^0.8.0;

import "../interfaces/compound/ICToken.sol";
import "../utils/WayRayMath.sol";
import "../utils/Printer.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCToken is ICToken, ERC20 {
    using WadRayMath for uint256;
    address internal _cToken;
    address internal _underlyingAsset;

    constructor(
        address cToken,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _cToken = cToken;
        _underlyingAsset = underlyingAsset;
    }

    function exchangeRateStored() override external view returns (uint) {
        return 0;
    }

}
