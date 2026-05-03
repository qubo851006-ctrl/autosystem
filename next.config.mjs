/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'p-queue', '@prisma/client'],
  },
};

export default nextConfig;
