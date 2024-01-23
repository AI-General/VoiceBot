const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { log } = require('../utils/log.js');



class MediaStream {
    constructor(connection) {
        console.log('1');
        this.connection = connection;
        this.firstMessage = {};
        this.isPlaying = false;
        this.intermediateTranscript = "";
        this.keepAlive = null;
        console.log('2');
        console.log('3');
        // const dgconnection = deepgram.listen.live({model: "nova"});
        // dgconnection.on(LiveTranscriptionEvents.Open, () => {
        //     log(`Deepgram WS: open`);
        // });
        this.deepgram = this.setupDeepgram();
        console.log('4');

        // Bind class methods to the current instance
        connection.on("message", this.processMessage.bind(this));
        connection.on("close", this.close.bind(this));
        console.log('5');
        // dgconnection.on(LiveTranscriptionEvents.Transcript, this.dgtranscript.bind(this));
        console.log('6');
        log(`Media WS: created`);
    }

    processMessage(message) {
        // log(`Vonage WS: message`, message);
        this.connection.send(message);
        if (typeof message === 'string') {
            let data = JSON.parse(message);
            log(`First Message: `, data);
            if (!data['event'] === "websocket:connected") {
                log('Error: no websocket:connected event');
            }
            this.firstMessage = data;
        } else {



            // this.dgconnection.on(LiveTranscriptionEvents.Open, () => {
            //     log(`Deepgram WS: open`);
            // });
            // if (this.dgconnection) {
            //     this.dgconnection.send(message);
            // } else {
            //     log(`Deepgram WS: no connection`);
            // }
            // log(`Message: `, message);
            if (this.deepgram.getReadyState() === 1 /* OPEN */) {
                // console.log("socket: data sent to deepgram")
                // console.log("message: ", message);
                this.deepgram.send(message);
            } else if (this.deepgram.getReadyState() >= 2 /* 2 = CLOSING, 3 = CLOSED */) {
                console.log("socket: data couldn't be sent to deepgram");
                console.log("socket: retrying connection to deepgram");
                /* Attempt to reopen the Deepgram connection */
                // this.deepgram.finish();
                // this.deepgram.removeAllListeners();
                this.deepgram = this.setupDeepgram();
                // this.deepgram.send(message);
                log(`Deepgram WS: closing`);
            } else {
                console.log("socket: data couldn't sent to deepgram");
            }
        }
    }

    dgtranscript(message) {
        log(`Transcript: `, message);
        const data = JSON.parse(message);
    }

    close() {
        if (this.keepAlive) clearInterval(this.keepAlive);
        this.deepgram.finish();
        this.deepgram.removeAllListeners();
        this.deepgram = null;
        log("Media WS: closed");
    }

    setupDeepgram() {
        const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
        console.log("deepgram: 1");
        const deepgram = deepgramClient.listen.live({
            language: "en",
            punctuate: true,
            smart_format: true,
            sample_rate: 16000,
            encoding: 'linear16',
            multichannel: true,
            // language: 'en - US',
            model: "nova",
        });
        console.log("deepgram: 2");

        if (this.keepAlive) clearInterval(this.keepAlive);
        this.keepAlive = setInterval(() => {
            console.log("deepgram: keepalive");
            deepgram.keepAlive();
        }, 1 * 1000);
        console.log("deepgram: 3");

        // deepgram.addListener('transcriptReceived', (data) => { 
        //     console.log("deepgram: transcript received");
        //     console.log(data);
        // });

        deepgram.addListener(LiveTranscriptionEvents.Open, async () => {
            console.log("deepgram: connected");

            //   deepgram.addListener(LiveTranscriptionEvents.Transcript, this.dgtranscript.bind(this));
            deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
                console.log("deepgram: packet received");
                console.log("deepgram: transcript received");
                console.log(data);
                console.log(data['channel']['alternatives'][0]['transcript'])
                // ws.send(JSON.stringify(data));
            });

            deepgram.addListener(LiveTranscriptionEvents.Close, async () => {
                console.log("deepgram: disconnected");
                clearInterval(this.keepAlive);
                // deepgram.finish();
            });

            deepgram.addListener(LiveTranscriptionEvents.Error, async (error) => {
                console.log("deepgram: error received");
                console.error(error);
            });

            deepgram.addListener(LiveTranscriptionEvents.Warning, async (warning) => {
                console.log("deepgram: warning received");
                console.warn(warning);
            });

            deepgram.addListener(LiveTranscriptionEvents.Metadata, (data) => {
                console.log("deepgram: packet received");
                console.log("deepgram: metadata received");
                // console.log("ws: metadata sent to client");
                console.log(data);
            });
        });
        console.log("deepgram: 4");
        return deepgram;
    };

}

module.exports = { MediaStream }