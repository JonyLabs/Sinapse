# SINAPSE — Conceptual Association Card Game

A dark, futuristic social card game where players forge conceptual connections
between ideas and convince their friends they make sense.

---

## Quick Start

### Option A — With real card images

1. Place your card images in the `img/` folder:
   - `img/15.png` → Card back
   - `img/16.png` through `img/75.png` → Card fronts (60 unique concept cards)

2. Open `index.html` in a browser:
   ```
   # Using Python's built-in server (recommended):
   python3 -m http.server 8080
   # Then open http://localhost:8080
   ```
   > **Note:** Images require a local server due to browser CORS rules.
   > Simply opening `index.html` directly may block image loading in some browsers.

### Option B — Generate placeholder images first

```bash
pip install Pillow
python3 generate_placeholder_cards.py
python3 -m http.server 8080
```

Then visit `http://localhost:8080` in your browser.

---

## How to Play

### Setup
1. Choose 1–4 players
2. Enter player names
3. Click **INITIATE GAME**

Each player gets 5 cards. The goal: create clever conceptual connections.

### Turn Flow

1. **Select a card** from your hand (click to select, click again to deselect)
2. **Write a phrase** explaining how your card connects to the cards in the pool
   - First card played: just describe the concept freely
   - Subsequent cards: connect to what's already there
3. **Click PLAY**
4. **Other players vote** YES or NO in sequence
5. Majority wins:
   - ✓ SYNAPSE! → 1 point for the playing player
   - ✗ REJECTED → no points
6. Playing player draws 1 card; next player's turn begins

### Example

**Pool:** Fire, Speed  
**New card:** Animal  
**Phrase:** *"A tiger sprinting through burning grass"*  

→ Other players decide if that connection is vivid/creative enough!

### Concept Pool Rules

- Maximum **4 cards** can be in the pool at once
- When the pool reaches 4, a **"Propose Pool Reset"** button appears
- If the playing player proposes a reset, **all players vote** to clear or keep
- Reset approved → pool clears, fresh chain begins

### Scoring

- +1 point each time your played card + phrase wins the vote
- Most points when the deck runs out = winner

---

## Adding More Cards

To expand the deck beyond card 75:

1. Add images `76.png`, `77.png`, etc. to the `img/` folder
2. In `index.html`, update this line in `CONFIG`:
   ```js
   CARD_IMG_END: 75,  // ← change to your new highest number
   ```

That's it — the game auto-generates the deck from the range.

---

## File Structure

```
sinapse/
├── index.html                    ← Complete game (HTML + CSS + JS)
├── generate_placeholder_cards.py ← Optional: creates test images
├── README.md                     ← This file
└── img/
    ├── 15.png   ← Card back
    ├── 16.png   ← Concept card 1
    ├── ...
    └── 75.png   ← Concept card 60
```

---

## Architecture Notes

The codebase is organized into clear sections inside `index.html`:

| Section | Purpose |
|---------|---------|
| `CONFIG` | All tunable constants (hand size, pool max, image paths) |
| `STATE`  | Single source of truth for all game state |
| `buildDeck / dealCards` | Deck management, shuffling |
| `playCard / castVote / resolveVoting` | Core game logic |
| `renderGame / render*` | All DOM rendering (pure functions reading STATE) |
| Event listeners | User input → state mutation → re-render |

To add online multiplayer: replace the `STATE` mutations with WebSocket messages
and the render functions stay exactly the same.

---

## Optional Features (Future)

- [ ] Sound effects (Web Audio API)
- [ ] Turn timer
- [ ] Drag-and-drop card placement
- [ ] AI player mode
- [ ] Online multiplayer via WebSockets
- [ ] Persistent score leaderboard
