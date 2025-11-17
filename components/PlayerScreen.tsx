import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Channel } from '../types';

declare global {
  interface Window {
    Hls: any;
  }
}

interface Props {
  channel: Channel;
  onBack: () => void;
}

type PlayerState = 'loading' | 'playing' | 'error';

const PlayerScreen: React.FC<Props> = ({ channel, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const cleanup = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const setupPlayer = useCallback(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    cleanup();
    setPlayerState('loading');
    setErrorMessage('');

    const videoSrc = channel.url;
    
    // Proactively use HLS.js for many stream types, not just .m3u8
    // Many IPTV streams are HLS but don't have the extension.
    if (window.Hls.isSupported()) {
        const hls = new window.Hls({
            // Increase timeout to handle slow-to-start streams
            manifestLoadingTimeOut: 10000, 
        });
        
        hls.loadSource(videoSrc);
        hls.attachMedia(videoElement);
        
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            videoElement.play().catch(() => {
                // Autoplay was prevented, user will have to click play
                setPlayerState('playing'); // Still show video
            });
        });

        hls.on(window.Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error('HLS Fatal Error:', data.details);
                setErrorMessage(`Error de red o formato no soportado (${data.details}).`);
                setPlayerState('error');
                cleanup();
            }
        });
        
        videoElement.addEventListener('playing', () => setPlayerState('playing'));
        
        hlsRef.current = hls;

    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (e.g., Safari)
        videoElement.src = videoSrc;
        videoElement.addEventListener('loadedmetadata', () => {
          videoElement.play().catch(() => {});
        });
        videoElement.addEventListener('playing', () => setPlayerState('playing'));
        videoElement.addEventListener('error', () => {
             setErrorMessage('No se pudo cargar el video.');
             setPlayerState('error');
        });
    } else {
        setErrorMessage('Tu navegador no soporta HLS.');
        setPlayerState('error');
    }

  }, [channel.url]);

  useEffect(() => {
    setupPlayer();
    return () => {
      cleanup();
    };
  }, [setupPlayer]);

  const renderOverlay = () => {
    switch (playerState) {
      case 'loading':
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="w-16 h-16 border-4 border-t-brand-primary border-gray-600 rounded-full animate-spin"></div>
          </div>
        );
      case 'error':
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 text-white p-4">
            <h3 className="text-xl font-bold mb-2">Error al Cargar Canal</h3>
            <p className="text-center text-gray-300 mb-4">{errorMessage}</p>
            <button
              onClick={setupPlayer}
              className="px-4 py-2 bg-brand-primary rounded-md hover:bg-blue-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        );
      case 'playing':
        return null;
    }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      <header className="flex-shrink-0 p-4 bg-gradient-to-b from-black/70 to-transparent absolute top-0 left-0 right-0 z-10 flex items-center">
        <button onClick={onBack} className="text-white hover:text-brand-primary transition-colors mr-4 p-2 bg-black/20 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-white truncate">{channel.name}</h1>
      </header>
      <div className="flex-grow flex items-center justify-center relative">
        <video ref={videoRef} className="w-full h-full" controls autoPlay playsInline />
        {renderOverlay()}
      </div>
    </div>
  );
};

export default PlayerScreen;