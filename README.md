# Mahjong Points Tracker · 麻雀计分

A bilingual (EN/中) round-by-round scoring app for Malaysian 3-player and 4-player Mahjong.

## Features

- **Game modes** — Malaysian 3P (dots only, fly tiles) and 4P (standard set)
- **Bilingual** — English / Chinese toggle
- **Fan-based or Simple scoring** — switchable via the Tweaks panel
- **Configurable rules:**
  - Minimum fan to win (default: 5)
  - Max fan cap / limit hand (default: 10, triggers double payout)
  - Base point value
  - Dealer (East) doubling
  - Pairwise loser fan comparison
  - Discard share rules: Standard / Helper / Shooter alone / Shooter full
- **Tracked events per round:**
  - Self-draw (自摸)
  - Discard / shoot (放炮)
  - Draw / no winner (流局) — bonuses still settle
  - Penalty (罚) — default 10 points each
  - Exposed Kong (明杠), Concealed Kong (暗杠), Fed Kong (放杠)
  - Flowers / animals / face tile bonuses
  - Fly tile bonuses (3P mode)
- **Round history** — table view and card view, with edit/delete (confirmation required)
- **Live delta preview** while entering a round
- **Export** — copy as text or save as image
- **localStorage persistence** — resume after closing the browser

## Scoring rules

| Discard share mode | Discarder pays | Others pay |
|---|---|---|
| Standard | 2× | 1× each |
| Helper (1.5×) | 1.5× | 0.5× each |
| Shooter alone | 4P: 3× · 3P: 2× | 0 |
| Shooter pays full | 4P: 4× · 3P: 3× | 0 |

**Limit hand** (winner reaches max fan): payout doubles; pairwise loser compare is skipped.

**Pairwise loser rule**: if enabled, the higher-fan loser collects the fan difference from the lower-fan loser. At least one loser must meet the minimum fan threshold.

**Fed Kong**: only the player who fed the kong tile pays (2× kong points); other non-kong-holders pay nothing.

## Usage

Open `index.html` in any modern browser. No build step required — uses React 18 via CDN + Babel standalone.

Or serve locally:
```bash
npx serve .
# then open http://localhost:3000
```
