import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { useDebounce } from "use-debounce";
import Fuse from "fuse.js";
import golfClubs from "@/data/golf-clubs.json";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Typography,
  Box,
  Paper,
  Grid,
} from "@mui/material";
import Logo from "../components/Logo";
import CheckeredBackground from "../components/CheckeredBackground";

export function meta() {
  return [{ title: "NAVTEE" }];
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

const fuse = new Fuse(golfClubs.features, {
  keys: ["properties.name", "properties.address", "properties.operator"],
  threshold: 0.4,
  distance: 100,
});

function searchCourses(query) {
  return fuse.search(query, { limit: 20 }).map(({ item: f }) => ({
    name: f.properties.name,
    display_name: f.properties.address || f.properties.name,
    osm_id: f.properties.id,
    osm_type: f.properties.type,
  }));
}

const Search = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery] = useDebounce(inputValue, 300);

  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    setSuggestions(debouncedQuery ? searchCourses(debouncedQuery) : []);
  }, [debouncedQuery]);

  const isLoading = !!inputValue && inputValue !== debouncedQuery;

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
            <Logo width={60} height={60} />
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
      </div>
    </div>
  );
};

export default Search;
