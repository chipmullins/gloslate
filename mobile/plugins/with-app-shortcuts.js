// Adds GloslateShortcuts.swift (Siri & Shortcuts) to the main app target. App Shortcuts
// have to live in the app itself (not a pod) so Xcode extracts their metadata.
const fs = require('fs');
const path = require('path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'GloslateShortcuts.swift';

module.exports = function withAppShortcuts(config) {
  config = withDangerousMod(config, ['ios', (cfg) => {
    const name = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const dest = path.join(cfg.modRequest.platformProjectRoot, name, FILE);
    fs.copyFileSync(path.join(__dirname, 'app-shortcuts', FILE), dest);
    return cfg;
  }]);
  return withXcodeProject(config, (cfg) => {
    const name = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const project = cfg.modResults;
    const filepath = `${name}/${FILE}`;
    if (!project.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project });
    }
    return cfg;
  });
};
