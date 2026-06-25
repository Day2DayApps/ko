// ===== CONTENT MANAGEMENT FUNCTIONS =====
class ContentManager {
    constructor() {
        this.supabase = window.supabaseClient;
    }

    // Create Content
    async createContent(data) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            const { data: content, error } = await this.supabase
                .from('content')
                .insert([{
                    user_id: user.id,
                    title: data.title,
                    content: data.content,
                    type: data.type || 'post',
                    status: data.status || 'pending',
                    is_published: data.isPublished || false
                }])
                .select();

            if (error) throw error;
            return { success: true, data: content[0] };
        } catch (error) {
            console.error('Create content error:', error);
            return { success: false, error: error.message };
        }
    }

    // Get Content (with role-based filtering)
    async getContent(filters = {}) {
        try {
            let query = this.supabase
                .from('content')
                .select('*, profiles!user_id(username, full_name, avatar_url)');

            const user = await this.getCurrentUser();
            const role = await this.getUserRole();

            // Role-based visibility
            if (role === 'user') {
                // Users see their own content + published content
                query = query.or(`user_id.eq.${user.id},is_published.eq.true`);
            } else if (role === 'admin' || role === 'owner') {
                // Admins and owners see all content
                // No filter needed
            } else {
                // Public view - only published
                query = query.eq('is_published', true);
            }

            // Apply additional filters
            if (filters.type) query = query.eq('type', filters.type);
            if (filters.status) query = query.eq('status', filters.status);
            if (filters.userId) query = query.eq('user_id', filters.userId);

            // Order
            query = query.order('created_at', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, data: data };
        } catch (error) {
            console.error('Get content error:', error);
            return { success: false, error: error.message };
        }
    }

    // Update Content
    async updateContent(id, updates) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Check permissions
            const canUpdate = await this.canModifyContent(id, user.id);
            if (!canUpdate) throw new Error('Insufficient permissions');

            const { data, error } = await this.supabase
                .from('content')
                .update(updates)
                .eq('id', id)
                .select();

            if (error) throw error;
            return { success: true, data: data[0] };
        } catch (error) {
            console.error('Update content error:', error);
            return { success: false, error: error.message };
        }
    }

    // Delete Content
    async deleteContent(id) {
        try {
            const user = await this.getCurrentUser();
            if (!user) throw new Error('User not authenticated');

            // Check permissions
            const canDelete = await this.canModifyContent(id, user.id);
            if (!canDelete) throw new Error('Insufficient permissions');

            const { error } = await this.supabase
                .from('content')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error('Delete content error:', error);
            return { success: false, error: error.message };
        }
    }

    // Check if user can modify content
    async canModifyContent(contentId, userId) {
        const role = await this.getUserRole();
        
        // Owners and admins can modify any content
        if (role === 'owner' || role === 'admin') return true;

        // Users can modify their own content
        const { data, error } = await this.supabase
            .from('content')
            .select('user_id')
            .eq('id', contentId)
            .single();

        if (error || !data) return false;
        return data.user_id === userId;
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
}

window.contentManager = new ContentManager();
