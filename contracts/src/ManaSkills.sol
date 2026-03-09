// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ManaSkills
 * @author Mana OS
 * @notice Soulbound Token (SBT) representing Human Capital. Tokens are permanently bound to the
 *         holder and cannot be transferred. Each token represents a skill record with category,
 *         proficiency level, and contributed hours.
 * @dev Inherits ERC721 but overrides _update to revert on any transfer (from != address(0)), enforcing soulbound semantics.
 *      No payable functions; this contract is part of a post-money resource-based system.
 */
contract ManaSkills is ERC721, Ownable {
    /// @notice Proficiency levels following RPG-style apprenticeship progression (see .cursorrules).
    enum ProficiencyLevel {
        Apprentice, // 0 - No experience, must be paired with Mentor for on-the-job learning
        Basic,      // 1 - Can perform tasks under supervision
        Advanced,   // 2 - Independent worker
        Mentor      // 3 - Can guide Apprentices and validate their progression
    }

    /// @notice A single skill record: category, level, and total hours contributed.
    struct SkillRecord {
        string category;
        ProficiencyLevel level;
        uint256 hoursContributed;
    }

    /// @dev Next token ID to mint (auto-incremented).
    uint256 private _nextTokenId;

    /// @dev Mapping from token ID to skill record.
    mapping(uint256 tokenId => SkillRecord) private _skillRecords;

    /// @dev Token IDs per owner (for enumeration without ERC721Enumerable).
    mapping(address owner => uint256[]) private _ownerTokenIds;

    /// @dev Emitted when a new skill token is minted.
    event SkillMinted(address indexed to, uint256 indexed tokenId, string category, ProficiencyLevel level, uint256 hoursContributed);

    /// @dev Emitted when a skill's level or hours are updated.
    event SkillLevelUp(uint256 indexed tokenId, ProficiencyLevel newLevel, uint256 newHoursContributed);

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
    /// @return The SkillRecord (category, level, hoursContributed).
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
    /// @param hoursContributed Initial hours contributed for this skill.
    function mintSkill(
        address to,
        string calldata category,
        ProficiencyLevel level,
        uint256 hoursContributed
    ) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _skillRecords[tokenId] = SkillRecord({ category: category, level: level, hoursContributed: hoursContributed });
        _safeMint(to, tokenId);
        emit SkillMinted(to, tokenId, category, level, hoursContributed);
        return tokenId;
    }

    /// @notice Updates the proficiency level and/or hours contributed for an existing skill token.
    /// @param tokenId The token ID to update.
    /// @param newLevel The new proficiency level.
    /// @param additionalHours Hours to add to the existing hoursContributed (can be 0).
    function levelUp(
        uint256 tokenId,
        ProficiencyLevel newLevel,
        uint256 additionalHours
    ) external onlyOwner {
        if (_ownerOf(tokenId) == address(0)) revert ManaSkillsNonexistentToken(tokenId);
        SkillRecord storage record = _skillRecords[tokenId];
        record.level = newLevel;
        record.hoursContributed += additionalHours;
        emit SkillLevelUp(tokenId, newLevel, record.hoursContributed);
    }
}
