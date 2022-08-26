pragma solidity ^0.8.0;

import "../interfaces/compound/ICToken.sol";
import "../utils/WadRayMath.sol";
import "../utils/Printer.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IERC20Minimal.sol";
import "../core_libraries/SafeTransferLib.sol";

contract MockCToken is ICToken, ERC20 {
    using WadRayMath for uint256;
    address internal _underlyingAsset;
    uint256 internal _rate;
    uint256 internal _supplyRatePerBlock;
    uint256 internal _borrowRatePerBlock;
    uint256 internal _borrowIndex;
    uint256 internal _accrualBlockNumber;

    using SafeTransferLib for IERC20Minimal;

    function balanceOfUnderlying(address owner) external returns (uint256) {
        return (balanceOf(owner) * exchangeRateCurrent()) / 1e18;
    }

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

    function exchangeRateCurrent() public override returns (uint256) {
        return _rate;
    }

    function exchangeRateStored() public view override returns (uint256) {
        return _rate;
    }

    function underlying() external view override returns (address) {
        return _underlyingAsset;
    }

    function redeemUnderlying(uint256 redeemAmount)
        external
        override
        returns (uint256)
    {
        uint256 yieldBearingAmount = redeemAmount.wadDiv(_rate);
        uint256 cTokenBalance = balanceOf(msg.sender);
        _burn(msg.sender, cTokenBalance);
        IERC20Minimal(address(_underlyingAsset)).safeTransfer(
            msg.sender,
            redeemAmount
        );
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

    function approveInternal(
        address owner,
        address spender,
        uint256 value
    ) public {
        _approve(owner, spender, value);
    }

    function setSupplyRatePerBlock(uint256 supplyRatePerBlock) external {
        _supplyRatePerBlock = supplyRatePerBlock;
    }

    function supplyRatePerBlock() public view override returns (uint256) {
        return _supplyRatePerBlock;
    }

    function setBorrowIndex(uint256 borrowIndex) external {
        _borrowIndex = borrowIndex;
    }

    function borrowIndex() public view override returns (uint256) {
        return _borrowIndex;
    }

    function setAccrualBlockNumber(uint256 accrualBlockNumber) external {
        _accrualBlockNumber = accrualBlockNumber;
    }

    function accrualBlockNumber() public view override returns (uint256) {
        return _accrualBlockNumber;
    }

    function setBorrowRatePerBlock(uint256 borrowRatePerBlock) external {
        _borrowRatePerBlock = borrowRatePerBlock;
    }

    function borrowRatePerBlock() public view override returns (uint256) {
        return _borrowRatePerBlock;
    }

    function borrowBalanceCurrent(address account) external override returns (uint) {
        return 0;
    }
}
