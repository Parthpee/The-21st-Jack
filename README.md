# Blackjack Pro — Phaser Edition

A modern browser-only Blackjack simulation built using **TypeScript + Vite + Phaser**.

This project is a full migration from the original single-file HTML/CSS/JavaScript prototype into a real game-development structure.

## What's included

- Browser-only game, no backend required
- TypeScript architecture
- Phaser canvas table rendering
- Mobile-first responsive HUD and sticky touch controls
- Phone, tablet, desktop, and landscape support
- PWA manifest
- 6-deck shoe
- H17 dealer rule
- Double after split
- Late surrender
- Insurance
- Split hands
- Blackjack pays 3:2
- Hi-Lo running count and true count
- Strategy helper with basic strategy and count deviations
- Monte Carlo-style win probability estimate
- Session stats and round history
- Sarcastic loss roasts
- Keyboard controls
- VS Code tasks
- Unit tests with Vitest

## Requirements

For macOS Catalina, use **Node.js 18**. Newer Vite versions require newer macOS/Node, so this project pins Catalina-safe versions.

Recommended for your Mac:

```bash
node -v   # should be v18.x
npm -v
```

## Run on your Mac

```bash
npm install
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173
```

## Test on your phone

Your phone must be on the same Wi‑Fi as your Mac.

Find your Mac Wi‑Fi IP:

```bash
ipconfig getifaddr en0
```

Then keep the dev server running and open this on your phone, replacing the IP:

```text
http://YOUR-MAC-IP:5173
```

Example:

```text
http://192.168.1.25:5173
```

If it does not open, allow incoming connections for Terminal/Node in macOS firewall settings.

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npm test
```

## Keyboard controls

- Space: Deal
- H: Hit
- S: Stand
- D: Double
- P: Split
- R: Surrender

## Project structure

```text
src/
  game/
    core/       Blackjack rules, cards, shoe, strategy, engine state
    scenes/     Phaser table scene
    runtime.ts  Shared game engine instance
  ui/           DOM HUD binding
  main.ts       Phaser boot entry
```

## Notes

This version does not require card image assets. Cards are drawn dynamically in Phaser, so the game can run immediately after dependencies install. You can later replace the generated card graphics with professional card sprites or a texture atlas.
