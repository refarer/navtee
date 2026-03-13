import osmtogeojson from "osmtogeojson";
import { OverpassClient } from "../lib/overpass.js";

const client = new OverpassClient({
  headers: { "User-Agent": "NAVTEE (navtee.com)" },
});

// St Andrews Links courses (Old, New, Jubilee, Eden, Strathtyrum, Castle)
const ST_ANDREWS_BBOX = "56.338,-2.812,56.362,-2.775";

// Yields { id, type, tags, center: { lat, lon }, features: GeoJSON[] }
export async function* getAllGolfData({ devMode = false } = {}) {
  let clubData;
  if (devMode) {
    clubData = await client.query(`
      [out:json];
      (
        rel["leisure"="golf_course"](${ST_ANDREWS_BBOX});
        way["leisure"="golf_course"](${ST_ANDREWS_BBOX});
      );
      out body center;
    `);
  } else {
    clubData = await client.getAllGolfClubs();
  }

  const elements = clubData.elements.filter((el) => el.center || (el.lat && el.lon));

  for (const el of elements) {
    const data = await client.getGolfCourseData(el.id, el.type);
    const geojson = osmtogeojson(data);

    yield {
      id: el.id,
      type: el.type,
      tags: el.tags ?? {},
      center: el.center ?? { lat: el.lat, lon: el.lon },
      features: geojson.features,
    };
  }
}
