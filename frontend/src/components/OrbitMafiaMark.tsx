import type { FC, SVGProps } from 'react';

export const OrbitMafiaMark: FC<SVGProps<SVGSVGElement>> = ({
  className = 'h-8 w-8',
  ...props
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={256}
      height={256}
      role="img"
      aria-label="Orbit Mafia mark"
      className={className}
      {...props}
    >
      <title>Orbit Mafia mark</title>
      <defs>
        <linearGradient id="mark-ring" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset=".5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
        <radialGradient id="mark-helm" cx=".35" cy=".3" r=".9">
          <stop offset="0" stopColor="#22345e" />
          <stop offset=".6" stopColor="#0c1530" />
          <stop offset="1" stopColor="#050a18" />
        </radialGradient>
        <linearGradient id="mark-visor" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset=".45" stopColor="#1d4ed8" />
          <stop offset="1" stopColor="#0B3D91" />
        </linearGradient>
        <linearGradient id="mark-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#232a3d" />
          <stop offset="1" stopColor="#070a14" />
        </linearGradient>
        <clipPath id="mark-backHalf">
          <rect x="-20" y="-40" width="300" height="190" />
        </clipPath>
        <clipPath id="mark-frontHalf">
          <rect x="-20" y="150" width="300" height="140" />
        </clipPath>
      </defs>

      <g id="mark">
        <circle cx="30" cy="40" r="2.2" fill="#cfe1ff" opacity=".8" />
        <circle cx="222" cy="52" r="1.8" fill="#cfe1ff" opacity=".8" />
        <circle cx="46" cy="220" r="1.6" fill="#cfe1ff" opacity=".8" />
        <circle cx="214" cy="214" r="2.2" fill="#cfe1ff" opacity=".8" />
        <circle cx="128" cy="14" r="1.6" fill="#cfe1ff" opacity=".8" />
        <g transform="rotate(-18 128 150)">
          <path
            d="M10 150 A118 34 0 1 1 246 150 A118 34 0 1 1 10 150"
            fill="none"
            stroke="url(#mark-ring)"
            strokeWidth="6"
            strokeLinecap="round"
            opacity=".55"
          />
        </g>
        <ellipse cx="128" cy="208" rx="42" ry="10" fill="#0a1226" stroke="#22d3ee" strokeWidth="3" />
        <circle cx="128" cy="146" r="66" fill="url(#mark-helm)" stroke="#22d3ee" strokeWidth="4" />
        <path
          d="M82 112 A58 58 0 0 1 128 90"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="3"
          strokeLinecap="round"
          opacity=".45"
        />
        <ellipse cx="128" cy="150" rx="43" ry="34" fill="url(#mark-visor)" stroke="#7dd3fc" strokeWidth="3" />
        <path
          d="M96 140 Q108 124 130 122"
          fill="none"
          stroke="#fff"
          strokeWidth="4"
          strokeLinecap="round"
          opacity=".55"
        />
        <path
          d="M150 164 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z"
          fill="#fff"
          opacity=".9"
        />
        <g transform="rotate(-7 128 88)">
          <ellipse cx="128" cy="90" rx="78" ry="14" fill="url(#mark-hat)" stroke="#22d3ee" strokeWidth="2.5" />
          <path
            d="M86 88 C85 62 92 46 104 42 C114 39 121 47 128 47 C135 47 142 39 152 42 C164 46 171 62 170 88 Z"
            fill="url(#mark-hat)"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M86.6 76 Q128 86 169.4 76 L170 88 Q128 98 86 88 Z" fill="#FC3D21" />
        </g>
        <g transform="rotate(-18 128 150)">
          <path
            d="M10 150 A118 34 0 0 0 246 150"
            fill="none"
            stroke="url(#mark-ring)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <g transform="translate(218.4 171.9)">
            <g>
              <rect x="-17" y="-2.5" width="11" height="5" rx="1" fill="#38bdf8" />
              <rect x="6" y="-2.5" width="11" height="5" rx="1" fill="#38bdf8" />
              <circle r="6.5" fill="#F4D6A3" />
              <circle r="2.6" fill="#FC3D21" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
};
