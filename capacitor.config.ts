import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.escanermobile.app',
  appName: 'DocuScan & Sign',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
