# Mana OS — Smart Contracts

Foundry project for Mana OS. No payable functions; post-money, resource-based design.

## Setup

```bash
# Install Foundry: https://book.getfoundry.sh/getting-started/installation
# Then install OpenZeppelin:
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

## Build & Test

```bash
forge build
forge test
```

## Layout

- `src/` — Solidity sources (e.g. `ManaSkills.sol` SBT)
- `test/` — Forge tests
- `script/` — Deployment and helper scripts
