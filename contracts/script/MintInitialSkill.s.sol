// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ManaSkills } from "../src/ManaSkills.sol";

/**
 * @title MintInitialSkill
 * @notice Mints an initial Agriculture (Basic, Realm Material, 10 mana cycles) skill token to a test address.
 * @dev Run against a deployed ManaSkills contract. Owner must be the broadcaster.
 *      Usage:
 *        1. Deploy ManaSkills: forge script script/DeployManaSkills.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 *        2. Set MANA_SKILLS_ADDRESS in .env to the deployed contract address.
 *        3. forge script script/MintInitialSkill.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
 *      Anvil default account (0xf39Fd...) is used as recipient; use PRIVATE_KEY for the contract owner (deployer).
 */
contract MintInitialSkill is Script {
    address internal constant ANVIL_DEFAULT_RECIPIENT = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    function run() external {
        address contractAddress = vm.envAddress("MANA_SKILLS_ADDRESS");
        uint256 ownerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));

        if (ownerPrivateKey == 0) {
            revert("MintInitialSkill: set PRIVATE_KEY (owner) in .env");
        }

        vm.startBroadcast(ownerPrivateKey);
        ManaSkills manaSkills = ManaSkills(contractAddress);
        uint256 tokenId = manaSkills.mintSkill(
            ANVIL_DEFAULT_RECIPIENT,
            "Agriculture",
            ManaSkills.ProficiencyLevel.Basic, // Level 1
            ManaSkills.Realm.Material,
            10 // mana cycles
        );
        vm.stopBroadcast();

        console2.log("Minted ManaSkills token ID:", tokenId);
        console2.log("Recipient:", ANVIL_DEFAULT_RECIPIENT);
        console2.log("Category: Agriculture, Level: Basic (1), Realm: Material, Mana Cycles: 10");
    }
}
