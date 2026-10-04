const DEFAULT_GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzAAwydbvNL25Z-muIiukfZ7HixwNIE2OWTNxN7SUJNWvLxowojvnvkUi0xt6tF61au/exec';

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

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }
  if (!body || typeof body !== 'object') body = {};

  // Extract Vercel IP-based Geolocation Headers
  const headerCity = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '';
  const headerRegion = req.headers['x-vercel-ip-country-region'] || '';
  const headerCountry = req.headers['x-vercel-ip-country'] || '';
  const headerLat = req.headers['x-vercel-ip-latitude'] || '';
  const headerLon = req.headers['x-vercel-ip-longitude'] || '';
  const rawIp = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
  const headerIp = String(rawIp).split(',')[0].trim();
  const headerLocString = [headerCity, headerRegion, headerCountry].filter(Boolean).join(', ');

  // Merge client data with server-detected geolocation
  const city = body.city || headerCity || '';
  const region = body.region || headerRegion || '';
  const country = body.country || headerCountry || '';
  const latitude = body.latitude || headerLat || '';
  const longitude = body.longitude || headerLon || '';
  const ip = body.ip || headerIp || '';
  const locString = body.location || headerLocString || [city, region, country].filter(Boolean).join(', ');

  const scriptUrl = process.env.WAITLIST_GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;

  // Build comprehensive payload supporting all common Google Sheet header conventions
  const payloadToGoogle = {
    ...body,
    contact: body.contact || '',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.contact || '') ? body.contact : (body.email || ''),
    phone: /^\d{10,13}$/.test((body.contact || '').replace(/[\s()+-]/g, '')) ? body.contact : (body.phone || ''),
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
    postal: body.postal || '',
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
    source: body.source || 'Waitlist Modal',
    Source: body.source || 'Waitlist Modal',
    page: body.page || req.headers['referer'] || '',
    ua: body.ua || req.headers['user-agent'] || '',
    userAgent: body.ua || req.headers['user-agent'] || '',
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
      return res.status(200).json({
        ok: true,
        num: Number(data.num) || 4230,
        existing: !!data.existing,
        contact: body.contact || '',
        location: locString,
        city: city,
        region: region,
        country: country
      });
    }
  } catch (err) {
    console.error('Error forwarding to Google Sheet:', err);
  }

  // Graceful fallback if Google Apps Script is momentarily unreachable
  const fallbackNum = 4230 + Math.floor(Math.random() * 80);
  return res.status(200).json({
    ok: true,
    num: fallbackNum,
    existing: false,
    contact: body.contact || '',
    location: locString,
    city: city,
    region: region,
    country: country
  });
}
