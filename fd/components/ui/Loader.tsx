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

/** Skeleton loader for table rows */
export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex h-12 items-center gap-3 rounded-lg border border-[#f0f0f0] bg-white px-4 py-3 mb-2">
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gradient-to-r from-[#f0f0f0] to-[#f8f8f8] rounded animate-pulse"
          style={{
            width: i === 0 ? '20%' : i === columns - 1 ? '15%' : '18%',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Skeleton loader for list items */
export function ListItemSkeleton() {
  return (
    <div className="mb-2 rounded-lg border border-[#f0f0f0] bg-white p-3">
      <div className="h-4 w-3/4 bg-gradient-to-r from-[#f0f0f0] to-[#f8f8f8] rounded animate-pulse mb-2" />
      <div className="h-3 w-1/2 bg-gradient-to-r from-[#f0f0f0] to-[#f8f8f8] rounded animate-pulse" />
    </div>
  );
}
