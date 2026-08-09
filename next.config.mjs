/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { optimizePackageImports: ["react"] },
  typescript: { ignoreBuildErrors: true },
};
export default nextConfig;
