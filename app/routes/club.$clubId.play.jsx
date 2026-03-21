import CourseMap from "../club/[clubId]/map";
import useGeolocation from "../useGeolocation";
import {
  useSearchParams,
  useNavigate,
  useLoaderData,
  useRouteError,
  useNavigation,
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

export function HydrateFallback() {
  return <LoadingFullPage message="Loading course..." />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const message =
    error instanceof Error ? error.message : "Failed to load course data";
  return <LoadingFullPage message={message} />;
}

const PlayPageContent = ({
  clubGeoJSONPromise,
  state,
  initialCourseId,
  navigate,
}) => {
  const clubGeoJSON = use(clubGeoJSONPromise);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

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
      />
    </div>
  );
};

const PlayPage = () => {
  const state = useGeolocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const courseId = searchParams.get("courseId");
  const { clubGeoJSON } = useLoaderData();
  const isLoading = navigation.state === "loading";

  return (
    <Suspense fallback={<LoadingFullPage message="Loading course..." />}>
      {isLoading && <LoadingFullPage message="Loading course..." />}
      <PlayPageContent
        clubGeoJSONPromise={clubGeoJSON}
        state={state}
        initialCourseId={courseId}
        navigate={navigate}
      />
    </Suspense>
  );
};

export default PlayPage;
