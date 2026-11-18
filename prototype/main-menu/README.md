# PROTOTYPE: main menu (#4). Throwaway. Never merge to main.

Question: what should the Main menu and the Player vs Player entry look like?

Run (from the repo root of this branch):

    python3 -m http.server 8123      # or: npx serve .

Open http://localhost:8123/index.html?variant=A  (B, C). Switch with the bottom bar or the arrow keys.

- A: Stacked menu: classic button stack; Room entry is a separate screen.
- B: Split doors: two halves; the Player vs Player half expands in place into the Room entry.
- C: Flip cards: two Gwent-style cards; the Player vs Player card flips to the Room entry.

Everything is mock (no networking). The Simulator panel (bottom right) fires opponent events.
The Lobby is the real deck-maker in Room mode (Start game -> Ready, Opponent's Deck panel -> opponent status).
Join codes: PLAY works, FULL = full Room, anything else = not found. Name field gates Create/Join.
