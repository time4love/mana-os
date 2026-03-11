// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title ProposalsDAO
 * @author Mana OS (The Healing OS)
 * @notice Governance by Resonance: additive, organic. Proposals are identified by off-chain UUID (Supabase).
 *         Only holders of a ManaSkills SBT can resonate. No downvotes; when resonance reaches threshold, the proposal "sprouts."
 * @dev Sybil resistance via ManaSkills SBT. proposalId is the Supabase proposal UUID string.
 */
contract ProposalsDAO {
    /// @notice Emitted when a community member resonates with a proposal.
    /// @param proposalId Supabase proposal UUID.
    /// @param resonator Address that resonated.
    /// @param newTotal Total resonance count after this resonance.
    event Resonated(string proposalId, address indexed resonator, uint256 newTotal);

    /// @notice ManaSkills SBT contract; only holders can resonate.
    IERC721 public immutable MANA_SKILLS;

    /// @notice Resonance count per proposal (key = Supabase proposal UUID).
    mapping(string => uint256) public proposalResonance;

    /// @notice Tracks whether an address has already resonated on a proposal (prevents double-resonance).
    mapping(string => mapping(address => bool)) public hasResonated;

    error ProposalsDAO_NoSBT();
    error ProposalsDAO_AlreadyResonated();

    /// @param _manaSkills Address of the ManaSkills (SBT) contract.
    constructor(address _manaSkills) {
        require(_manaSkills != address(0), "ProposalsDAO: zero address");
        MANA_SKILLS = IERC721(_manaSkills);
    }

    /// @notice Add your resonance to a proposal. Caller must hold at least one ManaSkills SBT and must not have resonated already.
    /// @param proposalId The Supabase proposal UUID (e.g. from proposals.id).
    function resonate(string calldata proposalId) external {
        if (MANA_SKILLS.balanceOf(msg.sender) == 0) revert ProposalsDAO_NoSBT();
        if (hasResonated[proposalId][msg.sender]) revert ProposalsDAO_AlreadyResonated();

        hasResonated[proposalId][msg.sender] = true;
        proposalResonance[proposalId] += 1;
        uint256 newTotal = proposalResonance[proposalId];

        emit Resonated(proposalId, msg.sender, newTotal);
    }
}
