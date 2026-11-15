import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg y cheerio corren solo del lado del servidor.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
