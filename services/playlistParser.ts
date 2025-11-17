import type { Category, Playlist, Channel } from '../types';

interface WorkerLoadPayload {
    type: 'LOAD';
    playlist: Playlist;
}

interface WorkerAddPayload {
    type: 'ADD';
    playlistData: Playlist; 
}

interface WorkerFilterPayload {
    type: 'FILTER';
    allChannels: Channel[];
    mainView: 'categories' | 'favorites' | 'history';
    selectedCategory: string;
    searchTerm: string;
    favorites: string[];
    history: string[];
}

type WorkerPayload = WorkerLoadPayload | WorkerAddPayload | WorkerFilterPayload;

// --- Worker Code ---
// This code will be executed in a separate thread.
const workerCode = `
  function proxifyHttpUrl(url, isSecureContext) {
    if (!url) {
      return undefined;
    }
    if (isSecureContext && url.startsWith('http://')) {
      // Use a relative path for the proxy from the worker's perspective
      return '/api/proxy?url=' + encodeURIComponent(url);
    }
    return url;
  }

  const parseM3U = async (content, isSecureContext) => {
    if (!content.startsWith('#EXTM3U')) {
      throw new Error('Archivo M3U inválido: Falta la cabecera #EXTM3U');
    }
    const lines = content.split('\\n');
    const channels = [];
    let currentChannelInfo = {};
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        currentChannelInfo = {};
        const info = line.substring(line.indexOf(' ') + 1);
        const tvgIdMatch = info.match(/tvg-id="([^"]*)"/);
        if (tvgIdMatch) currentChannelInfo.epgId = tvgIdMatch[1];
        const nameMatch = info.match(/tvg-name="([^"]*)"/);
        if (nameMatch) currentChannelInfo.name = nameMatch[1];
        const logoMatch = info.match(/tvg-logo="([^"]*)"/);
        if (logoMatch) currentChannelInfo.logo = logoMatch[1];
        const groupMatch = info.match(/group-title="([^"]*)"/);
        if (groupMatch) currentChannelInfo.group = groupMatch[1];
        const commaName = info.substring(info.lastIndexOf(',') + 1);
        if (!currentChannelInfo.name && commaName) {
          currentChannelInfo.name = commaName;
        }
      } else if (line && !line.startsWith('#')) {
        currentChannelInfo.url = line;
        if (currentChannelInfo.name && currentChannelInfo.url) {
          const id = (currentChannelInfo.group || 'General') + '-' + currentChannelInfo.name + '-' + currentChannelInfo.url;
          channels.push({
            id,
            name: currentChannelInfo.name,
            logo: proxifyHttpUrl(currentChannelInfo.logo, isSecureContext),
            url: proxifyHttpUrl(currentChannelInfo.url, isSecureContext),
            group: currentChannelInfo.group || 'General',
            epgId: currentChannelInfo.epgId,
          });
        }
        currentChannelInfo = {};
      }
    }
    return groupChannelsIntoCategories(channels);
  };

  const fetchAndParseURL = async (url, isSecureContext) => {
    // FORCE PROXY FOR CORS
    const proxiedUrl = '/api/proxy?url=' + encodeURIComponent(url);
    const response = await fetch(proxiedUrl);
    if (!response.ok) {
      throw new Error('¡Error HTTP! estado: ' + response.status + ' para ' + url);
    }
    const content = await response.text();
    return parseM3U(content, isSecureContext);
  };
  
  const fetchXtream = async (baseUrl, username, password, isSecureContext) => {
    const proxiedBaseUrl = '/api/proxy?url=' + encodeURIComponent(baseUrl);
    const api = proxiedBaseUrl + '/player_api.php?username=' + username + '&password=' + (password || '');
    const catResponse = await fetch(api + '&action=get_live_categories');
    if(!catResponse.ok) throw new Error("Error al obtener las categorías de Xtream");
    const categoriesData = await catResponse.json();
    const streamResponse = await fetch(api + '&action=get_live_streams');
    if(!streamResponse.ok) throw new Error("Error al obtener los streams de Xtream");
    const streamsData = await streamResponse.json();
    const channels = streamsData.map((stream) => ({
        id: stream.stream_id.toString(),
        name: stream.name,
        logo: proxifyHttpUrl(stream.stream_icon, isSecureContext),
        url: baseUrl + '/live/' + username + '/' + (password || '') + '/' + stream.stream_id + '.' + (stream.container_extension || 'ts'),
        group: categoriesData.find((cat) => cat.category_id === stream.category_id)?.category_name || 'General',
        epgId: stream.epg_channel_id,
    }));
    return groupChannelsIntoCategories(channels);
  };

  function groupChannelsIntoCategories(channels) {
    const categoryMap = {};
    channels.forEach(channel => {
      const groupName = channel.group || 'General';
      if (!categoryMap[groupName]) {
        categoryMap[groupName] = [];
      }
      categoryMap[groupName].push(channel);
    });
    return Object.keys(categoryMap).sort().map(name => ({
      name,
      channels: categoryMap[name],
    }));
  }
  
  function filterChannels(payload) {
    const { allChannels, mainView, selectedCategory, searchTerm, favorites, history } = payload;
    let channelsToFilter = [];

    if(mainView === 'favorites') {
        channelsToFilter = allChannels.filter((c) => favorites.includes(c.id));
    } else if (mainView === 'history') {
        channelsToFilter = history.map((id) => allChannels.find((c) => c.id === id)).filter((c) => !!c);
    } else { // categories
        if(selectedCategory === 'All') {
            channelsToFilter = allChannels;
        } else {
            channelsToFilter = allChannels.filter(c => c.group === selectedCategory);
        }
    }
    
    if (!searchTerm) return channelsToFilter;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return channelsToFilter.filter((channel) => channel.name.toLowerCase().includes(lowerCaseSearchTerm));
  }

  self.onmessage = async (event) => {
    const payload = event.data;
    const isSecureContext = self.location.protocol === 'https:';
    try {
      let result;
      switch (payload.type) {
        case 'LOAD': {
          const { playlist } = payload;
          if (playlist.type === 'FILE' || playlist.type === 'URL') {
              result = await fetchAndParseURL(playlist.source, isSecureContext);
          } else if (playlist.type === 'XTREAM' && playlist.xtream) {
              result = await fetchXtream(playlist.source, playlist.xtream.username, playlist.xtream.password, isSecureContext);
          }
          break;
        }
        case 'ADD': {
          const { playlistData } = payload;
          if (playlistData.type === 'FILE') {
              result = await parseM3U(playlistData.source, isSecureContext);
          } else if (playlistData.type === 'URL') {
              result = await fetchAndParseURL(playlistData.source, isSecureContext);
          } else if (playlistData.type === 'XTREAM' && playlistData.xtream) {
              result = await fetchXtream(playlistData.source, playlistData.xtream.username, playlistData.xtream.password, isSecureContext);
          }
          break;
        }
        case 'FILTER': {
          result = filterChannels(payload);
          break;
        }
        default:
          throw new Error('Unknown worker message type');
      }
      self.postMessage({ status: 'success', data: result, type: payload.type });
    } catch (e) {
      self.postMessage({ status: 'error', error: e.message, type: payload.type });
    }
  };
`;
// --- End of Worker Code ---

let worker: Worker | null = null;
const getWorker = () => {
    if (!worker) {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        worker = new Worker(url);
        // Optional: Revoke the object URL when it's no longer needed, e.g., on app close.
        // For simplicity in a SPA, we might not revoke it until the page is closed.
    }
    return worker;
};


function createWorkerPromise<T>(payload: WorkerPayload): Promise<T> {
  return new Promise((resolve, reject) => {
    const workerInstance = getWorker();
    
    const messageHandler = (event: MessageEvent) => {
      // Only handle messages that correspond to this request type
      if (event.data.type === payload.type) {
        if (event.data.status === 'success') {
          resolve(event.data.data as T);
        } else {
          reject(new Error(event.data.error));
        }
        workerInstance.removeEventListener('message', messageHandler);
        workerInstance.removeEventListener('error', errorHandler);
      }
    };

    const errorHandler = (error: ErrorEvent) => {
      reject(new Error(`Worker error: ${error.message}`));
      workerInstance.removeEventListener('message', messageHandler);
      workerInstance.removeEventListener('error', errorHandler);
    };

    workerInstance.addEventListener('message', messageHandler);
    workerInstance.addEventListener('error', errorHandler);
    
    workerInstance.postMessage(payload);
  });
}


export function processPlaylistInBackground(payload: WorkerLoadPayload | WorkerAddPayload): Promise<Category[]> {
  return createWorkerPromise<Category[]>(payload);
}

export function filterChannelsInBackground(payload: WorkerFilterPayload): Promise<Channel[]> {
  return createWorkerPromise<Channel[]>(payload);
}