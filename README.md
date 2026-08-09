# Esports Elite

**Where Grind Becomes Greatness.**

A premium BGMI / PUBG team training and match analytics platform. Built with Vite + React 18 + Tailwind CSS. 100% client-side — all data lives in `localStorage`. Ready to deploy as a static site on Hostinger.

---

## Features

- **Login / Landing** — Split-screen branded entry with feature pills.
- **Dashboard** — Live stats: practice time, daily streak, weekly consistency, sessions this month, Focus Tomorrow, Priority Focus, recent sessions.
- **Training Center**
  - **Modules:** ADS (17 primary + 14 secondary guns × 8 drills), Spray Training (4 drills), Car Spray (3 drills), Close Range (6 drills).
  - **Drill timer:** start / pause / complete with optional manual duration.
  - **Match Logger:** Classic, Scrims, Tournament with full match history table.
- **Profile** — Editable avatar (auto-initials), username, email, phone, IGN, IG ID.
- **Persistent shell:** collapsible sidebar, top bar with user dropdown, fully responsive (1280px desktop / 768px tablet).

---

## Setup (one time)

You need Node.js **18+** and npm installed.

1. Download & install Node.js LTS from [https://nodejs.org](https://nodejs.org)
2. Open PowerShell in this folder and run:

```powershell
cd D:\Karthik\Claude\esports-elite
npm install
```

---

## Run locally (dev mode)

```powershell
npm run dev
```

Vite will print a local URL (typically `http://localhost:5173`). Open it in your browser.

---

## Build for production (Hostinger)

```powershell
npm run build
```

This creates a `dist/` folder with the static site.

### Upload to Hostinger

1. Open Hostinger **File Manager**.
2. Navigate to `public_html/` (or a subfolder).
3. Upload **everything inside `dist/`** (not the `dist` folder itself — its contents).
4. That's it — the site is live.

Because `vite.config.js` uses `base: './'`, all asset paths are relative so it works in subdirectories too.

---

## Project structure

```
esports-elite/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx               # entry
    ├── App.jsx                # router + auth guard
    ├── index.css              # Tailwind + global styles
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Training.jsx
    │   └── Profile.jsx
    ├── components/
    │   ├── Layout.jsx
    │   ├── Sidebar.jsx
    │   ├── TopBar.jsx
    │   ├── StatCard.jsx
    │   ├── DrillTimer.jsx
    │   ├── ModuleCard.jsx
    │   └── MatchLogger.jsx
    ├── hooks/
    │   ├── useLocalStorage.js
    │   ├── useStats.js
    │   └── useStreak.js
    └── utils/
        ├── constants.js       # guns, drills, maps
        └── helpers.js
```

---

## localStorage keys

| Key                    | Holds                                |
|------------------------|--------------------------------------|
| `esportshub_auth`      | `true` when signed in                |
| `esportshub_user`      | `{ username, email, phone, ign, igId }` |
| `esportshub_sessions`  | drill session log (array)            |
| `esportshub_matches`   | match logger entries (array)         |
| `esportshub_streak`    | reserved                             |

Clear in DevTools → Application → Local Storage to reset all data.

---

## Color palette

- BG: `#0A0A0F` / `#111118` / `#1A1A24`
- Accent: `#E8001C` → `#FF2D44`
- Gold: `#FFD700`
- Text: `#F0F0F0` / `#9999AA` / `#555566`

Fonts: **Rajdhani** (display), **Exo 2** (body), **Share Tech Mono** (stats).

---

© 2025 Esports Elite
