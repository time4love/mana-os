# Mana OS: The Post-Money Operating System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Smart_Contracts-blue)](https://book.getfoundry.sh/)
[![Web3](https://img.shields.io/badge/Web3-ERC--4337-purple)](#)
[![AI](https://img.shields.io/badge/AI-Resource_Oracle-green)](#)

> *"The system isn't broken. It's working exactly as designed: to keep you surviving, not thriving. It's time to write a new operating system for human coordination."*

Welcome to **Mana OS**. 
We are building an open-source, decentralized operating system for communities transitioning into a post-money, post-state, resource-based economy. 

**⚠️ CRITICAL RULE FOR CONTRIBUTORS:** Money does not exist in this codebase. If you submit a PR containing variables like `price`, `fiat`, `budget`, or `payment_gateway`, it will be rejected. We do not trade in illusion. We trade in reality.

---

## 🛑 The Problem: The Legacy Codebase of Society
Humanity is running on a corrupted legacy operating system called "Fiat Economics." It utilizes engineered scarcity, infinite debt loops, and a parasitic managerial class (politicians, central banks, mega-corporations) to control the population. 

Right now, humans have the technology, the natural resources, and the AI capabilities to ensure every human being lives in absolute abundance. Yet, we are trapped in "bullshit jobs" just to earn fictional tokens to pay for the right to exist. 

We don't need a revolution of violence. We need a hard fork. We need to withdraw our consent and exit the system by building a better one.

---

## ⚡ The Solution: Mana OS
Mana OS allows micro-communities, eco-villages, and decentralized networks to govern themselves, manage resources, and build infrastructure using **AI, Smart Contracts, and Direct Democracy**—without a single dollar exchanging hands.

We replace the concept of "Capital" with **Mana**.
Mana is regenerative energy. It consists of:
1. **Natural Resources:** Water, timber, concrete, solar kWh.
2. **Human Capital:** Time, skills, mentorship.
3. **Action Potential:** AI-simulated community projects.

---

## 🧠 Core Architecture & Features

### 1. The AI Resource Oracle (Replacing Politicians)
Instead of electing a corrupt politician to allocate budgets, users submit plain-text proposals (e.g., *"Let's build a community greenhouse"*). 
Our AI Oracle (LLMs forced to output strict JSON schemas) acts as an objective physics simulator. It instantly breaks down the proposal into real-world costs: *"This requires 500kg of wood, 20 kWh of daily energy, 1 Advanced Carpenter, and 3 Apprentices."*

### 2. Direct On-Chain Consensus (Decentralized Democracy)
Once the AI simulates the resource cost, the proposal is hashed and pushed to the blockchain. Every community member votes via Smart Contracts. No representatives, no lobbying. Pure, transparent, immutable consensus.

### 3. Gamified Human Capital & Apprenticeship (Soulbound Tokens)
Jobs are replaced by **Contributions** (e.g., 4 hours a week). Skills are managed like an RPG leveling system:
*   `Level 0`: Apprentice (Paired with Mentors to learn on the job).
*   `Level 1`: Basic.
*   `Level 2`: Advanced.
*   `Level 3`: Mentor.
When a member levels up, the DAO mints an **ERC-5192 Soulbound Token (SBT)** to their wallet. It’s an untransferable, unforgeable cryptographic proof of their real-world value and contribution.

### 4. Gasless Web3 (Account Abstraction)
Because money doesn't exist here, users cannot pay "Gas Fees" in crypto to vote. We utilize **ERC-4337 (Account Abstraction)** and Paymasters. The community infrastructure abstracts away the blockchain. Users just click "Vote" or "Volunteer" without ever worrying about wallet balances.

### 5. Global First (i18n & Native RTL)
This movement isn't localized. Mana OS is built from Day 1 to support any natural language, with flawless logical-property styling (Tailwind) to support Right-to-Left (RTL) languages like Hebrew and Arabic natively. 

---

## 🛠 Tech Stack

We use a modern, developer-friendly Monorepo:

### `Frontend & Backend`
*   **Framework:** Next.js (App Router), React, TypeScript.
*   **Styling:** TailwindCSS (Logical Properties ONLY) + shadcn/ui.
*   **Web3 Integration:** Wagmi, Viem.
*   **AI:** Vercel AI SDK + OpenAI/Anthropic APIs (with RAG context).
*   **Off-chain DB:** Supabase (PostgreSQL + pgvector).

### `Smart Contracts`
*   **Environment:** Foundry (Forge, Anvil, Cast).
*   **Language:** Solidity (`^0.8.20`).
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

### 2. Start the Local Blockchain (Anvil)
```bash
cd contracts
forge build
anvil
```

### 3. Start the Next.js App
```bash
cd frontend
cp .env.example .env.local  # Add your OpenAI API key and Supabase details
pnpm run dev
```

## 🤝 Contributing: Join the Rebellion
We don't need another DeFi protocol. We don't need another yield-farming Ponzi scheme. We need a new society.
If you are a frontend wizard, a Solidity auditor, an AI prompt engineer, or a visionary architect, we need you.
Check out the Issues tab for "Good First Issues".
Read our .cursorrules to understand the coding philosophy.
Fork the repo, write clean code, and submit a PR.
History will not remember how comfortable we were. It will remember whether we wrote the code that set humanity free.

### License: MIT. Free forever. For the people, by the people.


