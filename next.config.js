/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/api/attestations/generate': [
        './public/fonts/**/*',
        './public/signature.png',
      ],
    },
  },
}

module.exports = nextConfig
