(() => {
  'use strict';

  const config = window.SITE_CONFIG || {};
  const url = String(config.supabaseUrl || '').trim();
  const anonKey = String(config.supabaseAnonKey || '').trim();
  const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url);

  window.BOOKING_BACKEND_CONFIGURED = Boolean(validUrl && anonKey && window.supabase?.createClient);
  window.bookingSupabase = window.BOOKING_BACKEND_CONFIGURED
    ? window.supabase.createClient(url.replace(/\/$/, ''), anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;
})();
