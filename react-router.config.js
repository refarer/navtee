import slugify from "@sindresorhus/slugify";
import golfClubs from "./data/golf-clubs.json";

/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: true,
  async prerender() {
    const paths = ["/", "/explore", "/sitemap.xml"];

    for (const f of golfClubs.features) {
      const { id, name } = f.properties;
      const slug = name ? `${id}-${slugify(name)}` : `${id}`;
      paths.push(`/club/${slug}`);
    }

    return paths;
  },
};
