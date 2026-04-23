# Navtee

A golf course directory, GPS yardage, and scorekeeping app powered by OpenStreetMap and the Overpass API. Browse golf clubs worldwide, explore course layouts and track your round.

## Features

- **Club directory** — searchable map of golf courses sourced from OpenStreetMap
- **Course detail pages** — hole-by-hole layout rendered from OSM geometry
- **Play mode** — geolocation-aware round tracking with per-hole scoring
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

## Routes

| Path                 | Description              |
| -------------------- | ------------------------ |
| `/`                  | Home / club search       |
| `/explore`           | Full-screen map explorer |
| `/club/:clubId`      | Club detail page         |
| `/club/:clubId/play` | Play mode (geolocation)  |
| `/sitemap.xml`       | Generated sitemap        |
