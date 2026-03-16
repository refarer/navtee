import slugify from "@sindresorhus/slugify";
import golfClubs from "./data/golf-clubs.json";

/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: true,
  async prerender() {
    const paths = ["/", "/explore", "/sitemap.xml"];

    for (const f of golfClubs.features) {
      const { id, name } = f.properties;
      paths.push(name ? `/club/${id}-${slugify(name)}` : `/club/${id}`);
    }

    return paths;
  },
};
