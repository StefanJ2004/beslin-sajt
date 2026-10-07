import { getStore } from '@netlify/blobs';

const BLOB_KEY = 'catalog';
const REQUIRED_PRODUCT_IDS = ['todoo-glo', 'icex-40k', 'extre-100k'];

// IMPORTANT: set an ADMIN_PASSCODE environment variable in the Netlify
// dashboard (Site settings -> Environment variables) so the real check
// doesn't rely on a value baked into the deployed code. This fallback only
// exists so the site still works before that variable is configured.
const ADMIN_PASSCODE = (process.env.ADMIN_PASSCODE || '').trim() || 'todoo2026';

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

  // Netlify Blobs are scoped per Netlify *site*. To make several sites
  // (e.g. a private and a public deploy of this same repo) share ONE
  // catalog, set BLOBS_SITE_ID (the Site ID of the "main" site) and
  // BLOBS_TOKEN (a Netlify personal access token) on every site. Without
  // them, each site keeps its own separate catalog.
  // Values pasted into the Netlify UI often carry stray spaces/newlines,
  // which make Netlify reject them with a 401.
  const sharedSiteID = (process.env.BLOBS_SITE_ID || '').trim();
  const sharedToken = (process.env.BLOBS_TOKEN || '').trim();
  const storeOptions = { name: 'kralj-dimova', consistency: 'strong' };
  if (sharedSiteID && sharedToken) {
    storeOptions.siteID = sharedSiteID;
    storeOptions.token = sharedToken;
  }
  const store = getStore(storeOptions);

  // Diagnostics: open /.netlify/functions/catalog?debug=1 to see which
  // store this site is actually using (never prints the token itself).
  if (req.method === 'GET' && new URL(req.url).searchParams.has('debug')) {
    let readTest;
    try {
      await store.get(BLOB_KEY, { type: 'json' });
      readTest = 'OK';
    } catch (err) {
      readTest = 'GREŠKA: ' + err.message;
    }
    return jsonResponse(200, {
      mode: storeOptions.siteID ? 'deljeno (BLOBS_SITE_ID + BLOBS_TOKEN)' : 'lokalno (skladište ovog sajta)',
      BLOBS_SITE_ID_set: Boolean(process.env.BLOBS_SITE_ID),
      BLOBS_SITE_ID_value: sharedSiteID || null,
      BLOBS_TOKEN_set: Boolean(process.env.BLOBS_TOKEN),
      BLOBS_TOKEN_length: sharedToken.length,
      ADMIN_PASSCODE_set: Boolean(process.env.ADMIN_PASSCODE),
      thisSiteID: process.env.SITE_ID || null,
      readTest,
    });
  }

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

    // Lets the admin login screen check the passcode without the passcode
    // ever having to be shipped in index.html.
    if (payload.verify) {
      return jsonResponse(200, { ok: true });
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
