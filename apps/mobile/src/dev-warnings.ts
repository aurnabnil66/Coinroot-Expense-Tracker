/**
 * Drops dev-only warnings that come from libraries, not our code, from both the LogBox toast
 * and the console / Metro output. Imported first by the entry (`index.js`), because NativeWind's
 * JSX runtime loads with the first screen file and warns before any of our code runs. Release
 * builds never show these. Don't hide our own warnings here.
 */
const IGNORED = [
  // react-native-css-interop (NativeWind) touches React Native's deprecated ImageBackground at
  // startup. Remove once NativeWind stops doing that.
  'ImageBackground is deprecated',
];

if (__DEV__) {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    const message = typeof args[0] === 'string' ? args[0] : '';
    if (IGNORED.some((text) => message.includes(text))) return;
    warn(...args);
  };
}
