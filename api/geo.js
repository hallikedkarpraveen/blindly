export default function handler(req, res) {
  const city = req.headers['x-vercel-ip-city'] ? decodeURIComponent(req.headers['x-vercel-ip-city']) : '';
  const region = req.headers['x-vercel-ip-country-region'] || '';
  const country = req.headers['x-vercel-ip-country'] || '';
  const latitude = req.headers['x-vercel-ip-latitude'] || '';
  const longitude = req.headers['x-vercel-ip-longitude'] || '';
  const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '';
  const location = [city, region, country].filter(Boolean).join(', ');

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(200).json({
    city,
    region,
    country,
    latitude,
    longitude,
    ip,
    location
  });
}
