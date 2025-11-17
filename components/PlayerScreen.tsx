import React, { useEffect, useRef } from 'react';
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

const PlayerScreen: React.FC<Props> = ({ channel, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Clean up previous HLS instance if it exists
    if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
    }

    const videoSrc = channel.url;

    if (videoSrc.endsWith('.m3u8')) {
      if (window.Hls.isSupported()) {
        const hls = new window.Hls();
        hls.loadSource(videoSrc);
        hls.attachMedia(videoElement);
        hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
          videoElement.play().catch(e => console.error("Autoplay was prevented:", e));
        });
        hlsRef.current = hls;
      } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (e.g., Safari)
        videoElement.src = videoSrc;
        videoElement.addEventListener('loadedmetadata', () => {
          videoElement.play().catch(e => console.error("Autoplay was prevented:", e));
        });
      }
    } else {
      // For other formats like MP4, TS, etc.
      videoElement.src = videoSrc;
      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play().catch(e => console.error("Autoplay was prevented:", e));
      });
    }

    return () => {
      // Cleanup on component unmount
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
    };
  }, [channel.url]);

  return (
    <div className="h-screen w-screen bg-black flex flex-col">
      <header className="flex-shrink-0 p-4 bg-black bg-opacity-50 z-10 flex items-center">
        <button onClick={onBack} className="text-white hover:text-brand-primary transition-colors mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-semibold text-white truncate">{channel.name}</h1>
      </header>
      <div className="flex-grow flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full" controls autoPlay playsInline />
      </div>
    </div>
  );
};

export default PlayerScreen;
