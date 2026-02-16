'use client';

function LoaderSpinner({ size = 60 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="animate-spin"
      style={{ animationDuration: '0.8s' }}
    >
      <circle cx="50" cy="50" r="10" fill="#02111B" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + Math.cos(rad) * 15;
        const y1 = 50 + Math.sin(rad) * 15;
        const x2 = 50 + Math.cos(rad) * 45;
        const y2 = 50 + Math.sin(rad) * 45;

        return (
          <g key={i}>
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#3F4045"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <circle cx={x2} cy={y2} r="5" fill="#02111B" />
          </g>
        );
      })}
    </svg>
  );
}

/** Full-page fixed overlay loader */
export default function Loader() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FCFCFC',
        zIndex: 50,
      }}
    >
      <LoaderSpinner size={60} />
    </div>
  );
}

/** Inline loader for use within page layouts (not fixed, fills parent) */
export function PageLoader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '4rem',
        paddingBottom: '4rem',
      }}
    >
      <LoaderSpinner size={48} />
    </div>
  );
}
