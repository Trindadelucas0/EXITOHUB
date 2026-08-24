function useJsonStorage() {
  if (process.env.HUB_MODE === '1' && process.env.FOLHA_STORAGE_BACKEND) {
    return process.env.FOLHA_STORAGE_BACKEND === 'json';
  }
  return process.env.STORAGE_BACKEND === 'json';
}

function getStorage() {
  return useJsonStorage()
    ? require('./json')
    : require('./postgres');
}

module.exports = {
  getStorage,
  useJsonStorage,
};
