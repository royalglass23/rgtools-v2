import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['@neondatabase/serverless', 'bcryptjs', 'drizzle-orm'],
}

export default nextConfig
