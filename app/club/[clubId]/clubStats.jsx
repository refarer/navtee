"use client";
import Link from "next/link";
import slugify from "@sindresorhus/slugify";
import { useApi } from "@/lib/useApi";

const ClubStats = ({ clubInfo }) => {
  const clubId = clubInfo.id;
  const { data, error, isLoading } = useApi("club/" + clubId);
  if (isLoading) return "loading...";
  if (error) return JSON.stringify(error);
  const editLink = `https://www.openstreetmap.org/edit?editor=id&${clubInfo.type}=${clubId}`;
  if (data.stats.length === 1 && data.stats[0].courseNumberHoles === 0) {
    return (
      <div>
        <p>This course doesn't have any hole information on OpenStreetMap</p>
        <Link href={editLink}>
          Click here to add hole information for this course on OpenStreetMap
        </Link>
      </div>
    );
  }
  return (
    <>
      {data.stats.map((course, i) => (
        <div key={i} className="bg-white shadow-lg rounded-lg p-6 mb-3">
          <Link
            href={`/club/${
              clubId +
              (clubInfo.tags.name ? "-" + slugify(clubInfo.tags.name) : "")
            }/course/${encodeURIComponent(course.id || "default")}`}
          >
            <div key={course.id} className="mb-3">
              <p>Holes: {course.courseNumberHoles}</p>
              <p>
                Par:{" "}
                {course.coursePar == null
                  ? "Not Available"
                  : course.coursePar}
              </p>
              <p>Length: {Math.round(course.courseLength)}m</p>
            </div>
          </Link>
        </div>
      ))}

      <Link href={editLink}>
        Click here to add hole information for this course on OpenStreetMap
      </Link>
    </>
  );
};

export default ClubStats;
