# Mana OS: The Post-Money, Post-Time Operating System

<p align="center">
  <img src="frontend/public/logo.png" alt="Mana OS logo" width="200" />
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Smart_Contracts-blue)](https://book.getfoundry.sh/)
[![Web3](https://img.shields.io/badge/Web3-ERC--4337-purple)](#)
[![AI](https://img.shields.io/badge/AI-Socratic_Oracle-green)](#)

> *"The system isn't broken. It's working exactly as designed: to keep you surviving, not thriving. It's time to write a new operating system for human consciousness and coordination."*

Welcome to **Mana OS**.
We are building an open-source, decentralized **Healing Operating System** for communities transitioning into a post-money, post-state, and post-time economy.

**⚠️ CRITICAL RULE FOR CONTRIBUTORS:** Money and Time-Tracking do not exist in this codebase. If you submit a PR containing variables like `price`, `budget`, `payment_gateway`, or `hoursContributed`, it will be rejected. We do not trade in the Matrix's illusions. We trade in energetic reality.

---

## 🛑 The Problem: The Matrix of Scarcity and Time
Humanity is running on a corrupted legacy operating system called "Fiat Economics." It utilizes engineered scarcity, infinite debt loops, and coercion to control the population.

Furthermore, the Industrial Revolution infected us with the ultimate bug: **"Time is Money."** By measuring human value in "hours," the old system penalizes mastery (the master healer who cures pain in 5 minutes) and rewards inefficiency (the apprentice who drags it out for an hour). We are trapped in "bullshit jobs," forced to punch clocks just to earn fictional tokens for the right to exist.

We don't need a revolution of violence. We need a hard fork. We need to withdraw our consent and exit the system by building a resilient, trauma-informed alternative.

---

## ⚡ The Solution: A Healing OS
Mana OS allows micro-communities, eco-villages, and decentralized networks to govern themselves, manage resources, and build infrastructure using **AI, Smart Contracts, and Direct Democracy**—without a single dollar exchanging hands, and without forcing anyone into a quota.

We replace "Capital" with **Mana** (Regenerative Energy), and we replace "Hours" with **Cycles of Resolution**.

### 🏛 The 3 Layers of Sovereignty
Mana OS is designed for sovereign, infinite beings. It inherently rejects coercion through three foundational pillars:
1. **Unconditional Basic Abundance (UBA):** Survival is never conditional. The system holds no mechanism to withhold food, shelter, or care from any member. You do not need to "earn" your right to live.
2. **Attraction-Based Resonance:** There are no "managers" assigning "tasks". The community board acts as a mirror of needs. Work is claimed purely by energetic attraction (Resonance). If a calling isn't claimed, it remains undone, reflecting the community's true frequency.
3. **Dynamic Soul Contracts:** Instead of rigid weekly quotas, users periodically declare their seasonal capacity to the Oracle (e.g., "I am in a resting/healing phase," or "I am in a building phase"). The system forecasts capacity without ever inducing guilt or pressure.

---

## 🧠 Core Architecture & Features

### 1. The Socratic AI Oracle (Replacing Politicians & Planners)
Instead of electing a politician, users chat with our AI Oracle to propose projects (e.g., *"Let's build a community greenhouse"*).
The Oracle acts as a **Spiritual Architect**. It questions ego-driven requests gently, guiding users toward nature-aligned abundance. Once a vision is clear, it acts as an objective physics simulator, breaking down the proposal into a strict JSON plan of required Natural Resources and **Mana Cycles**.

### 2. Direct On-Chain Resonance (Decentralized Democracy)
Once the Oracle formulates the resource plan, it is hashed on-chain. Every community member resonates (votes) via Smart Contracts. No representatives, no lobbying. Pure, transparent, immutable consensus.

### 3. Mana Cycles & Realms of Mastery (Soulbound Tokens)
We do not track hours. We track **Mana Cycles** (Resolutions).
Contributions are divided into energetic **Realms**:
*   **The Material Realm:** Agriculture, building, maintenance.
*   **The Energetic Realm:** Medicine, psychology, conflict resolution, healing.
*   **The Knowledge Realm:** Teaching, art, spiritual guidance, code.

Mastery is managed via an RPG-like progression (Level 0 Apprentice to Level 3 Mentor). When a member completes a cycle, the receiver initiates a **Gratitude Loop**, minting/updating an **ERC-5192 Soulbound Token (SBT)** to their wallet. It's an untransferable, cryptographic proof of their energetic density and real-world value.

### 4. Gasless Web3 (Account Abstraction)
Because money doesn't exist here, users cannot pay "Gas Fees" in crypto. We utilize **ERC-4337 (Account Abstraction)**. The community infrastructure abstracts away the blockchain. Users just click "Resonate" or "Claim Calling" without ever worrying about wallet balances or seed phrases.

### 5. Global First (i18n & Native RTL)
This movement isn't localized. Mana OS is built from Day 1 to support any natural language, with flawless logical-property styling (Tailwind) to support Right-to-Left (RTL) languages like Hebrew and Arabic natively.

---

## 🛠 Tech Stack

We use a modern, developer-friendly Monorepo:

### `Frontend & Backend`
*   **Framework:** Next.js (App Router), React, TypeScript.
*   **Styling:** TailwindCSS (Logical Properties ONLY) + shadcn/ui.
*   **Web3 Integration:** Wagmi, Viem.
*   **AI:** Vercel AI SDK + OpenAI/Anthropic APIs.
*   **Off-chain DB:** Supabase (PostgreSQL + pgvector).

### `Smart Contracts`
*   **Environment:** Foundry (Forge, Anvil, Cast).
*   **Language:** Solidity (`^0.8.24`).
*   **Standards:** OpenZeppelin (Access Control, ERC-5192 SBTs).

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js (v18+)
- pnpm or yarn
- Foundry (`curl -L https://foundry.paradigm.xyz | bash`)
- Docker (for local Supabase)

### 1. Clone & Install
```bash
git clone https://github.com/YourOrg/mana-os.git
cd mana-os
pnpm install
```

### 2. Contracts (Foundry)
```bash
cd contracts
forge build
forge script script/DeployManaSkills.s.sol --rpc-url http://127.0.0.1:8545 --broadcast  # with Anvil running
```

### 3. Frontend
```bash
cd frontend
cp .env.example .env.local   # set NEXT_PUBLIC_MANA_SKILLS_ADDRESS, etc.
pnpm dev
```

For full development phases, deployment, and mint scripts, see **[PROJECT_ROADMAP.md](PROJECT_ROADMAP.md)**.
