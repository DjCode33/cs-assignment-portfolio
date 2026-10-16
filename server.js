import express from 'express';
import { createServer } from 'node:http';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';

const app = express();
const server = createServer(app);
const PORT = 8080;
const HOST = '0.0.0.0';

// Private password challenge gate logic
app.use((req, res, next) => {
    if (req.path === '/ping' || req.path === '/favicon.ico') return next();
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Secure Workspace"');
        return res.status(401).send('Authentication required.');
    }
    try {
        const token = authHeader.split(' ');
        const [user, pass] = Buffer.from(token[1], 'base64').toString('ascii').split(':');
        
        // Define your secure access credentials here
        if (user === 'admin' && pass === 'pass123') {
            return next();
        }
    } catch(e) {}
    res.setHeader('WWW-Authenticate', 'Basic realm="Secure Workspace"');
    return res.status(401).send('Invalid credentials.');
});

// Attach the script interceptor libs natively
app.use('/uv/', express.static(uvPath));

// Inject Ultraviolet frontend configurations dynamically
app.get('/uv/uv.config.js', (req, res) => {
    res.type('application/javascript').send(`
        self.__uv$config = {
            prefix: '/service/',
            bare: 'https://solarplex.xyz',
            encodeUrl: Ultraviolet.codec.xor.encode,
            decodeUrl: Ultraviolet.codec.xor.decode,
            handler: '/uv/uv.handler.js',
            bundle: '/uv/uv.bundle.js',
            config: '/uv/uv.config.js',
            sw: '/uv/uv.sw.js',
        };
    `);
});

app.get('/uv/uv.sw.js', (req, res) => {
    res.type('application/javascript').send(`
        importScripts('/uv/uv.bundle.js');
        importScripts('/uv/uv.config.js');
        importScripts('/uv/uv.handler.js');
        const sw = new UVServiceWorker();
        self.addEventListener('fetch', event => {
            event.respondWith(sw.fetch(event));
        });
    `);
});

// Main User Dashboard Panel
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Academic Assignment Portfolio</title>
            <script src="/uv/uv.bundle.js" defer></script>
            <script src="/uv/uv.config.js" defer></script>
            <script>
                async function launchSession(e) {
                    e.preventDefault();
                    const val = document.getElementById('target').value.trim();
                    if(!val) return;
                    
                    try {
                        await navigator.serviceWorker.register('/uv/uv.sw.js', { scope: '/service/' });
                        let target = val;
                        if (!/^https?:\\/\\//i.test(target)) target = 'https://' + target;
                        window.location.href = '/service/' + __uv$config.encodeUrl(target);
                    } catch(err) {
                        alert('Routing initialization failed: ' + err.message);
                    }
                }
            </script>
        </head>
        <body style="font-family:sans-serif; text-align:center; padding-top:100px; background:#0b0f19; color:#fff;">
            <h2>📂 Personal Academic Workspace</h2>
            <p style="color:#64748b;">Secure developer request terminal sandboxed via cloud compilation layers:</p>
            <form onsubmit="launchSession(event)" style="margin-top:25px;">
                <input type="text" id="target" placeholder="://discord.com" style="width:400px; padding:12px; background:#0f172a; color:#fff; border:1px solid #1e293b; border-radius:6px;" required />
                <button type="submit" style="padding:12px 20px; background:#3b82f6; color:#fff; border:none; border-radius:6px; font-weight:bold; margin-left:10px; cursor:pointer;">Connect</button>
            </form>
        </body>
        </html>
    `);
});

server.listen(PORT, HOST, () => console.log('Proxy online on port ' + PORT));
