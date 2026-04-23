import { CircularProgress, Box } from "@mui/material";

const LoadingFullPage = ({ message, action }) => (
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
      {action ? <Box sx={{ mt: 2 }}>{action}</Box> : null}
    </Box>
  </Box>
);

export default LoadingFullPage;
