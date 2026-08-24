import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@expenzo/supabase-types';

/**
 * The typed client every repository takes as its first argument.
 *
 * Deliberately not constructed in this package. Web needs `@supabase/ssr` with
 * cookie storage in three flavours (browser, server, middleware); native needs
 * AsyncStorage, a URL polyfill and an AppState refresh listener. Injecting the
 * client keeps this package free of both, so neither bundler drags in the
 * other's runtime.
 */
export type Db = SupabaseClient<Database>;

export type { Database };
