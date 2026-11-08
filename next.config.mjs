import { jobhackingRedirects, settingsRedirects } from "./lib/settings-redirects.mjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // The JobHacking "Profile" page became "Narrative" (2026-11-03); registration links already sent still point here.
      { source: "/jobhacking/profile", destination: "/jobhacking/narrative", permanent: true },
      // The Profile page went into Settings (2026-11-07) — every old section link lands on the section that edits it now.
      ...settingsRedirects(),
      // The three artefacts became pages of their own (2026-11-09) — a section link into /jobhacking/artefacts lands on its page.
      ...jobhackingRedirects(),
    ];
  },
};
export default nextConfig;
