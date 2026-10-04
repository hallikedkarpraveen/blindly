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

  const scriptUrl = process.env.WAITLIST_GOOGLE_SCRIPT_URL || DEFAULT_GOOGLE_SCRIPT_URL;

  try {
    const googleRes = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body || {}),
      redirect: 'follow'
    });

    if (googleRes.ok) {
      const data = await googleRes.json();
      return res.status(200).json({
        ok: true,
        num: Number(data.num) || 4230,
        existing: !!data.existing,
        contact: body.contact || '',
        location: body.location || '',
        city: body.city || ''
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
    location: body.location || '',
    city: body.city || ''
  });
}
