const dotenv = require('dotenv');
const express = require('express');
const { Vonage } = require('@vonage/server-sdk');
const WebSocketServer = require("websocket").server;
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");

const { MediaStream } = require("./models/mediaStream.js");
const { log } = require('./utils/log.js');

dotenv.config();

SERVER_URL = process.env.SERVER_URL;
DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const deepgram = createClient(DEEPGRAM_API_KEY);
// const live = deepgram
const dgconnection = deepgram.listen.live({
    model: "nova",
});

const app = express();
const expressWs = require('express-ws')(app)
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/answer', (req, res) => {
    log(`Answering call`, req.body);
    const ncco = [
        {
            "action": "connect",
            "from": VONAGE_NUMBER,
            "endpoint": [
                {
                    "type": "websocket",
                    "uri": `wss://${NGROK_URL}/socket`,
                    // "content-type": "audio/l16;rate=16000",
                }
            ]
        }
    ];
    res.json(ncco);
})

app.post('/event', (req, res) => {
    // log(`Event status`, req.body['status']);
    // res.send(200);
})

app.ws('/socket', function (ws, req) {
    log(`Socket connected`);
    new MediaStream(ws);
    // ws.on('message', function (msg) {
    //     if (typeof msg === 'string') {
    //         data = JSON.parse(msg);

    //     }
        // live.send
        // ws.send(msg);
        // log(`Message Type: `, msg.type);
        // log(`Message`, msg);
    // })
})

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
})
