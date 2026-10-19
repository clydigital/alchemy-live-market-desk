/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { optimizePackageImports: ["react"] },
  async rewrites() {
    // Only Bluebelly's public hostname receives Blue Desk at clean URLs.
    // Other Live Desk domains, API routes, historical edition paths and cron
    // entry points remain identical to their established contracts.
    const onBluebelly = [{ type: "host", value: "bluebelly-desk.vercel.app" }];
    return [
      { source: "/", destination: "/blue-desk", has: onBluebelly },
      { source: "/calendar", destination: "/blue-desk/calendar", has: onBluebelly },
      { source: "/stories/:articleId", destination: "/blue-desk/stories/:articleId", has: onBluebelly },
    ];
  },
};
export default nextConfig;
