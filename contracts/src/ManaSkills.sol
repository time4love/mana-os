// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManaSkills
 * @author Mana OS (The Healing OS)
 * @notice Soulbound Token (SBT) representing Human Capital. Tokens are permanently bound to the
 *         holder and cannot be transferred. Each token represents a skill record with category,
 *         proficiency level, realm, and mana cycles (resolutions).
 * @dev Inherits ERC721 but overrides _update to revert on any transfer (from != address(0)), enforcing soulbound semantics.
 *      No payable functions; this contract is part of a post-money resource-based system.
 */
contract ManaSkills is ERC721, Ownable {
    /// @notice Proficiency levels following RPG-style apprenticeship progression (see .cursorrules).
    enum ProficiencyLevel {
        Apprentice, // 0 - No experience, must be paired with Mentor for on-the-job learning
        Basic,      // 1 - Can perform under supervision
        Advanced,   // 2 - Independent
        Mentor      // 3 - Can guide Apprentices and validate their progression
    }

    /// @notice Realm to which every skill belongs (see .cursorrules).
    enum Realm {
        Material,   // 0 - Physical, tangible
        Energetic, // 1 - Flow, presence
        Knowledge  // 2 - Wisdom, teaching
    }

    /// @notice A single skill record: category, level, realm, and mana cycles.
    struct SkillRecord {
        string category;
        ProficiencyLevel level;
        Realm realm;
        uint256 manaCycles;
    }

    /// @dev Next token ID to mint (auto-incremented).
    uint256 private _nextTokenId;

    /// @dev Mapping from token ID to skill record.
    mapping(uint256 tokenId => SkillRecord) private _skillRecords;

    /// @dev Token IDs per owner (for enumeration without ERC721Enumerable).
    mapping(address owner => uint256[]) private _ownerTokenIds;

    /// @dev Emitted when a new skill token is minted.
    event SkillMinted(address indexed to, uint256 indexed tokenId, string category, ProficiencyLevel level, Realm realm, uint256 manaCycles);

    /// @dev Emitted when a skill's level or mana cycles are updated.
    event SkillLevelUp(uint256 indexed tokenId, ProficiencyLevel newLevel, uint256 newManaCycles);

    error ManaSkillsSoulbound();
    error ManaSkillsNonexistentToken(uint256 tokenId);

    constructor(address initialOwner) ERC721("ManaSkills", "MSK") Ownable(initialOwner) {}

    // -------------------------------------------------------------------------
    // Soulbound: disable all transfers via _update hook (OZ ERC721 uses _update for mints and transfers)
    // -------------------------------------------------------------------------

    /// @dev Reverts if the token already exists (i.e. any transfer). Mints (from == address(0)) are allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert ManaSkillsSoulbound();
        address result = super._update(to, tokenId, auth);
        if (from == address(0)) _ownerTokenIds[to].push(tokenId);
        return result;
    }

    // -------------------------------------------------------------------------
    // Skill record storage and queries
    // -------------------------------------------------------------------------

    /// @notice Returns the skill record for a given token.
    /// @param tokenId The token ID.
    /// @return The SkillRecord (category, level, realm, manaCycles).
    function getSkillRecord(uint256 tokenId) external view returns (SkillRecord memory) {
        return _skillRecords[tokenId];
    }

    /// @notice Returns all token IDs owned by an address (for profile/dashboard reads).
    /// @param owner The address to query.
    /// @return Array of token IDs held by owner.
    function getTokenIdsOf(address owner) external view returns (uint256[] memory) {
        return _ownerTokenIds[owner];
    }

    /// @notice Mints a new soulbound skill token to an address.
    /// @param to Recipient address (must hold the token forever; no transfers).
    /// @param category Skill category (e.g., "Carpentry").
    /// @param level Initial proficiency level.
    /// @param realm Realm of the skill (Material, Energetic, Knowledge).
    /// @param cycles Initial mana cycles (resolutions) for this skill.
    function mintSkill(
        address to,
        string calldata category,
        ProficiencyLevel level,
        Realm realm,
        uint256 cycles
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _skillRecords[tokenId] = SkillRecord({ category: category, level: level, realm: realm, manaCycles: cycles });
        _safeMint(to, tokenId);
        emit SkillMinted(to, tokenId, category, level, realm, cycles);
        return tokenId;
    }

    /// @notice Updates the proficiency level and/or mana cycles for an existing skill token.
    /// @param tokenId The token ID to update.
    /// @param newLevel The new proficiency level.
    /// @param additionalCycles Mana cycles to add (can be 0).
    function levelUp(
        uint256 tokenId,
        ProficiencyLevel newLevel,
        uint256 additionalCycles
    ) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert ManaSkillsNonexistentToken(tokenId);
        SkillRecord storage record = _skillRecords[tokenId];
        record.level = newLevel;
        record.manaCycles += additionalCycles;
        emit SkillLevelUp(tokenId, newLevel, record.manaCycles);
    }
}
