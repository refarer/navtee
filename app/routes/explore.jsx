import { useEffect, useState, useCallback, Suspense, use } from "react";
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Link, useLoaderData } from "react-router";
import { Box, Typography, Paper, IconButton } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import LoadingFullPage from "../components/LoadingFullPage";

const exposeDevMap = import.meta.env.DEV;
const DEFAULT_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 2,
};

function getInitialViewState(golfClubs) {
  const coordinates = golfClubs.features
    .map((feature) => feature.geometry?.coordinates)
    .filter((coords) =>
      Array.isArray(coords) &&
      coords.length >= 2 &&
      Number.isFinite(coords[0]) &&
      Number.isFinite(coords[1]),
    );

  if (coordinates.length === 0) return DEFAULT_VIEW_STATE;

  let minLng = coordinates[0][0];
  let maxLng = coordinates[0][0];
  let minLat = coordinates[0][1];
  let maxLat = coordinates[0][1];

  for (const [lng, lat] of coordinates) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const lngSpan = Math.max(maxLng - minLng, 0.02);
  const latSpan = Math.max(maxLat - minLat, 0.02);
  const span = Math.max(lngSpan, latSpan);
  const zoom = Math.max(8, Math.min(12, Math.log2(360 / (span * 2.4))));

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    zoom,
  };
}

export async function loader() {
  const golfClubs = (await import("@/data/golf-clubs.json")).default;
  return { golfClubs };
}

export function clientLoader() {
  const golfClubs = import("@/data/golf-clubs.json").then((m) => m.default);
  return { golfClubs };
}
clientLoader.hydrate = true;

export function HydrateFallback() {
  return <LoadingFullPage message="Loading map..." />;
}

const mapStyle = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap Contributors",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
  glyphs: "https://cdn.protomaps.com/fonts/pbf/{fontstack}/{range}.pbf",
};

function ExploreMap({ golfClubsPromise }) {
  const golfClubs = use(golfClubsPromise);
  const [mapReady, setMapReady] = useState(false);
  const [viewState, setViewState] = useState(() =>
    exposeDevMap ? getInitialViewState(golfClubs) : DEFAULT_VIEW_STATE,
  );
  const [popupInfo, setPopupInfo] = useState(null);

  useEffect(() => {
    if (!exposeDevMap || typeof window === "undefined") return;

    return () => {
      delete window.__navteeExploreMap;
    };
  }, [exposeDevMap]);

  const onClickMap = useCallback((event) => {
    const feature = event.features && event.features[0];
    if (feature && feature.layer.id === "unclustered-point") {
      setPopupInfo({
        longitude: feature.geometry.coordinates[0],
        latitude: feature.geometry.coordinates[1],
        name: feature.properties.name,
        id: feature.properties.id,
        type: feature.properties.type,
      });
    } else {
      setPopupInfo(null);
    }
  }, []);

  const clusterLayer = {
    id: "clusters",
    type: "circle",
    source: "golfClubs",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": [
        "step",
        ["get", "point_count"],
        "#66BB6A",
        100,
        "#2E8B57",
        750,
        "#1B5E20",
      ],
      "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
    },
  };

  const clusterCountLayer = {
    id: "cluster-count",
    type: "symbol",
    source: "golfClubs",
    filter: ["has", "point_count"],
    layout: {
      "text-field": "{point_count_abbreviated}",
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
    },
    paint: {
      "text-color": "#ffffff",
    },
  };

  const unclusteredPointLayer = {
    id: "unclustered-point",
    type: "circle",
    source: "golfClubs",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#2E8B57",
      "circle-radius": 5,
      "circle-stroke-width": 2,
      "circle-stroke-color": "#fff",
    },
  };

  return (
    <Box
      sx={{ width: "100%", height: "100dvh", position: "relative" }}
      data-explore-map-ready={mapReady ? "true" : "false"}
    >
      {/* Header */}
      <Paper
        elevation={2}
        sx={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 2,
          py: 1,
          borderRadius: 2,
        }}
      >
        <IconButton component={Link} to="/" size="small" sx={{ mr: 0.5 }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <img src="/logo.svg" width={24} height={24} alt="Navtee" />
        <Typography variant="subtitle1" fontWeight="bold" color="primary">
          NAVTEE
        </Typography>
      </Paper>

      <Map
        {...viewState}
        preserveDrawingBuffer={exposeDevMap}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={(evt) => {
          if (exposeDevMap && typeof window !== "undefined") {
            window.__navteeExploreMap = evt.target;
          }
        }}
        onIdle={() => setMapReady(true)}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        mapLib={maplibregl}
        interactiveLayerIds={["unclustered-point"]}
        onClick={onClickMap}
        customAttribution={"&copy; OpenStreetMap contributors"}
      >
        <NavigationControl position="bottom-right" />
        <Source
          id="golfClubs"
          type="geojson"
          data={golfClubs}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>

        {popupInfo && (
          <Popup
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            anchor="bottom"
            onClose={() => setPopupInfo(null)}
            closeButton={false}
            style={{ maxWidth: "none" }}
          >
            <Paper elevation={0} sx={{ p: 1.5, minWidth: 160 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {popupInfo.name}
              </Typography>
              <Typography
                component={Link}
                to={`/club/${popupInfo.id}/play${popupInfo.type ? `?type=${popupInfo.type}` : ""}`}
                variant="body2"
                color="primary"
                sx={{
                  textDecoration: "none",
                  fontWeight: 500,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                View Course →
              </Typography>
            </Paper>
          </Popup>
        )}
      </Map>
    </Box>
  );
}

export default function ExplorePage() {
  const { golfClubs } = useLoaderData();
  return (
    <Suspense fallback={<HydrateFallback />}>
      <ExploreMap golfClubsPromise={golfClubs} />
    </Suspense>
  );
}
