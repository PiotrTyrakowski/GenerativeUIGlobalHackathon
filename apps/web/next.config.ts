import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/agent",
        destination: `http://localhost:${process.env.AGENT_PORT || 3001}/api/agent`,
      },
    ];
  },
};

export default nextConfig;
