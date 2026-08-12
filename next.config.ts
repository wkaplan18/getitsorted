import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow fetching invoice files from any domain (Clickatell media URLs)
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  },

  // @react-pdf/renderer must stay outside the server bundle. It loads font
  // metric files (fontkit's .afm data for the built-in Helvetica) from disk at
  // runtime, and Next's bundler rewrites those paths so they resolve locally
  // but not once traced onto Vercel — which is why the quote PDF rendered fine
  // in a standalone script and threw in production.
  serverExternalPackages: ['@react-pdf/renderer'],
}

export default nextConfig
