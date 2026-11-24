// The fingerprint is the app's runtime version (app.json `runtimeVersion.policy: fingerprint`):
// an OTA update only reaches APKs with the same fingerprint. It must come out the same on every
// machine and in every build, so leave out what isn't the app's native code:
// - android/ and ios/ are generated from app.json by `expo prebuild` (gitignored), and only exist
//   on machines that ran it, so hashing them would make each computer's fingerprint different;
//   app.json, config plugins and native packages are still hashed;
// - .gitignore and package.json scripts don't change the native app.

/** @type {import('expo/fingerprint').Config} */
const config = {
  ignorePaths: ['android/**/*', 'ios/**/*'],
  sourceSkips: ['GitIgnore', 'PackageJsonScriptsAll'],
};

module.exports = config;
