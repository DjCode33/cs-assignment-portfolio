// Pulling the heavy lifting files dynamically from the CDN network instead of local files
importScripts('https://cloudflare.com');
importScripts('uv/uv.config.js');
importScripts('https://cloudflare.com');

const sw = new UVServiceWorker();

self.addEventListener('fetch', event => {
    event.respondWith(sw.fetch(event));
});
