'use client';

import { useEffect, useState } from 'react';

export default function Loader() {
  const [phase, setPhase] = useState<'visible' | 'fading-out' | 'hidden' | 'fading-in'>('visible');

  useEffect(() => {
    const cycle = () => {
      setPhase('visible');
      
      setTimeout(() => {
        setPhase('fading-out');
        
        setTimeout(() => {
          setPhase('hidden');
          
          setTimeout(() => {
            setPhase('fading-in');
            
            setTimeout(() => {
              cycle();
            }, 500);
          }, 2000);
        }, 500);
      }, 1000);
    };

    cycle();
  }, []);

  const getOpacity = () => {
    switch (phase) {
      case 'visible': return 1;
      case 'fading-out': return 0;
      case 'hidden': return 0;
      case 'fading-in': return 1;
      default: return 1;
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FCFCFC] z-50">
      <div
        style={{
          opacity: getOpacity(),
          transition: phase === 'fading-out' || phase === 'fading-in' ? 'opacity 0.5s ease' : 'none',
        }}
      >
        <svg 
          width="60" 
          height="60" 
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
      </div>
    </div>
  );
}
