
import React, { useState, useEffect, useCallback } from 'react';
import type { Playlist, Channel, Category } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import WelcomeScreen from './components/WelcomeScreen';
import AddPlaylistScreen from './components/AddPlaylistScreen';
import MainScreen from './components/MainScreen';
import PlayerScreen from './components/PlayerScreen';
import { parseM3U, fetchAndParseURL, fetchXtream } from './services/playlistParser';

const App: React.FC = () => {
  const [view, setView] = useState<'welcome' | 'addPlaylist' | 'main' | 'player'>('welcome');
  const [playlists, setPlaylists] = useLocalStorage<Playlist[]>('iptv-playlists', []);
  const [activePlaylistId, setActivePlaylistId] = useLocalStorage<string | null>('iptv-activePlaylistId', null);
  const [activePlaylistData, setActivePlaylistData] = useState<Category[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [favorites, setFavorites] = useLocalStorage<string[]>('iptv-favorites', []);
  const [history, setHistory] = useLocalStorage<string[]>('iptv-history', []);

  const loadPlaylist = useCallback(async (playlist: Playlist) => {
    setIsLoading(true);
    setError(null);
    try {
      let categories: Category[] = [];
      if (playlist.type === 'FILE' || playlist.type === 'URL') {
        categories = await fetchAndParseURL(playlist.source);
      } else if (playlist.type === 'XTREAM' && playlist.xtream) {
        categories = await fetchXtream(playlist.source, playlist.xtream.username, playlist.xtream.password);
      }
      setActivePlaylistData(categories);
      setActivePlaylistId(playlist.id);
      setView('main');
    } catch (e) {
      setError('Error al cargar la lista. Por favor, comprueba la fuente y el formato.');
      console.error(e);
      setActivePlaylistData([]);
      setActivePlaylistId(null);
    } finally {
      setIsLoading(false);
    }
  }, [setActivePlaylistId]);

  useEffect(() => {
    const activePlaylist = playlists.find(p => p.id === activePlaylistId);
    if (activePlaylist) {
      loadPlaylist(activePlaylist);
    } else if (playlists.length > 0) {
      loadPlaylist(playlists[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlaylistId, playlists]); // loadPlaylist is stable
  
  useEffect(() => {
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
  }, [view, playlists.length]);

  const handleAddPlaylist = async (playlist: Omit<Playlist, 'id'>) => {
    setIsLoading(true);
    setError(null);
    try {
        const newPlaylist: Playlist = { ...playlist, id: Date.now().toString() };
        let categories: Category[] = [];
        if (newPlaylist.type === 'FILE') {
             categories = await parseM3U(newPlaylist.source);
             // For file, source is content. Create a blob URL for consistent handling
             const blob = new Blob([newPlaylist.source], { type: 'application/vnd.apple.mpegurl' });
             newPlaylist.source = URL.createObjectURL(blob);
        } else if (newPlaylist.type === 'URL') {
            categories = await fetchAndParseURL(newPlaylist.source);
        } else if (newPlaylist.type === 'XTREAM' && newPlaylist.xtream) {
            categories = await fetchXtream(newPlaylist.source, newPlaylist.xtream.username, newPlaylist.xtream.password);
        }

        if (categories.length === 0) {
          throw new Error("La lista está vacía o no se pudo analizar.");
        }

        setPlaylists(prev => [...prev, newPlaylist]);
        setActivePlaylistData(categories);
        setActivePlaylistId(newPlaylist.id);
        setView('main');
    } catch (e) {
        setError('Error al añadir la lista. Por favor, comprueba la fuente y el formato.');
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
      if (playlists.length > 1) {
        setActivePlaylistId(playlists.filter(p => p.id !== id)[0].id);
      } else {
         setView('addPlaylist');
      }
    }
  };

  const handleSelectPlaylist = (id: string) => {
    if (id !== activePlaylistId) {
        setActivePlaylistId(id);
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
      case 'welcome':
      default:
        return <WelcomeScreen />;
    }
  };

  return <div className="h-screen w-screen overflow-hidden">{renderContent()}</div>;
};

export default App;