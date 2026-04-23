import CourseMap from "../club/[clubId]/map";
import useGeolocation from "../useGeolocation";
import {
  useSearchParams,
  useNavigate,
  useLoaderData,
  useRouteError,
  useNavigation,
  useParams,
} from "react-router";
import { useState, useMemo, Suspense, use } from "react";
import { Link } from "react-router";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import { Box, Typography, Button, Container } from "@mui/material";
import GolfCourseIcon from "@mui/icons-material/GolfCourse";
import { courseStats, addCourses } from "@/lib/utilities";
import { OverpassClient, extractCourseById } from "@/lib/overpass";
import LoadingFullPage from "../components/LoadingFullPage";

const overpass = new OverpassClient();
const ROUND_STORAGE_PREFIX = "navtee.round";

function getHoleNumber(hole, index) {
  return hole.properties.ref ? Number(hole.properties.ref) : index + 1;
}

function buildScorecardHoles(courseData, courseId) {
  if (!courseData) return [];

  const holes = [];

  for (const [index, feature] of courseData.features.entries()) {
    if (feature.properties.golf !== "hole") continue;

    const holeNumber = getHoleNumber(feature, index);
    const parsedPar = Number(feature.properties.par);
    holes.push({
      key:
        feature.properties.id != null
          ? String(feature.properties.id)
          : `${courseId}:${holeNumber}:${index}`,
      holeNumber,
      par: Number.isFinite(parsedPar) ? parsedPar : null,
      index,
    });
  }

  return holes.sort((a, b) => a.holeNumber - b.holeNumber || a.index - b.index);
}

function formatVsPar(value) {
  if (value == null) return null;
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : String(value);
}

function readStoredScores(storageKey, holeOrder) {
  if (!storageKey || typeof window === "undefined") return {};

  try {
    const rawRound = window.localStorage.getItem(storageKey);
    if (!rawRound) return {};

    const parsedRound = JSON.parse(rawRound);
    const savedHoleOrder = Array.isArray(parsedRound?.holeOrder)
      ? parsedRound.holeOrder
      : [];

    if (
      savedHoleOrder.length !== holeOrder.length ||
      !savedHoleOrder.every((holeKey, index) => holeKey === holeOrder[index])
    ) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsedRound?.scoresByHoleKey ?? {}).filter(
        ([holeKey, value]) =>
          holeOrder.includes(holeKey) && Number.isInteger(value) && value > 0,
      ),
    );
  } catch {
    return {};
  }
}

function writeStoredRound({
  storageKey,
  clubId,
  courseId,
  holeOrder,
  scoresByHoleKey,
}) {
  if (!storageKey || typeof window === "undefined") return;

  try {
    if (Object.keys(scoresByHoleKey).length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        clubId,
        courseId,
        holeOrder,
        scoresByHoleKey,
        updatedAt: Date.now(),
      }),
    );
  } catch {
    // Ignore storage failures so scoring still works in memory.
  }
}

export function loader() {
  return { clubGeoJSON: null };
}

export function clientLoader({ params, request }) {
  const url = new URL(request.url);
  const osmType = url.searchParams.get("type");
  const clubId = params.clubId;
  const clubGeoJSON = Promise.all([
    overpass.getGolfCourseData(clubId, osmType),
    import("osmtogeojson"),
  ]).then(([data, { default: osmtogeojson }]) => {
    const geojson = osmtogeojson(data);
    try {
      return addCourses(geojson);
    } catch {
      return geojson;
    }
  });
  return { clubGeoJSON };
}
clientLoader.hydrate = true;

const CourseSelectDialog = ({ open, courses, onSelect, onClose }) => (
  <Dialog open={open} onClose={onClose}>
    <DialogTitle>Select a Course</DialogTitle>
    <DialogContent>
      <List>
        {courses.map((course) => (
          <ListItem key={course.id} disablePadding>
            <ListItemButton onClick={() => onSelect(course.id)}>
              <ListItemText
                primary={`Holes: ${course.courseNumberHoles}, Par: ${
                  course.coursePar == null ? "Unknown" : course.coursePar
                }, Length: ${Math.round(course.courseLength)}m`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </DialogContent>
  </Dialog>
);

export function HydrateFallback() {
  return <LoadingFullPage message="Loading course..." />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "Failed to load course data";
  return (
    <LoadingFullPage
      message={message}
      action={
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      }
    />
  );
}

const PlayPageContent = ({
  clubId,
  clubGeoJSONPromise,
  state,
  initialCourseId,
  navigate,
}) => {
  const clubGeoJSON = use(clubGeoJSONPromise);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [roundCache, setRoundCache] = useState({});

  const stats = useMemo(() => {
    const holes = clubGeoJSON.features.filter(
      (x) => x.properties.golf === "hole",
    );
    return courseStats(holes);
  }, [clubGeoJSON]);

  const resolvedCourseId = useMemo(() => {
    if (selectedCourseId && stats.some((s) => s.id === selectedCourseId))
      return selectedCourseId;
    if (initialCourseId && stats.some((s) => s.id === initialCourseId))
      return initialCourseId;
    if (stats.length === 1) return stats[0].id;
    return null;
  }, [stats, initialCourseId, selectedCourseId]);

  const courseData = resolvedCourseId
    ? extractCourseById(clubGeoJSON, resolvedCourseId)
    : null;
  const scorecardHoles = useMemo(
    () => buildScorecardHoles(courseData, resolvedCourseId),
    [courseData, resolvedCourseId],
  );
  const holeOrder = useMemo(
    () => scorecardHoles.map((hole) => hole.key),
    [scorecardHoles],
  );
  const storageKey = resolvedCourseId
    ? `${ROUND_STORAGE_PREFIX}.${clubId}.${resolvedCourseId}`
    : null;
  const storedScoresByHoleKey = useMemo(
    () => readStoredScores(storageKey, holeOrder),
    [storageKey, holeOrder],
  );
  const scoresByHoleKey =
    storageKey && Object.prototype.hasOwnProperty.call(roundCache, storageKey)
      ? roundCache[storageKey]
      : storedScoresByHoleKey;

  const roundSummary = useMemo(() => {
    let completedHoles = 0;
    let totalStrokes = 0;
    let comparableStrokes = 0;
    let comparablePar = 0;

    for (const hole of scorecardHoles) {
      const score = scoresByHoleKey[hole.key];
      if (!Number.isInteger(score)) continue;
      completedHoles += 1;
      totalStrokes += score;
      if (hole.par != null) {
        comparableStrokes += score;
        comparablePar += hole.par;
      }
    }

    const vsPar = comparablePar > 0 ? comparableStrokes - comparablePar : null;

    return {
      completedHoles,
      totalHoles: scorecardHoles.length,
      totalStrokes,
      vsPar,
      vsParLabel: formatVsPar(vsPar),
    };
  }, [scorecardHoles, scoresByHoleKey]);

  const setHoleScore = (holeKey, score) => {
    if (!storageKey) return;

    const nextScores = { ...scoresByHoleKey, [holeKey]: score };
    setRoundCache((prev) => ({ ...prev, [storageKey]: nextScores }));
    writeStoredRound({
      storageKey,
      clubId,
      courseId: resolvedCourseId,
      holeOrder,
      scoresByHoleKey: nextScores,
    });
  };

  const clearHoleScore = (holeKey) => {
    if (!storageKey || !(holeKey in scoresByHoleKey)) return;

    const nextScores = { ...scoresByHoleKey };
    delete nextScores[holeKey];

    setRoundCache((prev) => ({ ...prev, [storageKey]: nextScores }));
    writeStoredRound({
      storageKey,
      clubId,
      courseId: resolvedCourseId,
      holeOrder,
      scoresByHoleKey: nextScores,
    });
  };

  const resetRound = () => {
    if (!storageKey) return;

    setRoundCache((prev) => ({ ...prev, [storageKey]: {} }));
    writeStoredRound({
      storageKey,
      clubId,
      courseId: resolvedCourseId,
      holeOrder,
      scoresByHoleKey: {},
    });
  };

  if (stats.length === 1 && stats[0].courseNumberHoles === 0) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
        <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Typography
              variant="h6"
              color="primary"
              fontWeight="bold"
              sx={{ mb: 4 }}
            >
              NAVTEE
            </Typography>
          </Link>
          <GolfCourseIcon
            sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
          />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            No hole data available
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            This course doesn't have any hole information on OpenStreetMap yet.
            You can help by adding it!
          </Typography>
          <Button
            component="a"
            href="https://www.openstreetmap.org/edit?editor=id"
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            size="large"
            sx={{ borderRadius: 2, mb: 2 }}
          >
            Add on OpenStreetMap
          </Button>
          <Box sx={{ mt: 2 }}>
            <Link to="/explore" style={{ color: "inherit" }}>
              <Typography variant="body2" color="text.secondary">
                Explore other courses
              </Typography>
            </Link>
          </Box>
        </Container>
      </Box>
    );
  }

  if (!resolvedCourseId) {
    return (
      <CourseSelectDialog
        open={true}
        courses={stats}
        onSelect={(id) => setSelectedCourseId(id)}
        onClose={() => navigate(-1)}
      />
    );
  }

  if (
    !courseData ||
    !courseData.features.some((f) => f.properties.golf === "hole")
  ) {
    return (
      <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
        <Container maxWidth="sm" sx={{ py: 8, textAlign: "center" }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Typography
              variant="h6"
              color="primary"
              fontWeight="bold"
              sx={{ mb: 4 }}
            >
              NAVTEE
            </Typography>
          </Link>
          <GolfCourseIcon
            sx={{ fontSize: 64, color: "text.disabled", mb: 2 }}
          />
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Course not found
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Could not load hole data for this course.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Link to="/explore" style={{ color: "inherit" }}>
              <Typography variant="body2" color="text.secondary">
                Explore other courses
              </Typography>
            </Link>
          </Box>
        </Container>
      </Box>
    );
  }

  return (
    <div style={{ height: "100dvh" }}>
      <CourseMap
        courseData={courseData}
        courseId={resolvedCourseId}
        state={state}
        onBack={stats.length > 1 ? () => setSelectedCourseId(null) : undefined}
        scorecardHoles={scorecardHoles}
        scoresByHoleKey={scoresByHoleKey}
        onSetHoleScore={setHoleScore}
        onClearHoleScore={clearHoleScore}
        onResetRound={resetRound}
        roundSummary={roundSummary}
      />
    </div>
  );
};

const PlayPage = () => {
  const state = useGeolocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { clubId } = useParams();
  const courseId = searchParams.get("courseId");
  const { clubGeoJSON } = useLoaderData();
  const isLoading = navigation.state === "loading";

  return (
    <Suspense fallback={<LoadingFullPage message="Loading course..." />}>
      {isLoading && <LoadingFullPage message="Loading course..." />}
      <PlayPageContent
        clubId={clubId}
        clubGeoJSONPromise={clubGeoJSON}
        state={state}
        initialCourseId={courseId}
        navigate={navigate}
      />
    </Suspense>
  );
};

export default PlayPage;
