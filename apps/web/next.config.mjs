/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
    return config;
  },
};
export default nextConfig;
