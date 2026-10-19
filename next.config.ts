import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: [
    '@lineky/database',
    '@lineky/platform-auth',
    '@lineky/supabase'
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
};

export default withNextIntl(nextConfig);
