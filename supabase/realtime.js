// ===== REAL-TIME SUBSCRIPTIONS =====
class RealtimeManager {
    constructor() {
        this.supabase = window.supabaseClient;
        this.subscriptions = {};
    }

    // Subscribe to content changes
    subscribeToContent(callback, table = 'content') {
        const channel = this.supabase
            .channel(`${table}-changes`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: table
                },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions[table] = channel;
        return channel;
    }

    // Subscribe to specific user's data
    subscribeToUserContent(userId, callback) {
        const channel = this.supabase
            .channel(`user-${userId}-content`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'content',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();

        this.subscriptions[`user-${userId}`] = channel;
        return channel;
    }

    // Unsubscribe
    unsubscribe(channelKey) {
        if (this.subscriptions[channelKey]) {
            this.subscriptions[channelKey].unsubscribe();
            delete this.subscriptions[channelKey];
        }
    }

    // Unsubscribe all
    unsubscribeAll() {
        Object.keys(this.subscriptions).forEach(key => {
            this.subscriptions[key].unsubscribe();
        });
        this.subscriptions = {};
    }
}

window.realtimeManager = new RealtimeManager();
