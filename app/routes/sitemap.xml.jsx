import slugify from "@sindresorhus/slugify";
import golfClubs from "@/public/data/golf-clubs.json";

export function loader({ request }) {
  const base = new URL(request.url).origin;

  const staticPaths = ["/", "/explore"];
  const clubPaths = golfClubs.features.map((f) => {
    const { id, name } = f.properties;
    return name ? `/club/${id}-${slugify(name)}` : `/club/${id}`;
  });

  const urls = [...staticPaths, ...clubPaths]
    .map((path) => `  <url><loc>${base}${path}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}
