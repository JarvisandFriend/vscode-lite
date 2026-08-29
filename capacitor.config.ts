import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.code.vscodelite',
  appName: 'VS Code Lite',
  webDir: 'dist',
  server: {
    // Needed on Android so cleartext http:// backends work during dev;
    // remove/tighten once VITE_API_URL points at an https:// host.
    androidScheme: 'https',
    cleartext: true,
  },
};

export default config;
