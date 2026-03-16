import { OverpassClient } from "@/lib/overpass";

const overpass = new OverpassClient();
import osmtogeojson from "osmtogeojson";
import { addCourses } from "@/lib/utilities";

export async function golfCourseGeoJSONWithCourses(clubId, osmType) {
  console.info(
    "[golfClubs] golfCourseGeoJSONWithCourses - start",
    clubId,
    osmType,
  );
  const data = await overpass.getGolfCourseData(clubId, osmType);
  const geojson = osmtogeojson(data);
  let clubGeoJSON;
  try {
    clubGeoJSON = addCourses(geojson);
  } catch (error) {
    console.error("[golfClubs] addCourses error, returning raw geojson", error);
    clubGeoJSON = geojson;
  }
  console.info("[golfClubs] golfCourseGeoJSONWithCourses - done");
  return clubGeoJSON;
}

export async function getGolfClubInfo(clubId) {
  console.info("[golfClubs] getGolfClubInfo - start", clubId);
  const clubInfo = await overpass.getGolfCourseData(clubId);
  if (clubInfo)
    console.info("[golfClubs] getGolfClubInfo - found", clubInfo.id);
  else console.warn("[golfClubs] getGolfClubInfo - not found", clubId);
  return clubInfo;
}
