
export type PlaylistType = 'URL' | 'FILE' | 'XTREAM';

export interface Playlist {
  id: string;
  name: string;
  type: PlaylistType;
  source: string; // URL or Blob URL for file content
  xtream?: {
    username: string;
    password?: string;
  };
}

export interface Channel {
  id: string;
  name: string;
  logo?: string;
  url: string;
  group: string;
  epgId?: string;
}

export interface Category {
  name: string;
  channels: Channel[];
}
