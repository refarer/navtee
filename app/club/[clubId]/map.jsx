import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import Map, { Source, Layer, Marker } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import {
  Button,
  Box,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import GpsFixedIcon from "@mui/icons-material/GpsFixed";
import GpsNotFixedIcon from "@mui/icons-material/GpsNotFixed";
import GpsOffIcon from "@mui/icons-material/GpsOff";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import StraightenIcon from "@mui/icons-material/Straighten";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

const customMapStyle = {
  version: 8,
  sources: {},
  glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#ffffff" },
    },
  ],
};

const MapComponent = ({ courseData, courseId, state }) => {
  const navigate = useNavigate();

  const outsideMask = useMemo(() => {
    const boundaries = courseData.features.filter(
      (f) => f.properties.leisure === "golf_course",
    );
    if (boundaries.length === 0) return null;

    let combined = boundaries[0];
    for (let i = 1; i < boundaries.length; i++) {
      combined = turf.union(turf.featureCollection([combined, boundaries[i]]));
    }
    const buffered = turf.buffer(combined, 0.02);
    return turf.mask(buffered);
  }, [courseData]);

  const tees = courseData.features.filter((x) => x.properties.golf === "hole");
  const holeNumbers = useMemo(
    () =>
      tees
        .map((hole, i) =>
          hole.properties.ref ? Number(hole.properties.ref) : i + 1,
        )
        .sort((a, b) => a - b),
    [tees],
  );

  const [currentHoleNumber, setCurrentHoleNumber] = useState(
    holeNumbers[0] ?? 1,
  );
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState([]);
  const [cursorPos, setCursorPos] = useState(null);
  const [yardageMode, setYardageMode] = useState(false);
  const [useMetric, setUseMetric] = useState(true);

  const unitLabel = useMetric ? "m" : "yd";
  const fmt = (m) => (useMetric ? `${m}m` : `${Math.round(m * 1.09361)}yd`);

  const activeGps = gpsActive && state?.loaded;

  const currentHoleData =
    tees.find((x, i) =>
      x.properties.ref
        ? Number(x.properties.ref) === currentHoleNumber
        : i + 1 === currentHoleNumber &&
          (x.properties.courseId ? x.properties.courseId === courseId : true),
    ) ?? tees[0];
  const currentHoleTee = currentHoleData.geometry.coordinates[0];
  const currentHoleMiddleGreen =
    currentHoleData.geometry.coordinates[
      currentHoleData.geometry.coordinates.length - 1
    ];
  const distanceToHole = activeGps
    ? Math.trunc(
        turf.distance(
          turf.point([state.coordinates.lng, state.coordinates.lat]),
          turf.point(currentHoleMiddleGreen),
        ) * 1000,
      )
    : null;
  const holeLength = Math.trunc(
    turf.distance(
      turf.point(currentHoleTee),
      turf.point(currentHoleMiddleGreen),
    ) * 1000,
  );
  const bearing = turf.bearing(
    turf.point(currentHoleTee),
    turf.point(currentHoleMiddleGreen),
  );
  const center = useMemo(
    () => turf.center(turf.points(currentHoleData.geometry.coordinates)),
    [currentHoleData],
  );
  const currentHolePar = currentHoleData.properties.par;

  const [viewState, setViewState] = useState({
    longitude: center.geometry.coordinates[0],
    latitude: center.geometry.coordinates[1],
    zoom: 16.25,
    pitch: 0,
    bearing: bearing,
  });

  // Yardage half-circles centred on the green, perpendicular to the last hole segment
  const yardageCircles = useMemo(() => {
    if (!yardageMode) return null;
    const green = currentHoleMiddleGreen;
    const coords = currentHoleData.geometry.coordinates;
    const secondToLast =
      coords.length > 1 ? coords[coords.length - 2] : coords[0];
    const segBearing = turf.bearing(
      turf.point(secondToLast),
      turf.point(green),
    );
    // Bearing from green back toward tee (centre of the open side of each arc)
    const fromGreenBearing = (((segBearing + 180) % 360) + 360) % 360;

    const displayIntervals = [50, 100, 150, 200, 250, 300];
    const intervals = displayIntervals.filter((d) => {
      const dm = useMetric ? d : d / 1.09361;
      return dm < holeLength * 0.97;
    });

    return intervals.map((dist) => {
      const distKm = useMetric ? dist / 1000 : dist / 1.09361 / 1000;
      const numPoints = 40;
      const arcPoints = [];
      for (let i = 0; i <= numPoints; i++) {
        const angle = fromGreenBearing - 90 + 180 * (i / numPoints);
        const pt = turf.destination(turf.point(green), distKm, angle);
        arcPoints.push(pt.geometry.coordinates);
      }
      // Label sits just beyond the right-hand endpoint of the arc
      const labelPt = turf.destination(
        turf.point(green),
        distKm,
        fromGreenBearing - 90,
      );
      return { dist, arcPoints, labelCoord: labelPt.geometry.coordinates };
    });
  }, [
    yardageMode,
    currentHoleMiddleGreen,
    currentHoleData,
    holeLength,
    useMetric,
  ]);

  const yardageGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection",
      features: (yardageCircles ?? []).map(({ arcPoints }) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: arcPoints },
        properties: {},
      })),
    }),
    [yardageCircles],
  );

  const measureDistance =
    measurePoints.length === 2
      ? Math.round(
          turf.distance(
            turf.point(measurePoints[0]),
            turf.point(measurePoints[1]),
          ) * 1000,
        )
      : null;

  const measureMidpoint =
    measurePoints.length === 2
      ? turf.midpoint(
          turf.point(measurePoints[0]),
          turf.point(measurePoints[1]),
        ).geometry.coordinates
      : null;

  const handleMapClick = (evt) => {
    if (!measureMode) return;
    const { lng, lat } = evt.lngLat;
    setMeasurePoints((prev) => {
      if (prev.length >= 2) return [[lng, lat]];
      return [...prev, [lng, lat]];
    });
  };

  const toggleMeasureMode = () => {
    setMeasureMode((m) => {
      if (m) {
        setMeasurePoints([]);
        setCursorPos(null);
      }
      return !m;
    });
  };

  const nextHole = (back) => {
    const currentIndex = holeNumbers.indexOf(currentHoleNumber);

    if (back) {
      setCurrentHoleNumber(
        currentIndex <= 0
          ? holeNumbers[holeNumbers.length - 1]
          : holeNumbers[currentIndex - 1],
      );
    } else {
      setCurrentHoleNumber(
        currentIndex >= holeNumbers.length - 1
          ? holeNumbers[0]
          : holeNumbers[currentIndex + 1],
      );
    }
  };

  useEffect(() => {
    setViewState((prev) => ({
      ...prev,
      bearing,
      longitude: center.geometry.coordinates[0],
      latitude: center.geometry.coordinates[1],
    }));
  }, [center, bearing]);

  const handleGpsToggle = () => {
    if (gpsActive) {
      setGpsActive(false);
    } else if (state?.error?.code === 1) {
      setGpsDialogOpen(true);
    } else {
      setGpsActive(true);
    }
  };

  const handleGpsRetry = () => {
    navigator.geolocation.getCurrentPosition(
      () => {
        setGpsDialogOpen(false);
        setGpsActive(true);
      },
      (err) => {
        if (err.code !== 1) {
          setGpsDialogOpen(false);
          setGpsActive(true);
        }
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
  };

  return (
    <Box sx={{ position: "relative", height: "100%" }}>
      <Box sx={{ position: "relative", width: "100%", height: "100%" }}>
        <Map
          {...viewState}
          onMove={(evt) => setViewState(evt.viewState)}
          onClick={handleMapClick}
          onMouseMove={(evt) => {
            if (measureMode && measurePoints.length < 2)
              setCursorPos(evt.point);
          }}
          onMouseLeave={() => setCursorPos(null)}
          cursor={measureMode ? "crosshair" : "grab"}
          style={{ width: "100%", height: "100%" }}
          mapStyle={customMapStyle}
          mapLib={maplibregl}
        >
          <Source id="course-data" type="geojson" data={courseData}>
            <Layer
              id="natural-fills"
              type="fill"
              filter={[
                "all",
                ["has", "natural"],
                ["!=", ["get", "natural"], "tree"],
                ["!=", ["get", "natural"], "tree_row"],
                ["!=", ["get", "natural"], "cliff"],
              ]}
              paint={{
                "fill-color": [
                  "match",
                  ["get", "natural"],
                  "water",
                  "#4682b4",
                  "wetland",
                  "#6b9fbe",
                  "mud",
                  "#8b7355",
                  "sand",
                  "#f4e0b0",
                  "beach",
                  "#f5deb3",
                  "shingle",
                  "#c8b89a",
                  "scrub",
                  "#5a7a3a",
                  "heath",
                  "#8a7a5a",
                  "grassland",
                  "#a8d08d",
                  "wood",
                  "#2e6b2e",
                  "bare_rock",
                  "#b8b8b8",
                  "#888888",
                ],
                "fill-opacity": 0.8,
              }}
            />
            <Layer
              id="course-features"
              type="fill"
              filter={[
                "all",
                ["!=", ["get", "golf"], "green"],
                ["!", ["has", "natural"]],
              ]}
              paint={{
                "fill-color": [
                  "match",
                  ["get", "golf"],
                  "tee",
                  "#8fbc8f",
                  "water_hazard",
                  "#4682b4",
                  "rough",
                  "#228b22",
                  "out_of_bounds",
                  "#ffffff",
                  "bunker",
                  "#f4a460",
                  "lateral_water_hazard",
                  "#20b2aa",
                  "driving_range",
                  "#90ee90",
                  "fairway",
                  "#90ee90",
                  "transparent",
                ],
                "fill-opacity": 0.8,
              }}
            />
            <Layer
              id="course-lines"
              type="line"
              filter={["==", "$type", "LineString"]}
              paint={{
                "line-color": [
                  "match",
                  ["get", "golf"],
                  "hole",
                  "#ff4500",
                  "cartpath",
                  "#a9a9a9",
                  "out_of_bounds",
                  "#ffffff",
                  "#000000",
                ],
                "line-width": 2,
                "line-opacity": 1,
              }}
            />
            <Layer
              id="course-points"
              type="circle"
              filter={[
                "all",
                ["==", "$type", "Point"],
                ["!", ["has", "natural"]],
              ]}
              paint={{
                "circle-radius": 5,
                "circle-color": [
                  "match",
                  ["get", "golf"],
                  "pin",
                  "#ff0000",
                  "#000000",
                ],
                "circle-opacity": 0.8,
              }}
            />
            <Layer
              id="tree-rows"
              type="line"
              filter={["==", ["get", "natural"], "tree_row"]}
              paint={{
                "line-color": "#228b22",
                "line-width": 3,
                "line-opacity": 0.8,
              }}
            />
            <Layer
              id="cliffs"
              type="line"
              filter={["==", ["get", "natural"], "cliff"]}
              paint={{
                "line-color": "#6b4226",
                "line-width": 2,
                "line-opacity": 0.9,
              }}
            />
            <Layer
              id="trees"
              type="circle"
              filter={["==", ["get", "natural"], "tree"]}
              paint={{
                "circle-radius": 3,
                "circle-color": "#228b22",
                "circle-opacity": 0.8,
              }}
            />
            <Layer
              id="greens"
              type="fill"
              filter={["==", ["get", "golf"], "green"]}
              paint={{
                "fill-color": "#32cd32",
                "fill-opacity": 0.8,
              }}
            />
            <Layer
              id="course-boundary"
              type="line"
              filter={["==", ["get", "leisure"], "golf_course"]}
              paint={{
                "line-color": "#1b5e20",
                "line-width": 3,
                "line-opacity": 0.8,
              }}
            />
            <Layer
              id="feature-outlines"
              type="line"
              filter={[
                "all",
                ["==", "$type", "Polygon"],
                ["!=", ["get", "leisure"], "golf_course"],
              ]}
              paint={{
                "line-color": "#000000",
                "line-width": 1,
                "line-opacity": 1,
              }}
            />
            {showLabels && (
              <Layer
                id="feature-labels"
                type="symbol"
                layout={{
                  "text-field": [
                    "coalesce",
                    ["get", "golf"],
                    ["get", "natural"],
                    "",
                  ],
                  "text-font": ["Open Sans Semibold"],
                  "text-size": 12,
                  "text-offset": [0, -1.5],
                  "text-anchor": "bottom",
                  "text-allow-overlap": true,
                  "text-ignore-placement": true,
                }}
                paint={{
                  "text-color": "#000000",
                  "text-halo-color": "#ffffff",
                  "text-halo-width": 2,
                }}
              />
            )}
          </Source>

          {outsideMask && (
            <Source id="outside-mask" type="geojson" data={outsideMask}>
              <Layer
                id="outside-mask-fill"
                type="fill"
                paint={{
                  "fill-color": "#e0e0e0",
                  "fill-opacity": 1,
                }}
              />
            </Source>
          )}

          {activeGps && (
            <Marker
              longitude={state.coordinates.lng}
              latitude={state.coordinates.lat}
              color="orange"
            />
          )}

          {yardageMode && yardageCircles && (
            <>
              <Source id="yardage-arcs" type="geojson" data={yardageGeoJSON}>
                <Layer
                  id="yardage-arc-lines"
                  type="line"
                  paint={{
                    "line-color": "#1565c0",
                    "line-width": 1.5,
                    "line-dasharray": [4, 2],
                    "line-opacity": 0.85,
                  }}
                />
              </Source>
              {yardageCircles.map(({ dist, labelCoord }) => (
                <Marker
                  key={`yd-${dist}`}
                  longitude={labelCoord[0]}
                  latitude={labelCoord[1]}
                >
                  <Box
                    sx={{
                      bgcolor: "rgba(21,101,192,0.85)",
                      color: "white",
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: 11,
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                      pointerEvents: "none",
                    }}
                  >
                    {dist}
                    {unitLabel}
                  </Box>
                </Marker>
              ))}
            </>
          )}

          {measurePoints.length >= 2 && (
            <Source
              type="geojson"
              data={{
                type: "Feature",
                geometry: { type: "LineString", coordinates: measurePoints },
              }}
            >
              <Layer
                id="measure-line"
                type="line"
                paint={{
                  "line-color": "#e53935",
                  "line-width": 2,
                  "line-dasharray": [4, 2],
                }}
              />
            </Source>
          )}

          {measurePoints.map((pt, i) => (
            <Marker key={`mp-${i}`} longitude={pt[0]} latitude={pt[1]}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  bgcolor: "#e53935",
                  border: "2px solid white",
                  borderRadius: "50%",
                  boxShadow: 2,
                }}
              />
            </Marker>
          ))}

          {measureMidpoint && (
            <Marker
              longitude={measureMidpoint[0]}
              latitude={measureMidpoint[1]}
            >
              <Paper
                elevation={3}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  bgcolor: "#e53935",
                  color: "white",
                  borderRadius: 2,
                  pointerEvents: "auto",
                }}
              >
                <Typography
                  variant="caption"
                  fontWeight="bold"
                  sx={{ color: "white" }}
                >
                  {fmt(measureDistance)}
                </Typography>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMeasurePoints([]);
                  }}
                  sx={{ color: "white", p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Paper>
            </Marker>
          )}

          {tees.map((hole, index) => (
            <Marker
              key={hole.properties.id ?? index}
              longitude={hole.geometry.coordinates[0][0]}
              latitude={hole.geometry.coordinates[0][1]}
            >
              <Paper
                elevation={3}
                sx={{
                  bgcolor: "orange",
                  color: "white",
                  borderRadius: "50%",
                  width: 24,
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                {hole.properties.ref || index + 1}
              </Paper>
            </Marker>
          ))}
        </Map>

        <Box
          sx={{
            position: "absolute",
            bottom: 0,
            right: 0,
            bgcolor: "white",
            opacity: 0.7,
            p: 1,
            fontSize: 12,
            zIndex: 10,
          }}
        >
          © OpenStreetMap contributors
        </Box>

        {/* Mode toggle — top left */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
          }}
        >
          <Paper elevation={4} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tooltip title="Exit" placement="right">
              <IconButton
                onClick={() => navigate(-1)}
                sx={{
                  bgcolor: "white",
                  color: "text.secondary",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Paper>
          <Paper elevation={4} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tooltip
              title={
                gpsActive
                  ? activeGps
                    ? "GPS On"
                    : "Acquiring GPS…"
                  : "Enable GPS"
              }
              placement="right"
            >
              <IconButton
                onClick={handleGpsToggle}
                sx={{
                  bgcolor: gpsActive
                    ? activeGps
                      ? "success.main"
                      : "info.main"
                    : "white",
                  color: gpsActive ? "white" : "text.secondary",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": {
                    bgcolor: gpsActive
                      ? activeGps
                        ? "success.dark"
                        : "info.dark"
                      : "grey.100",
                  },
                }}
              >
                {gpsActive ? (
                  activeGps ? (
                    <GpsFixedIcon />
                  ) : (
                    <GpsNotFixedIcon />
                  )
                ) : (
                  <GpsOffIcon />
                )}
              </IconButton>
            </Tooltip>
          </Paper>

          <Paper elevation={4} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tooltip
              title={measureMode ? "Stop Measuring" : "Measure Distance"}
              placement="right"
            >
              <IconButton
                onClick={toggleMeasureMode}
                sx={{
                  bgcolor: measureMode ? "error.main" : "white",
                  color: measureMode ? "white" : "error.main",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": {
                    bgcolor: measureMode ? "error.dark" : "grey.100",
                  },
                }}
              >
                <StraightenIcon />
              </IconButton>
            </Tooltip>
          </Paper>

          <Paper elevation={4} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tooltip
              title={
                yardageMode ? "Hide Yardage Circles" : "Show Yardage Circles"
              }
              placement="right"
            >
              <IconButton
                onClick={() => setYardageMode((m) => !m)}
                sx={{
                  bgcolor: yardageMode ? "info.main" : "white",
                  color: yardageMode ? "white" : "info.main",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": {
                    bgcolor: yardageMode ? "info.dark" : "grey.100",
                  },
                }}
              >
                <TrackChangesIcon />
              </IconButton>
            </Tooltip>
          </Paper>

          <Paper elevation={4} sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Tooltip title="Settings" placement="right">
              <IconButton
                onClick={() => setSettingsOpen((o) => !o)}
                sx={{
                  bgcolor: settingsOpen ? "warning.main" : "white",
                  color: settingsOpen ? "white" : "warning.main",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": {
                    bgcolor: settingsOpen ? "warning.dark" : "grey.100",
                  },
                }}
              >
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Paper>

          {settingsOpen && (
            <Paper
              elevation={4}
              sx={{ borderRadius: 2, p: 1.5, bgcolor: "white", minWidth: 150 }}
            >
              <Typography
                variant="caption"
                color="warning.main"
                fontWeight="bold"
                display="block"
                mb={0.5}
              >
                Settings
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showLabels}
                    onChange={(e) => setShowLabels(e.target.checked)}
                    color="warning"
                  />
                }
                label={<Typography variant="caption">Labels</Typography>}
                sx={{ m: 0 }}
              />
              <Box sx={{ mt: 0.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                  mb={0.5}
                >
                  Units
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={useMetric ? "m" : "yd"}
                  onChange={(_, val) => {
                    if (val) setUseMetric(val === "m");
                  }}
                  color="warning"
                >
                  <ToggleButton
                    value="m"
                    sx={{ px: 1.5, py: 0.25, fontSize: 12 }}
                  >
                    m
                  </ToggleButton>
                  <ToggleButton
                    value="yd"
                    sx={{ px: 1.5, py: 0.25, fontSize: 12 }}
                  >
                    yd
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Cursor hint label */}
        {measureMode && measurePoints.length < 2 && cursorPos && (
          <Box
            sx={{
              position: "absolute",
              left: cursorPos.x + 14,
              top: cursorPos.y - 10,
              pointerEvents: "none",
              zIndex: 10,
              bgcolor: "rgba(0,0,0,0.65)",
              color: "white",
              px: 1,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12,
              whiteSpace: "nowrap",
            }}
          >
            {measurePoints.length === 0 ? "Tap A" : "Tap B"}
          </Box>
        )}

        <Box
          sx={{
            position: "absolute",
            bottom: 80,
            left: 0,
            right: 0,
            px: 4,
          }}
        >
          <Paper
            elevation={4}
            sx={{
              bgcolor: "white",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            {activeGps && (
              <Box
                sx={{
                  bgcolor: "success.main",
                  color: "white",
                  textAlign: "center",
                  py: 0.75,
                }}
              >
                <Typography variant="body1" fontWeight="bold">
                  {`${fmt(distanceToHole)}  ±${fmt(Math.round(state.accuracy || 0))}`}
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                px: 1,
                py: 1.5,
              }}
            >
              <IconButton
                onClick={() => nextHole(true)}
                sx={{
                  bgcolor: "white",
                  color: "success.main",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                <NavigateBeforeIcon />
              </IconButton>
              <Box sx={{ textAlign: "center", py: 1, px: 2 }}>
                <Typography variant="h5" color="success.main" fontWeight="bold">
                  Hole {currentHoleNumber}
                </Typography>
                <Typography
                  variant="h6"
                  color="text.secondary"
                  fontWeight="medium"
                >
                  Par {currentHolePar}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {fmt(holeLength)}
                </Typography>
              </Box>
              <IconButton
                onClick={() => nextHole(false)}
                sx={{
                  bgcolor: "white",
                  color: "success.main",
                  borderRadius: 2,
                  p: 1.5,
                  "&:hover": { bgcolor: "grey.100" },
                }}
              >
                <NavigateNextIcon />
              </IconButton>
            </Box>
          </Paper>
        </Box>

        <Dialog open={gpsDialogOpen} onClose={() => setGpsDialogOpen(false)}>
          <DialogTitle>Location Access Required</DialogTitle>
          <DialogContent>
            <Typography variant="body2" gutterBottom>
              Location access was denied. To enable GPS:
            </Typography>
            <Typography variant="body2" component="ol" sx={{ pl: 2, mt: 1 }}>
              <li>
                Click the lock or info icon in your browser&apos;s address bar
              </li>
              <li>Find &quot;Location&quot; in the permissions list</li>
              <li>Set it to &quot;Allow&quot;</li>
              <li>Reload the page</li>
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setGpsDialogOpen(false)}>Close</Button>
            <Button
              onClick={handleGpsRetry}
              variant="contained"
              color="success"
            >
              Try Again
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MapComponent;
