import { useEffect, useState } from 'react';

export function useDelayedLoading(loading: boolean, delayMs = 250): boolean {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoader(true);
    }, delayMs);

    return () => clearTimeout(timer);
  }, [loading, delayMs]);

  return showLoader;
}
