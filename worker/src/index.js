// Minimal Cloudflare Worker for prices + audit via D1

const DEFAULTS = {
  basePrices: {
    S: { "Tier 1": 12850, "Tier 2": 14950, "Tier 3": 17200, "Full Upgrades": 18250 },
    A: { "Tier 1": 10450, "Tier 2": 12550, "Tier 3": 14750, "Full Upgrades": 15800 },
    B: { "Tier 1": 8050, "Tier 2": 10700, "Tier 3": 12250, "Full Upgrades": 13300 },
    C: { "Tier 1": 5650, "Tier 2": 7750, "Tier 3": 10000, "Full Upgrades": 11050 },
    D: { "Tier 1": 3250, "Tier 2": 5350, "Tier 3": 7550, "Full Upgrades": 8650 }
  },
  partPrices: {
    Hoods: { S: 700, A: 600, B: 500, C: 400, D: 300 },
    "Roll Cage": { S: 800, A: 700, B: 600, C: 500, D: 400 },
    Exhaust: { S: 900, A: 800, B: 700, C: 600, D: 500 },
    Bumpers: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    Skirts: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    Seats: { S: 800, A: 700, B: 500, C: 400, D: 200 },
    Spoilers: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    "Xenon Headlights": { S: 600, A: 500, B: 400, C: 300, D: 300 },
    Rims: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    Interior: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    Exterior: { S: 600, A: 500, B: 400, C: 300, D: 200 },
    Roof: { S: 700, A: 600, B: 500, C: 400, D: 300 }
  },
  partsList: [
    "Hoods",
    "Roll Cage",
    "Exhaust",
    "Bumpers",
    "Skirts",
    "Seats",
    "Spoilers",
    "Xenon Headlights",
    "Rims",
    "Interior",
    "Exterior",
    "Roof"
  ],
  extrasList: [
    { name: "Full Service Repair", price: 1000 },
    { name: "Cleaning kits (5 for $1,000)", price: 1000 },
    { name: "Window tint", price: 200 },
    { name: "Horn", price: 300 },
    { name: "Spray Can", price: 100 },
    { name: "Flame kit", price: 2500 },
    { name: "Livery Roll", price: 300 },
    { name: "Plates", price: 100 },
    { name: "Race Harnesses", price: 7000 }
  ]
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const { pathname } = new URL(request.url);

  if (pathname === '/api/prices') {
    if (request.method === 'GET') return getPrices();
    if (request.method === 'PUT') return putPrices(request);
    if (request.method === 'OPTIONS') return optionsResponse();
  }

  if (pathname === '/api/audit') {
    if (request.method === 'GET') return getAudit(request);
    if (request.method === 'OPTIONS') return optionsResponse();
  }

  return new Response('Not found', { status: 404 });
}

function jsonResponse(obj, opts = {}) {
  const headers = new Headers(opts.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,PUT,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-admin-secret, x-admin-email');
  return new Response(JSON.stringify(obj), { status: opts.status || 200, headers });
}

function optionsResponse() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, x-admin-secret, x-admin-email' } });
}

async function getPrices() {
  try {
    const row = await PRICES_DB.prepare('SELECT data FROM prices WHERE id = 1').first();
    if (row && row.data) return jsonResponse(JSON.parse(row.data));
  } catch (err) {
    console.error('D1 read error', err);
  }
  return jsonResponse(DEFAULTS);
}

async function putPrices(request) {
  const secret = request.headers.get('x-admin-secret') || '';
  const expected = ADMIN_SECRET || '';
  if (!expected || secret !== expected) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Extract admin identity from common headers (Cloudflare Access or proxy)
  function extractAdmin(req) {
    const h = req.headers;
    const get = (n) => h.get(n) || h.get(n.toLowerCase());

    const candidates = [
      get('cf-access-authenticated-user'),
      get('cf-access-authenticated-user-email'),
      get('cf-access-jwt-assertion'),
      get('x-admin-email'),
      get('x-user-email'),
    ];

    for (const v of candidates) {
      if (!v) continue;
      try {
        const s = v.trim();
        if (s.startsWith('{')) {
          const parsed = JSON.parse(s);
          if (parsed?.email) return parsed.email;
        }
      } catch (e) {
        // ignore
      }

      const m = v.match(/email=([^,;\s]+)/i);
      if (m) return decodeURIComponent(m[1]);

      if (v.includes('@')) return v;
      return v;
    }

    return 'unknown';
  }

  const admin = extractAdmin(request);

  try {
    const beforeRow = await PRICES_DB.prepare('SELECT data FROM prices WHERE id = 1').first();
    const before = beforeRow?.data || null;

    await PRICES_DB.prepare('INSERT OR REPLACE INTO prices (id, data, updated_at) VALUES (1, ?, datetime("now"))').run(JSON.stringify(body));

    await PRICES_DB.prepare('INSERT INTO audit_logs (admin, before_data, after_data, created_at) VALUES (?, ?, ?, datetime("now"))').run(admin, before, JSON.stringify(body));

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('D1 write error', err);
    return jsonResponse({ error: 'Storage error' }, { status: 500 });
  }
}

async function getAudit(request) {
  const secret = request.headers.get('x-admin-secret') || '';
  const expected = ADMIN_SECRET || '';
  if (!expected || secret !== expected) return jsonResponse({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await PRICES_DB.prepare('SELECT id, admin, before_data, after_data, created_at FROM audit_logs ORDER BY id DESC LIMIT 100').all();
    return jsonResponse({ rows: rows?.results || [] });
  } catch (err) {
    console.error('D1 read audit error', err);
    return jsonResponse({ error: 'Storage error' }, { status: 500 });
  }
}
