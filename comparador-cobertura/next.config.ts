import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg y cheerio corren solo del lado del servidor.
  serverExternalPackages: ["pg"],
  // El proyecto vive en una subcarpeta del repo: la raíz es esta carpeta.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
