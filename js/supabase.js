// ============================================================
//  SUPABASE CLIENT
// ============================================================
let supabaseClient = null;

function isSupabaseConfigured() {
    return Boolean(
        window.supabase &&
        SUPABASE_URL &&
        SUPABASE_ANON_KEY &&
        !SUPABASE_URL.includes('YOUR_SUPABASE_URL') &&
        !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
    );
}

function initSupabaseClient() {
    if (!isSupabaseConfigured()) {
        console.warn('Supabase is not configured. Update SUPABASE_URL and SUPABASE_ANON_KEY in js/config.js.');
        return null;
    }

    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    return supabaseClient;
}

function requireSupabaseClient() {
    const client = initSupabaseClient();
    if (!client) throw new Error('Supabase is not configured yet.');
    return client;
}
