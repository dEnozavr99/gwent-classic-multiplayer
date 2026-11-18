# Relay authority, peer-to-peer first, server later

For the alpha, multiplayer uses a **relay (lockstep)** model: each client runs the full rules, and only the Host's seed and the players' Actions are exchanged, peer-to-peer. We accept that a client can read the Opponent's hand and that a modified client can cheat, because Rooms are friends-only and nothing is ranked. Once the project outgrows friends, an authoritative server that runs the rules replaces the relay.

## Consequences

- **Trust**: friends-only. No anti-cheat. Peer deck validation catches accidents, not malice. Widening the trust boundary is the trigger to move to a server.
- **Randomness**: the Host chooses the seed and who goes first. `sharedRng` (seeded) covers rule outcomes; `localRng` covers AI and cosmetic randomness. Deck shuffles are derived per seat up front; in-game rule randomness is consumed only inside the serialized action queue. Initial redraw is the one simultaneous moment: both choices are exchanged, then applied in fixed seat order (Host first).
- **Failure**: no reconnect in alpha; a dropped connection ends the Game. After each turn the clients compare a state hash, and a mismatch is fatal (the action log and seed are dumped for debugging).
- **Code**: the rules stay entangled with DOM and animation code; no extraction is needed for the relay. `Controller` becomes the seam (human, AI, remote), replacing the `instanceof ControllerAI` branches. The extraction into a headless rules engine is deferred to the server upgrade.
- **Stable contract for the server upgrade**: (1) the wire unit is a seat-relative, `uid`-based Action, never state diffs or DOM/array indices; (2) `card.uid` assignment is deterministic from the decklist; (3) all rule randomness goes through one module so a server can take it over; (4) the `Controller` seam stays Promise-based; (5) an action log (seed plus Actions in order) is kept from the alpha.

## Considered options

- **Server runs the rules now**: rejected for the alpha. It requires the headless rules engine first (a near-rewrite of `gwent.js`) and a backend, which is disproportionate for friends-only play.
- **Per-seat RNG streams instead of a redraw barrier**: rejected. It adds a second stream to specify, and the barrier is needed anyway to hold the Game until both players finish redrawing.
