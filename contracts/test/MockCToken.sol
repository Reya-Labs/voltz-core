pragma solidity ^0.8.0;

import "../interfaces/compound/ICToken.sol";
import "../utils/WadRayMath.sol";
import "../utils/Printer.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockCToken is ICToken, ERC20 {
    using WadRayMath for uint256;
    address internal _cToken;
    address internal _underlyingAsset;
    uint256 internal _rate;

    constructor(
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _underlyingAsset = underlyingAsset;
    }

    function setExchangeRate(uint256 rate) external {
        _rate = rate;
    }

    function exchangeRateStored() external view override returns (uint256) {
        return _rate;
    }
}
