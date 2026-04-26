# Navtee

A golf course directory, GPS yardage, and scorekeeping app powered by OpenStreetMap and the Overpass API. Browse golf clubs worldwide, explore course layouts and track your round.

## Features

- **Club directory** — searchable map of golf courses sourced from OpenStreetMap

- **Play mode** — hole-by-hole layout rendered from OSM geometry with geolocation-aware round tracking with per-hole scoring

- **Explore view** — full-screen map to discover nearby courses

## Tech Stack

- [React Router v7](https://reactrouter.com)
- [MapLibre GL](https://maplibre.org)
- [react-map-gl](https://visgl.github.io/react-map-gl/)
- [MUI](https://mui.com)
- [Overpass API](https://overpass-api.de)
- [Turf.js](https://turfjs.org)

## Getting Started

```bash
pnpm install
```

### Download course data

Fetches golf clubs from OpenStreetMap and writes to `data/golf-clubs.json`:

```bash
pnpm setup
```

> In development, the setup script queries a small bounding box around St Andrews / Fife for fast iteration. In production it fetches all golf courses worldwide.

### Run the dev server

```bash
pnpm dev
```

### Build for production

```bash
pnpm build
pnpm start
```

## Capture Assets

The repo includes a unified capture script for screenshots and demo videos.

All captures are saved to `screenshots/`.

### Capture a screenshot

```bash
pnpm screenshots -- --url "http://localhost:5173/" --executable-path "/path/to/browser"
```

You can pass multiple `--url` values.

Optional flags:

- `--size WIDTHxHEIGHT`
- `--device desktop|mobile`
- `--preset "iPhone 14"`

### Capture a video

```bash
pnpm video -- --url "http://localhost:5173/club/1006012480/play?courseId=928991790" --executable-path "/path/to/browser"
```

Optional flags:

- `--size WIDTHxHEIGHT`
- `--device desktop|mobile`
- `--preset "iPhone 14"`

### Run the default capture sequence

```bash
pnpm capture-sequence -- --executable-path "/path/to/browser"
```

The default sequence captures:

- home screenshot, desktop
- home screenshot, mobile
- explore screenshot, desktop
- explore screenshot, mobile
- play screenshot, desktop
- play screenshot, mobile
- play video, desktop
- play video, mobile

Sequence definitions live in `scripts/capture.js` under `captureSequences`.

## Routes

| Path                 | Description              |
| -------------------- | ------------------------ |
| `/`                  | Home / club search       |
| `/explore`           | Full-screen map explorer |
| `/club/:clubId`      | Club detail page         |
| `/club/:clubId/play` | Play mode (geolocation)  |
| `/sitemap.xml`       | Generated sitemap        |
