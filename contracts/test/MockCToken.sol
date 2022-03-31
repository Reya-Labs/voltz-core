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

    function redeemUnderlying(uint256 redeemAmount)
        external
        override
        returns (uint256)
    {
        return 0;
    }

    // https://github.com/compound-finance/compound-protocol/blob/master/contracts/CErc20.sol#L42
    /**
     * @dev Mints `amount` cTokens to `user`
     * @param user The address receiving the minted tokens
     * @param amount The amount of tokens getting minted
     * @return `true` if the the previous balance of the user was 0
     */
    function mint(address user, uint256 amount) external returns (bool) {
        uint256 previousBalance = super.balanceOf(user);

        require(amount != 0, "CT_INVALID_MINT_AMOUNT");
        _mint(user, amount);

        emit Transfer(address(0), user, amount);

        return previousBalance == 0;
    }
}
