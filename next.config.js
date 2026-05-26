/** @type {import('next').NextConfig} */
const nextConfig = {
  // ignoreBuildErrors=true : préserve le comportement Next 14.2 (TS errors
  // non bloquantes au build). 38 erreurs TS pré-existantes identifiées au
  // bump Next 15 (AUDIT-22-D1) — dont 5 dans le périmètre interdit
  // src/lib/supabase/hooks.ts. Dette séparée à traiter dans un ticket
  // dédié (AUDIT-26-D1 typecheck strict). ESLint reste bloquant au build
  // (AUDIT-22-D2) et tsc --noEmit reste utilisable en local pour diag.
  typescript: {
    ignoreBuildErrors: true,
  },
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
}

module.exports = nextConfig
