const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // API Mock Endpoints for Local Dev
  if (pathname === '/api/geo') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({
      city: 'Bengaluru',
      region: 'Karnataka',
      country: 'India',
      latitude: '12.9716',
      longitude: '77.5946',
      ip: '127.0.0.1',
      location: 'Bengaluru, Karnataka, India'
    }));
    return;
  }

  if (pathname === '/api/waitlist') {
    if (req.method === 'OPTIONS') {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      let parsed = {};
      try { parsed = JSON.parse(body); } catch (_) {}
      const scriptUrl = process.env.WAITLIST_GOOGLE_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzAAwydbvNL25Z-muIiukfZ7HixwNIE2OWTNxN7SUJNWvLxowojvnvkUi0xt6tF61au/exec';

      const city = parsed.city || 'Bengaluru';
      const region = parsed.region || 'Karnataka';
      const country = parsed.country || 'India';
      const latitude = parsed.latitude || '12.9716';
      const longitude = parsed.longitude || '77.5946';
      const ip = parsed.ip || req.socket?.remoteAddress || '127.0.0.1';
      const locString = parsed.location || [city, region, country].filter(Boolean).join(', ');

      const payloadToGoogle = {
        secret: process.env.WAITLIST_SECRET || 'blnd_sec_9e2f4a1c6b8d30e5',
        ...parsed,
        contact: parsed.contact || '',
        email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(parsed.contact || '') ? parsed.contact : (parsed.email || ''),
        phone: /^\d{10,13}$/.test((parsed.contact || '').replace(/[\s()+-]/g, '')) ? parsed.contact : (parsed.phone || ''),
        location: locString,
        Location: locString,
        city: city,
        City: city,
        region: region,
        Region: region,
        state: region,
        State: region,
        country: country,
        Country: country,
        postal: parsed.postal || '',
        latitude: latitude,
        Latitude: latitude,
        lat: latitude,
        longitude: longitude,
        Longitude: longitude,
        lng: longitude,
        lon: longitude,
        ip: ip,
        IP: ip,
        ipAddress: ip,
        source: parsed.source || 'Waitlist Modal',
        Source: parsed.source || 'Waitlist Modal',
        page: parsed.page || req.headers['referer'] || '',
        ua: parsed.ua || req.headers['user-agent'] || '',
        userAgent: parsed.ua || req.headers['user-agent'] || '',
        timestamp: new Date().toISOString(),
        Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      };

      try {
        const googleRes = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payloadToGoogle),
          redirect: 'follow'
        });
        if (googleRes.ok) {
          const data = await googleRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            ok: true,
            num: Number(data.num) || 4230,
            existing: !!data.existing,
            contact: parsed.contact || '',
            location: locString,
            city,
            region,
            country
          }));
          return;
        }
      } catch (e) {
        console.error('Local server Google Sheet forward error:', e);
      }
      const num = 4230 + Math.floor(Math.random() * 85);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        ok: true,
        num,
        contact: parsed.contact || '',
        location: locString,
        city,
        region,
        country
      }));
    });
    return;
  }

  // Default root to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.join(ROOT_DIR, pathname);

  // Security check - prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  // Check if file exists directly
  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(filePath, res);
    }

    // Clean URLs support: if /privacy -> check /privacy.html
    const htmlFilePath = filePath + '.html';
    fs.stat(htmlFilePath, (htmlErr, htmlStats) => {
      if (!htmlErr && htmlStats.isFile()) {
        return serveFile(htmlFilePath, res);
      }

      // Check directory index.html
      if (!err && stats.isDirectory()) {
        const dirIndex = path.join(filePath, 'index.html');
        fs.stat(dirIndex, (dirErr, dirStats) => {
          if (!dirErr && dirStats.isFile()) {
            return serveFile(dirIndex, res);
          }
          send404(res);
        });
        return;
      }

      send404(res);
    });
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('500 Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function send404(res) {
  const notFoundPath = path.join(ROOT_DIR, '404.html');
  fs.readFile(notFoundPath, (err, data) => {
    if (!err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 Not Found</h1><p>The requested URL was not found on this server.</p>');
    }
  });
}

server.listen(PORT, () => {
  console.log(`Blindly local dev server running at http://localhost:${PORT}/ (with Clean URLs support)`);
});
