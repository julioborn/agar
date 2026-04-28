/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zyxbeohmvwumldmihrgc.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // jspdf references these optional deps that don't exist in the bundle
      config.resolve.alias = {
        ...config.resolve.alias,
        canvg: false,
        html2canvas: false,
        dompurify: false,
      };
    }
    if (isServer) {
      // pdf-parse usa canvas como dependencia opcional — no está disponible en el runtime de Next.js
      config.externals = [...(Array.isArray(config.externals) ? config.externals : []), 'canvas'];
    }
    return config;
  },
};
export default nextConfig;
