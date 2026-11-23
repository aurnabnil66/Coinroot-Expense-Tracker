const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build loads a .wasm file.
config.resolver.assetExts.push('wasm');
// Drizzle migrations (src/lib/db/migrations/*.sql) are bundled as source.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './src/global.css' });
