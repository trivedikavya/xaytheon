/**
 * XAYTHEON — Notification Center
 * Issue #615: Unified Real-Time Notification Engine with Delivery Pipelines,
 *             Retry Logic & User Digest System
 */

document.addEventListener('DOMContentLoaded', () => {
    let socket = null;
    let pipelineStats = null;

    // Mock user/token for demo (would come from auth context in production)
    const DEMO_USER = 'demo_user';
    const DEMO_RECEIPT_POOL = [];

    init();

    async function init() {
        setStatus('Connecting to notification engine...', 'loading');
        initSocket();
        await Promise.all([
            fetchNotifications(),
            fetchPreferences(),
            fetchReceipts(),
            fetchPipelineStats()
        ]);
    }

    // ─── WebSocket ────────────────────────────────────────────────────────────

    function initSocket() {
        try {
            // Connect to socket.io if available
            if (typeof io !== 'undefined') {
                socket = io({ transports: ['websocket'], autoConnect: true });

                socket.on('connect', () => {
                    setStatus('🟢 Real-time connected', 'ok');
                    appendLiveEvent({ type: 'system', title: 'Socket connected', body: socket.id });
                });

                socket.on('notification_push', (notif) => {
                    appendLiveEvent(notif);
                    showToast(notif.title, notif.body || '', 'info');

                    // Auto-ACK after 3s (simulates client reading)
                    setTimeout(() => {
                        if (notif.receiptToken) {
                            socket.emit('notification_ack', { receiptToken: notif.receiptToken });
                            updateReceiptStatus(notif.receiptToken, 'delivered');
                        }
                    }, 3000);
                });

                socket.on('digest_ready', (data) => {
                    showToast('📬 Digest Flushed', data.message, 'digest');
                    fetchDigest();
                });

                socket.on('receipt_update', (data) => {
                    updateReceiptStatus(data.receiptToken, data.status);
                });

                socket.on('disconnect', () => setStatus('🔴 Disconnected — polling fallback active', 'warn'));
            } else {
                setStatus('📡 Demo mode — no live socket', 'warn');
                simulateMockStream();
            }
        } catch {
            setStatus('📡 Demo mode — socket unavailable', 'warn');
            simulateMockStream();
        }
    }

    function simulateMockStream() {
        const MOCK_EVENTS = [
            { type: 'build_failure', title: 'Build failed: main', body: 'Health check failed on api-gateway', priority: 8 },
            { type: 'security_alert', title: 'Security alert!', body: 'Critical vuln in lodash@4.17.20', priority: 8 },
            { type: 'deployment_success', title: 'Deploy succeeded', body: 'v2.4.1 deployed to production', priority: 5 },
            { type: 'pr_merged', title: 'PR #312 merged', body: 'feat: add CQAS engine by alice', priority: 4 },
            { type: 'commit', title: 'New commit on main', body: 'fix(auth): resolve token expiry race', priority: 3 }
        ];

        let i = 0;
        setInterval(() => {
            const evt = { ...MOCK_EVENTS[i % MOCK_EVENTS.length], id: `mock_${Date.now()}`, timestamp: Date.now() };
            appendLiveEvent(evt);
            if (i % 3 === 0) showToast(evt.title, evt.body, evt.priority >= 8 ? 'critical' : 'info');
            i++;
        }, 4000);
    }

    // ─── API Calls ────────────────────────────────────────────────────────────

    async function fetchNotifications() {
        try {
            const res = await fetch('/api/notifications?limit=20');
            const json = await res.json();
            if (json.success) {
                renderNotificationList(json.notifications || [], json.unreadCount || 0);
            }
        } catch {
            renderMockNotifications();
        }
    }

    async function fetchPreferences() {
        try {
            const res = await fetch('/api/notifications/preferences');
            const json = await res.json();
            if (json.success) renderPreferencesForm(json.preferences || {});
        } catch {
            renderPreferencesForm({});
        }
    }

    async function fetchReceipts() {
        try {
            const res = await fetch('/api/notifications/receipts');
            const json = await res.json();
            if (json.success) renderReceiptsTable(json.receipts || []);
        } catch {
            renderReceiptsTable(getMockReceipts());
        }
    }

    async function fetchPipelineStats() {
        try {
            const res = await fetch('/api/notifications/pipeline-stats');
            const json = await res.json();
            if (json.success) {
                pipelineStats = json;
                renderPipelineStats(json);
            }
        } catch {
            renderPipelineStats(getMockPipelineStats());
        }
    }

    async function fetchDigest() {
        try {
            const res = await fetch('/api/notifications/digest');
            const json = await res.json();
            if (json.success && json.digest) renderDigestPanel(json.digest);
            else showToast('📭 No digest', 'No notifications queued in digest window.', 'info');
        } catch {
            renderDigestPanel(getMockDigest());
        }
    }

    async function triggerRetry() {
        try {
            const res = await fetch('/api/notifications/retry', { method: 'POST' });
            const json = await res.json();
            showToast('♻️ Retry complete', `Re-sent ${json.retried} notification(s).`, 'ok');
            await fetchPipelineStats();
        } catch {
            showToast('♻️ Retry (demo)', 'Retry engine drained — 2 items re-queued.', 'ok');
        }
    }

    async function savePreferences() {
        const minPriority = parseInt(document.getElementById('pref-min-priority')?.value || '0');
        const digestMode = document.getElementById('pref-digest-mode')?.checked || false;
        const channels = [...document.querySelectorAll('.pref-channel:checked')].map(el => el.value);

        try {
            await fetch('/api/notifications/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ minPriority, digestMode, channels })
            });
            showToast('✅ Preferences saved', 'Notification filter applied.', 'ok');
        } catch {
            showToast('✅ Preferences (demo)', 'Filter applied in-session.', 'ok');
        }
    }

    // ─── Renderers ────────────────────────────────────────────────────────────

    function renderNotificationList(notifications, unreadCount) {
        const el = document.getElementById('notif-list');
        if (!el) return;

        document.getElementById('unread-badge').textContent = unreadCount;

        if (!notifications.length) {
            el.innerHTML = mockNotifications().map(renderNotifRow).join('');
            return;
        }
        el.innerHTML = notifications.map(renderNotifRow).join('');
    }

    function renderNotifRow(n) {
        const icon = n.type === 'build_failure' ? '🔴' : n.type === 'security_alert' ? '🔐' : n.type === 'pr_merged' ? '🟣' : n.type === 'commit' ? '⚫' : '🟡';
        const unread = !n.read_at ? 'unread' : '';
        return `
            <div class="notif-row ${unread}" id="notif-${n.id || n.notification_id}">
                <span class="notif-icon">${icon}</span>
                <div class="notif-body">
                    <div class="notif-title">${n.title || n.type}</div>
                    <div class="notif-msg">${n.message || n.body || ''}</div>
                </div>
                <div class="notif-meta">
                    <span class="notif-time">${formatAge(n.created_at || n.timestamp)}</span>
                    ${n.channel ? `<span class="channel-chip">${n.channel}</span>` : ''}
                </div>
            </div>`;
    }

    function renderMockNotifications() {
        renderNotificationList(mockNotifications(), 3);
    }

    function renderPreferencesForm(prefs) {
        const el = document.getElementById('prefs-form');
        if (!el) return;
        el.innerHTML = `
            <div class="pref-row">
                <label>Minimum Priority (0=all, 5=high, 8=critical)</label>
                <input type="range" id="pref-min-priority" min="0" max="10" value="${prefs.minPriority ?? 0}" oninput="document.getElementById('pref-pri-val').textContent=this.value">
                <span id="pref-pri-val">${prefs.minPriority ?? 0}</span>
            </div>
            <div class="pref-row">
                <label>Enable Digest Mode (batch into 5-min windows)</label>
                <input type="checkbox" id="pref-digest-mode" ${prefs.digestMode ? 'checked' : ''}>
            </div>
            <div class="pref-row">
                <label>Delivery Channels</label>
                <div class="channel-checks">
                    <label><input type="checkbox" class="pref-channel" value="socket"  ${(prefs.channels || ['socket', 'push']).includes('socket') ? 'checked' : ''}> Socket</label>
                    <label><input type="checkbox" class="pref-channel" value="push"    ${(prefs.channels || ['socket', 'push']).includes('push') ? 'checked' : ''}> Push</label>
                    <label><input type="checkbox" class="pref-channel" value="email"   ${(prefs.channels || []).includes('email') ? 'checked' : ''}> Email</label>
                </div>
            </div>
            <button class="btn" onclick="document.dispatchEvent(new Event('savePrefs'))">💾 Save Preferences</button>
        `;
    }

    function renderReceiptsTable(receipts) {
        const tbody = document.getElementById('receipts-tbody');
        if (!tbody) return;
        tbody.innerHTML = receipts.map(r => {
            const cls = r.status === 'delivered' ? 'ok' : r.status === 'failed' || r.status === 'dead_letter' ? 'bad' : 'pending';
            return `<tr>
                <td class="mono small">${r.token?.slice(-20) || '—'}</td>
                <td><span class="status-chip ${cls}">${r.status}</span></td>
                <td>${r.channel || 'socket'}</td>
                <td>${r.attempts || 1}</td>
                <td class="muted">${formatAge(r.issuedAt)}</td>
            </tr>`;
        }).join('');
    }

    function renderPipelineStats(data) {
        const el = document.getElementById('pipeline-stats');
        if (!el) return;
        const rt = data.retryStats || {};
        const pd = data.pendingDigests || [];
        const en = data.deliveryEngine || {};
        el.innerHTML = `
            <div class="stat-row"><span>Retry queue</span><strong>${rt.totalPending ?? 0}</strong></div>
            <div class="stat-row"><span>Pending digest windows</span><strong>${pd.length}</strong></div>
            <div class="stat-row"><span>Total processed</span><strong>${en.totalProcessed ?? 0}</strong></div>
            <div class="stat-row"><span>Dropped (rate limit)</span><strong>${en.eventsDropped ?? 0}</strong></div>
        `;
    }

    function renderDigestPanel(bundle) {
        const el = document.getElementById('digest-panel');
        if (!el) return;
        const types = Object.entries(bundle.grouped || {});
        el.innerHTML = `
            <div class="digest-header">
                <span>📦 ${bundle.totalEvents} events • window closed ${formatAge(bundle.windowEnd)}</span>
            </div>
            ${types.map(([type, evts]) => `
                <div class="digest-group">
                    <div class="dg-type">${type} <span class="count-chip">${evts.length}</span></div>
                    ${evts.slice(0, 3).map(e => `<div class="dg-item">${e.title || e.type}</div>`).join('')}
                    ${evts.length > 3 ? `<div class="dg-more">+${evts.length - 3} more</div>` : ''}
                </div>
            `).join('')}
        `;
        showToast('📬 Digest loaded', `${bundle.totalEvents} events from ${types.length} categories`, 'digest');
    }

    function appendLiveEvent(evt) {
        const feed = document.getElementById('live-feed');
        if (!feed) return;
        const row = document.createElement('div');
        row.className = 'feed-row fade-in';
        const icon = evt.priority >= 8 ? '🔴' : evt.priority >= 5 ? '🟡' : '⚪';
        row.innerHTML = `<span>${icon}</span><span class="feed-type">${evt.type || 'event'}</span><span class="feed-title">${evt.title || ''}</span><span class="feed-time muted">${formatAge(evt.timestamp || Date.now())}</span>`;
        feed.prepend(row);
        if (feed.children.length > 30) feed.lastChild.remove();
    }

    function updateReceiptStatus(token, status) {
        // Update the receipts table row if visible
        const rows = document.querySelectorAll('#receipts-tbody tr');
        rows.forEach(row => {
            if (row.textContent.includes(token?.slice(-20) || '')) {
                const chip = row.querySelector('.status-chip');
                if (chip) { chip.textContent = status; chip.className = `status-chip ${status === 'delivered' ? 'ok' : 'pending'}`; }
            }
        });
    }

    // ─── Toast ────────────────────────────────────────────────────────────────

    function showToast(title, body, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<strong>${title}</strong><p>${body}</p>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
    }

    function setStatus(msg, type = 'ok') {
        const el = document.getElementById('engine-status');
        if (el) el.innerHTML = msg;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function formatAge(ts) {
        if (!ts) return '—';
        const ms = typeof ts === 'number' ? ts : new Date(ts).getTime();
        const diff = Math.floor((Date.now() - ms) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    }

    function mockNotifications() {
        return [
            { id: 1, type: 'build_failure', title: 'Build failed on main', body: 'Health check timeout on API gateway', read_at: null, channel: 'socket', created_at: Date.now() - 120000 },
            { id: 2, type: 'security_alert', title: 'Security alert!', body: 'lodash deprecation CVE-2021-XXXX', read_at: null, channel: 'push', created_at: Date.now() - 360000 },
            { id: 3, type: 'pr_merged', title: 'PR #617 merged', body: 'feat: CQAS engine by @alice', read_at: 1, channel: 'socket', created_at: Date.now() - 600000 },
            { id: 4, type: 'deployment_success', title: 'v2.4.0 deployed', body: 'Deployed to production successfully', read_at: 1, channel: 'push', created_at: Date.now() - 1800000 },
            { id: 5, type: 'commit', title: 'New commit on feature/615', body: 'fix(notifications): add retry logic', read_at: 1, channel: 'socket', created_at: Date.now() - 3600000 }
        ];
    }

    function getMockReceipts() {
        return [
            { token: 'rcpt_user_evt_abc123_111', status: 'delivered', channel: 'socket', attempts: 1, issuedAt: Date.now() - 30000 },
            { token: 'rcpt_user_evt_def456_222', status: 'failed', channel: 'push', attempts: 2, issuedAt: Date.now() - 90000 },
            { token: 'rcpt_user_evt_ghi789_333', status: 'pending', channel: 'push', attempts: 1, issuedAt: Date.now() - 5000 },
            { token: 'rcpt_user_evt_jkl012_444', status: 'dead_letter', channel: 'email', attempts: 5, issuedAt: Date.now() - 300000 }
        ];
    }

    function getMockPipelineStats() {
        return { retryStats: { totalPending: 3, byAttempt: { 1: 2, 2: 1 } }, pendingDigests: [{ userId: 'alice', pendingCount: 7 }], deliveryEngine: { totalProcessed: 142, eventsDropped: 2 } };
    }

    function getMockDigest() {
        return { digestId: 'digest_mock', totalEvents: 9, windowEnd: Date.now(), grouped: { commit: [{ title: 'fix: retry bug' }, { title: 'chore: update deps' }], pr_merged: [{ title: 'feat: burnout engine' }], build_failure: [{ title: 'CI failure on PR #310' }, { title: 'Build #412 failed' }, { title: 'Lint error on branch' }] } };
    }

    // ─── Event Wiring ─────────────────────────────────────────────────────────

    document.addEventListener('savePrefs', savePreferences);

    document.getElementById('btn-retry')?.addEventListener('click', triggerRetry);
    document.getElementById('btn-digest')?.addEventListener('click', () => {
        if (socket?.connected) socket.emit('digest_flush', {});
        else fetchDigest();
    });
    document.getElementById('btn-refresh')?.addEventListener('click', init);
    document.getElementById('btn-mark-all')?.addEventListener('click', async () => {
        await fetch('/api/notifications/read-all', { method: 'PUT' }).catch(() => { });
        document.getElementById('unread-badge').textContent = '0';
        document.querySelectorAll('.notif-row.unread').forEach(el => el.classList.remove('unread'));
    });
});
