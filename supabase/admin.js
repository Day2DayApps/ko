// ===== ADMIN FUNCTIONS =====
class AdminManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.adminClient = window.supabaseAdmin;
    }

    // Verify Admin/Owner Role
    async verifyAdmin() {
        const role = await this.getUserRole();
        if (!['admin', 'owner'].includes(role)) {
            throw new Error('Admin privileges required');
        }
        return true;
    }

    // Get All Users (Admin Only)
    async getAllUsers() {
        try {
            await this.verifyAdmin();
            
            const { data, error } = await this.adminClient
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Get users error:', error);
            return { success: false, error: error.message };
        }
    }

    // Update User Role (Admin Only)
    async updateUserRole(userId, newRole) {
        try {
            await this.verifyAdmin();
            
            // Prevent owner from being demoted by admin
            const currentUserRole = await this.getUserRole();
            if (currentUserRole === 'admin' && newRole === 'owner') {
                throw new Error('Only owners can assign owner role');
            }

            const { data, error } = await this.adminClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)
                .select();

            if (error) throw error;
            
            // Log admin action
            await this.logAdminAction('update_role', userId, null, `Changed role to ${newRole}`);
            
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Update role error:', error);
            return { success: false, error: error.message };
        }
    }

    // Moderate Content (Admin Only)
    async moderateContent(contentId, status, reason = '') {
        try {
            await this.verifyAdmin();

            const { data, error } = await this.adminClient
                .from('content')
                .update({ 
                    status: status,
                    is_published: status === 'approved'
                })
                .eq('id', contentId)
                .select();

            if (error) throw error;

            // Log admin action
            await this.logAdminAction('moderate_content', null, contentId, `Status: ${status}, Reason: ${reason}`);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Moderate content error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get Admin Logs
    async getAdminLogs(filters = {}) {
        try {
            await this.verifyAdmin();

            let query = this.adminClient
                .from('admin_logs')
                .select('*, profiles!admin_id(username, full_name), profiles!target_user_id(username)');

            if (filters.adminId) query = query.eq('admin_id', filters.adminId);
            if (filters.actionType) query = query.eq('action_type', filters.actionType);
            if (filters.startDate) query = query.gte('created_at', filters.startDate);
            if (filters.endDate) query = query.lte('created_at', filters.endDate);

            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Get logs error:', error);
            return { success: false, error: error.message };
        }
    }

    // Log Admin Action
    async logAdminAction(actionType, targetUserId = null, targetContentId = null, description = '') {
        try {
            const user = await this.getCurrentUser();
            await this.adminClient
                .from('admin_logs')
                .insert([{
                    admin_id: user.id,
                    action_type: actionType,
                    target_user_id: targetUserId,
                    target_content_id: targetContentId,
                    description: description,
                    ip_address: await this.getIPAddress()
                }]);
        } catch (error) {
            console.error('Log admin action error:', error);
        }
    }

    // Get Current User (helper)
    async getCurrentUser() {
        const { data: { user } } = await this.supabase.auth.getUser();
        return user;
    }

    // Get User Role (helper)
    async getUserRole() {
        const user = await this.getCurrentUser();
        if (!user) return 'public';

        const { data, error } = await this.supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (error || !data) return 'user';
        return data.role;
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
}

window.adminManager = new AdminManager();
