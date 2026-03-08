/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.greenhouse.io' },
      { protocol: 'https', hostname: '**.lever.co' },
      { protocol: 'https', hostname: 'logo.clearbit.com' },
    ],
  },
};

module.exports = nextConfig;
