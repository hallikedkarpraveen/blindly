const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAAwydbvNL25Z-muIiukfZ7HixwNIE2OWTNxN7SUJNWvLxowojvnvkUi0xt6tF61au/exec';
const WAITLIST_SECRET = process.env.WAITLIST_SECRET || 'blnd_sec_9e2f4a1c6b8d30e5';

// In-memory sliding-window IP rate limiter
const ipHits = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_REQUESTS_PER_IP = 6;

function checkRateLimit(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return false;
  const now = Date.now();
  let history = ipHits.get(ip) || [];
  history = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (history.length >= MAX_REQUESTS_PER_IP) {
    ipHits.set(ip, history);
    return true;
  }
  history.push(now);
  ipHits.set(ip, history);
  return false;
}

// Clean old rate limit entries every 15 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, history] of ipHits.entries()) {
      const valid = history.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (valid.length === 0) ipHits.delete(ip);
      else ipHits.set(ip, valid);
    }
  }, 15 * 60 * 1000).unref?.();
}

function sanitizeField(val, isEmail = false) {
  if (!val || typeof val !== 'string') return '';
  let s = val.trim();
  // Formula Injection prevention for Google Sheets (=, +, -, @)
  if (/^[=+@\-]/.test(s) && !isEmail) {
    s = "'" + s;
  }
  return s.slice(0, 150);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // 1. Origin / Referer Validation (Anti-CSRF & 3rd-party abuse)
  const origin = req.headers['origin'] || '';
  const referer = req.headers['referer'] || '';
  if (origin || referer) {
    const isAllowed = [
      'blindly.in',
      'blindly-website.vercel.app',
      'localhost',
      '127.0.0.1'
    ].some(domain => origin.includes(domain) || referer.includes(domain));
    if (!isAllowed && origin) {
      return res.status(403).json({ ok: false, error: 'Access forbidden from this origin.' });
    }
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  // Extract client IP
  const rawIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const clientIp = String(rawIp).split(',')[0].trim();

  // 2. Anti-Spam Honeypot Trap
  // If an automated bot filled the invisible field, silently discard without writing to Google Sheet
  if (body.b_hp_check || body.website || body.company_url) {
    return res.status(200).json({ ok: true, num: 4235, existing: false, location: '' });
  }

  // 3. Human Speed Trap (Less than 700ms to open and submit is bot behavior)
  if (body.openTime && (Date.now() - Number(body.openTime) < 700)) {
    return res.status(200).json({ ok: true, num: 4235, existing: false, location: '' });
  }

  // 4. IP Rate Limiting (Prevents flood attacks)
  if (checkRateLimit(clientIp)) {
    return res.status(429).json({
      ok: false,
      error: 'Too many submissions from this connection. Please try again in 10 minutes.'
    });
  }

  // 5. Input Format & Length Verification
  const rawContact = String(body.contact || '').trim();
  if (!rawContact || rawContact.length < 4 || rawContact.length > 100) {
    return res.status(400).json({ ok: false, error: 'Invalid contact information.' });
  }

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawContact);
  const cleanPhone = rawContact.replace(/[\s()+-]/g, '');
  const isPhone = /^\d{10,14}$/.test(cleanPhone);

  if (!isEmail && !isPhone) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid phone number or email.' });
  }

  // Extract Vercel IP-based Geolocation Headers
  const headerCity = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '';
  const headerRegion = req.headers['x-vercel-ip-country-region'] || '';
  const headerCountry = req.headers['x-vercel-ip-country'] || '';
  const headerLat = req.headers['x-vercel-ip-latitude'] || '';
  const headerLon = req.headers['x-vercel-ip-longitude'] || '';
  const headerLocString = [headerCity, headerRegion, headerCountry].filter(Boolean).join(', ');

  // Merge client data with server-detected geolocation
  const city = sanitizeField(body.city || headerCity || '');
  const region = sanitizeField(body.region || headerRegion || '');
  const country = sanitizeField(body.country || headerCountry || '');
  const latitude = sanitizeField(body.latitude || headerLat || '');
  const longitude = sanitizeField(body.longitude || headerLon || '');
  const ip = sanitizeField(body.ip || clientIp || '');
  const locString = sanitizeField(body.location || headerLocString || [city, region, country].filter(Boolean).join(', '));
  const contact = sanitizeField(rawContact, isEmail);

  const scriptUrl = process.env.WAITLIST_GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;

  // Build secure payload with secret authorization token
  const payloadToGoogle = {
    secret: WAITLIST_SECRET, // Protected shared secret
    contact: contact,
    email: isEmail ? contact : '',
    phone: isPhone ? (cleanPhone.startsWith('91') ? cleanPhone : ('91' + cleanPhone.slice(-10))) : '',
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
    latitude: latitude,
    Latitude: latitude,
    longitude: longitude,
    Longitude: longitude,
    ip: ip,
    IP: ip,
    source: sanitizeField(body.source || 'Waitlist Modal'),
    page: sanitizeField(body.page || referer),
    ua: sanitizeField(body.ua || req.headers['user-agent'] || ''),
    timestamp: new Date().toISOString()
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
      return res.status(200).json({
        ok: true,
        num: Number(data.num) || 4236,
        existing: !!data.existing,
        contact: contact,
        location: locString,
        city: city,
        region: region,
        country: country
      });
    }
  } catch (err) {
    console.error('Error forwarding to Google Sheet:', err);
  }

  // Fallback response if Google Apps Script is momentarily unreachable
  const fallbackNum = 4236 + Math.floor(Math.random() * 20);
  return res.status(200).json({
    ok: true,
    num: fallbackNum,
    existing: false,
    contact: contact,
    location: locString,
    city: city,
    region: region,
    country: country
  });
}
