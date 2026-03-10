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

## 🔄 Holistic Flow: Proposal from Ideation to Execution

The lifecycle of a proposal in Mana OS (The Healing OS) connects all phases into one coherent flow:

1. **Ideation** (Phase 4) — A community member describes a project in free text. The **Socratic AI Oracle** (spiritual teacher and architect) mentors the user: it questions ego-driven requests gently, guides toward nature-aligned solutions, and only then produces a structured **ProposalResourcePlan** (Natural Resources + Human Capital) via the `finalize_resource_plan` tool.
2. **Governance** (Phase 5) — The proposal (or its hash) is recorded on-chain to **ProposalsDAO.sol**. The Community Feed UI lets members view pending proposals and vote with their wallets. Status moves from **Pending Vote** → **Approved** or **Rejected**.
3. **Resource Allocation** (Phase 6) — **Attraction-Based Resonance**: Approved proposals appear on the **Mana Callings Board**. The UI reads each user’s **ManaSkills.sol** SBTs and Realms (e.g. “Agriculture Level 2” task ↔ user holding that SBT). Users claim Callings by resonance; no forced commitment. Status moves **Open** → **In Resonance** → **Completed**.
4. **Onboarding** (Phase 7) — **Dynamic Soul Contracts**: New members join via a “Join Community” rite of passage; they declare their current **seasonal capacity** (Rest, Build, Learn) without obligation. A trusted local **Mentor** (Level 3) approves and mints the first **Level 0 (Apprentice)** or **Level 1** SBT, bootstrapping their presence in the system.
5. **Deployment & Launch** (Phase 8) — Contracts and frontend go to testnet and production; the repo is opened for contributors.

This flow ensures that every component—Socratic Oracle, DAO, Callings Board, and Skills—connects logically from idea to execution.

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

### ⏳ Phase 4: The Socratic AI Oracle (The Game Changer)
- [ ] Setup Supabase DB for off-chain context (Communities, Users, Proposals text).
- [ ] Create API Route `/api/oracle` using Vercel AI SDK.
- [ ] Define the **Socratic System Prompt**: the AI acts as spiritual teacher and architect—questioning ego-driven requests gently, guiding users toward nature-aligned solutions—before returning a strict JSON (`ProposalResourcePlan`) with Natural Resources and Human Capital.
- [ ] Build the **Socratic Chat** interface: "New Proposal" flow where users converse with the Oracle in a mentoring, spacious dialogue (no transactional forms).

### ⏳ Phase 5: Governance & Direct Democracy (The DAO)
- [ ] Create `ProposalsDAO.sol`: A smart contract to accept the AI-generated `ProposalResourcePlan` (hashed/stored on-chain).
- [ ] Build the "Community Feed" UI: Users can view pending proposals and vote on them directly using their connected wallets.
- [ ] Implement Status Tracking: Proposals should move from `Pending Vote` -> `Approved`/`Rejected`.

### ⏳ Phase 6: Calling Resonance (Attraction-Based Matchmaking)
- [ ] Create the **Mana Callings Board** UI for `Approved` proposals (no "Task Board" or task language).
- [ ] **Resonance Matchmaking**: The UI reads the user's `ManaSkills.sol` SBTs and Realms and surfaces **Callings** that resonate (e.g., matching an "Agriculture Level 2" calling to a user holding that SBT and Realm). Work is claimed by attraction, never assigned.
- [ ] **Calling Resonance flow**: Users claim callings based on energetic resonance. No quotas or commitments. Status moves from `Open` -> `In Resonance` -> `Completed`.

### ⏳ Phase 7: Community Onboarding & Verification
- [ ] Create the "Join Community" flow.
- [ ] Initial Skill Minting: Allow a trusted local mentor (Level 3) to approve and mint the first Level 0 (Apprentice) or Level 1 SBT for new members.

### ⏳ Phase 8: Testnet Deployment & Open Source Launch
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