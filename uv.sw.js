importScripts('https://cloudflare.com');
importScripts('uv.config.js');
importScripts('https://cloudflare.com');

const sw = new UVServiceWorker();

self.addEventListener('fetch', event => {
    event.respondWith(sw.fetch(event));
});
