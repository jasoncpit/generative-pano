/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Local development: proxy API calls to FastAPI on :8000
    return [{ source: '/api/generate', destination: 'http://localhost:8000/api/v1/generate' }];
  },
};

module.exports = nextConfig;

