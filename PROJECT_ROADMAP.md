# 🗺 Mana OS - Project Roadmap & Architecture

## 👁 The Vision
Mana OS is a decentralized, moneyless operating system for self-governing communities. 
We operate strictly on **Mana** (Natural Resources + Human Capital + Action Potential). Fiat currency, prices, and traditional economic concepts DO NOT EXIST in this system.

## 🏗 System Architecture
- **Contracts (Backend):** Solidity, Foundry. Gasless execution (ERC-4337). 
- **Frontend:** Next.js 15 (App Router), TailwindCSS (Logical properties for native RTL/Hebrew), shadcn/ui.
- **Web3 Interface:** Wagmi, Viem.
- **AI Oracle:** Vercel AI SDK + OpenAI/Anthropic (Structured JSON resource planning).
- **Off-chain DB:** Supabase.

---

## 🛤 Development Phases

### ✅ Phase 1: Foundation & Scaffold
- [x] Define `.cursorrules` with strict anti-fiat constraints and Clean Code/SOLID principles.
- [x] Initialize Monorepo (Frontend + Contracts).
- [x] Install Foundry and OpenZeppelin contracts (`solc ^0.8.24`).
- [x] Draft `README.md` manifesto for open-source contributors.

### 🚧 Phase 2: Core Smart Contracts (The Rules of Physics)
- [x] Create `ManaSkills.sol` (Soulbound Token - ERC5192) to represent Human Capital (Apprentice to Mentor progression).
-[x] Compile successfully via `forge build`.
- [ ] Write `DeployManaSkills.s.sol` deployment script.
- [ ] Create `ResourceLedger.sol` (Immutable append-only tracking of physical resources: water, wood, energy).
- [ ] Create `ProposalsDAO.sol` (Voting mechanism for AI-simulated community projects).

### ✅ Phase 3: Frontend Web3 Integration & UI Scaffold
- [x] Setup `Wagmi` and `Viem` providers in Next.js (Local Anvil first, Base Sepolia later).
- [x] Create `Web3Provider` wrapper.
- [x] Build the "My Mana Profile" dashboard (`/profile`) in Hebrew/RTL.
- [x] Connect the dashboard to `ManaSkills.sol` to fetch the user's SBTs and Proficiency Level.
- [x] i18n (he/en) with logical CSS and Language Switcher.

### ⏳ Phase 4: The AI Oracle (The Game Changer)
- [ ] Setup Supabase DB for off-chain context (Communities, Users, Proposals text).
- [ ] Create API Route `/api/oracle` using Vercel AI SDK.
- [ ] Define the `System Prompt` for the AI to receive a free-text proposal and return a strict JSON (`ProposalResourcePlan`) containing required Natural Resources and Human Capital.
- [ ] Build the "New Proposal" UI where users chat with the AI Oracle.

### ⏳ Phase 5: The Feedback Loop (Apprenticeship & Execution)
- [ ] Build the "Task Board" UI based on approved proposals.
- [ ] Implement the logic where an `Apprentice` (Level 0) pairs with a `Mentor` (Level 3).
- [ ] Implement the `levelUp` flow where completing a task updates the SBT on-chain.

### ⏳ Phase 6: Testnet Deployment & Open Source Launch
- [ ] Deploy all contracts to **Base Sepolia** testnet.
- [ ] Update Frontend environment variables to point to the live testnet.
- [ ] Deploy Next.js app to **Vercel**.
- [ ] Publicly launch the GitHub repo.

---

## 🤖 Instructions for Cursor AI
When starting a new session or task, the developer will reference this file. 
1. Look at the current 🚧 or ⏳ phases.
2. Identify the first unchecked `[ ]` task.
3. Propose the implementation steps, keeping strict adherence to `.cursorrules`.
4. When a task is complete, politely ask the developer to check off the `[x]` in this file.