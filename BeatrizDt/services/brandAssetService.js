const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const LOGO_RELATIVE_PATH = path.join('images', 'dauto-login-logo.png');
const LOGIN_PAGE_LOGO_RELATIVE_PATH = path.join('images', 'dauto-login-page-logo.png');
const EXITO_LOGO_RELATIVE_PATH = path.join('images', 'logo.png');

function getBasePath() {
  return process.env.FOLHA_BASE_PATH || process.env.BEATRIZ_BASE_PATH || '';
}

function publicUrl(relativePath) {
  const normalized = `/${String(relativePath).replace(/\\/g, '/')}`;
  const base = getBasePath();
  return base ? `${base}${normalized}` : normalized;
}

function getAssetDataUri(relativePath) {
  const assetPath = path.join(PUBLIC_ROOT, relativePath);

  if (!fs.existsSync(assetPath)) {
    return '';
  }

  const buffer = fs.readFileSync(assetPath);
  return `data:image/png;base64,${buffer.toString('base64')}`;
}

function getLogoAbsolutePath() {
  return path.join(PUBLIC_ROOT, LOGO_RELATIVE_PATH);
}

function getExitoLogoAbsolutePath() {
  return path.join(PUBLIC_ROOT, EXITO_LOGO_RELATIVE_PATH);
}

function getLogoPublicPath() {
  return publicUrl(LOGO_RELATIVE_PATH);
}

function getLoginPageLogoPublicPath() {
  return publicUrl(LOGIN_PAGE_LOGO_RELATIVE_PATH);
}

function getExitoLogoPublicPath() {
  return publicUrl(EXITO_LOGO_RELATIVE_PATH);
}

function getLogoDataUri() {
  return getAssetDataUri(LOGO_RELATIVE_PATH);
}

function getExitoLogoDataUri() {
  return getAssetDataUri(EXITO_LOGO_RELATIVE_PATH);
}

module.exports = {
  getLogoAbsolutePath,
  getExitoLogoAbsolutePath,
  getLogoPublicPath,
  getLoginPageLogoPublicPath,
  getExitoLogoPublicPath,
  getLogoDataUri,
  getExitoLogoDataUri,
};
