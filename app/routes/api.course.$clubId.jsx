import { OverpassClient } from "@/lib/overpass";
import osmtogeojson from "osmtogeojson";
import { addCourses } from "@/lib/utilities";

const overpass = new OverpassClient();

export async function loader({ params, request }) {
  const clubId = params.clubId.split("-")[0];
  const osmType = new URL(request.url).searchParams.get("type");

  const data = await overpass.getGolfCourseData(clubId, osmType);
  const geojson = osmtogeojson(data);

  const result = addCourses(geojson);

  return new Response(JSON.stringify(result), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
