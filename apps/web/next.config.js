// added by enable-proxy-mode.ps1
const API_REWRITE_TARGET = process.env.API_REWRITE_TARGET || "http://localhost:4000";
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "http://127.0.0.1:4000/:path*" },
    ];
  },
};
module.exports = nextConfig;
