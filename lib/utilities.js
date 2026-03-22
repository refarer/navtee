import * as turf from "@turf/turf";

export function addCourses(golfClubs) {
  const newGolfClubs = { ...golfClubs };
  let holes = newGolfClubs.features.filter(
    (feature) => feature.properties.golf === "hole",
  );

  if (process.env.NODE_ENV === "development")
    console.log(
      "[addCourses] debug input",
      JSON.stringify(
        {
          totalFeatures: newGolfClubs.features.length,
          holeCount: holes.length,
          holes: holes.map((h) => ({
            id: h.properties.id,
            ref: h.properties.ref,
            refParsed: parseInt(
              String(h.properties.ref ?? "").replace(/\D/g, ""),
              10,
            ),
            par: h.properties.par,
            courseId: h.properties.courseId,
            teeBox: h.geometry.coordinates[0],
            flag: h.geometry.coordinates[h.geometry.coordinates.length - 1],
          })),
        },
        null,
        2,
      ),
    );

  // Extract ref numbers - handle compound refs like "1/10" or "5;14"
  // Also handle suffixed refs like "3M", "1T" where the letter denotes the course
  const expandedHoles = [];
  const cloneGroups = new Map(); // original id → array of all holes (original + clones)
  holes.forEach((hole) => {
    const refStr = String(hole.properties.ref ?? "").trim();
    const suffixMatch = refStr.match(/^(\d+)\s*([A-Za-z]+)$/);
    if (suffixMatch) {
      hole.properties.ref = parseInt(suffixMatch[1], 10);
      hole.properties.courseId = suffixMatch[2].toUpperCase();
      expandedHoles.push(hole);
    } else {
      const parts = refStr
        .split(/[\/;]/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (parts.length > 1) {
        // Compound ref (e.g. "1/10", "5;14") - duplicate hole for each number
        // First entry reuses the original (which is already in features)
        hole.properties.ref = parts[0];
        const group = [hole];
        cloneGroups.set(hole.properties.id, group);
        expandedHoles.push(hole);
        for (let i = 1; i < parts.length; i++) {
          const clone = {
            ...hole,
            properties: { ...hole.properties, ref: parts[i], id: `${hole.properties.id}:${parts[i]}` },
          };
          group.push(clone);
          expandedHoles.push(clone);
          newGolfClubs.features.push(clone);
        }
      } else {
        hole.properties.ref = parts.length > 0 ? parts[0] : NaN;
        expandedHoles.push(hole);
      }
    }
  });
  holes = expandedHoles;

  const holesByRef = holes
    .filter((hole) => !hole.properties.courseId)
    .reduce((acc, hole) => {
      (acc[hole.properties.ref] = acc[hole.properties.ref] || []).push(hole);
      return acc;
    }, {});

  if (process.env.NODE_ENV === "development")
    console.log("[addCourses] debug after parsing", {
      holesByRef: Object.fromEntries(
        Object.entries(holesByRef).map(([ref, holes]) => [
          ref,
          holes.map((h) => h.properties.id),
        ]),
      ),
    });

  for (let index = 1; index < 18; index++) {
    const currentHoles = holesByRef[index] || [];
    let nextHoles = [];
    let nextIndex = index + 1;

    // Keep searching for next holes until we find some or reach the end
    while (nextHoles.length === 0 && nextIndex <= 18) {
      nextHoles = holesByRef[nextIndex] || [];
      nextIndex++;
    }

    // Sort so holes closest to an available next hole claim first
    const sortedHoles = [...currentHoles].sort((a, b) => {
      if (nextHoles.length === 0) return 0;
      const aFlag = turf.point(a.geometry.coordinates[a.geometry.coordinates.length - 1]);
      const bFlag = turf.point(b.geometry.coordinates[b.geometry.coordinates.length - 1]);
      const aMin = Math.min(...nextHoles.map((nh) => turf.distance(aFlag, turf.point(nh.geometry.coordinates[0]))));
      const bMin = Math.min(...nextHoles.map((nh) => turf.distance(bFlag, turf.point(nh.geometry.coordinates[0]))));
      return aMin - bMin;
    });

    sortedHoles.forEach((hole) => {
      const holeFlagPoint = turf.point(
        hole.geometry.coordinates[hole.geometry.coordinates.length - 1],
      );

      // Find closest unclaimed next hole within a reasonable distance
      const MAX_LINK_DISTANCE = 0.5; // km - max distance between flag and next tee
      const closest = nextHoles
        .filter((nh) => !nh.properties.courseId)
        .reduce(
          (closest, nextHole) => {
            const nextHoleTeeBoxPoint = turf.point(
              nextHole.geometry.coordinates[0],
            );
            const distance = turf.distance(holeFlagPoint, nextHoleTeeBoxPoint);
            return distance < closest.distance
              ? { hole: nextHole, distance }
              : closest;
          },
          { hole: null, distance: Infinity },
        );
      const closestNextHole = closest.distance <= MAX_LINK_DISTANCE ? closest.hole : null;

      // Assign course ID (start new chain if hole wasn't linked from a previous hole)
      const courseKey =
        index === 1 || !hole.properties.courseId
          ? hole.properties.id
          : hole.properties.courseId;
      hole.properties.courseId = courseKey;

      if (closestNextHole) {
        closestNextHole.properties.courseId = courseKey;
      }
    });
  }

  // Propagate courseId to all clones of the same compound-ref hole
  cloneGroups.forEach((group) => {
    const courseId = group.find((h) => h.properties.courseId)?.properties.courseId;
    if (courseId) {
      group.forEach((clone) => {
        if (!clone.properties.courseId) {
          clone.properties.courseId = courseId;
        }
      });
    }
  });

  // Deduplicate holes with the same ref + courseId (e.g. alternate tees)
  const seen = new Set();
  holes = holes.filter((hole) => {
    const key = `${hole.properties.ref}:${hole.properties.courseId ?? ""}`;
    if (seen.has(key)) {
      newGolfClubs.features.splice(newGolfClubs.features.indexOf(hole), 1);
      return false;
    }
    seen.add(key);
    return true;
  });

  const unassignedHoles = holes.filter((hole) => !hole.properties.courseId);
  unassignedHoles.forEach((hole) => {
    hole.properties.courseId = "unassigned";
  });

  return newGolfClubs;
}

export function courseStats(holes) {
  const courseIds = [
    ...new Set(holes.map((x) => x.properties.courseId)),
  ].filter((id) => id !== undefined);
  if (courseIds.length < 1) {
    const courseData = holes.reduce(
      (acc, current) => {
        return {
          ...acc,
          holes: acc.holes + 1,
          par: current.properties.par != null ? acc.par + Number(current.properties.par) : acc.par,
          hasPar: acc.hasPar || current.properties.par != null,
          length:
            acc.length + turf.length(current.geometry, { units: "meters" }),
        };
      },
      { holes: 0, par: 0, hasPar: false, length: 0 },
    );
    return [
      {
        id: "default",
        courseNumberHoles: courseData.holes,
        coursePar: courseData.hasPar ? courseData.par : null,
        courseLength: courseData.length,
      },
    ];
  }
  return courseIds.map((x) => {
    const courseHoles = holes.filter((h) => h.properties.courseId === x);
    const courseData = courseHoles.reduce(
      (acc, current) => {
        return {
          ...acc,
          holes: acc.holes + 1,
          par: current.properties.par != null ? acc.par + Number(current.properties.par) : acc.par,
          hasPar: acc.hasPar || current.properties.par != null,
          length:
            acc.length + turf.length(current.geometry, { units: "meters" }),
        };
      },
      { holes: 0, par: 0, hasPar: false, length: 0 },
    );
    return {
      id: x,
      courseNumberHoles: courseData.holes,
      coursePar: courseData.hasPar ? courseData.par : null,
      courseLength: courseData.length,
    };
  });
}

export function mapWaytoRelation(clubs) {
  const mappings = {};
  clubs.elements.forEach((club) => {
    if (club.type === "relation" && club.members.length >= 1) {
      club.members.forEach((way) => {
        mappings[way.ref] = club.id;
      });
    }
  });
  return mappings;
}

export async function searchGolfClubs(query, allClubs) {
  if (!query || !allClubs || !allClubs.elements) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  return allClubs.elements.filter((club) => {
    if (club.tags && club.tags.name) {
      return club.tags.name.toLowerCase().includes(lowerQuery);
    }
    return false;
  });
}
