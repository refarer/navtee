import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.jsx"),
  route("club/:clubId", "routes/club.$clubId.jsx"),
  route("club/:clubId/play", "routes/club.$clubId.play.jsx"),
  route("explore", "routes/explore.jsx"),
] satisfies RouteConfig;
