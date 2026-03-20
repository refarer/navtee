const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export class OverpassClient {
  constructor({ headers } = {}) {
    this._headers = headers ?? {};
  }

  async query(q) {
    let lastError;
    for (const url of OVERPASS_MIRRORS) {
      let response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...this._headers,
          },
          body: `data=${encodeURIComponent(q)}`,
        });
      } catch (err) {
        lastError = err;
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status} from ${url}`);
        continue;
      }
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(text);
      }
    }
    throw lastError ?? new Error("All Overpass mirrors failed");
  }

  async getGolfClubInfo(osmId) {
    const query = `
[out:json];
wr(${osmId});
out tags;
    `;
    const data = await this.query(query);
    if (Array.isArray(data.elements) && data.elements?.length >= 1)
      return data.elements[0];
    else throw new Error("Couldn't find golf club");
  }

  async getGolfCourseData(osmId, osmType) {
    let elementQuery;
    if (osmType === "relation") {
      elementQuery = `relation(${osmId}) -> .golf_course_relation;`;
    } else if (osmType === "way") {
      elementQuery = `
way(${osmId}) -> .golf_course_way;
// Find adjacent golf course ways (same course split across multiple ways)
way(around.golf_course_way:200)["leisure"="golf_course"] -> .sibling_ways;
(.golf_course_way; .sibling_ways;) -> .golf_course_way;
(.golf_course_way;);
rel(bw)["leisure"="golf_course"] -> .golf_course_relation;`;
    } else {
      // Unknown type — try both with tag filters to avoid ID collisions
      elementQuery = `
way(${osmId})["leisure"="golf_course"] -> .golf_course_way;
// Find adjacent golf course ways (same course split across multiple ways)
way(around.golf_course_way:200)["leisure"="golf_course"] -> .sibling_ways;
(.golf_course_way; .sibling_ways;) -> .golf_course_way;
(.golf_course_way;);
rel(bw)["leisure"="golf_course"] -> .golf_course_relation;
relation(${osmId})["leisure"="golf_course"] -> .rel_direct;
(.golf_course_relation; .rel_direct;) -> .golf_course_relation;`;
    }

    const query = `
[out:json];
${elementQuery}

(
 .golf_course_relation;
 .golf_course_way;
);

map_to_area ->.golfcourse;

(
  nwr(area.golfcourse)[golf];
  nwr(area.golfcourse)[natural=tree];
  nwr(area.golfcourse)[natural=water];
) -> .golfInfo;
.golfInfo out;.golfInfo >;out geom;
`;
    return this.query(query);
  }

  async getAllGolfClubs() {
    let query;
    if (process.env.NODE_ENV !== "production") {
      // Small bbox around St Andrews / Fife for fast dev queries
      query = `
[out:json];
(
  rel["leisure"="golf_course"](56.2,-3.2,56.5,-2.7);
  way["leisure"="golf_course"](56.2,-3.2,56.5,-2.7);
);
out body center;`;
    } else {
      query = `
[out:json];
relation["leisure"="golf_course"];

out body center;

way["leisure"="golf_course"];

out tags center;`;
    }
    return this.query(query);
  }
}

export function extractCourseById(clubData, courseId) {
  const courseFeatures = clubData.features.filter(
    (feature) =>
      // Include features specific to the course
      feature.properties.courseId === courseId ||
      (courseId === "default" && !feature.properties.courseId) ||
      // Include all features that aren't holes
      feature.properties.golf !== "hole",
  );

  if (courseFeatures.length === 0) {
    return null;
  }

  return {
    type: "FeatureCollection",
    features: courseFeatures,
  };
}
