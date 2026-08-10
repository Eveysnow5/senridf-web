// CJS → ESM bridge for the shared model/provider config.
//
// The scrapers are CommonJS (package.json has no "type": "module") but
// functions/api/_lib/models.js must stay ESM because Cloudflare Pages Functions
// require it. `require()` cannot load ESM, so we use a dynamic import and cache
// the promise — Node caches the module itself, this just avoids re-resolving.
//
// The alternative was duplicating the model ids in a CJS file, which is exactly
// the drift problem the shared config exists to prevent: a quota switch would
// have to be made twice and one copy would eventually be forgotten.
//
// An absolute file:// URL is used deliberately: relative specifiers in dynamic
// import from CJS behave inconsistently across platforms, and these scripts run
// both on Windows (local) and Linux (GitHub Actions).

const path = require('path');
const { pathToFileURL } = require('url');

let cached;

/**
 * Load the shared provider/model config.
 * @returns {Promise<{CHAT_ENDPOINT: string, modelFor: Function, TIERS: object, TASK_TIER: object}>}
 */
function loadModelConfig() {
  if (!cached) {
    const abs = path.join(__dirname, '..', '..', 'functions', 'api', '_lib', 'models.js');
    cached = import(pathToFileURL(abs).href);
  }
  return cached;
}

module.exports = { loadModelConfig };
