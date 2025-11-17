// /api/proxy.js

import { Readable } from 'node:stream';

/**
 * Vercel Serverless Function to proxy requests.
 * This is used to bypass "Mixed Content" errors when an HTTPS site
 * tries to fetch resources from an HTTP source.
 * 
 * Usage: /api/proxy?url=ENCODED_TARGET_URL
 */
export default async function handler(req, res) {
  const { url: targetUrl } = req.query;

  // 1. Validate the input URL
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).json({ error: 'El parámetro "url" es obligatorio.' });
  }

  let validatedUrl;
  try {
    validatedUrl = new URL(targetUrl);
  } catch (e) {
    return res.status(400).json({ error: 'Se proporcionó una URL inválida.' });
  }

  // 2. Fetch the resource from the target URL
  try {
    const response = await fetch(validatedUrl.toString(), {
      method: req.method, // Forward the original request method
      headers: {
        // Use a common User-Agent to avoid being blocked by IPTV servers
        'User-Agent': 'VLC/3.0.20 LibVLC/3.0.20',
        // Forward other relevant headers if necessary
        'Accept': req.headers.accept || '*/*',
        'Range': req.headers.range, // Important for video seeking
      },
      redirect: 'follow', // Automatically follow redirects
    });

    // 3. Forward the headers from the target response to our client
    response.headers.forEach((value, name) => {
      // Let Vercel handle content encoding (compression)
      // and transfer encoding (chunking).
      if (!['content-encoding', 'transfer-encoding'].includes(name.toLowerCase())) {
        res.setHeader(name, value);
      }
    });

    // 4. Set the status code from the target response
    res.status(response.status);

    // 5. Stream the response body back to the client
    // This is crucial for performance and handling large files like video streams,
    // as it avoids buffering the entire file in memory.
    if (response.body) {
      const bodyStream = Readable.fromWeb(response.body);
      bodyStream.pipe(res);
    } else {
      res.end();
    }

  } catch (error) {
    console.error(`[IPTV_PROXY_ERROR] for ${targetUrl}:`, error.message);
    // Send a "Bad Gateway" error if the proxy fails to fetch the resource
    res.status(502).json({ 
      error: 'Gateway incorrecto', 
      message: 'El servidor proxy no pudo obtener el recurso solicitado.' 
    });
  }
}