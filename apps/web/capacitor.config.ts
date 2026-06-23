import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.agar.sistema',
  appName: 'AGAR',
  webDir: 'www',
  server: {
    url: 'https://www.agar.ar',
    androidScheme: 'https',
    allowNavigation: ['agar.ar', 'www.agar.ar', '*.agar.ar'],
  },
  backgroundColor: '#09090b',
};

export default config;
