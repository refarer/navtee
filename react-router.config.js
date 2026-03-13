import slugify from "@sindresorhus/slugify";
import { readdirSync } from "fs";
import golfClubs from "./public/data/golf-clubs.json";

/** @type {import('@react-router/dev/config').Config} */
export default {
  ssr: true,
  async prerender() {
    const paths = ["/", "/explore", "/sitemap.xml"];

    // IDs of courses that have prebuilt hole data
    let coursesWithHoles = new Set();
    const files = readdirSync("public/data/courses");
    coursesWithHoles = new Set(files.map((f) => f.replace(".json", "")));

    for (const f of golfClubs.features) {
      const { id, name } = f.properties;
      if (!coursesWithHoles.has(String(id))) continue;
      paths.push(name ? `/club/${id}-${slugify(name)}` : `/club/${id}`);
    }

    return paths;
  },
};
