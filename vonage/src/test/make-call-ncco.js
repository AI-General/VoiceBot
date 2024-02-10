require('dotenv').config()
const fs = require('fs')
// const { v4: uuidv4 } = require("uuid");

const TO_NUMBER = process.env.TO_NUMBER
const VONAGE_NUMBER = process.env.VONAGE_NUMBER

const VONAGE_API_KEY = process.env.VONAGE_API_KEY
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET
const VONAGE_APPLICATION_ID = process.env.VONAGE_APPLICATION_ID
const VONAGE_APPLICATION_PRIVATE_KEY_PATH = process.env.VONAGE_APPLICATION_PRIVATE_KEY_PATH
const NGROK_URL = process.env.NGROK_URL

const { Vonage } = require('@vonage/server-sdk')
const { NCCOBuilder, Talk, OutboundCallWithNCCO } = require('@vonage/voice')
const { log } = require('console')

const privateKey = fs.readFileSync(VONAGE_APPLICATION_PRIVATE_KEY_PATH);
const vonage = new Vonage({
    apiKey: VONAGE_API_KEY,
    apiSecret: VONAGE_API_SECRET,
    applicationId: VONAGE_APPLICATION_ID,
    privateKey: privateKey,
})

console.log(NGROK_URL)
// const call_id = uuidv4();
// console.log(call_id);
async function makeCall() {
    vonage.voice.createOutboundCall({
        // uuid: call_id,
        to: [{
            type: 'phone',
            number: TO_NUMBER //13308798656, 15087949928
        }],
        from: {
            type: 'phone',
            number: VONAGE_NUMBER
        },
        // ncco: [
        //     // {
        //     //     "action": "record",
        //     //     "eventUrl": [`https://${NGROK_URL}/recordings`]
        //     //     // "transcription": {}
        //     // },
        //     {
        //         "action": "connect",
        //         "from": VONAGE_NUMBER,
        //         "endpoint": [
        //             {
        //                 "type": "websocket",
        //                 "uri": `wss://${NGROK_URL}/socket`,
        //                 // "content-type": "audio/l16;rate=8000",
        //             }
        //         ]
        //     }
        // ]
        answerUrl: [`https://${NGROK_URL}/answer?direction=outbound`],
        answerMethod: 'POST'
    })
        .then(resp => console.log(resp))
        .catch(err => console.error(err));
}
makeCall();