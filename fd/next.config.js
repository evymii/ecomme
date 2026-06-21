/** @type {import('next').NextConfig} */
function getApiUploadRemotePattern() {
  const rawApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (!rawApiUrl) return null

  try {
    const apiUrl = new URL(rawApiUrl)
    return {
      protocol: apiUrl.protocol.replace(':', ''),
      hostname: apiUrl.hostname,
      port: apiUrl.port,
      pathname: '/uploads/**',
    }
  } catch (_error) {
    return null
  }
}

const apiUploadRemotePattern = getApiUploadRemotePattern()

const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5001',
        pathname: '/uploads/**',
      },
      ...(apiUploadRemotePattern ? [apiUploadRemotePattern] : []),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer }) => {
    // Make html2canvas and jspdf optional (only bundle if installed)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };
    }
    return config;
  },
}

module.exports = nextConfig
