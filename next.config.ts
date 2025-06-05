
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Adding a comment to try and trigger a rebuild and potentially resolve startup issues
  // Adding another comment to ensure the file is marked as changed for a clean rebuild.
  // General stability pass: another minor modification to ensure this config is re-evaluated.
  // Attempt to resolve ChunkLoadError by ensuring this file is re-processed (again).
};

export default nextConfig;
