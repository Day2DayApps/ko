// ============================================
// SUPABASE CONFIGURATION - RENDER COMPATIBLE
// ============================================

// Method 1: Environment Variables (for Render build)
// These will be replaced during build
const SUPABASE_CONFIG = {
    url: process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL',
    anonKey: process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY'
};

// Method 2: Fallback to window variables (for runtime)
if (typeof window !== 'undefined') {
    const config = {
        url: window.SUPABASE_URL || SUPABASE_CONFIG.url,
        anonKey: window.SUPABASE_ANON_KEY || SUPABASE_CONFIG.anonKey,
        serviceKey: window.SUPABASE_SERVICE_KEY || SUPABASE_CONFIG.serviceKey
    };
    window.SUPABASE_CONFIG = config;
}

// Initialize Supabase client
const supabase = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);

// Admin client
const getAdminClient = () => {
    return window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.serviceKey
    );
};

// Expose globally
window.supabaseClient = supabase;
window.supabaseAdmin = getAdminClient;

console.log('✅ Supabase configured on Render!');
