// SPDX-License-Identifier: MIT

pragma solidity =0.8.9;

import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IVault.sol";
import "../interfaces/glp/IGlpManager.sol";
import "../interfaces/glp/IRewardTracker.sol";
import "../interfaces/glp/IRewardRouter.sol";
import "../interfaces/glp/IRewardDistributor.sol";

contract GlpOracleDependencies is
    IGlpManager,
    IVault,
    IRewardTracker,
    IRewardRouter,
    IRewardDistributor
{
    uint256 _aum;
    uint256 _price;
    uint256 _tokensPerInterval;
    address _rewardToken;

    function getAum(bool maximise) public view override returns (uint256) {
        return _aum;
    }

    function setAum(uint256 aum_) public {
        _aum = aum_;
    }

    function vault() public view override returns (IVault) {
        return IVault(address(this));
    }

    function getMinPrice(address _token)
        public
        view
        override
        returns (uint256)
    {
        return _price;
    }

    function setMinPrice(uint256 price_) public {
        _price = price_;
    }

    function distributor() public view override returns (address) {
        return address(this);
    }

    function feeGlpTracker() public view override returns (address) {
        return address(this);
    }

    function glpManager() public view override returns (address) {
        return address(this);
    }

    function tokensPerInterval() public view override returns (uint256) {
        return _tokensPerInterval;
    }

    function setTokensPerInterval(uint256 tokens_) public {
        _tokensPerInterval = tokens_;
    }

    function rewardToken() public view override returns (address) {
        return _rewardToken;
    }

    function setRewardToken(address rewardToken_) public {
        _rewardToken = rewardToken_;
    }
}
