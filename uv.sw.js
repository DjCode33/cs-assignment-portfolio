// 1. ANCHOR PUBLIC WEB ROUTING PIPELINE CONSTANTS
const PREFIX = '/cs-assignment-portfolio/service/';
// Updated to a fast, working public data server link
const BARE_SERVER = 'https://solarplex.xyz';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// 2. REQUEST INTERCEPTOR INTERACTION TERMINAL
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith(PREFIX)) {
        event.respondWith((async () => {
            try {
                const parts = url.pathname.split(PREFIX);
                const scrambledTarget = parts[1];
                
                if (!scrambledTarget) {
                    return new Response('Error: Missing routing parameters.', { status: 400 });
                }
                
                // Decode the string cleanly
                let targetUrl = scrambledTarget.split('').map((char, i) => {
                    return i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
                }).join('');
                
                if (!/^https?:\/\//i.test(targetUrl)) {
                    targetUrl = 'https://' + targetUrl;
                }

                // Construct a valid URL link string configuration
                const cleanRequestUrl = new URL(BARE_SERVER);
                cleanRequestUrl.searchParams.set('url', targetUrl);
                
                // Inject custom browser agent strings so Discord doesn't reject your server's requests
                const customHeaders = new Headers(event.request.headers);
                customHeaders.set('X-Bare-Url', targetUrl);
                customHeaders.set('X-Bare-Host', new URL(targetUrl).host);

                const response = await fetch(cleanRequestUrl.toString(), {
                    method: event.request.method,
                    headers: customHeaders,
                    credentials: 'omit'
                });

                return response;
            } catch (err) {
                return new Response('Proxy routing pipeline error: ' + err.message, { status: 500 });
            }
        })());
    }
});
