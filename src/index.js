import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import { createBareServer } from '@tomphttp/bare-server-node';
import { epoxyPath } from '@mercuryworkshop/epoxy-transport';
import wisp from 'wisp-server-node';

const app = express();
const server = createServer();
const bare = createBareServer('/bare/', { logErrors: true });

const publicPath = join(process.cwd(), 'public');
const bareMuxPath = dirname(fileURLToPath(import.meta.resolve('@mercuryworkshop/bare-mux')));
const usageFile = join(process.env.HOME || process.cwd(), '.cache', 'cs-assignment-portfolio', 'proxy-usage.json');
const dailyLimitBytes = 2 * 1024 ** 3;
const centralDay = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const activeProxySockets = new Set();
const activeProxyResponses = new Set();
let usage = { day: centralDay.format(new Date()), bytes: 0 };
let unpersistedBytes = 0;

if (existsSync(usageFile)) {
    try {
        const savedUsage = JSON.parse(readFileSync(usageFile, 'utf8'));
        if (savedUsage.day === usage.day && Number.isSafeInteger(savedUsage.bytes) && savedUsage.bytes >= 0) {
            usage.bytes = savedUsage.bytes;
        } else {
            persistUsage();
        }
    } catch (error) {
        console.error('Could not read saved proxy usage:', error.message);
        persistUsage();
    }
}

function persistUsage() {
    try {
        mkdirSync(dirname(usageFile), { recursive: true });
        const temporaryFile = `${usageFile}.${process.pid}.tmp`;
        writeFileSync(temporaryFile, JSON.stringify(usage), { mode: 0o600 });
        renameSync(temporaryFile, usageFile);
        unpersistedBytes = 0;
    } catch (error) {
        console.error('Could not save proxy usage:', error.message);
    }
}

function currentUsage() {
    const today = centralDay.format(new Date());
    if (usage.day !== today) {
        usage = { day: today, bytes: 0 };
        unpersistedBytes = 0;
        persistUsage();
    }
    return usage;
}

function capReached() {
    return currentUsage().bytes >= dailyLimitBytes;
}

function recordProxyBytes(byteCount) {
    if (byteCount <= 0) return;
    const dailyUsage = currentUsage();
    const wasBelowCap = dailyUsage.bytes < dailyLimitBytes;
    dailyUsage.bytes += byteCount;
    unpersistedBytes += byteCount;

    if (unpersistedBytes >= 4 * 1024 * 1024 || (wasBelowCap && dailyUsage.bytes >= dailyLimitBytes)) {
        persistUsage();
    }

    if (wasBelowCap && dailyUsage.bytes >= dailyLimitBytes) {
        for (const socket of activeProxySockets) socket.destroy();
        for (const response of activeProxyResponses) response.destroy();
    }
}

function meterProxySocket(socket) {
    activeProxySockets.add(socket);
    socket.on('data', chunk => recordProxyBytes(chunk.length));
    socket.once('close', () => activeProxySockets.delete(socket));

    const originalWrite = socket.write.bind(socket);
    socket.write = (chunk, ...args) => {
        const encoding = typeof args[0] === 'string' ? args[0] : 'utf8';
        const byteCount = typeof chunk === 'string' ? Buffer.byteLength(chunk, encoding) : chunk?.byteLength || 0;
        recordProxyBytes(byteCount);
        if (capReached()) {
            socket.destroy();
            return false;
        }
        return originalWrite(chunk, ...args);
    };
}

function rejectCappedHttp(res) {
    const message = 'Shared 2 GiB daily data cap reached. Usage resets at midnight Central Time; proxy availability follows the Codespace schedule.';
    res.writeHead(429, {
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(message),
        'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end(message);
}

function rejectCappedSocket(socket) {
    const message = 'Shared 2 GiB daily data cap reached. Usage resets at midnight Central Time; proxy availability follows the Codespace schedule.';
    socket.end([
        'HTTP/1.1 429 Too Many Requests',
        'Connection: close',
        'Cache-Control: no-store',
        'Content-Type: text/plain; charset=utf-8',
        `Content-Length: ${Buffer.byteLength(message)}`,
        '',
        message,
    ].join('\r\n'));
}

function meterBareResponse(req, res) {
    activeProxyResponses.add(res);
    const cleanup = () => activeProxyResponses.delete(res);
    res.once('close', cleanup);
    res.once('finish', cleanup);
    req.on('data', chunk => recordProxyBytes(chunk.length));

    const originalWrite = res.write.bind(res);
    res.write = (chunk, ...args) => {
        const encoding = typeof args[0] === 'string' ? args[0] : 'utf8';
        const byteCount = typeof chunk === 'string' ? Buffer.byteLength(chunk, encoding) : chunk?.byteLength || 0;
        recordProxyBytes(byteCount);
        if (capReached()) {
            res.destroy();
            return false;
        }
        return originalWrite(chunk, ...args);
    };

    const originalEnd = res.end.bind(res);
    res.end = (chunk, ...args) => {
        if (chunk !== undefined) {
            const encoding = typeof args[0] === 'string' ? args[0] : 'utf8';
            const byteCount = typeof chunk === 'string' ? Buffer.byteLength(chunk, encoding) : chunk?.byteLength || 0;
            recordProxyBytes(byteCount);
        }
        if (capReached()) {
            res.destroy();
            return res;
        }
        return originalEnd(chunk, ...args);
    };
}

function usageStatus() {
    const dailyUsage = currentUsage();
    return {
        limitBytes: dailyLimitBytes,
        usedBytes: dailyUsage.bytes,
        remainingBytes: Math.max(0, dailyLimitBytes - dailyUsage.bytes),
        capReached: dailyUsage.bytes >= dailyLimitBytes,
        resetTime: 'midnight America/Chicago',
    };
}

setInterval(() => {
    currentUsage();
    if (unpersistedBytes > 0) persistUsage();
}, 10_000).unref();

// Serve your workspace frontend assets out of the public folder natively
app.use(express.static(publicPath));
app.use('/uv/', express.static(uvPath));
app.use('/bare-mux/', express.static(bareMuxPath));
app.use('/epoxy/', express.static(epoxyPath));
app.get('/api/proxy-usage', (_req, res) => res.json(usageStatus()));

// CRITICAL FIX: Intercept incoming proxied tab requests and handle routing assets
app.use('/service/', express.static(uvPath));

app.get('/', (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
});

// Pass background network parameters straight into the official proxy core engines
server.on('request', (req, res) => {
    if (bare.shouldRoute(req)) {
        if (capReached()) {
            rejectCappedHttp(res);
            return;
        }
        meterBareResponse(req, res);
        bare.routeRequest(req, res);
    } else {
        app(req, res);
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        if (capReached()) {
            rejectCappedSocket(socket);
            return;
        }
        meterProxySocket(socket);
        bare.routeUpgrade(req, socket, head);
    } else if (req.url?.startsWith('/wisp/')) {
        if (capReached()) {
            rejectCappedSocket(socket);
            return;
        }
        meterProxySocket(socket);
        wisp.routeRequest(req, socket, head);
    } else {
        socket.end();
    }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});
