import slugify from "@sindresorhus/slugify";

export async function loader() {
  const golfClubs = (await import("@/data/golf-clubs.json")).default;
  const base = "https://navtee.com";

  const staticPaths = ["/", "/explore"];
  const clubPaths = golfClubs.features.map((f) => {
    const { id, name } = f.properties;
    const s = name ? slugify(name) : "";
    return s ? `/club/${id}-${s}` : `/club/${id}`;
  });

  const urls = [...staticPaths, ...clubPaths]
    .map((path) => `  <url><loc>${base}${path}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}