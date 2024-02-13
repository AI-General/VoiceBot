/**
 * This script creates a multi-user call
 * 
 * yarn run multi-user
 */

require('dotenv').config()
const { Vonage } = require('@vonage/server-sdk')

// Phone Numbers
const TO_NUMBER1 = process.env.TO_NUMBER1
const TO_NUMBER2 = process.env.TO_NUMBER2
const VONAGE_NUMBER = process.env.VONAGE_NUMBER

// Vonage API Credentials
const VONAGE_API_KEY = process.env.VONAGE_API_KEY
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET
const VONAGE_APPLICATION_ID = process.env.VONAGE_APPLICATION_ID
const VONAGE_APPLICATION_PRIVATE_KEY_PATH = process.env.VONAGE_APPLICATION_PRIVATE_KEY_PATH
const NGROK_URL = process.env.NGROK_URL


const privateKey = (require('fs')).readFileSync(VONAGE_APPLICATION_PRIVATE_KEY_PATH);
const vonage = new Vonage({
    apiKey: VONAGE_API_KEY,
    apiSecret: VONAGE_API_SECRET,
    applicationId: VONAGE_APPLICATION_ID,
    privateKey: privateKey,
})

console.log(NGROK_URL)
// const call_id = uuidv4();
// console.log(call_id);
async function makeCall(to_number) {
    vonage.voice.createOutboundCall({
        // uuid: call_id,
        to: [{
            type: 'phone',
            number: to_number
        }],
        from: {
            type: 'phone',
            number: VONAGE_NUMBER
        },
        answerUrl: [`https://${NGROK_URL}/answer?direction=outbound`],
        answerMethod: 'POST'
    })
        .then(resp => console.log(resp))
        .catch(err => console.error(err));
}

makeCall(TO_NUMBER1);
makeCall(TO_NUMBER2);