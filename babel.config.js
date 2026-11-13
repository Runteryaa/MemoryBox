module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // The Reanimated Babel plugin is automatically added by babel-preset-expo
    // when react-native-reanimated / react-native-worklets are installed.
    // In Reanimated 4 the plugin lives at 'react-native-worklets/plugin'.
  };
};
