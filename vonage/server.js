const dotenv = require('dotenv');
const express = require('express');
const { Vonage } = require('@vonage/server-sdk');
const WebSocketServer = require("websocket").server;

const { log } = require('./log.js');

dotenv.config();

SERVER_URL = process.env.SERVER_URL;

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
            "action": "talk",
            "text": "Hello, please tell me your request."
        },
        {
            "action": "input",
            "eventUrl": [`${SERVER_URL}/event`],
            "type": ["speech"],
            "speech": {
                "saveAudio": true
            }
        }
    ];
})

expressWs.getWss().on('connection', function (ws) {
    log('Websocket connection is open');
});


app.post('/event', (req, res) => {
    log(`Event`, req.body);
    // res.send(200);
})

app.ws('/socket', function (ws, req) {
    log(`Socket connected`);
    ws.on('message', function (msg) {
        ws.send(msg);
        log(`Message`, msg);
    })
})

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
})
