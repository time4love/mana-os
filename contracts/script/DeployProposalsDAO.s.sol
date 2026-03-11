// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { ProposalsDAO } from "../src/ProposalsDAO.sol";

/**
 * @title DeployProposalsDAO
 * @notice Deploys ProposalsDAO with ManaSkills address for Sybil-resistant Resonance governance.
 * @dev Run after DeployManaSkills. Set MANA_SKILLS_ADDRESS in .env to the deployed ManaSkills contract.
 *      forge script script/DeployProposalsDAO.s.sol --rpc-url <RPC> --broadcast
 */
contract DeployProposalsDAO is Script {
    function run() external returns (ProposalsDAO dao) {
        address manaSkillsAddress = vm.envAddress("MANA_SKILLS_ADDRESS");
        require(manaSkillsAddress != address(0), "MANA_SKILLS_ADDRESS not set");

        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerPrivateKey != 0) {
            vm.startBroadcast(deployerPrivateKey);
        } else {
            vm.startBroadcast();
        }
        dao = new ProposalsDAO(manaSkillsAddress);
        vm.stopBroadcast();

        console2.log("ProposalsDAO deployed at:", address(dao));
        return dao;
    }
}
