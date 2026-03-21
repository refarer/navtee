import { OverpassClient } from "./overpass.js";

const USER_AGENT = "NAVTEE (navtee.com)";

const overpass = new OverpassClient({ headers: { "User-Agent": USER_AGENT } });
import { promises as fs } from "fs";

const OSM_TYPE_PREFIX = { relation: "R", way: "W", node: "N" };

async function nominatimLookup(elements) {
  const ids = elements
    .map((el) => `${OSM_TYPE_PREFIX[el.type] ?? "W"}${el.id}`)
    .join(",");
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${ids}&format=json&addressdetails=1`;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });

    if (res.status === 429 && attempt < 3) {
      const delay = Math.min(1000 * 2 ** attempt, 30000);
      await sleep(delay);
      continue;
    }

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Nominatim error ${res.status}: ${text.slice(0, 200)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Nominatim returned non-JSON response: ${text.slice(0, 200)}`,
      );
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const data = await overpass.getAllGolfClubs();
  const elements = data.elements.filter(
    (el) => el.center || (el.lat && el.lon),
  );

  // Separate named vs unnamed
  const unnamed = elements.filter((el) => !el.tags?.name);

  // Bulk-lookup unnamed elements via Nominatim (max 50 per request)
  const nominatimMap = {};
  for (let i = 0; i < unnamed.length; i += 50) {
    const batch = unnamed.slice(i, i + 50);
    const results = await nominatimLookup(batch);
    for (const result of results) {
      nominatimMap[`${result.osm_type[0].toUpperCase()}${result.osm_id}`] =
        result;
    }
    console.log(
      `Nominatim lookup: ${Math.min(i + 50, unnamed.length)}/${unnamed.length}`,
    );
    if (i + 50 < unnamed.length) await sleep(1100);
  }

  const features = elements.map((el) => {
    const key = `${OSM_TYPE_PREFIX[el.type] ?? "W"}${el.id}`;
    const nom = nominatimMap[key];

    const name =
      el.tags?.name ||
      nom?.display_name?.split(",")[0] ||
      "Unnamed Golf Course";
    if (!el.tags?.name) console.log(`[${key}] name from nominatim: ${name}`);
    const address =
      [
        el.tags?.["addr:street"],
        el.tags?.["addr:city"],
        el.tags?.["addr:state"],
        el.tags?.["addr:postcode"],
        el.tags?.["addr:country"],
      ]
        .filter(Boolean)
        .join(", ") ||
      nom?.display_name ||
      null;

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          el.center ? el.center.lon : el.lon,
          el.center ? el.center.lat : el.lat,
        ],
      },
      properties: {
        id: el.id,
        name,
        type: el.type,
        website: el.tags?.website || el.tags?.["contact:website"] || null,
        phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
        address,
        holes: el.tags?.holes ? parseInt(el.tags.holes, 10) : null,
        par: el.tags?.par ? parseInt(el.tags.par, 10) : null,
        operator: el.tags?.operator || null,
        description: el.tags?.description || null,
        opening_hours: el.tags?.opening_hours || null,
      },
    };
  });

  const geojson = { type: "FeatureCollection", features };
  await fs.writeFile("./data/golf-clubs.json", JSON.stringify(geojson), "utf8");
  console.log(`Wrote ${features.length} clubs to data/golf-clubs.json`);
})();
