import { useSearchParams, useLoaderData } from "react-router";
import { Link } from "react-router";
import { Box, Typography, Button, Paper, Container } from "@mui/material";
import GolfCourseIcon from "@mui/icons-material/GolfCourse";
import LanguageIcon from "@mui/icons-material/Language";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import slugify from "@sindresorhus/slugify";
export async function loader({ params }) {
  const golfClubs = (await import("@/data/golf-clubs.json")).default;
  const clubId = params.clubId.split("-")[0];
  const club = golfClubs.features.find(
    (f) => String(f.properties.id) === String(clubId),
  );
  if (!club) {
    return { club: null };
  }
  return { club: club.properties, coordinates: club.geometry.coordinates };
}

export function meta({ data }) {
  const club = data?.club;
  if (!club) {
    return [{ title: "Golf Club Not Found | NAVTEE" }];
  }
  const description =
    club.description ||
    `${club.name}${club.address ? ` - ${club.address}` : ""}${club.holes ? ` - ${club.holes} holes` : ""}. View course map and GPS yardages on NAVTEE.`;
  const canonical = `/club/${club.id}-${slugify(club.name)}`;
  return [
    { title: `${club.name} | NAVTEE` },
    { name: "description", content: description },
    { property: "og:title", content: `${club.name} | NAVTEE` },
    { property: "og:description", content: description },
    { tagName: "link", rel: "canonical", href: canonical },
  ];
}

const InfoRow = ({ icon, children }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
    {icon}
    <Typography variant="body1">{children}</Typography>
  </Box>
);

const ClubInfoPage = () => {
  const { club } = useLoaderData();
  const [searchParams] = useSearchParams();
  const osmType = searchParams.get("type");
  const typeParam = osmType ? `?type=${osmType}` : "";

  if (!club) {
    return (
      <Container maxWidth="sm" sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="h5">Golf club not found</Typography>
        <Link to="/">Back to search</Link>
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "background.default" }}>
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Link to="/" style={{ textDecoration: "none", color: "inherit" }}>
            <Typography
              variant="h6"
              color="primary"
              fontWeight="bold"
              sx={{ mb: 2 }}
            >
              NAVTEE
            </Typography>
          </Link>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            {club.name}
          </Typography>
        </Box>

        <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          {club.address && (
            <InfoRow icon={<LocationOnIcon color="action" />}>
              {club.address}
            </InfoRow>
          )}
          {club.holes && (
            <InfoRow icon={<GolfCourseIcon color="action" />}>
              {club.holes} holes{club.par ? ` · Par ${club.par}` : ""}
            </InfoRow>
          )}
          {club.website && (
            <InfoRow icon={<LanguageIcon color="action" />}>
              <a href={club.website} target="_blank" rel="noopener noreferrer">
                {club.website
                  .replace(/^https?:\/\/(www\.)?/, "")
                  .replace(/\/$/, "")}
              </a>
            </InfoRow>
          )}
          {club.phone && (
            <InfoRow icon={<PhoneIcon color="action" />}>
              <a href={`tel:${club.phone}`}>{club.phone}</a>
            </InfoRow>
          )}
          {club.opening_hours && (
            <InfoRow icon={<AccessTimeIcon color="action" />}>
              {club.opening_hours}
            </InfoRow>
          )}
          {club.operator && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Operated by {club.operator}
            </Typography>
          )}
        </Paper>

        {club.description && (
          <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="body1">{club.description}</Typography>
          </Paper>
        )}

        <Button
          component={Link}
          to={`/club/${club.id}/play${typeParam}`}
          variant="contained"
          size="large"
          fullWidth
          startIcon={<GolfCourseIcon />}
          sx={{ py: 1.5, fontSize: "1.1rem", borderRadius: 2 }}
        >
          View Course Map
        </Button>

        <Box sx={{ mt: 3, textAlign: "center" }}>
          <Link to="/explore" style={{ color: "inherit" }}>
            <Typography variant="body2" color="text.secondary">
              Explore all courses
            </Typography>
          </Link>
        </Box>

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ display: "block", textAlign: "center", mt: 4 }}
        >
          Data{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "inherit" }}
          >
            &copy; OpenStreetMap contributors
          </a>
        </Typography>
      </Container>
    </Box>
  );
};

export default ClubInfoPage;
