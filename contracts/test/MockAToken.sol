// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../interfaces/aave/IAToken.sol";
import "../utils/WayRayMath.sol";
import "../utils/Printer.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAToken is IAToken, ERC20 {
    using WadRayMath for uint256;
    IAaveV2LendingPool internal _pool;
    address internal _underlyingAsset;

    modifier onlyLendingPool() {
        require(msg.sender == address(_pool), "CT_CALLER_MUST_BE_LENDING_POOL");
        _;
    }

    constructor(
        IAaveV2LendingPool pool,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        _pool = pool;
        _underlyingAsset = underlyingAsset;
    }

    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount)
        public
        virtual
        override(ERC20)
        returns (bool)
    {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    /**
     * @dev Calculates the balance of the user: principal balance + interest generated by the principal
     * @param user The user whose balance is calculated
     * @return The balance of the user
     **/
    function balanceOf(address user)
        public
        view
        override(ERC20)
        returns (uint256)
    {
        return
            super.balanceOf(user).rayMul(
                _pool.getReserveNormalizedIncome(_underlyingAsset)
            );
    }

    // AB: only lending pool modifier removed from the original AToken implementation
    /**
     * @dev Mints `amount` aTokens to `user`
     * - Only callable by the LendingPool, as extra state updates there need to be managed
     * @param user The address receiving the minted tokens
     * @param amount The amount of tokens getting minted
     * @param index The new liquidity index of the reserve
     * @return `true` if the the previous balance of the user was 0
     */
    function mint(
        address user,
        uint256 amount,
        uint256 index
    ) external override returns (bool) {
        uint256 previousBalance = super.balanceOf(user);

        uint256 amountScaled = amount.rayDiv(index);

        require(amountScaled != 0, "CT_INVALID_MINT_AMOUNT");
        _mint(user, amountScaled);

        emit Transfer(address(0), user, amount);

        return previousBalance == 0;
    }

    /**
     * @dev Burns aTokens from `user` and sends the equivalent amount of underlying to `receiverOfUnderlying`
     * - Only callable by the LendingPool, as extra state updates there need to be managed
     * @param user The owner of the aTokens, getting them burned
     * @param receiverOfUnderlying The address that will receive the underlying
     * @param amount The amount being burned
     * @param index The new liquidity index of the reserve
     **/
    function burn(
        address user,
        address receiverOfUnderlying,
        uint256 amount,
        uint256 index
    ) external override onlyLendingPool {
        uint256 amountScaled = amount.rayDiv(index);
        require(amountScaled != 0, "CT_INVALID_BURN_AMOUNT");
        _burn(user, amountScaled);

        // AB: changed from safeTransfer to transfer for simplicity
        IERC20Minimal(_underlyingAsset).transfer(receiverOfUnderlying, amount);

        emit Transfer(user, address(0), amount);
    }

    /**
     * @dev Returns the scaled balance of the user. The scaled balance is the sum of all the
     * updated stored balance divided by the reserve's liquidity index at the moment of the update
     * @param user The user whose balance is calculated
     * @return The scaled balance of the user
     **/
    function scaledBalanceOf(address user)
        external
        view
        override
        returns (uint256)
    {
        return super.balanceOf(user);
    }

    /**
     * @dev Returns the scaled balance of the user and the scaled total supply.
     * @param user The address of the user
     * @return The scaled balance of the user
     * @return The scaled balance and the scaled total supply
     **/
    function getScaledUserBalanceAndSupply(address user)
        external
        view
        override
        returns (uint256, uint256)
    {
        return (super.balanceOf(user), super.totalSupply());
    }

    /**
     * @dev calculates the total supply of the specific aToken
     * since the balance of every single user increases over time, the total supply
     * does that too.
     * @return the current total supply
     **/
    // AB: when add IERC20Minimal to the override: Invalid contract specified in override list: "IERC20Minimal" (investigate)
    // https://github.com/aave/protocol-v2/blob/61c2273a992f655c6d3e7d716a0c2f1b97a55a92/contracts/protocol/tokenization/AToken.sol#L248
    function totalSupply() public view override(ERC20) returns (uint256) {
        uint256 currentSupplyScaled = super.totalSupply();

        if (currentSupplyScaled == 0) {
            return 0;
        }

        return
            currentSupplyScaled.rayMul(
                _pool.getReserveNormalizedIncome(_underlyingAsset)
            );
    }

    /**
     * @dev Returns the scaled total supply of the variable debt token. Represents sum(debt/index)
     * @return the scaled total supply
     **/
    function scaledTotalSupply()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return super.totalSupply();
    }

    /**
     * @dev Returns the address of the underlying asset of this aToken (E.g. WETH for aWETH)
     **/
    function UNDERLYING_ASSET_ADDRESS() public view override returns (address) {
        return _underlyingAsset;
    }

    /**
     * @dev Returns the address of the lending pool where this aToken is used
     **/
    function POOL() public view returns (IAaveV2LendingPool) {
        return _pool;
    }

    /**
     * @dev Transfers the aTokens between two users. Validates the transfer
     * (ie checks for valid HF after the transfer) if required
     * @param from The source address
     * @param to The destination address
     * @param amount The amount getting transferred
     **/
    // AB: removed validate parameter
    function _transfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        address underlyingAsset = _underlyingAsset;
        IAaveV2LendingPool pool = _pool;

        uint256 index = pool.getReserveNormalizedIncome(underlyingAsset);

        super._transfer(from, to, amount.rayDiv(index));
    }
}
