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
  // T5-bis-fix2 — bundle edge : @anthropic-ai/sdk fait
  // `await import('node:fs')` et `await import('node:path')` dans son module
  // credentials (OAuth file-based flow). Ces chemins ne sont jamais exécutés
  // quand on passe `apiKey` au constructeur, mais webpack tente quand même de
  // les résoudre statiquement. On réécrit `node:fs|path` → `fs|path` puis on
  // les stubbe à `false` via `resolve.fallback` UNIQUEMENT pour le runtime
  // edge. Le bundle nodejs reste inchangé.
  webpack: (config, { nextRuntime, webpack }) => {
    if (nextRuntime === 'edge') {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:(fs|path)$/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, '')
          }
        )
      )
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
