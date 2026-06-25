// ============================================================
//  SUPABASE DATA SERVICES
// ============================================================
async function getActiveSession() {
    const client = requireSupabaseClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
}

async function getCurrentProfile() {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser?.id)
        .single();
    if (error) throw error;
    return data;
}

async function refreshCurrentProfile() {
    if (!currentUser?.id) return null;
    const profile = await getCurrentProfile();
    currentUser = { ...currentUser, ...profile };
    localStorage.setItem('user', JSON.stringify(currentUser));
    return currentUser;
}

async function logUserActivity(action, details = {}) {
    if (!currentUser?.id) return null;
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('user_activities')
        .insert({
            user_id: currentUser.id,
            action,
            ip_address: details.ip_address || null,
            user_agent: details.user_agent || navigator.userAgent || null
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function getPublicContent(type = null) {
    const client = requireSupabaseClient();
    let query = client
        .from('content')
        .select('*, profiles(username, avatar_url)')
        .eq('is_published', true)
        .eq('status', 'approved')
        .order('published_at', { ascending: false });

    if (type) query = query.eq('type', type);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function getMyContent() {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('content')
        .select('*')
        .eq('user_id', currentUser?.id)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function createContentRecord({ title, content, type = 'post', status = 'pending' }) {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('content')
        .insert({ user_id: currentUser.id, title, content, type, status })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateOwnContent(id, updates) {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('content')
        .update(updates)
        .eq('id', id)
        .eq('user_id', currentUser?.id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function getAdminUsers() {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function updateUserStatus(userId, isActive) {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    await logAdminAction(isActive ? 'activate_user' : 'suspend_user', { target_user_id: userId });
    return data;
}

async function moderateContent(contentId, status) {
    const client = requireSupabaseClient();
    const isPublished = status === 'approved';
    const { data, error } = await client
        .from('content')
        .update({
            status,
            is_published: isPublished,
            published_at: isPublished ? new Date().toISOString() : null
        })
        .eq('id', contentId)
        .select()
        .single();
    if (error) throw error;
    await logAdminAction(`content_${status}`, { target_content_id: contentId });
    return data;
}

async function getAnalyticsSummary() {
    const client = requireSupabaseClient();
    const [profilesResult, contentResult, activitiesResult] = await Promise.all([
        client.from('profiles').select('id, role, is_active', { count: 'exact' }),
        client.from('content').select('id, status, type', { count: 'exact' }),
        client.from('user_activities').select('id, action, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(50)
    ]);

    const error = profilesResult.error || contentResult.error || activitiesResult.error;
    if (error) throw error;

    return {
        users: profilesResult.data || [],
        content: contentResult.data || [],
        recentActivities: activitiesResult.data || []
    };
}

async function getSystemSettings() {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('system_settings')
        .select('*')
        .order('setting_key');
    if (error) throw error;
    return data || [];
}

async function upsertSystemSetting(settingKey, settingValue, description = '') {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('system_settings')
        .upsert({
            setting_key: settingKey,
            setting_value: settingValue,
            description,
            updated_by: currentUser?.id || null
        }, { onConflict: 'setting_key' })
        .select()
        .single();
    if (error) throw error;
    await logAdminAction('update_system_setting', { description: settingKey });
    return data;
}

async function logAdminAction(actionType, details = {}) {
    if (!currentUser?.id) return null;
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('admin_logs')
        .insert({
            admin_id: currentUser.id,
            action_type: actionType,
            target_user_id: details.target_user_id || null,
            target_content_id: details.target_content_id || null,
            description: details.description || null,
            ip_address: details.ip_address || null
        })
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteContentAsOwner(contentId) {
    const client = requireSupabaseClient();
    const { error } = await client
        .from('content')
        .delete()
        .eq('id', contentId);
    if (error) throw error;
    await logAdminAction('delete_content', { target_content_id: contentId });
}

async function updateUserRoleAsOwner(userId, role) {
    const client = requireSupabaseClient();
    const { data, error } = await client
        .from('profiles')
        .update({ role })
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    await logAdminAction('update_user_role', { target_user_id: userId, description: role });
    return data;
}
