// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.js',
          logTimings: true,
        },
      ],
      'react-native-reanimated/plugin', // Must be last
    ],
  };
};