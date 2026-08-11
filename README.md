# Ledger — Habit Tracker

A single-page habit tracker for exercise, reading, smoking, self-control, and
anti-chastity goals. All data lives in the browser's `localStorage` — nothing
is sent anywhere. Back it up regularly from the **Settings** tab.

## Files

- `index.html` — structure
- `styles.css` — the ledger/instrument-panel design system, light + dark
- `app.js` — all logic: storage, rendering, trends, stats, charts, import/export
- `favicon.svg` — the browser-tab icon (a "§" mark over five accent ticks, one per habit); auto-switches for OS light/dark mode
- `favicon-16.png`, `favicon-32.png` — PNG fallbacks for browsers that don't support SVG favicons
- `apple-touch-icon.png` — the icon iOS uses when you Add to Home Screen
- `icon-512.png` — a larger PNG version, handy if you ever add a web app manifest for a proper installable PWA

No build step. No dependencies to install locally — the only external
resources are Google Fonts and Chart.js, both loaded from CDN at runtime.

## Deploying to GitHub Pages

1. Create a new repository (or use an existing one) and add these three files
   to its root (or to a `docs/` folder — either works).
2. Push to GitHub.
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to "Deploy from a branch,"
   pick the branch (usually `main`) and the folder (`/root` or `/docs`).
5. Save. GitHub will give you a URL like
   `https://yourusername.github.io/repo-name/` within a minute or two.

## Using it on your phone

Open the GitHub Pages URL in Safari, tap the Share icon, then **Add to Home
Screen**. It'll launch full-screen without Safari's address bar, like a
regular app. The layout switches to a bottom tab bar under ~760px width, and
all number inputs use the phone's numeric keypad automatically.

## Theme

The moon/sun button in the top-right corner toggles dark and light mode
anywhere in the app; the same control also lives in **Settings → Appearance**.
Your choice is saved on that device and re-applied on next visit.

## Data model

Everything is stored under one `localStorage` key, `ledger.v1`, as JSON:

```json
{
  "entries": {
    "exercise": [{ "id", "date", "time", "pushups", "pullups", "situps", "squats", "runTime", "runDist" }],
    "reading":  [{ "id", "date", "time", "pages" }],
    "writing":  [{ "id", "date", "time", "words" }],
    "smoking":  [{ "id", "date", "time", "amount" }],
    "onanism":  [{ "id", "date", "time", "count" }],
    "chastity": [{ "id", "date", "time", "count" }]
  },
  "goals": { "smokingDaily": null, "chastityWeekly": null }
}
```

- **Exercise**: log push-ups, pull-ups, sit-ups, squats, and/or a run (time in
  minutes, distance in miles) — leave any field blank to skip it. There's no
  fixed numeric target; the goal is progressive — each card shows a "This
  week vs last" panel comparing every metric, plus how many days you trained,
  against the previous week. The aim is simply to keep beating last week.
- **Reading, Writing, Smoking, Self-Control, Love**: each also gets a "This
  week vs last" panel, comparing total volume and active days against the
  previous week. Reading, Writing, and Love are framed to encourage more
  (green arrow = up); Smoking and Self-Control are framed to encourage less
  (green arrow = down).
- **Smoking** and **Love** additionally support a fixed goal
  (daily max cigarettes, weekly goal) — tap the pencil icon next to the
  goal number on the card itself to set or change it. There's no longer a
  separate goals screen.
- **Writing**: tracks words written per entry, same pattern as Reading.
- **Smoking**: the ½ and 1 cigarette buttons each log a timestamped entry, so
  time-of-day statistics are available later even though logging itself is a
  single tap.
- **Self-Control** and **Love**: single-tap "log occurrence" buttons,
  with an "undo last" button next to each in case of a mis-tap. Internally
  Love is still keyed as `chastity` in storage — only the on-screen label
  changed — so old exported backups still import correctly.

## Backing up

Use **Settings → Export as JSON** to download a full snapshot, and **Settings
→ Import JSON** to restore it in any browser. **Export as CSV** gives a flat
spreadsheet-friendly log of every entry if you'd rather analyze the data in
Excel or similar.

## Customizing

Each habit has its own accent color defined as a CSS variable near the top of
`styles.css` (`--exercise`, `--reading`, `--writing`, `--smoking`, `--onanism`,
`--chastity`), separately for dark (`:root, html[data-theme="dark"]`) and
light (`html[data-theme="light"]`) — change those to re-theme without
touching layout.
