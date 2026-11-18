# Gwent Classic — 2-Player Online Multiplayer (fork plan)

**Goal:** fork [asundr/gwent-classic](https://github.com/asundr/gwent-classic) and add online 1v1 so I can play Gwent with friends. Non-commercial fun project.

**Upstream snapshot analysed:** commit `08592d8` (2026-05-26). Line numbers below refer to that commit and will drift. Use them as starting points for `grep`, not as exact positions.

---

## 1. Constraints & decisions

| Topic | Decision / note |
|---|---|
| Purpose | Play with friends. No monetisation, so the license is fine. |
| License | MIT + **Commons Clause**: anything except selling is allowed. Card art and music are CD Projekt's, so the fork stays a fan project. |
| Players | 2 per match (1v1). "Friends" means anyone can create or join a room, not 3+ players at one table. |
| Trust model | Friends only. Peer-to-peer is acceptable even though a client *can* inspect the opponent's hand in DevTools. **No anti-cheat.** |
| Hosting | Keep it a static site (GitHub Pages) with no backend of my own if possible. |
| Approach | **Deterministic lockstep:** exchange decks + RNG seed at start, then send only player *inputs*. Both clients simulate the same game. |
| Transport | **PeerJS** (WebRTC data channel; free public signalling server). Fallbacks if NAT is a problem: a TURN server, or a tiny WebSocket relay / Firebase Realtime DB. |
| Out of scope (v1) | Reconnect after disconnect, spectators, matchmaking, server-authoritative rules, mobile polish. |

---

## 2. Codebase map

Vanilla JS, no build step, no framework. Open `index.html` and it runs.

| File | Lines | What's in it |
|---|---|---|
| `gwent.js` | ~3540 | Everything: `ControllerAI`, `Player`, containers (`CardContainer`, `Grave`, `Deck`, `Hand`, `HandAI`, `Row`, `Weather`), `Board`, `Game`, `Card`, `UI`, `Carousel`, `Popup`, `DeckMaker`, globals |
| `abilities.js` | ~520 | `ability_dict`: card abilities (medic, spy, scorch, muster, decoy, leader abilities…) |
| `factions.js` | ~100 | Faction perks (Scoia'tael go-first choice, Monsters keep a unit, Skellige revive, …) |
| `cards.js` | ~220 | Card data (`card_dict`) |
| `decks.js` | ~11 | Premade decks |
| `common.js` | ~90 | Helpers incl. `randomInt(n)` (line ~92), `sleepUntil` |
| `index.html`, `style.css` | | Single page: deck builder + board |

**Globals** (bottom of `gwent.js`, ~3528): `ui`, `board`, `weather`, `game`, `dm` (DeckMaker), plus `player_me` / `player_op` (assigned in `DeckMaker.startNewGame`).

Game logic, DOM manipulation, animations (`await`ed) and SFX are **interleaved in the same async methods**. There's no separate model layer.

### Key flow

```
DeckMaker.startNewGame()            (~2819)  builds me_deck + op_deck (AI deck), new Player(0), new Player(1)
 └─ game.startGame()                (~1486)  initPlayers → draw 10 each → coinToss → initialRedraw → startRound
     └─ Game.startRound / startTurn (~1524 / ~1550)
         └─ currPlayer.startTurn()  Player (~535): if ControllerAI → controller.startTurn(player)
             human input: UI.selectCard (~2058) / UI.selectRow (~2076) / pass button / leader click
             └─ Player.endTurn()    (~581) → game.endTurn() (~1557) → switch player / endRound
```

### The seam we'll use

```js
// gwent.js ~16
class Controller {}                 // human, empty
class ControllerAI { startTurn(player) {...} }

// Player constructor ~463
this.controller = (id === 0) ? new Controller() : new ControllerAI(this);
this.hand       = (id === 0) ? new Hand(elem)   : new HandAI();
```

Plan: add a **`ControllerRemote`** for the opponent. Its `startTurn()` waits for the next network action and executes it through the same code paths a local human would trigger.

---

## 3. Problems to solve (with hook points)

### 3.1 Perspective: `player_me` / `player_op` are hard-coded
- ~64 references across files. The UI assumes the local player is the bottom side (`tag "me"`).
- **Approach:** each client keeps *itself* as `player_me` (id 0) and the remote as `player_op` (id 1). Messages must use **perspective-neutral IDs** (e.g. "host"/"guest" or seat 0/1) and be mapped on receipt.
- Watch for `instanceof ControllerAI` and `instanceof HandAI` checks (e.g. ~544, ~1339, ~2212, ~3339, `factions.js` ~44). Many of them really mean "is this the non-local player?"

### 3.2 Randomness must be identical on both clients
Replace `Math.random` with a **seeded PRNG** (e.g. mulberry32/sfc32) seeded by the host and sent in the handshake. Inventory:

| Location | What | Notes |
|---|---|---|
| `common.js` ~92 `randomInt` | Used by AI + containers | Make it use the seeded RNG |
| `gwent.js` ~678 `findCardsRandom` / ~705 `getCardsRandom` | Random subset | Via `randomInt` |
| `gwent.js` ~745 `addCardRandom` (called from `Deck.initialize` ~878, `Deck.addCard` ~886) | **Deck shuffle** | Critical for sync |
| `gwent.js` ~1508 `coinToss` | Who goes first | Must be the same on both sides, or host decides |
| `gwent.js` ~268 | AI agile row tie-break | AI only. Use a separate unseeded RNG for AI so it doesn't consume the shared stream |
| `abilities.js` ~162 | Random grave unit (revive-type ability) | |
| `abilities.js` ~195 | Agile row coin-flip | |
| `abilities.js` ~308 | Reveal 3 random cards from opponent hand (leader) | |
| `factions.js` ~45 | Scoia'tael AI go-first choice | AI path only |
| `factions.js` ~70, ~81 | Skellige / grave random revives | |
| `gwent.js` ~2217 | AI carousel pick | AI path only |

⚠️ **Order of RNG calls must be identical on both clients.** Any RNG call that runs on only one side (AI logic, UI-only randomness) desyncs the stream. Use two RNGs: `sharedRng` (seeded, game rules) and `localRng` (cosmetic/AI).

### 3.3 Stable card identity
`Card` objects have no instance ID. Add `card.uid` assigned deterministically at deck build (e.g. `seat * 1000 + index` from the deck list *before* shuffling), plus a global `uid → Card` lookup. Messages reference `uid`, never DOM elements or array indices that differ per client.

### 3.4 Hidden hand
The opponent's hand is `HandAI`, an invisible container. For the remote player, `HandAI` (or a `HandRemote`) should still *hold the real cards* because the deck is known via seed + deck list. It just isn't rendered. Lockstep needs this.

### 3.5 Choice dialogs (carousels & popups)
`UI.queueCarousel` (~2210) **returns immediately when `game.currPlayer === player_op` and the controller isn't AI**. For remote play it must instead **await the remote player's choice** from the network. Locally, the choice made in a carousel must be **sent**.

Call sites to wire up:

| Location | Purpose |
|---|---|
| `gwent.js` ~1516 `initialRedraw` | Choose up to 2 cards to redraw. **Both players choose simultaneously** → needs a "both ready" barrier |
| `abilities.js` ~168 | Pick unit from grave (medic-like) |
| `abilities.js` ~333 | Grave pick |
| `abilities.js` ~359 | Grave pick (revive) |
| `abilities.js` ~378–379 | Discard 2 from hand, then draw 1 from deck (leader) |
| `abilities.js` ~396 | Pick weather from deck (leader) |
| `factions.js` ~42 | Scoia'tael popup: go first / let opponent start |
| `gwent.js` ~1662 `ui.popup` | End-of-game popup (rematch / customise). Needs a network "rematch" handshake |
| `gwent.js` ~2752, ~2770, ~3037 | Deck-builder / view-only carousels. Probably local only, verify |

Generic idea: wrap choices in `await chooser(player, container, count, predicate)`. For the local player it opens the carousel and broadcasts the picks (`uid`s). For the remote player it awaits a `choice` message.

### 3.6 Input entry points to intercept
- `UI.selectCard` (~2058): Decoy target selection
- `UI.selectRow` (~2076): play a card to a row / Scorch / horn
- Pass button → `Player.passRound` (~550)
- Leader click → `Player.activateLeader` (~610)

Each one should emit an action **and** execute it locally. Remote actions run through the same function with the remote `Player`.

### 3.7 Async / animation ordering
Everything is `async` with awaited animations. Incoming actions must go into a **FIFO queue** that is processed one at a time after the previous action fully resolves. Never apply a network message in the middle of an animation.

### 3.8 Desync detection
After every turn, both clients compute a cheap **state hash** (scores per row, hand/deck/grave counts, passed flags, round wins, RNG call counter) and exchange it. On mismatch, show a big warning plus a debug dump. This saves hours of debugging.

---

## 4. Draft network protocol

```jsonc
// handshake (host → guest, guest → host)
{ "t": "hello", "v": 1, "name": "Denys", "deck": { "faction": "...", "leader": <id>, "cards": [[id, count], ...] } }
{ "t": "start", "seed": 123456789, "hostSeat": 0 }        // host only

// in-game, all from the sender's perspective (seat = sender)
{ "t": "redraw",  "uids": [12, 40] }                       // initial redraw (0–2)
{ "t": "play",    "uid": 17, "row": "close" | "ranged" | "siege" | "weather" | null }
{ "t": "decoy",   "uid": 21, "target": 33 }
{ "t": "leader" }
{ "t": "pass" }
{ "t": "choice",  "uids": [5] }                            // answer to a carousel/popup
{ "t": "popup",   "yes": true }                            // Scoia'tael go-first etc.
{ "t": "hash",    "turn": 7, "h": "a1b2c3" }
{ "t": "rematch" } / { "t": "leave" }
```

Rows are owner-relative, so "close" means *the actor's* close row. Spy cards go to the opponent's row, and the game logic already handles that.

---

## 5. Phased implementation plan

Use small, meaningful commits per step.

- [ ] **Phase 0: Setup.** Fork, run locally (`npx serve .`), read `gwent.js` top to bottom once. Optionally add a `CLAUDE.md` with this file's key points.
- [ ] **Phase 1: Determinism groundwork** (still single-player, nothing visible changes)
  - [ ] Seeded `sharedRng` + `localRng`; route every rule RNG call (table 3.2) through `sharedRng`
  - [ ] `card.uid` + `uid → Card` registry
  - [ ] State-hash function
  - [ ] Test: two runs with the same seed + same scripted inputs give the same hash
- [ ] **Phase 2: Action layer** (still offline)
  - [ ] Funnel all human inputs (3.6) and choices (3.5) through `dispatchAction(action)`
  - [ ] Action log + replay. Replaying the log from the seed reproduces the game. This proves lockstep works before any networking
- [ ] **Phase 3: Hot-seat / local loopback**
  - [ ] `ControllerRemote` fed by an in-memory queue; two browser tabs via `BroadcastChannel` makes a cheap 2-client test without WebRTC
  - [ ] Perspective mapping (seat ↔ me/op)
  - [ ] Simultaneous initial redraw barrier
- [ ] **Phase 4: Real networking**
  - [ ] PeerJS: "Create room" → show code/link; "Join room" → enter code
  - [ ] Deck exchange in lobby (each player builds their deck in the existing DeckMaker)
  - [ ] Hash exchange + desync warning
  - [ ] Disconnect handling (v1: show "opponent left", back to menu)
- [ ] **Phase 5: Polish**
  - [ ] Turn timer (optional), opponent name, "waiting for opponent…" states
  - [ ] Rematch flow
  - [ ] Deploy to GitHub Pages, play with friends
- [ ] **Later / maybe:** reconnect via action-log replay, TURN server, spectators, server-authoritative mode (needs logic/DOM separation, close to a rewrite).

**Rough effort:** ~30–60 hours for a playable friends-only version. Phases 1–2 are the riskiest. Once replay works, networking is mostly plumbing.

---

## 6. Gotchas / open questions

- Does any ability logic branch on `player === player_me` in a way that changes **rules** (not just UI)? Grep each hit and classify it as UI-only or rules.
- `instanceof ControllerAI` / `HandAI` checks that gate rules (e.g. agile row choice ~1339, ~3339). Remote players need a real choice path, not an AI one.
- Scoia'tael vs Scoia'tael special case in `initPlayers` (~1455).
- Leader abilities that peek at the opponent's hand/deck (`abilities.js` ~308, `gwent.js` ~3037) only need UI for the local player, but the RNG must still be consumed identically on both sides.
- Card-play animations may read `player_me` for direction or sound. Cosmetic only, fine.
- Floating/timing: `sleepUntil` polling (100 ms) inside carousels must not block processing of the network queue.
- Is the `Nilfgaard` draw-wins perk / Northern Realms extra-card perk purely deterministic? (Probably yes. Verify against table 3.2.)
- PeerJS public signalling server reliability. Fallback: self-host `peerjs-server` on a free tier, or swap the transport for Firebase/Supabase realtime.
- Keep the AI opponent mode working (`?mode=ai` vs online).

---

## 7. Suggested first prompt for Claude Code

> Read `GWENT_MULTIPLAYER_PLAN.md`. We're doing Phase 1 only. First, grep the codebase and verify/update the randomness inventory (section 3.2) and the `player_me`/`instanceof ControllerAI` usages, classifying each as *rules* vs *UI-only*. Report back before changing code. Then implement the seeded RNG split (`sharedRng`/`localRng`) and `card.uid` in small commits, keeping single-player vs AI behaviour unchanged.
