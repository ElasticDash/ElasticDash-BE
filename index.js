import './config'
import { pool } from './postgres';
import express from 'express';
import xmlparser from 'express-xml-bodyparser';
import cors from 'cors';
import socketio from "socket.io";
import { createServer } from "http";
import { root } from './routes';
import { workerLoop, POLL_INTERVAL_MS } from './worker/testCaseRunWorker.js';
import { startAutoFeatureAnalyzer } from './worker/autoFeatureAnalyzer.js';

const PORT = process.env.PORT || 3000;
const app = express();
const http = createServer(app);

// Set reasonable server timeout (30 seconds for most APIs)
http.timeout = 30000;

// Whitelist configuration
const whitelist = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3061',
    'http://localhost:3062',
    'http://localhost:3063',
    'http://localhost:5000',
    'https://web.postman.co', 
    'https://*.elasticdash.com',
    'vscode-webview://*',
    'https://demo-jan-6.d1d50d5y0i5tn9.amplifyapp.com',
    'null',
    process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined values

// Configure CORS (use only one CORS configuration)
const corsOptions = {
    credentials: true,
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin || origin === 'null') return callback(null, true);
        
        // Check if origin matches whitelist or wildcards
        const isAllowed = whitelist.some(pattern => {
            if (pattern.includes('*')) {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'));
                return regex.test(origin);
            }
            return pattern === origin;
        });
        
        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Origin', 'Accept', 'X-Requested-With', 'Content-Type', 'Access-Control-Request-Method', 'Access-Control-Request-Headers', 'Authorization', 'api-token'],
    optionsSuccessStatus: 200
};

// Apply CORS middleware early in the middleware chain
app.use(cors(corsOptions));

// Use JSON parser for all non-webhook routes
app.use((req, res, next) => {
    if (req.originalUrl === '/api/plan/webhook') {
        next();
    } else {
        express.json({
            limit: '50mb', // Reduced from 500mb to more reasonable size
            extended: true
        })(req, res, next);
    }
});

app.use(express.urlencoded({
    limit: '50mb', // Reduced from 500mb
    extended: true
}));

// Only apply XML parser to specific routes that need it (e.g., webhooks)
// app.use(xmlparser()); // Commented out - apply to specific routes only if needed

// Set reasonable timeout for requests (30 seconds)
app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        res.status(408).send('Request timeout: Operation took longer than 30 seconds');
    });
    next();
});

// Socket.IO configuration
const io = socketio(http, {
    pingTimeout: 60000, // 1 minute
    pingInterval: 25000,
    upgradeTimeout: 30000,
    cors: corsOptions, // Use same CORS options
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

export { app, io };

// API routes
app.use('/api', root);

// Health check endpoint
app.use('/', function(req, res){
    res.send({
        success: true,
        message: 'health-check'
    });
});

// Start server
http.listen(PORT, () => {
    console.log('http.listen is triggered');
    console.log('Today is ', new Date());
    console.log(`App running on port ${PORT}.`);

    const host = http.address().address;
    const port = http.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
    
    // Run Claude login check immediately on startup
    // checkClaudeLogin();
    
    // Set up hourly Claude login check (3600000 ms = 1 hour)
    // setInterval(checkClaudeLogin, 3600000);
});

// Error handling
process.on('unhandledRejection', (reason, p) => {
    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
    // application specific logging, throwing an error, or other logic here
    return false;
});

// Kill idle database connections (run every 5 minutes instead of every second)
function killDeadConnections() {
    const query = `
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity
        WHERE state= 'idle' 
        AND now() - query_start > '00:10:00';
    `;

    return pool.query(query).then(() => {
        return true;
    })
    .catch((err) => {
        console.error('killDeadConnections error: ', err)
        return 500;
    })
}

// Run every 5 minutes (300000ms) instead of every second
setInterval(async () => {
    return killDeadConnections()
}, 300000);


// io START

// io.use(
//     socketioJwt.authorize({
//         secret: process.env.SECRET,
//         timeout: 5000, // 5 seconds to send the authentication message
//         handshake: true,
//         auth_header_required: false,
//         required: false
//     })
// )

io.use((socket, next) => {
    next();
});

global.io = io;

io.on('authenticated', (socket) => {
    //this socket is authenticated, we are good to handle more events from it.
    // console.log(`hello! ${socket.decoded_token.name}`);
});

io.on('connect_error', (err) => {
    // console.log('connect_error detected');
    // console.log('err: ', err);
})

io.on('disconnect', (data) => {
    // console.log('user disconnect detected');
    // console.log('data: ', data);
    // console.log('io.sockets.adapter.rooms: ', io.sockets.adapter.rooms);
})

io.on('connect', (socket) => {
    const sessionID = socket.id;
    // console.log('connect detected, sessionId: ', sessionID);
    // console.log('sessionID: ', sessionID);
    // console.log('socket.decoded_token: ', socket.decoded_token);
    // console.log('io.sockets.adapter.rooms.size', io.sockets.adapter.rooms.size);

    if (socket['decoded_token'] && socket['decoded_token']['scopeId']) {
        socket.join(socket.decoded_token.scopeId.toString());
    }

    if (socket['type'] && socket['type'] === 'application' && socket['id']) {
        socket.join('application-' + socket['id'].toString());
    }

    socket.on('sign in', data => {
        // console.log('sign in is triggered');
        // console.log('data: ', data);
        if (data !== null) {
            socket.join(data.toString());
            if (socket['decoded_token'] && socket['decoded_token']['role'] === 'Admin') {
                socket.join('Admin');
            }
            // console.log('io.sockets.adapter.rooms: ', io.sockets.adapter.rooms);
            socket.emit('get sessionID', {sessionId: sessionID}, (data, callback) => {
                //单独为该用户触发event事件
                // console.log('data: ', data);
            })
        }
    })

    socket.on('sign out', data => {
        // console.log('sign out is triggered');
        // console.log('data: ', data);
        // io.in(data.toString()).emit('sign out this user');
        if (data) {
            socket.leave(data.toString());
        }
        if (socket['decoded_token'] && socket['decoded_token']['role'] === 'Admin') {
            socket.leave('Admin');
        }
        // console.log('io.sockets.adapter.rooms: ', io.sockets.adapter.rooms);
        socket.emit('get sessionID', {sessionId: sessionID}, (data, callback) => {
            //单独为该用户触发event事件
            // console.log('data: ', data);
        })
        if (data && io.sockets.adapter.rooms[data.toString()]) {
            // console.log('the room exists');
            if (io.sockets.adapter.rooms[data.toString()].length === 0) {
                // console.log('no user logged in');
            }
        }
    })

    socket.on('join', data => {
        const rooms = Array.from(socket.rooms);
        if (!rooms.includes(data)) {
            console.log('socket join is triggered');
            console.log('join data: ', data);
            socket.join(data);
            console.log(`Socket joined room: ${data}`);
        } else {
            // console.log(`Socket is already in room: ${data}`);
        }
    })

    socket.on('leave', data => {
        const rooms = Array.from(socket.rooms);
        if (rooms.includes(data)) {
            console.log('socket leave is triggered');
            console.log('leave data: ', data);
            socket.leave(data);
            console.log(`Socket left room: ${data}`);
        } else {
            // console.log(`Socket is not in room: ${data}`);
        }
    })

    socket.on('notification updated', data => {
        // console.log('notification updated is triggered');
        // console.log('data: ', data);
        // io.to(data.toString()).emit('update notification', {sessionId: sessionID})
        //为该用户所在的房间内所有用户触发event事件
        
        // socket.emit('update notification', {sessionId: sessionID}, function (data, callback) {
        //     //单独为该用户触发event事件
            console.log('data: ', data);
        // })
    });

    socket.on('authenticated', data => {
        // console.log('socket authenticated is triggered');
        // console.log('data: ', data);

    })

    socket.on('detect disconnect', data => {
        // console.log('detect disconnect is triggered');
        // console.log('data: ', data);
        setTimeout(() => {
            if (data) {
                // console.log('io.sockets.adapter.rooms[data.toString()]: ', io.sockets.adapter.rooms[data.toString()]);
                if (io.sockets.adapter.rooms[data.toString()]) {
                    // console.log('the room exists');
                    if (io.sockets.adapter.rooms[data.toString()].length === 0) {
                        // console.log('no user logged in');
                    }
                }
            }
        }, 1000)
    })

    socket.on('disconnect', data => {
        // console.log('user disconnect detected');
        // console.log('sessionID: ', sessionID);
        // console.log('data: ', data);
        // console.log('io.sockets.adapter.rooms: ', io.sockets.adapter.rooms);
        // set user disconnected all's logged_in status to false 
    })

});

// io END

setInterval(workerLoop, POLL_INTERVAL_MS);
console.log('TestCaseRun worker started.');

// Start Auto Feature Analyzer worker
startAutoFeatureAnalyzer();
