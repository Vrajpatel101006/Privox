import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Image Optimization ──────────────────────────────────────────────────────
  images: {
    // Enable Next.js built-in image optimization (WebP conversion, lazy loading)
    unoptimized: false,
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // 24h cache for optimized images
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'http', hostname: '127.0.0.1' },
    ],
  },

  // ── Compiler optimizations ──────────────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // Strip console.log in prod
  },

  // ── Bundle & performance ───────────────────────────────────────────────────
  transpilePackages: ['three'],

  // Compress responses with gzip
  compress: true,

  // Enable React strict mode for better performance and catching bugs
  reactStrictMode: true,

  // ── HTTP Headers for security + performance ────────────────────────────────
  async headers() {
    return [
      // Firebase popup support
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Prevent MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer policy
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // Aggressive caching for static assets (images, fonts, icons)
      {
        source: '/dashboard/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=2592000',
          },
        ],
      },
      {
        source: '/categories/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=2592000',
          },
        ],
      },
      {
        source: '/landing/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=2592000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;



