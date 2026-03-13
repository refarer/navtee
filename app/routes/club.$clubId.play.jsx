import CourseMap from "../club/[clubId]/map";
import useGeolocation from "../useGeolocation";
import {
  useSearchParams,
  useNavigate,
  useLoaderData,
  useRouteError,
} from "react-router";
import { useMemo, Suspense, use } from "react";
import { Link } from "react-router";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import {
  CircularProgress,
  Box,
  Typography,
  Button,
  Container,
} from "@mui/material";
import GolfCourseIcon from "@mui/icons-material/GolfCourse";
import { courseStats, extractCourseById } from "@/lib/utilities";

export function clientLoader({ params }) {
  const clubId = params.clubId.split("-")[0];
  const clubGeoJSON = fetch(`/data/courses/${clubId}.json`).then((r) => {
    if (!r.ok) return null;
    return r.json();
  });
  return { clubGeoJSON };
}

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
                  course.coursePar
                }, Length: ${Math.round(course.courseLength)}m`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </DialogContent>
  </Dialog>
);

const LoadingFullPage = ({ message }) => (
  <Box
    sx={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      bgcolor: "rgba(255,255,255,0.9)",
      zIndex: 1300,
    }}
  >
    <Box sx={{ textAlign: "center" }}>
      <CircularProgress />
      {message ? (
        <Box component="div" sx={{ mt: 2, color: "text.secondary" }}>
          {message}
        </Box>
      ) : null}
    </Box>
  </Box>
);

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "Failed to load course data";
  return <LoadingFullPage message={message} />;
}

const PlayPageContent = ({
  clubGeoJSONPromise,
  state,
  courseId,
  navigate,
}) => {
  const clubGeoJSON = use(clubGeoJSONPromise);

  const stats = useMemo(() => {
    const holes = (clubGeoJSON?.features ?? []).filter(
      (x) => x.properties.golf === "hole",
    );
    return courseStats(holes);
  }, [clubGeoJSON]);

  // Prefer valid courseId from URL, fall back to sole course
  const resolvedCourseId = useMemo(() => {
    if (courseId && stats.some((s) => s.id === courseId)) return courseId;
    if (stats.length === 1) return stats[0].id;
    return null;
  }, [stats, courseId]);

  const courseData = resolvedCourseId && clubGeoJSON
    ? extractCourseById(clubGeoJSON, resolvedCourseId)
    : null;

  const buildParams = (id) => {
    const p = new URLSearchParams();
    if (id) p.set("courseId", id);
    return `?${p.toString()}`;
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
        onSelect={(id) => navigate(buildParams(id), { replace: true })}
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
      />
    </div>
  );
};

const PlayPage = () => {
  const state = useGeolocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courseId = searchParams.get("courseId");
  const { clubGeoJSON } = useLoaderData();

  return (
    <Suspense fallback={<LoadingFullPage />}>
      <PlayPageContent
        clubGeoJSONPromise={clubGeoJSON}
        state={state}
        courseId={courseId}
        navigate={navigate}
      />
    </Suspense>
  );
};

export default PlayPage;
