"use client";
// Custom SVG illustrations — hand-crafted, professional, subtle animations.
// These are original SVGs (not emoji/icons), like those on Linear/Vercel landing pages.

// Animated glucose curve illustration for the hero
export function GlucoseCurveIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d9488" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0d9488" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      ))}
      {/* threshold line */}
      <line x1="0" y1="60" x2="400" y2="60" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="6 4" />
      <text x="380" y="56" fontSize="9" fill="#f43f5e" textAnchor="end" fontWeight="600">180</text>
      {/* area fill */}
      <path
        d="M0,140 C40,130 60,100 100,90 C140,80 160,50 200,55 C240,60 260,110 300,120 C340,130 360,100 400,85 L400,200 L0,200 Z"
        fill="url(#curveGrad)"
      />
      {/* main curve — history */}
      <path
        d="M0,140 C40,130 60,100 100,90 C140,80 160,50 200,55"
        stroke="url(#lineGrad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      >
        <animate attributeName="stroke-dasharray" from="0 400" to="400 0" dur="2s" fill="freeze" />
      </path>
      {/* prediction — dashed */}
      <path
        d="M200,55 C240,60 260,110 300,120 C340,130 360,100 400,85"
        stroke="#0ea5e9"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="6 4"
        fill="none"
        opacity="0"
      >
        <animate attributeName="opacity" from="0" to="1" dur="0.8s" begin="1.5s" fill="freeze" />
      </path>
      {/* now marker */}
      <circle cx="200" cy="55" r="4" fill="#0d9488">
        <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
      </circle>
      <line x1="200" y1="0" x2="200" y2="200" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />
      <text x="204" y="14" fontSize="9" fill="#64748b" fontWeight="600">now</text>
      {/* meal dots */}
      <circle cx="90" cy="92" r="3" fill="#f59e0b" />
      <circle cx="280" cy="118" r="3" fill="#f59e0b" />
    </svg>
  );
}

// Animated heart pulse illustration
export function HeartPulseIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 60" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0,30 L20,30 L25,15 L32,45 L40,20 L45,30 L120,30"
        stroke="#ef4444"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <animate attributeName="stroke-dashoffset" from="240" to="0" dur="2s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// Animated medical cross / droplet
export function DropletIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <path
        d="M30,5 C30,5 10,30 10,50 C10,65 18,75 30,75 C42,75 50,65 50,50 C50,30 30,5 30,5 Z"
        fill="url(#dropGrad)"
        opacity="0.9"
      />
      {/* shine */}
      <ellipse cx="22" cy="40" rx="4" ry="8" fill="white" opacity="0.3" />
      {/* pulse inside */}
      <path
        d="M18,50 L24,50 L27,42 L30,58 L33,46 L36,50 L42,50"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <animate attributeName="opacity" values="0.6;1;0.6" dur="1.5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// Animated data flow illustration
export function DataFlowIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* source nodes */}
      <rect x="10" y="25" width="50" height="30" rx="6" fill="#f0fdfa" stroke="#14b8a6" strokeWidth="1.5" />
      <text x="35" y="44" fontSize="8" fill="#0f766e" textAnchor="middle" fontWeight="600">EHR</text>
      <rect x="10" y="25" width="50" height="30" rx="6" fill="#f0fdfa" stroke="#14b8a6" strokeWidth="1.5" transform="translate(0,0)" />
      <rect x="10" y="25" width="50" height="30" rx="6" fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.5" transform="translate(0,0)" opacity="0" />

      {/* flowing dots */}
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} cx="60" cy="40" r="2.5" fill="#14b8a6">
          <animate
            attributeName="cx"
            values="60;240"
            dur="2s"
            begin={`${i * 0.5}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            dur="2s"
            begin={`${i * 0.5}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* model node */}
      <rect x="240" y="20" width="50" height="40" rx="6" fill="#0d9488" />
      <text x="265" y="44" fontSize="8" fill="white" textAnchor="middle" fontWeight="600">AI</text>
    </svg>
  );
}
