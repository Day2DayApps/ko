// ===== AUTHENTICATION FUNCTIONS =====
class AuthManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.currentUser = null;
        this.currentProfile = null;
    }

    // Sign Up with role
    async signUp(email, password, userData = {}) {
        try {
            const { data, error } = await this.supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: userData.username || email,
                        full_name: userData.fullName || '',
                        role: 'user' // Default role
                    }
                }
            });

            if (error) throw error;
            
            // Profile is auto-created via trigger
            this.currentUser = data.user;
            await this.loadProfile();
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Signup error:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign In
    async signIn(email, password) {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;
            
            this.currentUser = data.user;
            await this.loadProfile();
            
            // Log activity
            await this.logActivity('user_login');
            
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    // Sign Out
    async signOut() {
        try {
            await this.logActivity('user_logout');
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.currentUser = null;
            this.currentProfile = null;
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    // Load Current User Profile
    async loadProfile() {
        try {
            if (!this.currentUser) {
                const { data: { user } } = await this.supabase.auth.getUser();
                this.currentUser = user;
            }

            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            
            this.currentProfile = data;
            return data;
        } catch (error) {
            console.error('Load profile error:', error);
            return null;
        }
    }

    // Get User Role
    getUserRole() {
        return this.currentProfile?.role || 'user';
    }

    // Check if user has role
    hasRole(roles) {
        const userRole = this.getUserRole();
        return roles.includes(userRole);
    }

    // Log Activity
    async logActivity(action) {
        try {
            await this.supabase
                .from('user_activities')
                .insert([{
                    user_id: this.currentUser?.id,
                    action: action,
                    ip_address: await this.getIPAddress(),
                    user_agent: navigator.userAgent
                }]);
        } catch (error) {
            console.error('Activity log error:', error);
        }
    }

    // Get IP Address (helper)
    async getIPAddress() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch {
            return 'unknown';
        }
    }

    // Auth State Listener
    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.currentUser = session?.user || null;
                this.loadProfile();
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.currentProfile = null;
            }
            callback(event, session, this.currentProfile);
        });
    }
}

// Initialize Auth Manager
window.authManager = new AuthManager();
