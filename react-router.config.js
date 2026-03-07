import slugify from "@sindresorhus/slugify";
import golfClubs from "./data/golf-clubs.json";

/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: true,
  async prerender() {
    const paths = ["/", "/explore", "/sitemap.xml"];
    try {
      const data = golfClubs;
      paths.push(
        ...data.features.map((f) => {
          const { id, name } = f.properties;
          return name ? `/club/${id}-${slugify(name)}` : `/club/${id}`;
        }),
      );
    } catch (e) {
      console.warn("Failed to fetch golf clubs for pre-rendering:", e.message);
    }
    return paths;
  },
};
