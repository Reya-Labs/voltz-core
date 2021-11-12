pragma solidity ^0.8.0;
import "./interfaces/IVoltzMarginPricer.sol";

/**
 * @author Voltz Team
 * @title Margin Calculator Oracle Module
 * @notice The Oracle module sets, retrieves, and stores [x] for underlying, collateral, and strike assets
 * manages [pricers] that are used for different underlying pools
 * todo: think about disputer, oracle migration
 * todo: most functions can only be done by an owner
 * todo: use a different word instead of Pricer
 * todo: locking period?
 */

    
contract MarginOracle {

    /// @dev mapping between an underlying pool and its apy upper pricer
    mapping(address => address) internal underlyingPoolApyUpperPricer; // this is a pricer

    /// @dev mapping between an underlying pool and its apy lower pricer
    mapping(address => address) internal underlyingPoolApyLowerPricer;

    /// @notice emits an event when the pricer is updated for an underlyingPool
    event PricerUpdated(address indexed underlyingPool, address indexed pricer, bool indexed isLower);

    /// @dev mapping between underlyingPool, isLower, and the ConfidenceBound
    mapping(address => mapping(bool => ConfidenceBound)) internal storedConfidenceBound;

    event ConfidenceBoundUpdated(
        address indexed underlyingPool,
        bool indexed isLower,
        uint256 confidenceBound,
        uint256 onchainTimestamp
    );
   
   /// @dev structure that stores the confidence bound of an underlying pool and timestamp when the confidence bound was stored
    struct ConfidenceBound {
        uint256 confidenceBound;
        bool isLower;
        uint256 timestamp; // timestamp at which the price is pushed to this oracle
    }
    
    // set the pricer
    function setConfidenceBoundPricer(address _underlyingPool, address _pricer, bool isLower) external {
        require(_pricer != address(0), "Oracle: cannot set pricer to address(0)");

        if (isLower) {
            underlyingPoolApyLowerPricer[_underlyingPool] = _pricer;
        } else {
            underlyingPoolApyUpperPricer[_underlyingPool] = _pricer;
        }

        emit PricerUpdated(_underlyingPool, _pricer, isLower);
    }


    /**
     * @notice get a live apyUpper/apyLower from the asset's confidence bound contract
     * @param _underlyingPool asset address
     * @return result scaled by 1e18?
     */
    function getConfidenceBound(address _underlyingPool, bool isLower) external view returns (uint256 result) {
        
        if (isLower) {
            require(underlyingPoolApyLowerPricer[_underlyingPool] != address(0), "Oracle: Pricer for this underlying pool not set");
            result = IVoltzMarginPricer(underlyingPoolApyLowerPricer[_underlyingPool]).getConfidenceBound(isLower);
        } else {
            require(underlyingPoolApyLowerPricer[_underlyingPool] != address(0), "Oracle: Pricer for this underlying pool not set");
            result = IVoltzMarginPricer(underlyingPoolApyLowerPricer[_underlyingPool]).getConfidenceBound(isLower);
        }
    
    }

    
    
    // function getPricer(address _underlyingPool, bool isLower) external view returns (address result) {
        
    //     if (isLower) {
    //         require(underlyingPoolApyLowerPricer[_underlyingPool] != address(0), "Oracle: Pricer for this underlying pool not set");
    //         result = underlyingPoolApyLowerPricer[_underlyingPool];
    //     } else {
    //         require(underlyingPoolApyLowerPricer[_underlyingPool] != address(0), "Oracle: Pricer for this underlying pool not set");
    //         result = underlyingPoolApyLowerPricer[_underlyingPool];
    //     }
    // }


    /**
     * @notice submits the confidence bound to the oracle, can only be set from the pricer
     * @param _underlyingPool underlying pool address
     * @param _confidenceBound confidenceBound
     */
    function setConfidenceBound(
        address _underlyingPool,
        uint256 _confidenceBound,
        bool isLower
    ) external {

        if (isLower) {
            require(msg.sender == underlyingPoolApyLowerPricer[_underlyingPool], "Oracle: caller is not authorized to set confidence bound");
        } else {
            require(msg.sender == underlyingPoolApyUpperPricer[_underlyingPool], "Oracle: caller is not authorized to set confidence bound");
        }

        storedConfidenceBound[_underlyingPool][isLower] = ConfidenceBound(_confidenceBound, isLower, block.timestamp);

        emit ConfidenceBoundUpdated(_underlyingPool, isLower, _confidenceBound, block.timestamp);

    }


    /**
     * @notice get the pricer for an underlying pool
     * @param _underlyingPool underlying pool address
     * @return pricer address
     */
     // todo: add require statements
    function getPricer(address _underlyingPool, bool isLower) external view returns (address pricer) {
        if (isLower) {
            pricer = underlyingPoolApyLowerPricer[_underlyingPool];
        } else {
            pricer = underlyingPoolApyUpperPricer[_underlyingPool];
        }
    }
       
}