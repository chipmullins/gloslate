// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  // React Native <Text> isn't HTML; apostrophes in copy are fine.
  { rules: { 'react/no-unescaped-entities': 'off' } },
  { ignores: ['dist/*', 'modules/*/android/**', 'modules/*/ios/**', 'scripts/**'] },
]);
