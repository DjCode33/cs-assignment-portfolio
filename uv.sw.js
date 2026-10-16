// 1. SELF-CONTAINED CONFIGURATION CONSTANTS
const PREFIX = '/cs-assignment-portfolio/service/';
const BARE_SERVER = 'https://is-a.dev';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// 2. NETWORK INTERCEPTOR ENGINE
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Check if the request path falls under your custom proxy folder scope
    if (url.pathname.startsWith(PREFIX)) {
        event.respondWith((async () => {
            try {
                // Extract the scrambled URL parameter from the request path
                const pathParts = url.pathname.split(PREFIX);
                const scrambledTarget = pathParts[1];
                
                if (!scrambledTarget) {
                    return new Response('Error: Missing proxy target destination string.', { status: 400 });
                }
                
                // Custom XOR Decoder to reveal the actual website destination path
                let targetUrl = scrambledTarget.split('').map((char, i) => {
                    return i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
                }).join('');
                
                if (!/^https?:\/\//i.test(targetUrl)) {
                    targetUrl = 'https://' + targetUrl;
                }

                // Append the target URL to your public Bare node to tunnel traffic safely
                const proxyRequestUrl = BARE_SERVER + encodeURIComponent(targetUrl);
                
                // Fetch the site content cleanly through the open network pipeline
                const response = await fetch(proxyRequestUrl, {
                    method: event.request.method,
                    headers: event.request.headers,
                    credentials: 'omit'
                });

                return response;
            } catch (err) {
                return new Response('Proxy routing pipeline error: ' + err.message, { status: 500 });
            }
        })());
    }
});
