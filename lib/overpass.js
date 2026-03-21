const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

export class OverpassClient {
  constructor({ headers } = {}) {
    this._headers = headers ?? {};
  }

  async query(q, { maxRetries = 3 } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const response = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          ...this._headers,
        },
        body: `data=${encodeURIComponent(q)}`,
      });

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(1000 * 2 ** attempt, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      const text = await response.text();
      if (!response.ok) {
        throw new Error(
          `Overpass API error ${response.status}: ${text.slice(0, 200)}`,
        );
      }
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(
          `Overpass API returned non-JSON response: ${text.slice(0, 200)}`,
        );
      }
    }
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
  nwr(area.golfcourse)[natural];
) -> .golfInfo;
.golfInfo out;.golfInfo >;out geom;
(.golf_course_relation; .golf_course_way;);out geom;
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
[out:json][timeout:300];
relation["leisure"="golf_course"];

out body center;

way["leisure"="golf_course"];

out body center;`;
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
