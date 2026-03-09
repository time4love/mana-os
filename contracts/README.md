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

## Deploy locally (Anvil)

```bash
anvil
# In another terminal:
cd contracts
forge script script/DeployManaSkills.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

The script prints **ManaSkills deployed at: 0x...** to the terminal. Use that address in the frontend:

```bash
# frontend/.env.local
NEXT_PUBLIC_MANA_SKILLS_ADDRESS=0x<paste_deployed_address_here>
```

You can also read the address from `broadcast/DeployManaSkills.s.sol/31337/run-latest.json` (see the `contractAddress` of the deployment transaction).

## Layout

- `src/` — Solidity sources (e.g. `ManaSkills.sol` SBT)
- `test/` — Forge tests
- `script/` — Deployment and helper scripts
