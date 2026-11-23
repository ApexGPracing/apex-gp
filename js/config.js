/* Global time-trial leaderboard (Supabase). Paste your project's values here.
   Both are safe to publish: the anon key only allows what the database rules allow
   (reading the leaderboard and adding lap times). Leave empty to turn the leaderboard off. */
export const SUPABASE_URL = 'https://zhlmkzfowjzarurkyjvf.supabase.co';      // e.g. 'https://abcdefgh.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_ttmlAv9wIxBIMh6E96UA7w_Pe48KVQP'; // the long 'anon' 'public' key

/* Optional TURN relay for online races (free Metered / Open Relay account): the app name (the part before
   .metered.live) and its API key. Leave empty to use direct connections and the Supabase relay only. */
export const METERED_APP = '';
export const METERED_KEY = '';
/* Metered TURN credential (dashboard → TURN Server → credential). Lets players on school / work networks
   that block direct connections race through Metered's relay (ports 80 and 443, incl. TLS) instead of
   the slower Supabase fallback. */
export const TURN_USER = '23497927d33ac95a25e3c602';
export const TURN_PASS = 'iklMdiz1PkegGQJO';
