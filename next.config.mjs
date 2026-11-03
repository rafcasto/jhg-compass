/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The JobHacking "Profile" page became "Narrative" (2026-11-03); registration links already sent still point here.
      { source: "/jobhacking/profile", destination: "/jobhacking/narrative", permanent: true },
    ];
  },
};
export default nextConfig;
