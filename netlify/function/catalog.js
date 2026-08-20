const { getStore } = require('@netlify/blobs');

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

function json(statusCode, body) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
    body: JSON.stringify(body),
  };
}

function isValidCatalog(cat) {
  if (!cat || typeof cat !== 'object') return false;
  return REQUIRED_PRODUCT_IDS.every(function (id) {
    var p = cat[id];
    return p && Array.isArray(p.flavors) && Array.isArray(p.priceTiers);
  });
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const store = getStore({ name: 'kralj-dimova', consistency: 'strong' });

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get(BLOB_KEY, { type: 'json' });
      return json(200, data || null);
    } catch (err) {
      return json(500, { error: 'Greška pri čitanju kataloga.' });
    }
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (err) {
      return json(400, { error: 'Neispravan JSON.' });
    }

    if (payload.passcode !== ADMIN_PASSCODE) {
      return json(401, { error: 'Pogrešna šifra.' });
    }

    if (!isValidCatalog(payload.catalog)) {
      return json(400, { error: 'Neispravan format kataloga.' });
    }

    try {
      await store.setJSON(BLOB_KEY, payload.catalog);
      return json(200, { ok: true });
    } catch (err) {
      return json(500, { error: 'Greška pri čuvanju kataloga.' });
    }
  }

  return json(405, { error: 'Method not allowed.' });
};
