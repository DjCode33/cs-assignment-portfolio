import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { uvPath } from '@titaniumnetwork-dev/ultraviolet';
import createBareServer from '@tomsun/bare-server-node';

const app = express();
const server = createServer(app);
const bare = createBareServer('/bare/');
const PORT = 8080;
const HOST = '0.0.0.0';

app.use(express.urlencoded({ extended: true }));

// Serve core ultraviolet bundle files out of the internal dependency path
app.use('/uv/', express.static(uvPath));

// Route interface layout out of the public folder
app.use(express.static(join(process.cwd(), 'public')));

// Intercept incoming connection loops and pass them to the bare proxy engine
server.on('request', (req, res) => {
    if (bare.shouldRoute(req)) {
        bare.route(req, res);
    } else {
        app(req, res);
    }
});

server.on('upgrade', (req, socket, head) => {
    if (bare.shouldRoute(req)) {
        bare.route(req, socket, head);
    } else {
        socket.end();
    }
});

server.listen(PORT, HOST, () => console.log('Proxy active on ' + HOST + ':' + PORT));
