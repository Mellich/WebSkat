The following changes and additions are planned for this project:

Bug fixes and inconsistencies:
- The result dialog shows only the standard score, even when Seeger scoring is selected. Also show default score in statistics by default.
- The reducedMotion setting is saved but has no control in Settings and nothing reads it. Clean it up.
- The UI never sends the leave or abort-game commands. A client that clicks Leave just disconnects and stays seated until the host kicks it. Fix it to send the commands as intended.
- Illegal cards are plain images with no aria-disabled. The announce.* texts exist but are never used, and card images aren't preloaded. Preload cards, actually use the disabling for disabled cards during the game, remove unused texts.

Update the documentation accordingly, if required.
Do the changes step-by-step and complete the implementation and validation of one fix before starting the next. 

The following improvements and addtions have to be implemented:
- keep the order of played cards on the table the same: The left player card should always show up as the left card, the right player card should show as the right card. The center card should always be your own card. Move the center card down to form a trangle with the played cards so it gets easier to understand, who played the card. Keep the names on the card.
- support for reconnects and replacement of disconnected players during a game with freshly joined players: Let the host allow to replace a disconnected player seat with a player that is waiting in the lobby. Allow kicking of players during the game and replacing them with players in the lobby or bots. Support reinviting disconnected players via a code or link.
- Add Ramsch as play type: during ramsch, all playrs play on their own and have to make as less points as possible. Add a setting to the table: Start a Ramsch round, if all players leave the bidding without a bid. Usually this would mean the cards are given again, but then a Ramsch round should start instead!
- Add Bockrunden to the game: Bockrunden can be enabled in the table settings. If enabled, if a game ends with 60 points for each team, the next three games are Bockrunden and the points are doubled.
- Create a game log that can be opened via a button on in the top row similar to the settings. The log should contain joins and disconnects of players, bidding updates, updates if the game type is announced, updates ,if a game ended with the winner and points.
- Improve bidding visualization: Currently, bidding is hard to follow for players that are currently not part of the bidding. Also, the bidding screen does not give a good overview. Instead of plain concatenated string in the bidding screen, only show the last bid and also show speak bubbles below the player that does the bid. The speach bubble should contain the number of the bid, i.e. 18, 20,... It should be visible for a second, the duration the bubble is visible should be configurable in the settings. After the bidding is over and the player chooses the game, the status bar (the bar above your own cards) for all players should also show, at which bid the player won the bidding. It should also give updates if the player took the Skat.
