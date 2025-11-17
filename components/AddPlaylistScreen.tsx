import React, { useState } from 'react';
import type { Playlist } from '../types';

interface Props {
  onAddPlaylist: (playlist: Omit<Playlist, 'id'>) => void;
  isLoading: boolean;
  error: string | null;
  showBackButton: boolean;
  onBack: () => void;
}

type AddType = 'URL' | 'FILE' | 'XTREAM';

const AddPlaylistScreen: React.FC<Props> = ({ onAddPlaylist, isLoading, error, showBackButton, onBack }) => {
  const [addType, setAddType] = useState<AddType>('URL');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [xtreamUrl, setXtreamUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
        if(!name) setName(file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let playlistData: Omit<Playlist, 'id'>;

    switch (addType) {
      case 'URL':
        if (!name || !url) return;
        playlistData = { name, type: 'URL', source: url };
        break;
      case 'FILE':
        if (!name || !fileContent) return;
        playlistData = { name, type: 'FILE', source: fileContent };
        break;
      case 'XTREAM':
        if (!name || !xtreamUrl || !username) return;
        playlistData = {
          name,
          type: 'XTREAM',
          source: xtreamUrl,
          xtream: { username, password },
        };
        break;
    }
    onAddPlaylist(playlistData);
  };

  const renderForm = () => {
    switch (addType) {
      case 'URL':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="url" className="block text-sm font-medium text-brand-text-dark mb-1">URL de la lista (.m3u, .m3u8)</label>
              <input type="url" id="url" value={url} onChange={(e) => setUrl(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-md p-2 text-brand-text-light focus:ring-brand-primary focus:border-brand-primary" placeholder="http://example.com/playlist.m3u" required />
            </div>
          </>
        );
      case 'FILE':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="file" className="block text-sm font-medium text-brand-text-dark mb-1">Archivo M3U</label>
              <input type="file" id="file" onChange={handleFileChange} accept=".m3u,.m3u8" className="w-full text-sm text-brand-text-dark file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-white hover:file:bg-blue-700" required />
            </div>
          </>
        );
      case 'XTREAM':
        return (
          <>
            <div className="mb-4">
              <label htmlFor="xtreamUrl" className="block text-sm font-medium text-brand-text-dark mb-1">URL del Servidor</label>
              <input type="url" id="xtreamUrl" value={xtreamUrl} onChange={(e) => setXtreamUrl(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-md p-2 text-brand-text-light focus:ring-brand-primary focus:border-brand-primary" placeholder="http://server.com:8080" required />
            </div>
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium text-brand-text-dark mb-1">Usuario</label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-md p-2 text-brand-text-light focus:ring-brand-primary focus:border-brand-primary" required />
            </div>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-brand-text-dark mb-1">Contraseña</label>
              <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-md p-2 text-brand-text-light focus:ring-brand-primary focus:border-brand-primary" />
            </div>
          </>
        );
    }
  };
  
  const getTabClassName = (type: AddType) => 
    `px-4 py-2 text-sm font-medium rounded-md focus:outline-none ${addType === type ? 'bg-brand-primary text-white' : 'text-brand-text-dark hover:bg-brand-surface'}`;

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
        {showBackButton && (
            <button onClick={onBack} className="absolute top-4 left-4 text-brand-text-light hover:text-brand-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
        )}
      <div className="w-full max-w-md bg-brand-surface rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-center text-brand-text-light mb-6">Añadir Nueva Lista</h2>
        
        <div className="flex justify-center space-x-2 mb-6">
          <button onClick={() => setAddType('URL')} className={getTabClassName('URL')}>URL</button>
          <button onClick={() => setAddType('FILE')} className={getTabClassName('FILE')}>Archivo</button>
          <button onClick={() => setAddType('XTREAM')} className={getTabClassName('XTREAM')}>Xtream</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-brand-text-dark mb-1">Nombre de la Lista</label>
            <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-brand-bg border border-gray-600 rounded-md p-2 text-brand-text-light focus:ring-brand-primary focus:border-brand-primary" required />
          </div>

          {renderForm()}

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          
          <button type="submit" disabled={isLoading} className="w-full bg-brand-primary text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-500 transition-colors">
            {isLoading ? 'Cargando...' : 'Añadir Lista'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddPlaylistScreen;