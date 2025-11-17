import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { Playlist, Category, Channel } from '../types';
import { FixedSizeGrid as Grid } from 'react-window';
import { useDebounce } from '../hooks/useDebounce';
import { filterChannelsInBackground } from '../services/playlistParser';

const ChannelCard = ({ channel, onPlayChannel, onToggleFavorite, favorites, style }: { channel: Channel, onPlayChannel: (channel: Channel) => void, onToggleFavorite: (channelId: string) => void, favorites: string[], style: React.CSSProperties }) => (
    <div style={style} className="p-2">
        <div className="group w-full h-full relative bg-brand-surface rounded-lg shadow-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform" onClick={() => onPlayChannel(channel)}>
            <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); onToggleFavorite(channel.id); }}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${favorites.includes(channel.id) ? 'text-yellow-400' : 'text-white'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            </div>
            <div className="w-full h-2/3 bg-gray-800 flex items-center justify-center">
                {channel.logo ? (
                    <img src={channel.logo} alt={channel.name} className="max-w-full max-h-full object-contain p-2" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement?.querySelector('.placeholder-icon')?.classList.remove('hidden'); }} />
                ) : null}
                <div className={`placeholder-icon ${channel.logo ? 'hidden' : ''} text-brand-text-dark`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                </div>
            </div>
            <div className="p-2 h-1/3 flex items-center">
                <p className="text-sm text-brand-text-light text-center w-full break-words line-clamp-2">{channel.name}</p>
            </div>
        </div>
    </div>
);


const ChannelGrid = React.memo(({ channels, onPlayChannel, onToggleFavorite, favorites }: { channels: Channel[], onPlayChannel: (channel: Channel) => void, onToggleFavorite: (channelId: string) => void, favorites: string[] }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [gridSize, setGridSize] = useState({ width: 0, height: 0, columnCount: 1, columnWidth: 150, rowHeight: 120 });

    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            if (entry) {
                const { width, height } = entry.contentRect;
                const CARD_MIN_WIDTH = 140;
                const CARD_ASPECT_RATIO = 4 / 3;
                const columnCount = Math.max(1, Math.floor(width / CARD_MIN_WIDTH));
                const columnWidth = width / columnCount;
                const rowHeight = columnWidth / CARD_ASPECT_RATIO;
                setGridSize({ width, height, columnCount, columnWidth, rowHeight });
            }
        });

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const Cell = useCallback(({ columnIndex, rowIndex, style, data }: any) => {
        const { channels, columnCount, onPlayChannel, onToggleFavorite, favorites } = data;
        const index = rowIndex * columnCount + columnIndex;
        if (index >= channels.length) return null;
        const channel = channels[index];
        return <ChannelCard channel={channel} onPlayChannel={onPlayChannel} onToggleFavorite={onToggleFavorite} favorites={favorites} style={style} />;
    }, []);

    const rowCount = Math.ceil(channels.length / gridSize.columnCount);

    return (
        <div ref={containerRef} className="w-full h-full">
            {gridSize.width > 0 && (
                <Grid
                    className="grid-container"
                    columnCount={gridSize.columnCount}
                    columnWidth={gridSize.columnWidth}
                    height={gridSize.height}
                    rowCount={rowCount}
                    rowHeight={gridSize.rowHeight}
                    width={gridSize.width}
                    itemData={{
                        channels,
                        columnCount: gridSize.columnCount,
                        onPlayChannel,
                        onToggleFavorite,
                        favorites,
                    }}
                >
                    {Cell}
                </Grid>
            )}
        </div>
    );
});

type MainView = 'categories' | 'favorites' | 'history';

interface MainScreenProps {
  playlists: Playlist[];
  activePlaylistId: string | null;
  onSelectPlaylist: (id: string) => void;
  onAddPlaylist: () => void;
  onDeletePlaylist: (id: string) => void;
  onRefreshPlaylist: () => void;
  categories: Category[];
  onPlayChannel: (channel: Channel) => void;
  favorites: string[];
  history: string[];
  onToggleFavorite: (channelId: string) => void;
  isLoading: boolean;
  error: string | null;
}

const MainScreen: React.FC<MainScreenProps> = ({ playlists, activePlaylistId, onSelectPlaylist, onAddPlaylist, onDeletePlaylist, onRefreshPlaylist, categories, onPlayChannel, favorites, history, onToggleFavorite, isLoading, error }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [mainView, setMainView] = useState<MainView>('categories');
    const [isFiltering, setIsFiltering] = useState(false);
    const [displayChannels, setDisplayChannels] = useState<Channel[]>([]);

    const allChannels = useMemo(() => categories.flatMap((cat) => cat.channels.map(c => ({...c, group: cat.name }))), [categories]);

    useEffect(() => {
        // Reset category when switching main view
        setSelectedCategory('All');
    }, [mainView]);

    useEffect(() => {
      if (isLoading) return; // Don't filter while loading a whole playlist
      setIsFiltering(true);
      
      const payload = {
        type: 'FILTER' as const,
        allChannels,
        mainView,
        selectedCategory,
        searchTerm: debouncedSearchTerm,
        favorites,
        history,
      };

      filterChannelsInBackground(payload)
        .then(filtered => {
          setDisplayChannels(filtered);
        })
        .catch(console.error)
        .finally(() => {
          setIsFiltering(false);
        });
    }, [debouncedSearchTerm, selectedCategory, mainView, allChannels, favorites, history, isLoading]);


    const activePlaylist = playlists.find((p) => p.id === activePlaylistId);

    const SidebarTab = ({ view, label }: { view: MainView, label: string}) => (
        <button onClick={() => setMainView(view)} className={`w-full text-left p-2 rounded-md ${mainView === view ? 'bg-brand-primary text-white' : 'hover:bg-brand-surface'}`}>
            {label}
        </button>
    );

    return (
        <div className="h-screen w-screen flex flex-col bg-brand-bg">
            {/* Header */}
            <header className="flex-shrink-0 bg-brand-surface shadow-md p-2 flex items-center justify-between z-20">
                <div className="flex items-center space-x-4">
                    <select disabled={isLoading} value={activePlaylistId || ''} onChange={(e) => onSelectPlaylist(e.target.value)} className="bg-gray-700 border border-gray-600 rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary disabled:opacity-50">
                        {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <button onClick={onAddPlaylist} title="Añadir Lista" className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    </button>
                    {activePlaylist && (
                        <>
                        <button disabled={isLoading} onClick={onRefreshPlaylist} title="Actualizar Lista" className="p-2 rounded-full hover:bg-gray-700 transition-colors disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 4s-1.5-2-5-2-6 2.5-6 6s2.5 6 6 6 5-2 5-2" /></svg>
                        </button>
                        <button disabled={isLoading} onClick={() => onDeletePlaylist(activePlaylist.id)} title="Eliminar Lista" className="p-2 rounded-full hover:bg-red-800 text-red-500 transition-colors disabled:opacity-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        </>
                    )}
                </div>
                <div className="relative w-full max-w-xs">
                    <input type="search" placeholder="Buscar canales..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 pl-10 focus:ring-brand-primary focus:border-brand-primary" />
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
            </header>

            <div className="flex-grow flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-64 bg-brand-surface flex-shrink-0 overflow-y-auto p-4 space-y-4">
                    <nav className="space-y-1">
                        <SidebarTab view="categories" label="Todos los Canales" />
                        <SidebarTab view="favorites" label="Favoritos" />
                        <SidebarTab view="history" label="Historial" />
                    </nav>
                    {mainView === 'categories' && (
                        <div>
                            <h3 className="font-bold text-lg mb-2 border-b border-gray-700 pb-2">Categorías</h3>
                            <ul className="space-y-1 max-h-96 overflow-y-auto">
                                <li>
                                    <button onClick={() => setSelectedCategory('All')} className={`w-full text-left p-2 rounded-md ${selectedCategory === 'All' ? 'bg-brand-primary text-white' : 'hover:bg-brand-surface'}`}>Todos</button>
                                </li>
                                {categories.map((cat) => (
                                    <li key={cat.name}>
                                        <button onClick={() => setSelectedCategory(cat.name)} className={`w-full text-left p-2 rounded-md truncate ${selectedCategory === cat.name ? 'bg-brand-primary text-white' : 'hover:bg-brand-surface'}`}>
                                            {cat.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </aside>

                {/* Main Content */}
                <main className="flex-grow overflow-y-auto relative">
                    {(isLoading || isFiltering) && <div className="absolute inset-0 flex justify-center items-center bg-brand-bg bg-opacity-75 z-30"><p>{isLoading ? 'Cargando lista...' : 'Filtrando...'}</p></div>}
                    {error && <div className="flex justify-center items-center h-full"><p className="text-red-500">{error}</p></div>}
                    {!isLoading && !error && (
                        <ChannelGrid channels={displayChannels} onPlayChannel={onPlayChannel} onToggleFavorite={onToggleFavorite} favorites={favorites} />
                    )}
                     {!isLoading && !error && !isFiltering && displayChannels.length === 0 && (
                        <div className="flex justify-center items-center h-full">
                            <p className="text-brand-text-dark">No se encontraron canales.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default MainScreen;