import * as turf from "@turf/turf";

export function addCourses(golfClubs) {
  const newGolfClubs = { ...golfClubs };
  const holes = newGolfClubs.features.filter(
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

  // Extract ref numbers - handle compound refs like "1/10" or "5;14" by taking first number
  holes.forEach((hole) => {
    const refStr = String(hole.properties.ref ?? "");
    const parts = refStr
      .split(/[\/;]/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    hole.properties.ref = parts.length > 0 ? parts[0] : NaN;
  });

  const holesByRef = holes.reduce((acc, hole) => {
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

    currentHoles.forEach((hole) => {
      const holeFlagPoint = turf.point(
        hole.geometry.coordinates[hole.geometry.coordinates.length - 1],
      );

      // Find closest unclaimed next hole
      const closestNextHole = nextHoles
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
        ).hole;

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

  // Add this check after the course assignment loop
  const unassignedHoles = holes.filter((hole) => !hole.properties.courseId);
  if (unassignedHoles.length > 0) {
    throw new Error(
      `${unassignedHoles.length} holes were not assigned a courseId. First unassigned hole ID: ${unassignedHoles[0].properties.id}`,
    );
  }

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
          par: acc.par + (Number(current.properties.par) || 0),
          length:
            acc.length + turf.length(current.geometry, { units: "meters" }),
        };
      },
      { holes: 0, par: 0, length: 0 },
    );
    return [
      {
        id: "default",
        courseNumberHoles: courseData.holes,
        coursePar: courseData.par,
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
          par: acc.par + (Number(current.properties.par) || 0),
          length:
            acc.length + turf.length(current.geometry, { units: "meters" }),
        };
      },
      { holes: 0, par: 0, length: 0 },
    );
    return {
      id: x,
      courseNumberHoles: courseData.holes,
      coursePar: courseData.par,
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
