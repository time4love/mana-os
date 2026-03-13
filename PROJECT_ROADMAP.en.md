# 🗺 Mana OS - Project Roadmap & Architecture

##  The Vision
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
3. **Resource Allocation** (Phase 6) — **Attraction-Based Resonance**: Approved proposals appear on the **Mana Callings Board**. The UI reads each user's **ManaSkills.sol** SBTs and Realms (e.g. "Agriculture Level 2" task ↔ user holding that SBT). Users claim Callings by resonance; no forced commitment. Status moves **Open** → **In Resonance** → **Completed**.
4. **Onboarding** (Phase 7) — **Dynamic Soul Contracts**: New members join via a "Join Community" rite of passage; they declare their current **seasonal capacity** (Rest, Build, Learn) without obligation. A trusted local **Mentor** (Level 3) approves and mints the first **Level 0 (Apprentice)** or **Level 1** SBT, bootstrapping their presence in the system.
5. **The Awakening Map** (Phase 8) — Simulation mode: map overlay transmutes matrix infrastructure; users drop Vision Seeds, Abundance pins, and Resource Pledges.
6. **Deployment & Launch** (Phase 9) — Contracts and frontend go to testnet and production; the repo is opened for contributors.

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
- [ ] **Anonymous Resonance (ZKP) & Refinement Circle:** Implement Anonymous Resonance mechanism (ZKP concepts) so who resonated is not exposed; add **The Refinement Circle** (discussion/comments thread) for collaborative proposal upgrading.
- [ ] **Automatic Oracle Synthesis:** When an upgrade seed's resonance reaches the merge threshold (e.g. 2), the seed becomes 'merged' and the Oracle synthesis runs automatically in the backend. The proposal's `resource_plan` and `oracle_insight` (תבוננות) are updated. No manual "Seek Synthesis" button—updates are strictly triggered by community consensus.

### ⏳ Phase 6: Calling Resonance (Attraction-Based Matchmaking)
- [ ] Create the **Mana Callings Board** UI for `Approved` proposals (no "Task Board" or task language).
- [ ] **Resonance Matchmaking**: The UI reads the user's `ManaSkills.sol` SBTs and Realms and surfaces **Callings** that resonate (e.g., matching an "Agriculture Level 2" calling to a user holding that SBT and Realm). Work is claimed by attraction, never assigned.
- [ ] **Calling Resonance flow**: Users claim callings based on energetic resonance. No quotas or commitments. Status moves from `Open` -> `In Resonance` -> `Completed`.
- [ ] **Sunset Whisper Cron Job & Seasonal Muting Logic**: Implement batched daily digest (Sunset Whisper) instead of real-time notifications; respect Soul Contract season (e.g., Winter = full mute of project/action updates).
- [ ] **Context-Aware Codex (Individual Exploration):** The Codex Sheet is the single PULL-based interface for consulting the Oracle. It accepts `contextData` (e.g. current proposal, profile); the Architect Oracle receives this context and can answer deep questions (e.g. "If we approve this broccoli seed, how much more water will we need?") without altering the main proposal. Core proposal updates happen only via automatic synthesis on merge.

### 🚧 Phase 7: Community Onboarding & Verification (Rite of Passage)
- [x] Create the "Join Community" onboarding flow (Breath → Soul Contract/Seasons → Realm → Genesis Anchor) with fluid step transitions and Concept Whispers.
- [ ] Initial Skill Minting: Allow a trusted local mentor (Level 3) to approve and mint the first Level 0 (Apprentice) or Level 1 SBT for new members.
- [ ] **Restorative Justice Protocol:** Implement **Call for Harmony** (בקשת גישור)—route conflict to Level 3 Mentors in the Energetic/Healing Realm for human mediation (NVC/healing framing, not moderation or admin enforcement).

### ⏳ Phase 8: The Awakening Map (Simulation Mode & Abundance Radar)
- [ ] **Matrix Transmutation (Map Overlay):** Integrate OpenStreetMap but transmute existing matrix infrastructure into Mana OS entities (e.g., Banks display as "Museums of the Old World", Supermarkets as "Abundance Hubs"). Use a glowing, Solarpunk custom map style.
- [ ] **Crowdsourcing Abundance (Pins):** Build a UI allowing users to drop 3 types of pins on the map:
  1. *Vision Seeds:* Location-based project proposals ("A food forest should grow here").
  2. *Anchoring Existing Abundance:* Tagging public fruit trees, street libraries, and water sources.
  3. *Resource Pledging:* Citizens opening their private spaces for community use (e.g., sharing a roof for solar panels).

### ⏳ Phase 9: Testnet Deployment & Open Source Launch
- [ ] Deploy all contracts to **Base Sepolia** testnet.
- [ ] Update Frontend environment variables to point to the live testnet.
- [ ] Deploy Next.js app to **Vercel**.
- [ ] Publicly launch the GitHub repo.
- [ ] **The Weave: Fractal Economy & Surplus Overflow routing** — Inter-community surplus flow: communities in surplus resonate overflow to the network; others take what they need. No barter, trade, or debt. Macro-projects (bridges between communities) require Macro-Resonance pooled from multiple hubs.

### 🔮 Phase 10: The Fractal Truth Engine
- [x] **Step 1: The DAG Architecture & Database Schema:** Create `truth_nodes` and `truth_edges` in Supabase to allow concepts to have multiple parents, including `pgvector` integration.
- [ ] **Step 2: The Semantic Weaver (Anti-Duplication):** Integrate OpenAI Embeddings. Intercept users adding nodes to run cosine-similarity checks, forcing them to merge duplicates into canonical nodes.
- [ ] **Step 3: The "Pure Logician" AI Oracle & The Epistemic Forge:** An API endpoint trained exclusively on formal logic and fallacies, acting as an unbiased structural mapper. **The Epistemic Forge:** All entry into the Truth Graph (macro-root or micro-challenge) passes through a Socratic AI chat. The Pure Logician guides the user to a bulletproof, falsifiable premise; when logical cohesion is reached, the AI calls the `draft_epistemic_node` tool so the user can approve and Anchor. No raw reply boxes—conversational gatekeeping and generative injection only.
- [ ] **Step 4: The Endless Dive UX:** Implement a sliding, horizontal column layout that isolates singular logic junctions, preventing visual collapse and infinite nesting scroll-fatigue.
- [ ] **Step 5: Epistemic Resonance (SBT Immunity):** Implement anti-troll voting (`Verify Logic` / `Flag Fallacy`). Only users holding Genesis Anchor SBTs can affect the structural weight of a node.
- [ ] **Localized Epistemic Windows:** Develop isolated context payloads preventing cross-pollution into main nodes until `Context Bubbling` commits resolved propositions.
- [ ] **Background Memory Consolidation Worker:** Architect an async CRON workflow instructing the Gemini 1.5 core via tree-traversal API to condense noise into `Refined Thought Trajectory` records stored via pgvector, not needing active response generation overhead on chat execution logic, serving to reset stale tokens.
- [ ] **LLM-As-A-Judge Sync Verification:** Tool testing condensed graph structures post consolidation checking unparsed logic/debunk loss before applying strictly.
- [ ] **Multi-Agent Flow Refactoring:** Deprecate single-prompt AI calls for large documents. Adopt Agentic pipelining mapping array inputs asynchronously against: The Sieve, The Matcher, The Logician, and The Scout before batching for human visual approval on UI and finalizing Postgres relations.

### 🔮 Phase 11: The Council of Elders (Multi-Agent Swarm & Co-Governance)
- [ ] **Multi-Agent Architecture:** Upgrading the Oracle from a single LLM to an Agentic Workflow where specialized AI entities debate backend before responding.
- [ ] **Agent 1: The Earth Architect:** Master of the Material Realm (Biomimicry, Permaculture, ecological physics). Calculates raw resource needs.
- [ ] **Agent 2: The Spirit Weaver:** Master of the Energetic Realm. Monitors human capacity, Soul Contracts (seasons), and prevents community burnout by pacing projects organically.
- [ ] **Agent 3: The Knowledge Keeper:** Master of the Knowledge Realm. Guardian of the Manifesto, ensuring Matrix constructs (competition, fiat logic) do not infect proposals.
- [ ] **The Village Elder (Orchestrator):** The user-facing synthesizer. Gathers council insights and weaves them into a singular, poetic, and actionable response for the community.

---

## 🤖 Instructions for Cursor AI
When starting a new session or task, the developer will reference this file. 
1. Look at the current 🚧 or ⏳ phases.
2. Identify the first unchecked `[ ]` task.
3. Propose the implementation steps, keeping strict adherence to `.cursorrules`.
4. When a task is complete, politely ask the developer to check off the `[x]` in this file.
