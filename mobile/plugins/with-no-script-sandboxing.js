// CocoaPods' "Copy Pods Resources" script writes into ios/Pods, which Xcode's user
// script sandbox blocks for app extensions (the widget). Expo turns sandboxing off
// for the main app target only; this turns it off for every target.
const { withXcodeProject } = require('expo/config-plugins');

module.exports = function withNoScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const configs = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const entry = configs[key];
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });
};
