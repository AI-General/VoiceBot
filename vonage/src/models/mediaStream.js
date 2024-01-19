const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { log } = require('../utils/log.js');

class MediaStream {
    constructor(connection) {
        this.connection = connection;
        this.firstMessage = {};
        // Bind class methods to the current instance
        connection.on("message", this.processMessage.bind(this));
        connection.on("close", this.close.bind(this));

        this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
        this.dgconnection = deepgram.listen.live({model: "nova"});
    }

    processMessage(message) {
        if (typeof message === 'string') {
            let data = JSON.parse(message);
            log(`First Message: `, data);
            if (! data['event'] === "websocket:connected") {
                log('Error: no websocket:connected event');
            }
            this.firstMessage = data;
        }

        this.connection.send(message);
    }

    close() {
        log("Media WS: closed");
    }
}

module.exports = { MediaStream }