import type { Category, Playlist } from '../types';

interface WorkerLoadPayload {
    type: 'LOAD';
    playlist: Playlist;
}

interface WorkerAddPayload {
    type: 'ADD';
    playlistData: Playlist; // Here it includes the content for FILE type
}

type WorkerPayload = WorkerLoadPayload | WorkerAddPayload;

export function processPlaylistInBackground(payload: WorkerPayload): Promise<Category[]> {
  return new Promise((resolve, reject) => {
    // Create a new worker for each job. This is cleaner than managing a single worker's state.
    const worker = new Worker('/parser.worker.js');

    worker.onmessage = (event) => {
      if (event.data.status === 'success') {
        resolve(event.data.data);
      } else {
        reject(new Error(event.data.error));
      }
      worker.terminate(); // Clean up the worker
    };

    worker.onerror = (error) => {
      reject(new Error(`Worker error: ${error.message}`));
      worker.terminate(); // Clean up the worker
    };

    worker.postMessage(payload);
  });
}
