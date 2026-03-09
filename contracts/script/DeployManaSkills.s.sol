// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ManaSkills } from "../src/ManaSkills.sol";

/**
 * @title DeployManaSkills
 * @notice Broadcasts deployment of ManaSkills (SBT) to the configured network.
 * @dev Run with: forge script script/DeployManaSkills.s.sol --rpc-url <RPC> --broadcast
 *      Set PRIVATE_KEY in .env for the deployer; initial owner is the deployer address.
 *      The deployed address is printed to stdout and written to broadcast/<chainId>/run-latest.json.
 */
contract DeployManaSkills is Script {
    function run() external returns (ManaSkills manaSkills) {
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        address owner = deployerPrivateKey != 0 ? vm.addr(deployerPrivateKey) : msg.sender;

        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }
        manaSkills = new ManaSkills(owner);
        vm.stopBroadcast();

        console2.log("ManaSkills deployed at:", address(manaSkills));

        return manaSkills;
    }
}
