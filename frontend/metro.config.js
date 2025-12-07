// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add Tamagui and MapLibre resolver configuration
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];

// Ensure proper module resolution
config.resolver.unstable_enablePackageExports = true;

// Add transformer configuration for Tamagui
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_classnames: true, // Prevent issues with React Native minification
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
};

module.exports = config;