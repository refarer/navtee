import React from "react";

const Logo = ({ width = 40, height = 40, color = "#2e7d32" }) => {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id="ballShadow">
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="2"
            floodColor={color}
            floodOpacity="0.2"
          />
        </filter>
        <radialGradient id="ballGrad" cx="38%" cy="33%" r="65%">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="#eeeeee" />
        </radialGradient>
      </defs>

      {/* Tee — drawn first so ball sits on top */}
      <rect x="48" y="78" width="4" height="13" rx="1" fill={color} />
      <rect x="43" y="74" width="14" height="5" rx="2" fill={color} />

      {/* Pin pole — drawn before ball */}
      <line
        x1="50"
        y1="4"
        x2="50"
        y2="74"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Flag */}
      <polygon points="50,4 73,13 50,22" fill={color} />

      {/* Golf ball — on top of pole and tee */}
      <circle
        cx="50"
        cy="52"
        r="24"
        fill="url(#ballGrad)"
        stroke={color}
        strokeWidth="2.5"
        filter="url(#ballShadow)"
      />

      {/* Dimples — outer ring of 8 */}
      <circle cx="50" cy="40" r="2.2" fill={color} opacity="0.45" />
      <circle cx="58" cy="43" r="2.2" fill={color} opacity="0.45" />
      <circle cx="62" cy="52" r="2.2" fill={color} opacity="0.45" />
      <circle cx="58" cy="61" r="2.2" fill={color} opacity="0.45" />
      <circle cx="50" cy="64" r="2.2" fill={color} opacity="0.45" />
      <circle cx="42" cy="61" r="2.2" fill={color} opacity="0.45" />
      <circle cx="38" cy="52" r="2.2" fill={color} opacity="0.45" />
      <circle cx="42" cy="43" r="2.2" fill={color} opacity="0.45" />

      {/* Dimples — inner ring of 4 */}
      <circle cx="50" cy="46" r="1.7" fill={color} opacity="0.35" />
      <circle cx="56" cy="52" r="1.7" fill={color} opacity="0.35" />
      <circle cx="50" cy="58" r="1.7" fill={color} opacity="0.35" />
      <circle cx="44" cy="52" r="1.7" fill={color} opacity="0.35" />
    </svg>
  );
};

export default Logo;
