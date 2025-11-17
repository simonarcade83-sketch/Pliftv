// public/parser.worker.js

/**
 * Wraps an insecure HTTP URL with the proxy endpoint.
 * This is only active when the app is running on a secure (https) domain,
 * preventing mixed content errors in production deployments (e.g., Vercel).
 * It does not affect URLs during local development (http://localhost).
 * @param url The original URL to process.
 * @returns The proxied URL if conditions are met, otherwise the original URL.
 */
function proxifyHttpUrl(url, isSecureContext) {
  if (!url) {
    return undefined;
  }
  // If we're on an HTTPS page and the resource URL is HTTP, use the proxy.
  if (isSecureContext && url.startsWith('http://')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}


const parseM3U = async (content, isSecureContext) => {
  if (!content.startsWith('#EXTM3U')) {
    throw new Error('Archivo M3U inválido: Falta la cabecera #EXTM3U');
  }

  const lines = content.split('\n');
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
        const id = `${currentChannelInfo.group || 'General'}-${currentChannelInfo.name}-${currentChannelInfo.url}`;
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
  const proxiedUrl = proxifyHttpUrl(url, isSecureContext) || url;
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    throw new Error(`¡Error HTTP! estado: ${response.status}`);
  }
  const content = await response.text();
  return parseM3U(content, isSecureContext);
};

const fetchXtream = async (baseUrl, username, password, isSecureContext) => {
    const proxiedBaseUrl = proxifyHttpUrl(baseUrl, isSecureContext) || baseUrl;
    const api = `${proxiedBaseUrl}/player_api.php?username=${username}&password=${password || ''}`;
    
    const catResponse = await fetch(`${api}&action=get_live_categories`);
    if(!catResponse.ok) throw new Error("Error al obtener las categorías de Xtream");
    const categoriesData = await catResponse.json();

    const streamResponse = await fetch(`${api}&action=get_live_streams`);
    if(!streamResponse.ok) throw new Error("Error al obtener los streams de Xtream");
    const streamsData = await streamResponse.json();

    const channels = streamsData.map((stream) => ({
        id: stream.stream_id.toString(),
        name: stream.name,
        logo: proxifyHttpUrl(stream.stream_icon, isSecureContext),
        url: proxifyHttpUrl(`${baseUrl}/live/${username}/${password || ''}/${stream.stream_id}.${stream.container_extension || 'ts'}`, isSecureContext),
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


self.onmessage = async (event) => {
  const { type, playlist, playlistData } = event.data;
  const isSecureContext = self.location.protocol === 'https:';

  try {
    let categories = [];
    if (type === 'LOAD') {
        if (playlist.type === 'FILE' || playlist.type === 'URL') {
            categories = await fetchAndParseURL(playlist.source, isSecureContext);
        } else if (playlist.type === 'XTREAM' && playlist.xtream) {
            categories = await fetchXtream(playlist.source, playlist.xtream.username, playlist.xtream.password, isSecureContext);
        }
    } else if (type === 'ADD') {
        if (playlistData.type === 'FILE') {
            categories = await parseM3U(playlistData.source, isSecureContext);
        } else if (playlistData.type === 'URL') {
            categories = await fetchAndParseURL(playlistData.source, isSecureContext);
        } else if (playlistData.type === 'XTREAM' && playlistData.xtream) {
            categories = await fetchXtream(playlistData.source, playlistData.xtream.username, playlistData.xtream.password, isSecureContext);
        }
    }
    
    self.postMessage({ status: 'success', data: categories });
  } catch (e) {
    self.postMessage({ status: 'error', error: e.message });
  }
};
