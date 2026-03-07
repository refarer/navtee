import React from "react";

const CheckeredBackground = ({
  color = "#2e7d32",
  lightColor = "#e8f5e9",
  opacity = 0.12,
  size = "30px",
}) => {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: -1,
        opacity: opacity,
        backgroundImage: `
          linear-gradient(45deg, ${lightColor} 25%, transparent 25%),
          linear-gradient(-45deg, ${lightColor} 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, ${lightColor} 75%),
          linear-gradient(-45deg, transparent 75%, ${lightColor} 75%)
        `,
        backgroundSize: `${size} ${size}`,
        backgroundPosition: `0 0, 0 ${parseInt(size) / 2}px, ${parseInt(size) / 2}px -${parseInt(size) / 2}px, -${parseInt(size) / 2}px 0px`,
      }}
    />
  );
};

export default CheckeredBackground;
