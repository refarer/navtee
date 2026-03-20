import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router";
import { useDebounce } from "use-debounce";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
  Box,
  Paper,
  Grid,
} from "@mui/material";
import CheckeredBackground from "../components/CheckeredBackground";

export function meta() {
  return [
    { title: "NAVTEE — Golf Course Navigation & Maps" },
    {
      name: "description",
      content:
        "A golf course directory and navigation app. Browse golf clubs worldwide, explore course layouts, and find pin distances.",
    },
    { property: "og:title", content: "NAVTEE — Golf Course Navigation & Maps" },
    {
      property: "og:description",
      content:
        "A golf course directory and navigation app. Browse golf clubs worldwide, explore course layouts, and find pin distances.",
    },
    { property: "og:type", content: "website" },
    { property: "og:image", content: "/web-app-manifest-512x512.png" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "NAVTEE — Golf Course Navigation & Maps" },
    {
      name: "twitter:description",
      content:
        "A golf course directory and navigation app. Browse golf clubs worldwide, explore course layouts, and find pin distances.",
    },
    { name: "twitter:image", content: "/web-app-manifest-512x512.png" },
  ];
}

const previewClubs = [
  {
    name: "Cypress Point Golf Course",
    clubId: "36435651",
    courseId: "679090601",
  },
  {
    clubId: "319591744",
    courseId: "1070060251",
    name: "Oakmont Country Club",
  },
  {
    clubId: "689056680",
    courseId: "923582601",
    name: "Shinnecock Hills Golf Club",
  },
  { clubId: "1006012480", courseId: "928991790", name: "Tara Iti" },
];

const Search = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery] = useDebounce(inputValue, 300);
  const [suggestions, setSuggestions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const miniSearchRef = useRef(null);
  const initPromiseRef = useRef(null);

  const ensureSearch = useCallback(() => {
    if (miniSearchRef.current) return Promise.resolve(miniSearchRef.current);
    if (initPromiseRef.current) return initPromiseRef.current;

    setSearchLoading(true);
    initPromiseRef.current = Promise.all([
      import("minisearch"),
      import("@/data/golf-clubs.json"),
    ]).then(([MiniSearchMod, golfClubsMod]) => {
      const MiniSearch = MiniSearchMod.default;
      const golfClubs = golfClubsMod.default;
      const ms = new MiniSearch({
        idField: "id",
        fields: ["name", "address", "operator"],
        storeFields: ["name", "address", "id", "type"],
        searchOptions: {
          boost: { name: 2 },
          fuzzy: 0.2,
          prefix: true,
        },
      });
      ms.addAll(
        golfClubs.features.map((f) => ({
          id: f.properties.id,
          name: f.properties.name,
          address: f.properties.address,
          operator: f.properties.operator,
          type: f.properties.type,
        })),
      );
      miniSearchRef.current = ms;
      setSearchLoading(false);
      return ms;
    });
    return initPromiseRef.current;
  }, []);

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }
    ensureSearch().then((ms) => {
      const results = ms.search(debouncedQuery).slice(0, 20).map((hit) => ({
        name: hit.name,
        display_name: hit.address || hit.name,
        osm_id: hit.id,
        osm_type: hit.type,
      }));
      setSuggestions(results);
    });
  }, [debouncedQuery, ensureSearch]);

  const isLoading = searchLoading || (!!inputValue && inputValue !== debouncedQuery);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100dvh",
        height: "100%",
        position: "relative",
      }}
    >
      <CheckeredBackground />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
          padding: "1rem",
        }}
      >
        <Box sx={{ width: "100%", maxWidth: "42rem", mb: 4 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 3,
            }}
          >
            <img src="/logo.svg" width={60} height={60} alt="Navtee" />
            <Typography
              variant="h2"
              align="center"
              sx={{
                fontWeight: "bold",
                marginLeft: "0.5rem",
                color: "success.dark",
              }}
            >
              NAVTEE
            </Typography>
          </Box>
          <Paper
            elevation={4}
            sx={{ borderRadius: 2, overflow: "hidden", px: 2, py: 0.5 }}
          >
            <Autocomplete
              disableCloseOnSelect
              options={suggestions}
              getOptionLabel={(option) => option.name || option.display_name}
              inputValue={inputValue}
              filterOptions={(x) => x}
              loading={isLoading}
              open={!!inputValue && suggestions.length > 0}
              noOptionsText="No results found"
              onInputChange={(event, newInputValue) => {
                if (newInputValue) ensureSearch();
                setInputValue(newInputValue);
              }}
              onChange={(event, newValue) => {
                if (newValue && newValue.osm_id) {
                  const typeParam = newValue.osm_type
                    ? `?type=${newValue.osm_type}`
                    : "";
                  navigate(
                    `/club/${encodeURIComponent(newValue.osm_id)}/play${typeParam}`,
                  );
                }
              }}
              slotProps={{
                paper: {
                  elevation: 4,
                  sx: { borderRadius: 2, mt: 1 },
                },
                listbox: {
                  sx: { py: 0.5 },
                },
              }}
              renderOption={(props, option) => (
                <Box
                  component="li"
                  {...props}
                  sx={{
                    px: 2,
                    py: 1.25,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start !important",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight={500}
                    noWrap
                    sx={{ width: "100%" }}
                  >
                    {option.name || option.display_name.split(",")[0]}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ width: "100%" }}
                  >
                    {option.display_name}
                  </Typography>
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  variant="standard"
                  placeholder="Enter a place to find golf courses nearby..."
                  slotProps={{
                    input: {
                      ...params.InputProps,
                      disableUnderline: true,
                      endAdornment: (
                        <>
                          {isLoading ? (
                            <CircularProgress color="inherit" size={20} />
                          ) : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    },
                  }}
                  sx={{ py: 0.75 }}
                />
              )}
            />
          </Paper>
        </Box>

        <Link
          to="/explore"
          style={{ textDecoration: "none", marginBottom: "1.5rem" }}
        >
          <Typography
            variant="body1"
            color="success.main"
            sx={{ "&:hover": { textDecoration: "underline" } }}
          >
            Explore map →
          </Typography>
        </Link>

        <Typography variant="h4" mb={3} color="success.main" fontWeight="bold">
          Featured Courses
        </Typography>

        <Grid container spacing={2} sx={{ width: "100%", maxWidth: "42rem" }}>
          {previewClubs.map((club, index) => (
            <Grid key={index} size={6}>
              <Paper
                elevation={2}
                onClick={() =>
                  navigate(
                    `/club/${club.clubId}/play?courseId=${club.courseId}`,
                  )
                }
                sx={{
                  px: 3,
                  py: 2,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 2,
                  "&:hover": { bgcolor: "action.hover" },
                  transition: "background-color 0.15s",
                  height: "100%",
                }}
              >
                <Typography variant="body1" fontWeight={500}>
                  {club.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ›
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Box
          sx={{
            mt: 4,
            display: "flex",
            gap: 3,
            alignItems: "center",
          }}
        >
          <Typography
            component="a"
            href="mailto:contact@navtee.com"
            variant="body2"
            color="text.secondary"
            sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            contact@navtee.com
          </Typography>
          <Typography
            component="a"
            href="https://github.com/refarer/navtee"
            target="_blank"
            rel="noopener noreferrer"
            variant="body2"
            color="text.secondary"
            sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
          >
            GitHub →
          </Typography>
        </Box>
      </div>
    </div>
  );
};

export default Search;
