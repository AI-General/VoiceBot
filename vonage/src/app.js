const dotenv = require('dotenv');
const express = require('express');

const { MediaStream } = require("./models/mediaStream.js");
const { log } = require('./utils/log.js');

dotenv.config();

SERVER_URL = process.env.SERVER_URL;
DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const NGROK_URL = process.env.NGROK_URL;
// const live = deepgram


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
            "from": req.body['to'],
            "endpoint": [
                {
                    "type": "websocket",
                    "uri": `wss://${NGROK_URL}/socket`,
                    // "content-type": "audio/l16;rate=8000",
                }
            ]
        }
    ];
    res.json(ncco);
})

app.post('/event', (req, res) => {
    log(`Event status`, req.body['status']);
    // res.send(200);
})

app.ws('/socket', function (ws, req) {
    log(`Socket connected`);
    new MediaStream(ws);
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
})
