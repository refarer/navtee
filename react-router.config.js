import slugify from "@sindresorhus/slugify";
import golfClubs from "./data/golf-clubs.json";

/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: false,
  async prerender() {
    const paths = ["/", "/explore", "/sitemap.xml"];

    for (const f of golfClubs.features) {
      const { id, name } = f.properties;
      const s = name ? slugify(name) : "";
      const slug = s ? `${id}-${s}` : `${id}`;
      paths.push(`/club/${slug}`, `/club/${id}/play`);
    }

    return paths;
  },
};
