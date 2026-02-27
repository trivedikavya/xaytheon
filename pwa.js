/**
 * PWA Manager v2 — Handles Service Worker registration, updates, install prompt,
 * offline detection, caching, and background sync for the XAYTHEON PWA.
 */

const PWA = {
    deferredPrompt: null,
    swRegistration: null,
    isOnline: navigator.onLine,
    dbName: 'xaytheon-offline-db',
    dbVersion: 1,
    db: null,
    installBannerDismissed: false,

    // ==================== INITIALIZATION ====================
    async init() {
        console.log('[PWA] Initializing v2...');

        // Inject PWA CSS styles
        this.injectStyles();

        // Setup online/offline detection
        this.setupNetworkListeners();

        // Register Service Worker
        await this.registerServiceWorker();

        // Setup Install Prompt
        this.setupInstallPrompt();

        // Initialize IndexedDB
        await this.initIndexedDB();

        // Setup periodic update checks
        setInterval(() => this.checkForUpdates(), 60 * 60 * 1000); // Every hour

        // Log install state
        if (this.isInstalled()) {
            console.log('[PWA] Running in installed (standalone) mode');
        }

        console.log('[PWA] Initialized successfully');
    },

    // ==================== PWA CSS INJECTION ====================
    injectStyles() {
        if (document.getElementById('pwa-styles')) return;

        const style = document.createElement('style');
        style.id = 'pwa-styles';
        style.textContent = `
      /* ===== PWA Toast ===== */
      @keyframes pwa-slideUp {
        from { transform: translate(-50%, 100%); opacity: 0; }
        to   { transform: translate(-50%, 0); opacity: 1; }
      }
      @keyframes pwa-slideDown {
        from { transform: translate(-50%, 0); opacity: 1; }
        to   { transform: translate(-50%, 100%); opacity: 0; }
      }
      @keyframes pwa-fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pwa-fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to   { opacity: 0; transform: translateY(10px); }
      }
      @keyframes pwa-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
        50% { box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
      }
      @keyframes pwa-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      @keyframes pwa-bounceIn {
        0%   { transform: scale(0.3); opacity: 0; }
        50%  { transform: scale(1.05); }
        70%  { transform: scale(0.95); }
        100% { transform: scale(1); opacity: 1; }
      }

      /* ===== Install Banner ===== */
      .pwa-install-banner {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(15, 15, 30, 0.98), rgba(25, 25, 50, 0.98));
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 20px;
        padding: 20px 28px;
        z-index: 10000;
        max-width: 420px;
        width: calc(100% - 32px);
        animation: pwa-slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.15);
      }
      .pwa-install-banner .pwa-banner-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 12px;
      }
      .pwa-install-banner .pwa-app-icon {
        width: 48px;
        height: 48px;
        border-radius: 12px;
        border: 2px solid rgba(99, 102, 241, 0.3);
        object-fit: cover;
      }
      .pwa-install-banner .pwa-banner-title {
        font-size: 1.1rem;
        font-weight: 700;
        color: #fff;
        margin: 0;
      }
      .pwa-install-banner .pwa-banner-subtitle {
        font-size: 0.8rem;
        color: #a1a1aa;
        margin: 2px 0 0;
      }
      .pwa-install-banner .pwa-banner-description {
        font-size: 0.85rem;
        color: #d4d4d8;
        line-height: 1.5;
        margin: 0 0 16px;
      }
      .pwa-install-banner .pwa-banner-features {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }
      .pwa-install-banner .pwa-feature-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: #a1a1aa;
        background: rgba(99, 102, 241, 0.1);
        padding: 4px 10px;
        border-radius: 12px;
        border: 1px solid rgba(99, 102, 241, 0.15);
      }
      .pwa-install-banner .pwa-banner-actions {
        display: flex;
        gap: 10px;
      }
      .pwa-install-banner .pwa-btn-install {
        flex: 1;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        padding: 12px 20px;
        border-radius: 12px;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s ease;
        animation: pwa-pulse 2s infinite;
      }
      .pwa-install-banner .pwa-btn-install:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
        animation: none;
      }
      .pwa-install-banner .pwa-btn-dismiss {
        background: rgba(255, 255, 255, 0.05);
        color: #a1a1aa;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 12px 16px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.2s ease;
      }
      .pwa-install-banner .pwa-btn-dismiss:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }
      .pwa-install-banner .pwa-close-btn {
        position: absolute;
        top: 12px;
        right: 14px;
        background: none;
        border: none;
        color: #71717a;
        cursor: pointer;
        font-size: 1.2rem;
        padding: 4px;
        line-height: 1;
        transition: color 0.2s;
      }
      .pwa-install-banner .pwa-close-btn:hover {
        color: #fff;
      }

      /* ===== Update Banner ===== */
      .pwa-update-banner {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(15, 15, 30, 0.98), rgba(25, 25, 50, 0.98));
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(99, 102, 241, 0.4);
        color: white;
        padding: 16px 24px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(99, 102, 241, 0.3);
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 16px;
        animation: pwa-fadeIn 0.4s ease;
        max-width: 480px;
        width: calc(100% - 32px);
      }
      .pwa-update-banner .pwa-update-text {
        flex: 1;
        font-size: 0.9rem;
        font-weight: 500;
      }
      .pwa-update-banner button {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.8rem;
        transition: all 0.2s;
      }
      .pwa-update-banner .pwa-btn-update {
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
      }
      .pwa-update-banner .pwa-btn-update:hover {
        transform: scale(1.05);
      }
      .pwa-update-banner .pwa-btn-later {
        background: rgba(255, 255, 255, 0.08);
        color: #d4d4d8;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .pwa-update-banner .pwa-btn-later:hover {
        background: rgba(255, 255, 255, 0.15);
      }

      /* ===== Offline Indicator ===== */
      .pwa-offline-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #ef4444, #f97316);
        color: white;
        text-align: center;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        animation: pwa-fadeIn 0.3s ease;
      }
      .pwa-offline-bar .pwa-status-dot {
        width: 8px;
        height: 8px;
        background: #fbbf24;
        border-radius: 50%;
        animation: pwa-pulse 1.5s infinite;
      }

      /* ===== Toast Notification ===== */
      .pwa-toast {
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(10, 10, 20, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(99, 102, 241, 0.2);
        color: white;
        padding: 14px 28px;
        border-radius: 14px;
        font-size: 0.9rem;
        z-index: 10003;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        animation: pwa-slideUp 0.35s ease;
        max-width: 90vw;
        text-align: center;
      }

      /* ===== Floating Install FAB ===== */
      .pwa-install-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: white;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 6px 24px rgba(99, 102, 241, 0.5);
        z-index: 9999;
        transition: all 0.3s ease;
        animation: pwa-bounceIn 0.6s ease;
      }
      .pwa-install-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 32px rgba(99, 102, 241, 0.6);
      }
      .pwa-install-fab svg {
        width: 24px;
        height: 24px;
      }

      /* ===== iOS Install Instructions ===== */
      .pwa-ios-instructions {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(15, 15, 30, 0.98), rgba(25, 25, 50, 0.98));
        backdrop-filter: blur(20px);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 20px;
        padding: 24px;
        z-index: 10000;
        max-width: 380px;
        width: calc(100% - 32px);
        animation: pwa-slideUp 0.4s ease;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        text-align: center;
        color: #d4d4d8;
      }
      .pwa-ios-instructions h3 {
        color: #fff;
        margin: 0 0 16px;
        font-size: 1.1rem;
      }
      .pwa-ios-instructions .pwa-ios-steps {
        text-align: left;
        font-size: 0.85rem;
        line-height: 1.8;
      }
      .pwa-ios-instructions .pwa-ios-steps li {
        margin-bottom: 8px;
      }

      /* Responsive */
      @media (max-width: 480px) {
        .pwa-install-banner {
          padding: 16px 20px;
          border-radius: 16px;
          bottom: 16px;
        }
        .pwa-install-banner .pwa-banner-actions {
          flex-direction: column;
        }
      }
    `;
        document.head.appendChild(style);
    },

    // ==================== SERVICE WORKER ====================
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA] Service Workers not supported');
            return;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('[PWA] Service Worker registered:', this.swRegistration.scope);

            // Handle updates
            this.swRegistration.addEventListener('updatefound', () => {
                this.handleUpdateFound();
            });

            // Check if there's a waiting worker
            if (this.swRegistration.waiting) {
                this.showUpdateNotification();
            }

            // Listen for controller change (after skipWaiting)
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                console.log('[PWA] Controller changed — reloading...');
                window.location.reload();
            });

        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
        }
    },

    handleUpdateFound() {
        const newWorker = this.swRegistration.installing;
        console.log('[PWA] New service worker version found');

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
            }
        });
    },

    showUpdateNotification() {
        if (document.getElementById('pwa-update-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-update-banner';
        banner.className = 'pwa-update-banner';
        banner.innerHTML = `
      <span class="pwa-update-text">🔄 A new version of XAYTHEON is available!</span>
      <button class="pwa-btn-update" id="pwa-update-btn">Update</button>
      <button class="pwa-btn-later" id="pwa-dismiss-update-btn">Later</button>
    `;

        document.body.appendChild(banner);

        document.getElementById('pwa-update-btn').addEventListener('click', () => {
            this.applyUpdate();
            banner.style.animation = 'pwa-fadeOut 0.3s ease forwards';
            setTimeout(() => banner.remove(), 300);
        });

        document.getElementById('pwa-dismiss-update-btn').addEventListener('click', () => {
            banner.style.animation = 'pwa-fadeOut 0.3s ease forwards';
            setTimeout(() => banner.remove(), 300);
        });
    },

    applyUpdate() {
        if (this.swRegistration?.waiting) {
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    },

    async checkForUpdates() {
        if (this.swRegistration) {
            try {
                await this.swRegistration.update();
            } catch (e) {
                console.warn('[PWA] Update check failed:', e);
            }
        }
    },

    // ==================== INSTALL PROMPT ====================
    setupInstallPrompt() {
        // Intercept the browser's native install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] Install prompt intercepted');
            e.preventDefault();
            this.deferredPrompt = e;

            // Don't show if user previously dismissed and it's the same session
            if (!this.installBannerDismissed) {
                // Delay showing the install banner for better UX
                setTimeout(() => this.showInstallBanner(), 3000);
            } else {
                // Show a subtle FAB button instead
                this.showInstallFAB();
            }
        });

        // Track successful installation
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed successfully!');
            this.deferredPrompt = null;
            this.hideInstallBanner();
            this.hideInstallFAB();
            this.showToast('🎉 XAYTHEON installed! You can now access it from your home screen.');

            // Track install event
            if (typeof gtag !== 'undefined') {
                gtag('event', 'pwa_install', { method: 'prompt' });
            }
        });

        // iOS detection — show manual install instructions
        if (this.isIOS() && !this.isInstalled()) {
            setTimeout(() => {
                if (!sessionStorage.getItem('pwa-ios-dismissed')) {
                    this.showIOSInstallInstructions();
                }
            }, 5000);
        }
    },

    showInstallBanner() {
        if (document.getElementById('pwa-install-banner') || this.isInstalled()) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.className = 'pwa-install-banner';
        banner.innerHTML = `
      <button class="pwa-close-btn" id="pwa-close-banner" aria-label="Close">✕</button>
      <div class="pwa-banner-header">
        <img src="/assets/icons/icon-96x96.png" alt="XAYTHEON" class="pwa-app-icon" onerror="this.src='/assets/favicon.svg'">
        <div>
          <p class="pwa-banner-title">Install XAYTHEON</p>
          <p class="pwa-banner-subtitle">GitHub Analytics Platform</p>
        </div>
      </div>
      <p class="pwa-banner-description">
        Get instant access with offline support, push notifications, and a native app experience.
      </p>
      <div class="pwa-banner-features">
        <span class="pwa-feature-chip">⚡ Instant Load</span>
        <span class="pwa-feature-chip">📴 Works Offline</span>
        <span class="pwa-feature-chip">🔔 Notifications</span>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-btn-install" id="pwa-install-action">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Install App
        </button>
        <button class="pwa-btn-dismiss" id="pwa-dismiss-banner">Not now</button>
      </div>
    `;

        document.body.appendChild(banner);

        document.getElementById('pwa-install-action').addEventListener('click', () => this.promptInstall());
        document.getElementById('pwa-dismiss-banner').addEventListener('click', () => {
            this.installBannerDismissed = true;
            this.hideInstallBanner();
            this.showInstallFAB();
        });
        document.getElementById('pwa-close-banner').addEventListener('click', () => {
            this.installBannerDismissed = true;
            this.hideInstallBanner();
            this.showInstallFAB();
        });
    },

    hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.style.animation = 'pwa-slideDown 0.3s ease forwards';
            setTimeout(() => banner.remove(), 300);
        }
    },

    showInstallFAB() {
        if (document.getElementById('pwa-install-fab') || this.isInstalled() || !this.deferredPrompt) return;

        const fab = document.createElement('button');
        fab.id = 'pwa-install-fab';
        fab.className = 'pwa-install-fab';
        fab.setAttribute('aria-label', 'Install XAYTHEON');
        fab.setAttribute('title', 'Install XAYTHEON');
        fab.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    `;
        fab.addEventListener('click', () => {
            this.hideInstallFAB();
            this.showInstallBanner();
        });

        document.body.appendChild(fab);
    },

    hideInstallFAB() {
        const fab = document.getElementById('pwa-install-fab');
        if (fab) fab.remove();
    },

    showIOSInstallInstructions() {
        if (document.getElementById('pwa-ios-instructions') || this.isInstalled()) return;

        const instructions = document.createElement('div');
        instructions.id = 'pwa-ios-instructions';
        instructions.className = 'pwa-ios-instructions';
        instructions.innerHTML = `
      <button class="pwa-close-btn" id="pwa-close-ios" aria-label="Close" style="position:absolute;top:12px;right:14px;background:none;border:none;color:#71717a;cursor:pointer;font-size:1.2rem;">✕</button>
      <h3>📱 Install XAYTHEON</h3>
      <ol class="pwa-ios-steps">
        <li>Tap the <strong>Share</strong> button <span style="font-size:1.1em">⎙</span> in Safari</li>
        <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
        <li>Tap <strong>"Add"</strong> to confirm</li>
      </ol>
    `;

        document.body.appendChild(instructions);

        document.getElementById('pwa-close-ios').addEventListener('click', () => {
            sessionStorage.setItem('pwa-ios-dismissed', 'true');
            instructions.style.animation = 'pwa-slideDown 0.3s ease forwards';
            setTimeout(() => instructions.remove(), 300);
        });
    },

    async promptInstall() {
        if (!this.deferredPrompt) {
            console.log('[PWA] No install prompt available');
            return;
        }

        // Show the browser's install prompt
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);

        this.deferredPrompt = null;

        if (outcome === 'accepted') {
            this.hideInstallBanner();
            this.hideInstallFAB();
        }
    },

    // ==================== NETWORK STATUS ====================
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('[PWA] Back online');
            this.isOnline = true;
            this.hideOfflineIndicator();
            this.syncPendingRequests();
            this.showToast('✅ You are back online!');
        });

        window.addEventListener('offline', () => {
            console.log('[PWA] Gone offline');
            this.isOnline = false;
            this.showOfflineIndicator();
            this.showToast('📴 You are offline. Cached content is still available.');
        });

        // Initial check
        if (!navigator.onLine) {
            this.showOfflineIndicator();
        }
    },

    showOfflineIndicator() {
        if (document.getElementById('pwa-offline-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'pwa-offline-bar';
        bar.className = 'pwa-offline-bar';
        bar.innerHTML = `<span class="pwa-status-dot"></span> <span>You are offline — cached content is available</span>`;

        document.body.appendChild(bar);
        document.body.style.paddingTop = '40px';
    },

    hideOfflineIndicator() {
        const bar = document.getElementById('pwa-offline-bar');
        if (bar) {
            bar.style.animation = 'pwa-fadeOut 0.3s ease forwards';
            setTimeout(() => {
                bar.remove();
                document.body.style.paddingTop = '0';
            }, 300);
        }
    },

    // ==================== INDEXED DB ====================
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[PWA] IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[PWA] IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('pendingRequests')) {
                    const store = db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }

                if (!db.objectStoreNames.contains('cachedData')) {
                    const store = db.createObjectStore('cachedData', { keyPath: 'key' });
                    store.createIndex('expiry', 'expiry', { unique: false });
                }

                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences', { keyPath: 'key' });
                }

                console.log('[PWA] IndexedDB schema created');
            };
        });
    },

    async savePendingRequest(url, method, headers, body) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readwrite');
            const store = transaction.objectStore('pendingRequests');

            const request = store.add({
                url,
                method,
                headers: Object.fromEntries(headers.entries?.() || []),
                body,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getPendingRequests() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readonly');
            const store = transaction.objectStore('pendingRequests');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async removePendingRequest(id) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readwrite');
            const store = transaction.objectStore('pendingRequests');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    async syncPendingRequests() {
        const pendingRequests = await this.getPendingRequests();
        if (pendingRequests.length === 0) return;

        console.log('[PWA] Syncing', pendingRequests.length, 'pending requests');

        for (const req of pendingRequests) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                });

                if (response.ok) {
                    await this.removePendingRequest(req.id);
                    console.log('[PWA] Synced:', req.url);
                }
            } catch (error) {
                console.error('[PWA] Sync failed:', error);
            }
        }

        // Trigger background sync if available
        if (this.swRegistration && 'sync' in this.swRegistration) {
            try {
                await this.swRegistration.sync.register('sync-pending-requests');
            } catch (e) {
                console.warn('[PWA] Background sync registration failed:', e);
            }
        }
    },

    // ==================== PUSH NOTIFICATIONS ====================
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('[PWA] Notifications not supported');
            return false;
        }

        const permission = await Notification.requestPermission();
        console.log('[PWA] Notification permission:', permission);
        return permission === 'granted';
    },

    async subscribeToPush() {
        if (!this.swRegistration) {
            console.error('[PWA] Service Worker not registered');
            return null;
        }

        try {
            const response = await fetch('/api/push/vapid-public-key');
            const { publicKey } = await response.json();

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey)
            });

            console.log('[PWA] Push subscription:', subscription);

            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            return subscription;
        } catch (error) {
            console.error('[PWA] Push subscription failed:', error);
            return null;
        }
    },

    async unsubscribeFromPush() {
        if (!this.swRegistration) return;

        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                console.log('[PWA] Unsubscribed from push');
            }
        } catch (error) {
            console.error('[PWA] Unsubscribe failed:', error);
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // ==================== CACHE MANAGEMENT ====================
    async getCacheSize() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const { usage, quota } = await navigator.storage.estimate();
            return {
                used: usage,
                total: quota,
                usedMB: (usage / (1024 * 1024)).toFixed(2),
                totalMB: (quota / (1024 * 1024)).toFixed(2),
                percentage: ((usage / quota) * 100).toFixed(1)
            };
        }
        return null;
    },

    async clearAllCaches() {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[PWA] All caches cleared');
        this.showToast('🗑️ All cached data cleared');
    },

    // ==================== UTILITIES ====================
    showToast(message, duration = 3500) {
        // Remove existing toast
        const existing = document.querySelector('.pwa-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'pwa-toast';
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'pwa-fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true ||
            document.referrer.includes('android-app://');
    },

    isIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    },

    isAndroid() {
        return /Android/.test(navigator.userAgent);
    },

    // Get SW version
    async getVersion() {
        if (!navigator.serviceWorker.controller) return null;

        return new Promise((resolve) => {
            const messageChannel = new MessageChannel();
            messageChannel.port1.onmessage = (event) => {
                resolve(event.data.version);
            };
            navigator.serviceWorker.controller.postMessage(
                { type: 'GET_VERSION' },
                [messageChannel.port2]
            );
        });
    }
};

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
    PWA.init();
}

// Export for global access
window.PWA = PWA;
