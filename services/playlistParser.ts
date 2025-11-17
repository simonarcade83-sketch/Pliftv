import type { Category, Channel } from '../types';

/**
 * Wraps an insecure HTTP URL with the proxy endpoint.
 * This is only active when the app is running on a secure (https) domain,
 * preventing mixed content errors in production deployments (e.g., Vercel).
 * It does not affect URLs during local development (http://localhost).
 * @param url The original URL to process.
 * @returns The proxied URL if conditions are met, otherwise the original URL.
 */
function proxifyHttpUrl(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  // Check if we are in a browser context and on an HTTPS page.
  const isSecureContext = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // If we're on an HTTPS page and the resource URL is HTTP, use the proxy.
  if (isSecureContext && url.startsWith('http://')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }

  // Otherwise, return the original URL.
  return url;
}


const parseM3U = async (content: string): Promise<Category[]> => {
  if (!content.startsWith('#EXTM3U')) {
    throw new Error('Archivo M3U inválido: Falta la cabecera #EXTM3U');
  }

  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentChannelInfo: Partial<Channel> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('#EXTINF:')) {
      // Example: #EXTINF:-1 tvg-id="channel1" tvg-name="Channel One" tvg-logo="logo.png" group-title="News",Channel One
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
          logo: proxifyHttpUrl(currentChannelInfo.logo),
          url: proxifyHttpUrl(currentChannelInfo.url)!,
          group: currentChannelInfo.group || 'General',
          epgId: currentChannelInfo.epgId,
        });
      }
      currentChannelInfo = {};
    }
  }
  
  return groupChannelsIntoCategories(channels);
};

const fetchAndParseURL = async (url: string): Promise<Category[]> => {
  const proxiedUrl = proxifyHttpUrl(url) || url;
  const response = await fetch(proxiedUrl);
  if (!response.ok) {
    throw new Error(`¡Error HTTP! estado: ${response.status}`);
  }
  const content = await response.text();
  return parseM3U(content);
};

const fetchXtream = async (baseUrl: string, username: string, password?: string): Promise<Category[]> => {
    // We only need to proxy the initial API calls. The stream URLs will be proxied individually later.
    const proxiedBaseUrl = proxifyHttpUrl(baseUrl) || baseUrl;
    const api = `${proxiedBaseUrl}/player_api.php?username=${username}&password=${password || ''}`;
    
    // Fetch categories
    const catResponse = await fetch(`${api}&action=get_live_categories`);
    if(!catResponse.ok) throw new Error("Error al obtener las categorías de Xtream");
    const categoriesData = await catResponse.json();

    // Fetch streams
    const streamResponse = await fetch(`${api}&action=get_live_streams`);
    if(!streamResponse.ok) throw new Error("Error al obtener los streams de Xtream");
    const streamsData = await streamResponse.json();

    const channels: Channel[] = streamsData.map((stream: any) => ({
        id: stream.stream_id.toString(),
        name: stream.name,
        logo: proxifyHttpUrl(stream.stream_icon),
        // The stream URL is constructed with the *original* base URL, and then the whole thing is proxied.
        url: proxifyHttpUrl(`${baseUrl}/live/${username}/${password || ''}/${stream.stream_id}.${stream.container_extension || 'ts'}`)!,
        group: categoriesData.find((cat: any) => cat.category_id === stream.category_id)?.category_name || 'General',
        epgId: stream.epg_channel_id,
    }));

    return groupChannelsIntoCategories(channels);
};


function groupChannelsIntoCategories(channels: Channel[]): Category[] {
  const categoryMap: { [key: string]: Channel[] } = {};

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


export { parseM3U, fetchAndParseURL, fetchXtream };