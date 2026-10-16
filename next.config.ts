import type { NextConfig } from 'next';

// Server pengembangan menolak permintaan dari alamat selain localhost. Terowongan (ngrok, dll.) harus
// didaftarkan lewat DEV_PUBLIC_URL, mis. https://abc-123.ngrok-free.app
const devHost = process.env.DEV_PUBLIC_URL ? new URL(process.env.DEV_PUBLIC_URL).hostname : null;

const nextConfig: NextConfig = {
  allowedDevOrigins: devHost ? [devHost] : [],
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  },
  experimental: {
    // Cache Turbopack di disk (.next) bisa membengkak sampai beberapa GB saat dev berjalan lama.
    // ponytail: dimatikan karena disk laptop pengembang sempit; nyalakan lagi bila start dev terasa lambat.
    turbopackFileSystemCacheForDev: false
  }
};

export default nextConfig;
