'use client';

import { useEffect } from 'react';

export function ChunkErrorListener() {
  useEffect(() => {
    const handleChunkError = (e: ErrorEvent) => {
      // ChunkLoadError happens when dynamic imports fail, often after a new deploy
      if (e.message?.toLowerCase().includes('chunkloaderror') || 
          e.filename?.includes('_next/static/chunks/')) {
        console.warn('ChunkLoadError detected. Reloading page...');
        window.location.reload();
      }
    };

    window.addEventListener('error', handleChunkError, true);
    return () => window.removeEventListener('error', handleChunkError, true);
  }, []);

  return null;
}
