# aDAI, aUSDC, cDAI order
# termEndTimestamp_pools = 1659423600

currentBlockTimestamp=$(npx hardhat queryCurrentBlockTimestamp)

if [ $currentBlockTimestamp -le 1659423600 ]
then 
    # Rate oracle entries are made here
    for rateOracle in 0x65F5139977C608C6C2640c088D7fD07fA17A0614 0x65F5139977C608C6C2640c088D7fD07fA17A0614 0x919674d599D8df8dd9E7Ebaabfc2881089C5D91C
    do 
        npx hardhat writeRateOracle --rate-oracle $rateOracle
        echo "Rate oracle write entry made for address $rateOracle"
    done
else
    echo "The pools have not reached their term end date and time, yet."
fi

# currentBlockTimestamp=$(npx hardhat queryCurrentBlockTimestamp)

# if [ $currentBlockTimestamp -ge 1659423600 ]
# then 
#     for i in 0x65F5139977C608C6C2640c088D7fD07fA17A0614 0x65F5139977C608C6C2640c088D7fD07fA17A0614 0x919674d599D8df8dd9E7Ebaabfc2881089C5D91C
#     do 
#         echo "Printing addresses $i"
#         echo "Rate oracle write entry made for address $i"
#     done
# else
#     echo "The pools have not reached their term end date and time, yet."
# fi







