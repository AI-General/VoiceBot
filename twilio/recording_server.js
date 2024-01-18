const twilio = require("twilio");
const WebSocketServer = require("websocket").server;
const express = require('express');
const {default: axios} = require("axios");
const fs = require('node:fs');

const PORT = process.env.PORT || 3000;
const ngrokURL = "9957-209-20-159-176.ngrok-free.app";
const app = express();
const bodyParser = require('body-parser');
const VoiceResponse = require("twilio/lib/twiml/VoiceResponse");
const authToken = "86d0018152fa3da85c4c1ca190aaa562";
const accountSid = "AC181ec392ebc45dcd29a7c8d0257a42b9";
const client = twilio(accountSid, authToken);
let x = 1;
app.use(bodyParser.json());

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
const wss = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true
});

function log(message, ...args) {
    console.log(new Date(), message, ...args);
}

wss.on("connect", function (connection) {
    log("From Twilio: Connection accepted");
    new RecordStream(connection);
});

wss.on("listen", function (connection, id) {
    log("Listener connected with id ", id);
});

wss.on("listen", function (id) {
    log("Call id ", id)
})

class RecordStream {
    constructor(connection) {
        this.connection = connection;
        this.call_id = '';
        this.media_count = 0;
        this.logger = fs.createWriteStream('log.txt');
        connection.on("message", this.processMessage.bind(this));
        connection.on("close", this.close.bind(this));
    }
    processMessage(message){

        const data = JSON.parse(message.utf8Data);
        if (data.event === "start"){
            this.call_id = data.start.callSid;
        }
        if (this.media_count === 100){
            const response = new VoiceResponse();
            response.say("Hello, really nice to meet you.");
            const start_stream = response.connect();
            start_stream.stream({url: `wss://${ngrokURL}`, track: "inbound_track"});
            client.calls(this.call_id)
                .update({twiml: response.toString()})
                .then((call) => console.log(call.to));
        }
        this.logger.write(message.utf8Data + "\n", (err) => {
            if (err) {
                console.error('An error occurred:', err);
            } else {
                console.log(`${message.utf8Data}\n`);
            }
            this.media_count += 1;
        });
    }
    close() {
        this.logger.end();
    }
}

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

app.post("/record", async (req, res) => {
    const response = new VoiceResponse();
    response.say("Hello, really nice to meet you.");
    const start_stream = response.connect();
    const websocket_stream = start_stream.stream({url: `wss://${ngrokURL}`, track: "inbound_track"});
    // response.say("Hello, this is a recording test");
    // response.play({digits: 1})
    // response.pause({length: 2});
    // response.redirect(`https://${ngrokURL}/record`)
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
});

app.post("/callback", async (req, res) => {
    console.log("=======================================================================================");
    console.log(req);
    console.log("=======================================================================================");
});

app.post("/call", async (req, res) => {
    phone_number = "5087949928"
    client.calls
        .create({
            url: `https://${ngrokURL}/record`,
            to: `+1${phone_number}`,
            from: "+13257700175",
            method: "POST",
        })
        .then(async (call) => {
            res.json({status: "success"})
        })
        .catch((error) => {
            console.error(error);
            res.json({status: error})
        });
});
