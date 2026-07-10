'use client';

import { useEffect } from 'react';

export default function HydrationReady() {
  useEffect(() => {
    document.body.removeAttribute('inert');
    document.documentElement.dataset.hydrated = 'true';

    return () => {
      delete document.documentElement.dataset.hydrated;
    };
  }, []);

  return null;
}
