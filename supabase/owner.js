// ===== OWNER FUNCTIONS =====
class OwnerManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.adminClient = window.supabaseAdmin;
    }

    // Verify Owner Role
    async verifyOwner() {
        const role = await this.getUserRole();
        if (role !== 'owner') {
            throw new Error('Owner privileges required');
        }
        return true;
    }

    // Manage Admins (Add/Remove)
    async manageAdmin(userId, action) {
        try {
            await this.verifyOwner();

            if (!['add', 'remove'].includes(action)) {
                throw new Error('Invalid action. Use "add" or "remove"');
            }

            const newRole = action === 'add' ? 'admin' : 'user';

            const { data, error } = await this.adminClient
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId)
                .select();

            if (error) throw error;

            // Log owner action
            await this.logOwnerAction('manage_admin', userId, null, `${action}ed admin`);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Manage admin error:', error);
            return { success: false, error: error.message };
        }
    }

    // System Settings Management
    async getSystemSettings() {
        try {
            await this.verifyOwner();

            const { data, error } = await this.adminClient
                .from('system_settings')
                .select('*')
                .order('created_at');

            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Get settings error:', error);
            return { success: false, error: error.message };
        }
    }

    async updateSystemSettings(settingKey, settingValue) {
        try {
            await this.verifyOwner();

            const user = await this.getCurrentUser();

            const { data, error } = await this.adminClient
                .from('system_settings')
                .upsert({
                    setting_key: settingKey,
                    setting_value: settingValue,
                    updated_by: user.id
                }, { onConflict: 'setting_key' })
                .select();

            if (error) throw error;

            // Log owner action
            await this.logOwnerAction('update_settings', null, null, `Updated ${settingKey}`);

            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Update settings error:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete User (Owner Only)
    async deleteUser(userId) {
        try {
            await this.verifyOwner();

            // Prevent deleting self
            const currentUser = await this.getCurrentUser();
            if (currentUser.id === userId) {
                throw new Error('Cannot delete your own account');
            }

            // Check if user is owner
            const { data: userData, error: userError } = await this.adminClient
                .from('profiles')
                .select('role')
                .eq('id', userId)
                .single();

            if (userError) throw userError;
            if (userData.role === 'owner') {
                throw new Error('Cannot delete another owner');
            }

            // Delete user (cascade will handle related data)
            const { error } = await this.adminClient.auth.admin.deleteUser(userId);
            
            if (error) throw error;

            // Log owner action
            await this.logOwnerAction('delete_user', userId, null, 'Deleted user account');

            return { success: true };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get System Analytics (Owner Only)
    async getSystemAnalytics() {
        try {
            await this.verifyOwner();

            // Get user statistics
            const { data: users, error: userError } = await this.adminClient
                .from('profiles')
                .select('role, created_at');

            if (userError) throw userError;

            // Get content statistics
            const { data: content, error: contentError } = await this.adminClient
                .from('content')
                .select('status, type, created_at');

            if (contentError) throw contentError;

            // Get activity statistics
            const { data: activities, error: activityError } = await this.adminClient
                .from('user_activities')
                .select('action, created_at')
                .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

            if (activityError) throw activityError;

            // Compile analytics
            const analytics = {
                users: {
                    total: users.length,
                    by_role: this.groupBy(users, 'role'),
                    new_last_30_days: users.filter(u => 
                        new Date(u.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length
                },
                content: {
                    total: content.length,
                    by_status: this.groupBy(content, 'status'),
                    by_type: this.groupBy(content, 'type'),
                    new_last_30_days: content.filter(c =>
                        new Date(c.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length
                },
                activities: {
                    total_last_30_days: activities.length,
                    by_action: this.groupBy(activities, 'action')
                }
            };

            return { success: true, data: analytics };
        } catch (error) {
            console.error('Get analytics error:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper: Group by property
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const value = item[key] || 'unknown';
            result[value] = (result[value] || 0) + 1;
            return result;
        }, {});
    }

    // Log Owner Action
    async logOwnerAction(actionType, targetUserId = null, targetContentId = null, description = '') {
        try {
            const user = await this.getCurrentUser();
            await this.adminClient
                .from('admin_logs')
                .insert([{
                    admin_id: user.id,
                    action_type: 'owner_' + actionType,
                    target_user_id: targetUserId,
                    target_content_id: targetContentId,
                    description: description,
                    ip_address: await this.getIPAddress()
                }]);
        } catch (error) {
            console.error('Log owner action error:', error);
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

window.ownerManager = new OwnerManager();
