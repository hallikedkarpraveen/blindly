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

  const contact = (body && body.contact) || '';
  const source = (body && body.source) || '';
  const location = (body && body.location) || '';
  const city = (body && body.city) || '';

  // Compute waitlist number
  const baseNum = 1420;
  const num = baseNum + Math.floor(Math.random() * 85);

  // Optional: Attempt to forward to external Google Script if configured
  const scriptUrl = process.env.WAITLIST_GOOGLE_SCRIPT_URL;
  if (scriptUrl) {
    try {
      await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      }).catch(() => {});
    } catch (_) {}
  }

  return res.status(200).json({
    ok: true,
    num,
    contact,
    source,
    location,
    city,
    created_at: new Date().toISOString()
  });
}
