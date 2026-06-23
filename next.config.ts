import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow fetching invoice files from any domain (Clickatell media URLs)
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  }
}

export default nextConfig
