// Standalone Service Worker Engine
importScripts('uv/uv.config.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Check if the browser is requesting a proxied asset path
    if (url.pathname.includes('/service/')) {
        event.respondWith((async () => {
            try {
                // Scrape path parameters dynamically
                const targetUrlStr = url.pathname.split('/service/')[1];
                if (!targetUrlStr) return new Response('Missing proxy destination parameters', { status: 400 });
                
                // XOR Decoder logic to translate scrambled string parameter tags
                let targetUrl = targetUrlStr.split('').map((char, i) => i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join('');
                if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

                // Send request parameters straight through the public traffic proxy node
                const proxyRequestUrl = 'https://is-a.dev' + encodeURIComponent(targetUrl);
                const response = await fetch(proxyRequestUrl, {
                    method: event.request.method,
                    headers: event.request.headers,
                    credentials: 'omit'
                });

                return response;
            } catch (err) {
                return new Response('Proxy routing engine failure: ' + err.message, { status: 500 });
            }
        })());
    }
});
