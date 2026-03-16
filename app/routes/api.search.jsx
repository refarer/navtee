import MiniSearch from "minisearch";
import golfClubs from "@/data/golf-clubs.json";

const miniSearch = new MiniSearch({
  idField: "id",
  fields: ["name", "address", "operator"],
  storeFields: ["name", "address", "id", "type"],
  searchOptions: {
    boost: { name: 2 },
    fuzzy: 0.2,
    prefix: true,
  },
});

miniSearch.addAll(
  golfClubs.features.map((f) => ({
    id: f.properties.id,
    name: f.properties.name,
    address: f.properties.address,
    operator: f.properties.operator,
    type: f.properties.type,
  })),
);

export async function loader({ request }) {
  const q = new URL(request.url).searchParams.get("q") || "";

  if (!q.trim()) {
    return Response.json([]);
  }

  const results = miniSearch.search(q).slice(0, 20).map((hit) => ({
    name: hit.name,
    display_name: hit.address || hit.name,
    osm_id: hit.id,
    osm_type: hit.type,
  }));

  return Response.json(results, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
