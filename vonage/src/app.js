const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');

const { MediaStream } = require("./models/mediaStream.js");
const { log } = require('./utils/log.js');

dotenv.config();

const VONAGE_API_KEY = process.env.VONAGE_API_KEY
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET
const VONAGE_APPLICATION_ID = process.env.VONAGE_APPLICATION_ID
const VONAGE_APPLICATION_PRIVATE_KEY_PATH = process.env.VONAGE_APPLICATION_PRIVATE_KEY_PATH
// const SPEAKER_PATH = process.env.SPEAKER_PATH;

// const speaker_name = SPEAKER_PATH.split('/').pop().slice(0, -5);

const privateKey = fs.readFileSync(VONAGE_APPLICATION_PRIVATE_KEY_PATH);

SERVER_URL = process.env.SERVER_URL;
DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const NGROK_URL = process.env.NGROK_URL;

const { Vonage } = require('@vonage/server-sdk');

const vonage = new Vonage({
    apiKey: VONAGE_API_KEY,
    apiSecret: VONAGE_API_SECRET,
    applicationId: VONAGE_APPLICATION_ID,
    privateKey: privateKey
}, { debug: true });


const app = express();
const expressWs = require('express-ws')(app)
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/answer', (req, res) => {
    // log(`Answering call`, req.body);
    const call_id = req.body.uuid;
    log(`Answering call`, call_id);
    let ncco;
    if (req.query?.direction === 'outbound') {
        ncco = [
            // {
            //     "action": "record"
            // },
            {
                "action": "connect",
                "from": req.body['from'],
                "endpoint": [
                    {
                        "type": "websocket",
                        "uri": `wss://${NGROK_URL}/socket?call_id=${call_id}`,
                        // "content-type": "audio/l16;rate=8000",
                    }
                ]
            }
        ];
    } else {
        ncco = [
            // {
            //     "action": "record"
            // },
            {
                "action": "connect",
                "from": req.body['to'],
                "endpoint": [
                    {
                        "type": "websocket",
                        "uri": `wss://${NGROK_URL}/socket?call_id=${call_id}`,
                        // "content-type": "audio/l16;rate=8000",
                    }
                ]
            }
        ];
    }
    res.json(ncco);
})

app.post('/event', (req, res) => {
    log(`Event ${req.body['from']} -> ${req.body['to']}`, req.body['status']);

    if (req.body['status'] === 'rejected') {
        console.log(req.body);
    }

    if (req.body.recording_url) {
        const recording_url = req.body.recording_url;
        const fileId = req.body.recording_uuid;
        const recordingsDirPath = path.join(__dirname, 'recordings');
        const filePath = path.join(recordingsDirPath, `${fileId}.mp3`);

        fs.mkdir(recordingsDirPath, { recursive: true }, (err) => {
            if (err) {
                return console.error('Failed to create directory:', err);
            }

            // Directory is now ensured to exist, proceed to download and save the recording  
            vonage.voice.downloadRecording(recording_url, filePath, (err, res) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log(`Recording saved to ${filePath}`);
                }
            });
        });
    }
})

// app.post('/recordings', (req, res) => {
//     const recording_url = req.body.recording_url;
//     console.log(`Recording URL = ${recording_url}`);

//     res.status(204).send();
// })

app.ws('/socket', function (ws, req) {
    log(`Socket connected`);
    const call_id = req.query.call_id;
    console.log("Call ID: ", call_id);
    new MediaStream(ws, call_id);
})

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
})
