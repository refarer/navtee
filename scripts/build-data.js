#!/usr/bin/env node
/**
 * Builds golf course data files using Overpass API + Nominatim.
 *
 * Usage:
 *   # Dev — public APIs, St Andrews bbox only (no docker compose needed):
 *   node scripts/build-data.js --dev
 *
 *   # Production — local docker compose services:
 *   docker compose -f docker-compose.data.yml up
 *   node scripts/build-data.js
 *
 * Output:
 *   public/data/golf-clubs.json     — golf courses (for search)
 *   public/data/courses/{id}.json   — per-course GeoJSON for courses with >= 1 hole
 */

import { promises as fs } from "fs";
import path from "path";
import { getAllGolfData } from "./overpass.js";
import { addCourses } from "../lib/utilities.js";

const devMode = process.argv.includes("--dev");

const USER_AGENT = "NAVTEE (navtee.com)";
const CLUBS_FILE = "public/data/golf-clubs.json";
const COURSES_DIR = "public/data/courses";
const NOMINATIM_BASE = (process.env.NOMINATIM_URL ?? (devMode ? "https://nominatim.openstreetmap.org" : "http://localhost:8080")).replace(/\/$/, "");

const OSM_TYPE_PREFIX = { relation: "R", way: "W", node: "N" };


async function nominatimLookup(courses) {
  const ids = courses
    .map((c) => `${OSM_TYPE_PREFIX[c.type] ?? "W"}${c.id}`)
    .join(",");
  const url = `${NOMINATIM_BASE}/lookup?osm_ids=${ids}&format=json&addressdetails=1`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return res.json();
}

function getAddress(tags, nom) {
  const fromTags = [
    tags?.["addr:street"],
    tags?.["addr:city"],
    tags?.["addr:state"],
    tags?.["addr:postcode"],
    tags?.["addr:country"],
  ]
    .filter(Boolean)
    .join(", ");
  return fromTags || nom?.display_name || null;
}

async function main() {
  await fs.rm(COURSES_DIR, { recursive: true, force: true });
  await fs.mkdir(COURSES_DIR, { recursive: true });

  console.log(devMode
    ? "Fetching St Andrews courses via public Overpass API..."
    : "Fetching golf course data via Overpass...");

  // Stream courses — write course files immediately, buffer only lightweight metadata
  const courseMeta = []; // { id, type, tags, center } — no features
  let total = 0, saved = 0;

  for await (const course of getAllGolfData({ devMode })) {
    total++;
    courseMeta.push({ id: course.id, type: course.type, tags: course.tags, center: course.center });

    const geojson = { type: "FeatureCollection", features: course.features };
    const holes = geojson.features.filter((f) => f.properties.golf === "hole");
    if (holes.length >= 1) {
      let processed = geojson;
      try {
        processed = addCourses(geojson);
      } catch (e) {
        console.warn(`  [${course.id}] addCourses failed: ${e.message}`);
      }
      await fs.writeFile(path.join(COURSES_DIR, `${course.id}.json`), JSON.stringify(processed), "utf8");
      saved++;
    }

    if (total % 500 === 0) console.log(`  Processed ${total} courses...`);
  }

  console.log(`Got ${total} courses. ${saved} with holes saved → ${COURSES_DIR}/`);

  // Nominatim reverse-geocode for courses without a name
  const unnamed = courseMeta.filter((c) => !c.tags?.name);
  const nominatimMap = {};
  for (let i = 0; i < unnamed.length; i += 50) {
    const batch = unnamed.slice(i, i + 50);
    const results = await nominatimLookup(batch);
    for (const r of results) {
      nominatimMap[`${r.osm_type[0].toUpperCase()}${r.osm_id}`] = r;
    }
    console.log(`  Nominatim: ${Math.min(i + 50, unnamed.length)}/${unnamed.length}`);
  }

  // Build golf-clubs.json
  const clubFeatures = courseMeta.map((course) => {
    const key = `${OSM_TYPE_PREFIX[course.type] ?? "W"}${course.id}`;
    const nom = nominatimMap[key];
    const name = course.tags?.name || nom?.display_name?.split(",")[0] || "Unnamed Golf Course";
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [course.center.lon, course.center.lat] },
      properties: {
        id: course.id,
        name,
        type: course.type,
        website: course.tags?.website || course.tags?.["contact:website"] || null,
        phone: course.tags?.phone || course.tags?.["contact:phone"] || null,
        address: getAddress(course.tags, nom),
        holes: course.tags?.holes ? parseInt(course.tags.holes, 10) : null,
        par: course.tags?.par ? parseInt(course.tags.par, 10) : null,
        operator: course.tags?.operator || null,
        description: course.tags?.description || null,
        opening_hours: course.tags?.opening_hours || null,
      },
    };
  });

  await fs.writeFile(CLUBS_FILE, JSON.stringify({ type: "FeatureCollection", features: clubFeatures }), "utf8");
  console.log(`Wrote ${clubFeatures.length} clubs → ${CLUBS_FILE}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
