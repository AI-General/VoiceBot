const twilio = require("twilio");
const authToken = process.env.TWILIO_AUTH_TOKEN;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const client = twilio(accountSid, authToken);
call_id = "CA68028c1f291eb3812a5a3c7cc71686f3"
client.calls(call_id).update(
    {twiml: '<Response><Say>This is an interruption test. I wish this would modify the stream response.</Say></Response>'}
).then((call) => console.log(call.to));