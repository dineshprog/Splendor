# 💎 Splendor Online

A high-fidelity, web-native digital adaptation of the award-winning board game **Splendor** (designed by Marc André). Built with modern vanilla ES Modules, Three.js WebGL 3D physical chip rendering, Web Audio API procedural sound synthesis, and a luxury Renaissance obsidian & gold aesthetic.

---

## 🌟 Key Features

1. **Deterministic & Authoritative Game Engine**:
   - Complete official dataset of **90 Development Cards** (40 Tier 1, 30 Tier 2, 20 Tier 3) and **10 Historical Nobles**.
   - Dynamic token bank setup based on player count ($4$ for 2p, $5$ for 3p, $7$ for 4p; $5$ Gold).
   - All 4 standard Splendor actions:
     - Take 3 distinct gem tokens.
     - Take 2 same-color gem tokens (strictly when stack $\ge 4$).
     - Reserve 1 card from board or blind deck + receive 1 Gold Joker.
     - Purchase 1 card with permanent discounts and Gold wildcard substitution.
   - 10-token holding limit with interactive discard modal.
   - Noble visits (automatic single visit, choice modal on multiple).
   - 15 Prestige points endgame trigger with full final round cycle and official tiebreaker hierarchy.

2. **Tactile 3D & Visual Luxury (PRD Section 4)**:
   - **Three.js WebGL 3D Gem Tokens**: Beveled ceramic chips with jewel inlays, realistic specular reflections, and physical stack wobble.
   - **2D Canvas Fallback**: High-resolution procedural canvas renderer when running offline or on low-power devices.
   - **Renaissance Glassmorphism UI**: Obsidian mat backdrop, antique gold borders, card affordability glow, and smooth CSS transforms.
   - **Colorblind Accessible**: Unique geometric symbols for every gem (❖ Diamond, ◼ Sapphire, ⬟ Emerald, ● Ruby, ⬢ Onyx, ★ Gold).

3. **Procedural Web Audio Synthesizer**:
   - Zero external audio files required — 100% synthesized in real time via Web Audio API:
     - Multi-frequency ceramic chip clink.
     - Pure harmonic crystal gem chimes.
     - Linen card slide and snap sounds.
     - Royal noble arrival fanfare chords.
     - Turn bell and victory celebration fanfare.
     - Mobile haptic vibration feedback.

4. **3-Tier AI Opponents (PRD Section 8)**:
   - **Apprentice (Easy)**: 1-ply greedy bot that buys cheap foundation cards.
   - **Merchant (Medium)**: Target-driven heuristic engine builder targeting noble synergies and high-value cards.
   - **Master Guildmaster (Hard)**: Minimax tempo evaluation, opponent card denial ("hate-drafting"), and Gold optimization.

5. **Multiplayer & Game Modes**:
   - **Solo vs AI**: 1 human vs 1–3 configurable AI bots.
   - **Pass-and-Play**: 2–4 players taking turns on a single shared screen.
   - **Online Multiplayer**: Real-time room synchronization supporting both serverless WebRTC Peer-to-Peer (out-of-the-box on GitHub Pages, zero backend required) and local Python WebSocket server.
   - **Configurable Turn Timers**: Casual (no timer), Blitz (30s), Standard (60s), or Classical (120s).
   - **Post-Game Analytics & Podium**: Line graph and bar comparison of points progression and card bonuses.

---

## 🚀 How to Run

### Option 1: GitHub Pages & Static Hosting (Serverless WebRTC Multiplayer)

When hosted on **GitHub Pages** (or any static host), online multiplayer works 100% out of the box via **WebRTC Peer-to-Peer** (powered by PeerJS).
- Simply open the site on GitHub Pages (`https://<username>.github.io/<repo>/`).
- Click **Online Room (Share Link)** > **Create Room**.
- Share the generated invite link (`?room=CODE`) with your friends.
- No backend deployment or server setup required!

### Option 2: Start the Local Server (WebSocket Mode)

In your terminal, navigate to the project directory and run:

```bash
python3 server.py
```

Then open your browser and navigate to:

```
http://localhost:8000
```

### Option 3: Direct Browser Launch

Open [`index.html`](file:///c:/Users/ANT-PC/projects/Splendor/index.html) directly in any modern browser. All game logic, AI, 2D/3D graphics, procedurally synthesized audio, and WebRTC P2P multiplayer operate completely client-side without external dependencies.

---

## 🧪 Running the Automated Test Suite

To run the automated rules and file integrity tests:

```bash
python3 tests/test_splendor.py
```

---

## 📁 Architecture Overview

```
/Users/rasika/Spendor/
├── index.html              # Luxury Renaissance layout, 3D mount, HUD, and dialogs
├── css/
│   └── style.css           # Glassmorphism styling, responsive grid, Renaissance palette
├── js/
│   ├── cards-data.js       # Complete 90 development cards & 10 noble tiles dataset
│   ├── engine.js           # Deterministic Splendor state machine & rules validator
│   ├── ai.js               # 3 AI difficulty tiers (Apprentice, Merchant, Master)
│   ├── audio.js            # Web Audio API procedural sound synthesizer
│   ├── visual3d.js         # Three.js 3D gem token canvas with 2D fallback
│   ├── ui.js               # Reactive DOM controller, affordability glow, timer, modals
│   └── app.js              # Application coordinator, lobby, and networking
├── server.py               # Zero-dependency Python HTTP & WebSocket multiplayer server
├── tests/
│   └── test_splendor.py    # Automated test suite for rules & dataset integrity
├── splendor_prd.md         # Full Product Requirements Document
└── README.md               # Documentation & user guide
```

