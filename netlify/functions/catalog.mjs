import { getStore } from '@netlify/blobs';

const BLOB_KEY = 'catalog';
const REQUIRED_PRODUCT_IDS = ['todoo-glo', 'icex-40k', 'extre-100k'];

// IMPORTANT: set an ADMIN_PASSCODE environment variable in the Netlify
// dashboard (Site settings -> Environment variables) so the real check
// doesn't rely on a value baked into the deployed code. This fallback only
// exists so the site still works before that variable is configured.
const ADMIN_PASSCODE = process.env.ADMIN_PASSCODE || 'todoo2026';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isValidCatalog(cat) {
  if (!cat || typeof cat !== 'object') return false;
  return REQUIRED_PRODUCT_IDS.every((id) => {
    const p = cat[id];
    return p && Array.isArray(p.flavors) && Array.isArray(p.priceTiers);
  });
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const store = getStore({ name: 'kralj-dimova', consistency: 'strong' });

  if (req.method === 'GET') {
    try {
      const data = await store.get(BLOB_KEY, { type: 'json' });
      return jsonResponse(200, data || null);
    } catch (err) {
      return jsonResponse(500, { error: 'Greška pri čitanju kataloga: ' + err.message });
    }
  }

  if (req.method === 'POST') {
    let payload;
    try {
      payload = await req.json();
    } catch (err) {
      return jsonResponse(400, { error: 'Neispravan JSON.' });
    }

    if (payload.passcode !== ADMIN_PASSCODE) {
      return jsonResponse(401, { error: 'Pogrešna šifra.' });
    }

    if (!isValidCatalog(payload.catalog)) {
      return jsonResponse(400, { error: 'Neispravan format kataloga.' });
    }

    try {
      await store.setJSON(BLOB_KEY, payload.catalog);
      return jsonResponse(200, { ok: true });
    } catch (err) {
      return jsonResponse(500, { error: 'Greška pri čuvanju kataloga: ' + err.message });
    }
  }

  return jsonResponse(405, { error: 'Method not allowed.' });
};
