// pnpm 모노레포: 워크스페이스 루트를 감시 대상에 추가.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, '../..')];

module.exports = config;
