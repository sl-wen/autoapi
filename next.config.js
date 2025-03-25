/** @type {import('next').NextConfig} */

const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  swcMinify: true,
  env: {
    VERCEL_URL: process.env.VERCEL_URL,
  },
};

module.exports = nextConfig; 