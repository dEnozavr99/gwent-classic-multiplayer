# Gwent Classic Multiplayer

A fan-made Gwent card game that can be played against the computer or, online, against a friend.

## Language

**Game**:
One best-of-three match between two players, from the first deal to the end screen.
_Avoid_: Match, session

**Room**:
A private pairing of exactly two human players, entered with a code or link, that can hold several Games in a row (rematch). Rooms are for friends: everyone who holds the code is trusted.
_Avoid_: Lobby, match, session

**Host**:
The player who created the Room. Chooses the Game's random seed and who goes first, and has no other special authority.
_Avoid_: Server, owner, master

**Seat**:
A player's fixed, perspective-neutral position in a Game (host seat or guest seat). Both clients agree on seats; only the Local player/Opponent view differs per client.
_Avoid_: Side, slot, player id

**Action**:
Something a player did in a Game: play a card, pass, use a leader, make a choice, redraw. Identified by Seat and cards by `uid`, never by screen position.
_Avoid_: Move, command, event

**Local player**:
The human using this client; always shown on the bottom side of the board.
_Avoid_: Me, player_me, self

**Opponent**:
The other player in a Game, whether the computer or a remote human.
_Avoid_: Enemy, player_op, remote player
