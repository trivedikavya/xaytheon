
(function () {
    'use strict';

    // ==================== PWA INJECTION ====================
    // Automatically inject PWA support into every page
    function injectPWASupport() {
        const head = document.head;

        // Manifest link
        if (!head.querySelector('link[rel="manifest"]')) {
            const manifest = document.createElement('link');
            manifest.rel = 'manifest';
            manifest.href = '/manifest.json';
            head.appendChild(manifest);
        }

        // Theme color
        if (!head.querySelector('meta[name="theme-color"]')) {
            const themeColor = document.createElement('meta');
            themeColor.name = 'theme-color';
            themeColor.content = '#6366f1';
            head.appendChild(themeColor);
        }

        // Apple touch icon
        if (!head.querySelector('link[rel="apple-touch-icon"]')) {
            const appleIcon = document.createElement('link');
            appleIcon.rel = 'apple-touch-icon';
            appleIcon.href = '/assets/icons/icon-192x192.png';
            head.appendChild(appleIcon);
        }

        // Apple mobile web app capable
        if (!head.querySelector('meta[name="apple-mobile-web-app-capable"]')) {
            const capable = document.createElement('meta');
            capable.name = 'apple-mobile-web-app-capable';
            capable.content = 'yes';
            head.appendChild(capable);
        }

        // Apple status bar style
        if (!head.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')) {
            const statusBar = document.createElement('meta');
            statusBar.name = 'apple-mobile-web-app-status-bar-style';
            statusBar.content = 'black-translucent';
            head.appendChild(statusBar);
        }

        // PWA script
        if (!document.querySelector('script[src*="pwa.js"]')) {
            const pwaScript = document.createElement('script');
            pwaScript.src = '/pwa.js?v=2.0.0';
            pwaScript.defer = true;
            head.appendChild(pwaScript);
        }
    }

    function loadComponent(url, targetId, callback) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);

        xhr.onload = function () {
            if (xhr.status === 200 || xhr.status === 0) { // 0 for file:// protocol
                const target = document.getElementById(targetId);
                if (target) {
                    target.innerHTML = xhr.responseText;

                    // Call callback after content is loaded
                    if (callback && typeof callback === 'function') {
                        // Small delay to ensure DOM is updated
                        setTimeout(callback, 50);
                    }
                } else {
                    console.warn(`Target element #${targetId} not found`);
                }
            } else {
                console.error(`Failed to load ${url}: ${xhr.status}`);
            }
        };

        xhr.onerror = function () {
            console.error(`Error loading component from ${url}`);
        };

        xhr.send();
    }


    function initBoilerplate() {
        // Inject PWA support (manifest, meta tags, pwa.js)
        injectPWASupport();

        // Load header and re-initialize theme toggles after it loads
        loadComponent('boilerplate/header.html', 'header-placeholder', function () {
            // Re-setup theme toggles after header is loaded
            if (typeof window.setupThemeToggles === 'function') {
                window.setupThemeToggles();
            }
        });

        // Load footer
        loadComponent('boilerplate/footer.html', 'footer-placeholder');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBoilerplate);
    } else {
        initBoilerplate();
    }
})();