import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * Hosts the dev server will serve `/_next/*` to.
   *
   * `next dev` refuses any request for an internal asset whose Origin it does
   * not recognise, and answers 403. It knows `localhost`; it does not know
   * `127.0.0.1`, which is a different origin to a browser and the one this
   * project sends people to — `site_url` in supabase/config.toml is
   * http://127.0.0.1:3000, so every magic link and invitation lands there.
   *
   * The failure is quiet and looks like something else entirely: the document
   * renders, every script 403s, React never hydrates, and the forms fall back
   * to a native submit. Signing in reloads the page and nothing happens — not
   * even client-side validation, because validation is client-side. It reads
   * as broken authentication, and cost an afternoon of looking at the wrong
   * thing.
   *
   * Development only; `next start` does not consult this.
   */
  allowedDevOrigins: ['127.0.0.1'],
  // The shared packages ship TypeScript source, so Next must compile them.
  transpilePackages: [
    '@expenzo/ui',
    '@expenzo/data',
    '@expenzo/domain',
    '@expenzo/i18n',
    '@expenzo/supabase-types',
  ],
};

export default nextConfig;
