const fs = require('node:fs');
const path = require('node:path');

function getAssetVersion(relativePath) {
  try {
    const fullPath = path.join(__dirname, '..', 'public', relativePath.replace(/^\//, ''));
    return String(Math.floor(fs.statSync(fullPath).mtimeMs));
  } catch {
    return String(Date.now());
  }
}

function assetUrl(relativePath) {
  const clean = String(relativePath || '').replace(/^\//, '');
  const base = process.env.FOLHA_BASE_PATH || process.env.BEATRIZ_BASE_PATH || '';
  return `${base}/${clean}?v=${getAssetVersion(clean)}`;
}

module.exports = {
  assetUrl,
  getAssetVersion,
};
