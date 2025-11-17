
import React, { useState, useEffect, useCallback } from 'react';
import type { Playlist, Channel, Category } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import WelcomeScreen from './components/WelcomeScreen';
import AddPlaylistScreen from './components/AddPlaylistScreen';
import MainScreen from './components/MainScreen';
import PlayerScreen from './components/PlayerScreen';
import { processPlaylistInBackground } from './services/playlistParser';

const App: React.FC = () => {
  const [view, setView] = useState<'welcome' | 'addPlaylist' | 'main' | 'player'>('welcome');
  const [playlists, setPlaylists] = useLocalStorage<Playlist[]>('iptv-playlists', []);
  const [activePlaylistId, setActivePlaylistId] = useLocalStorage<string | null>('iptv-activePlaylistId', null);
  const [activePlaylistData, setActivePlaylistData] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);

  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv-favorites', []);
  const [history, setHistory] = useLocalStorage<string[]>('iptv-history', []);

  const loadPlaylist = useCallback(async (playlist: Playlist) => {
    setIsLoading(true);
    setError(null);
    try {
      const categories = await processPlaylistInBackground({ type: 'LOAD', playlist });
      setActivePlaylistData(categories);
      setActivePlaylistId(playlist.id);
      setView('main');
    } catch (e: any) {
      setError(e.message || 'Error al cargar la lista. Por favor, comprueba la fuente y el formato.');
      console.error(e);
      setActivePlaylistData([]);
      setActivePlaylistId(null);
    } finally {
      setIsLoading(false);
    }
  }, [setActivePlaylistId]);

  useEffect(() => {
    const initialize = async () => {
      const activePlaylist = playlists.find(p => p.id === activePlaylistId);
      if (activePlaylist) {
        await loadPlaylist(activePlaylist);
      } else if (playlists.length > 0) {
        await loadPlaylist(playlists[0]);
      } else {
        // No playlists, stop loading and show add screen
        setIsLoading(false); 
      }
    };
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on initial mount
  
  useEffect(() => {
    if (isLoading) return; // Don't transition while initial load is happening
    const timer = setTimeout(() => {
      if (view === 'welcome') {
        if (playlists.length === 0) {
          setView('addPlaylist');
        } else {
          setView('main');
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [view, playlists.length, isLoading]);

  const handleAddPlaylist = async (playlistData: Omit<Playlist, 'id'>) => {
    setIsLoading(true);
    setError(null);
    try {
        const newPlaylist: Playlist = { ...playlistData, id: Date.now().toString() };
        
        const categories = await processPlaylistInBackground({ type: 'ADD', playlistData: newPlaylist });

        if (categories.length === 0) {
          throw new Error("La lista está vacía o no se pudo analizar.");
        }
        
        // If file, source is content. Create a blob URL for consistent handling
        if (newPlaylist.type === 'FILE') {
             const blob = new Blob([newPlaylist.source], { type: 'application/vnd.apple.mpegurl' });
             newPlaylist.source = URL.createObjectURL(blob);
        }

        setPlaylists(prev => [...prev, newPlaylist]);
        setActivePlaylistData(categories);
        setActivePlaylistId(newPlaylist.id);
        setView('main');
    } catch (e: any) {
        setError(e.message || 'Error al añadir la lista. Por favor, comprueba la fuente y el formato.');
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeletePlaylist = (id: string) => {
    setPlaylists(playlists.filter(p => p.id !== id));
    if (activePlaylistId === id) {
      setActivePlaylistId(null);
      setActivePlaylistData([]);
      const remainingPlaylists = playlists.filter(p => p.id !== id);
      if (remainingPlaylists.length > 0) {
        loadPlaylist(remainingPlaylists[0]);
      } else {
         setView('addPlaylist');
      }
    }
  };

  const handleSelectPlaylist = (id: string) => {
    if (id !== activePlaylistId) {
        const playlistToLoad = playlists.find(p => p.id === id);
        if (playlistToLoad) {
            loadPlaylist(playlistToLoad);
        }
    }
  };


  const handlePlayChannel = (channel: Channel) => {
    setCurrentChannel(channel);
    setHistory(prev => [channel.id, ...prev.filter(id => id !== channel.id)].slice(0, 50));
    setView('player');
  };

  const handleToggleFavorite = (channelId: string) => {
    if (favorites.includes(channelId)) {
      setFavorites(favorites.filter(id => id !== channelId));
    } else {
      setFavorites([channelId, ...favorites]);
    }
  };

  const renderContent = () => {
    if (view === 'welcome') {
        return <WelcomeScreen />;
    }
    
    switch (view) {
      case 'player':
        return currentChannel && <PlayerScreen channel={currentChannel} onBack={() => setView('main')} />;
      case 'addPlaylist':
        return (
          <AddPlaylistScreen 
            onAddPlaylist={handleAddPlaylist}
            isLoading={isLoading}
            error={error}
            showBackButton={playlists.length > 0}
            onBack={() => setView('main')}
          />
        );
      case 'main':
        return (
          <MainScreen
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onSelectPlaylist={handleSelectPlaylist}
            onAddPlaylist={() => setView('addPlaylist')}
            onDeletePlaylist={handleDeletePlaylist}
            onRefreshPlaylist={() => activePlaylistId && loadPlaylist(playlists.find(p => p.id === activePlaylistId)!)}
            categories={activePlaylistData}
            onPlayChannel={handlePlayChannel}
            favorites={favorites}
            history={history}
            onToggleFavorite={handleToggleFavorite}
            isLoading={isLoading}
            error={error}
          />
        );
      default:
        return <WelcomeScreen />;
    }
  };

  return <div className="h-screen w-screen overflow-hidden">{renderContent()}</div>;
};

export default App;