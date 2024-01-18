const dotenv = require("dotenv");
dotenv.config();
const { pipeline, Transform } = require("node:stream");
const VoiceResponse = require("twilio").twiml.VoiceResponse;
const twilio = require("twilio");
const { Agent, Tool } = require("./agent.js");
const WebSocketServer = require("websocket").server;
const { default: axios } = require("axios");
const { Deepgram } = require("@deepgram/sdk");
const stream = require("stream");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
const util = require("node:util");
const { v4: uuidv4 } = require("uuid");
const path = require('path');
const fs = require('fs');

const logFilePath = path.join(__dirname, 'app.log');

// Delete the log file if it exists
if (fs.existsSync(logFilePath)) {
    fs.unlinkSync(logFilePath, (err) => {
        if (err) throw err;
    });
}

const authToken = process.env.TWILIO_AUTH_TOKEN;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
log("Twilio Auth Token", authToken);
log("Twilio Account SID", accountSid);
const client = twilio(accountSid, authToken);

const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

const PORT = process.env.PORT || 3000;
const deepgram = new Deepgram(deepgramApiKey);
const { startTimer, endTimer } = require("./utils.js");

let chalk = null;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// console.log(OPENAI_API_KEY);
const Elevenlabs_Key = process.env.XI_API_KEY;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

import("chalk").then((module) => {
    chalk = module.default;
});

const ngrokURL = process.env.NGROK_URL;
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json());
// app.use(cookieParser());

ffmpeg.setFfmpegPath(ffmpegPath);
/** */

const server = app.listen(PORT, () => {
    log(`Server running on port ${PORT}`);
});
const wss = new WebSocketServer({
    httpServer: server, autoAcceptConnections: true
});


function log(message, ...args) {
    // log(new Date(), message, ...args);
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    console.log(message, ...args);

    // Append log message to the log file
    fs.appendFile(logFilePath, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        }
    });
}

wss.on("connect", function (connection) {
    log("From Twilio: Connection accepted");
    new MediaStream(connection);
});
wss.on("listen", function (connection, id) {
    log("Listener connected with id ", id);
});
wss.on("listen", function (id) {
    log("Call id ", id)
})


class MediaStream {
    constructor(connection) {
        this.connection = connection;
        this.trackHandlers = {};
        this.isPlaying = false;
        this.callDetails = {};
        this.agent = "";
        this.newStreamNeeded = false;
        this.intermediateTranscript = "";
        this.call_id;
        this.voice;
        this.callSid;
        // Bind class methods to the current instance
        connection.on("message", this.processMessage.bind(this));
        connection.on("close", this.close.bind(this));
    }

    async sendAudioStream(text, streamSid) {
        // startTimer("Text to speech");
        // const voiceId = "BtfOvRgc4aLrwPWBaeeZ";
        const voiceId = this.voice ? this.voice : '21m00Tcm4TlvDq8ikWAM'; // Replace with your voiceId

        log("Voice ID", voiceId);

        let response;

        try {
            response = await axios({
                method: "post",
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4`,
                headers: {
                    "xi-api-key": Elevenlabs_Key, "Content-Type": "application/json", accept: "audio/mpeg",
                },
                data: {
                    text: text, model_id: "eleven_monolingual_v1", voice_settings: {
                        stability: 0.15, similarity_boost: 0.5
                    },
                },
                responseType: "stream",
            });
        } catch (err) {
            console.log(err.response);
            // log("error: ", err.stringify());
        }

        log("elevenlabs passed");
        // Timer to measure response time

        const input = response.data;
        log("input", input);

        // Creating a PassThrough stream for the µ-law conversion
        const outputMulaw = new stream.PassThrough();

        // Conversion of the MP3 stream to Mulaw (µ-law) format
        ffmpeg(input)
            .audioFrequency(8000)
            .audioChannels(1)
            .audioCodec("pcm_mulaw")
            .format("wav")
            .pipe(outputMulaw)
            .on("end", () => {
            })
            .on("error", (err) => log("error: ", +err));

        // endTimer("Text to speech");

        // endTimer("general");
        // Handle each chunk of data, convert to base64, and send as a media event
        outputMulaw.on("data", (chunk) => {
            const base64Data = this.isPlaying ? Buffer.from(chunk).toString("base64") : Buffer.from(chunk.slice(44).toString("base64"));

            this.isPlaying = true;
            const mediaData = {
                event: "media", streamSid: streamSid, media: {
                    payload: base64Data,
                },
            };
            this.connection.sendUTF(JSON.stringify(mediaData));
        });

        // On stream end, stop playing and transcribing if it is the second stream
        outputMulaw.on("end", () => {
            this.isPlaying = false;
        });
    }

    async invokeStreamProcess(prompt, streamSid) {
        log("prompt-messages", prompt);
        let action = '';
        let response = await fetch("https://api.openai.com/v1/chat/completions", {
            headers: {
                "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}`
            }, method: "POST", body: JSON.stringify({
                model: "gpt-4-1106-preview", messages: prompt, temperature: 0.75, top_p: 0.95, // stop: ["\n\n"],
                frequency_penalty: 0, presence_penalty: 0, max_tokens: 500, stream: true, n: 1,
            }),
        });
        let fullResp = '';
        const generator = pipeline(response.body, new Transform({
            construct(callback) {
                this.buffer = '';
                callback();
            }, transform(chunk, encoding, callback) {
                if (chunk.toString().startsWith("data: ")) {
                    this.buffer = "";
                }
                for (const data of (this.buffer + chunk).toString().split('\n')) {
                    if (data) {
                        // log('data', data);
                        if (data.endsWith("}]}")) {
                            this.push(data.slice(6));
                        } else if (data === "data: [DONE]") {
                            this.push(data.slice(6))
                        } else {
                            this.buffer = data;
                        }
                    }
                }
                callback();
            }
        }), new Transform({
            construct(callback) {
                this.isActionPart = false;
                this.partialResp = '';
                callback();
            }, transform(chunk, encoding, callback) {
                if (chunk.toString() !== `[DONE]`) {
                    const content = JSON.parse(chunk).choices[0].delta?.content || "";
                    log(util.inspect(content));
                    fullResp += content;
                    if ((content === '.' || content === '!' || content === '?' || content === '?\"' || content === '\\n' || content.endsWith('\n'))) {
                        if (this.isActionPart === false) {
                            this.push(this.partialResp + content);
                            this.partialResp = '';
                        } else {
                            this.push(this.partialResp);
                            this.partialResp = '';
                            this.isActionPart = false;
                        }
                    } else {
                        if (this.partialResp === 'action:') {
                            this.isActionPart = true;
                            this.partialResp += content;
                        } else {
                            this.partialResp += content;
                        }
                    }
                } else {
                    this.push(this.partialResp);
                }
                callback();
            }
        }), (err) => {
            if (err) {
                console.error('failed', err);
            } else {
                log('completed');
            }
        },);

        const waitToFinish = async () => {
            return new Promise((resolve) => {
                const interval = setInterval(async () => {
                    if (this.isPlaying === false) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100); // Check every 1000ms (1 second)
            });
        };
        for await (const value of generator) {
            const string = value.toString();
            // log("~~~~~~~~~~~~ String ~~~~~~~~~~~~");
            // log(string);
            // log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            if (string.startsWith('<<action_block>>') || string.startsWith('#####')) {
                action = '';
            } else {
                // log("Value Part####" + string);
                if (action !== '') {
                    // log("Action: " + action);
                    if (action === "Speak") {
                        if (string.startsWith("action_input: ")) {
                            await this.sendAudioStream(string.slice(14), streamSid);
                        } else {
                            await this.sendAudioStream(string, streamSid);
                        }
                        await waitToFinish();
                    } else if (action === "Press Buttons") {
                        this.agent.update_message(fullResp);
                        await update_agent_message(this.agent.messages.slice(1), this.call_id);
                        const num = string.startsWith("action_input: ") ? string.slice(14) : string;
                        const response = new VoiceResponse();
                        response.play({ digits: num });
                        response.say(`I pressed button ${num}`);
                        const start_stream = response.connect();
                        const websocket_stream = start_stream.stream({
                            url: `wss://${ngrokURL}`,
                            track: "inbound_track"
                        });
                        websocket_stream.parameter({ name: `call_id`, value: this.call_id })
                        client.calls(this.callSid)
                            .update({ twiml: response.toString() })
                            .then((call) => log(call.to));
                    }
                } else if (string.startsWith("action: ")) {
                    action = string.slice(8);
                    if (action === "Finish") {
                        this.connection.close()
                        this.close();
                    } else if (action === "Dial") {
                        this.agent.update_message(fullResp);
                        await update_agent_message(this.agent.messages.slice(1), this.call_id);
                        const number = "650-750-8255";
                        const response = new VoiceResponse();
                        response.dial({ hangupOnStar: true }, number);
                        response.say(`Dial Finished with ${number}`);
                        const start_stream = response.connect();
                        const websocket_stream = start_stream.stream({
                            url: `wss://${ngrokURL}`,
                            track: "inbound_track"
                        });
                        websocket_stream.parameter({ name: `call_id`, value: this.call_id });
                        client.calls(this.callSid)
                            .update({ twiml: response.toString() })
                            .then((call) => log(call.to));
                    }
                }
            }
        }
        this.agent.update_message(fullResp);
        log(`Full Response: ${fullResp}`)
    }

    debounce(func, wait, immediate) {
        var timeout;
        return function executedFunction() {
            var context = this;
            var args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }

    processMessage(message) {
        if (message.type === "utf8") {
            // Parsing the received message
            const data = JSON.parse(message.utf8Data);
            // Handling 'start' event
            if (data.event === "start") {
                // Setting up class properties
                this.metaData = data.start;
                this.callSid = data.start.callSid;
                this.call_id = data.start.customParameters.call_id;
                // let isFirstConnect = true;
                // get_call_param(this.call_id).then((promptData) => {
                // this.callDetails["params"] = promptData?.params;
                // this.callDetails["objective"] = promptData?.objective;
                // this.voice = promptData?.voice;
                // this.callDetails["voice_to_use"] = promptData?.objective;
                // isFirstConnect = promptData?.messages === [];
                // Combining strings for logging
                // let combinedString = Object.keys(this.callDetails)
                //     .map((key) => `${key}: ${this.callDetails[key]}`)
                //     .join("\n");
                // Creating a new Agent instance
                this.agent = new Agent( //combinedString,
                    [
                        new Tool("Speak", "Talk to the person on the other end of the line"),
                        // new Tool("Press Buttons", "Press buttons on phone. Each character is a different button."),
                        // new Tool("Wait", "Wait for the person to continue speaking."),
                        // new Tool("Hold", "Wait for the new person to come."),
                        // new Tool("Finish", "Hang up the call."),
                        // new Tool("Dial", "Dial boss.")
                    ], this.callDetails?.objective);
                // this.agent.feed(promptData?.messages);
                // log(`Prompt messages: ` + promptData?.messages);
                // log(`agent messages: ` + this.agent.messages);
                // });

                // if (isFirstConnect) {
                this.voice = this.callDetails['voice_to_use']
                const greetings = ["Hello!", "Hi there!", "Hey anybody there.", "Good day!", "Hey!", "Hows it going, are you there?!",];

                // Generate a random index
                const randomIndex = Math.floor(Math.random() * greetings.length);

                // Select a random greeting
                const randomGreeting = greetings[randomIndex];
                // log(randomGreeting);
                this.sendAudioStream(`${randomGreeting}`, data?.streamSid).then(() => {
                })
                // }
            }
            if (data.event === "subscribe") {
                this.connection = data?.streamSid
                JSON.stringify({
                    stream: data.streamSid, event: "interim-transcription", text: transcription,
                })
            }
            if (data.event === "stop") {
                // updateIsDone(this.call_id, true)

            }
            // Handling non-media event
            if (data.event !== "media") {
                return;
            }
            const track = data.media.track;
            // log(track);
            // When a new track is identified, and no transcription or playback is in progress
            if (!this.trackHandlers[track]) {
                // The function createNewStream sets up the specifications for a new audio stream
                const createNewStream = () => {
                    const newService = deepgram.transcription.live({
                        smart_format: true,
                        interim_results: true,
                        language: "en-US",
                        model: "nova",
                        encoding: "mulaw",
                        sample_rate: 8000,
                        endpointing: 100,
                        punctuate: true,
                    });
                    return newService;
                };
                let service = createNewStream();
                // If a new stream is needed, the current service is replaced with a new one
                if (this.newStreamNeeded) {
                    service = createNewStream();
                    this.trackHandlers[track] = service;
                    this.newStreamNeeded = false;
                }
                // The function sendAudioStream handles sending an audio stream
                let currentAudioStream = null;
                const handleTranscription = this.debounce(async (transcription) => {
                    const mediaData = {
                        event: "clear", streamSid: data?.streamSid,
                    };
                    for (let i = 0; i < 1; i++) {
                        this.connection.sendUTF(JSON.stringify(mediaData));
                        // clear audio buffer.
                    }
                    if (this.isPlaying) {
                        return
                    }
                    // add this line to prevent a new transcription
                    // log(chalk.white.bgMagenta('\n[Human] : '), `${transcription}`, "\n");
                    const toHoldTranscription = transcription;
                    // const toHoldTranscription = "Hello.";
                    // log("Transcript Received");
                    const prompt = await this.agent.ask(toHoldTranscription);
                    // log(prompt);
                    await this.invokeStreamProcess(prompt, data?.streamSid);
                    this.intermediateTranscript = "";
                    this.isPlaying = false
                    // reset the flag when transcription is done
                }, 1);
                // service.on("transcription", handleTranscription);
                service.addListener("transcriptReceived", (message) => {
                    const data = JSON.parse(message);
                    if (data.is_final) {
                        this.intermediateTranscript = this.intermediateTranscript + data?.channel?.alternatives[0]?.transcript;

                    }
                    if (data?.is_final && data?.speech_final && data?.channel?.alternatives[0]?.transcript) {
                        // transcript_byte(this.call_id, 'human', this.intermediateTranscript)
                        handleTranscription(this.intermediateTranscript);
                    }
                });
                service.addListener("close", (e) => {
                    log("Connection closed.");
                    log(e);
                    if (e.reason === "Deepgram did not receive audio data or a text message within the timeout window. See https://dpgr.am/net0001") {
                        log("TIMED OUT \n\n\n\n");
                        this.newStreamNeeded = true;
                    }
                });

                this.trackHandlers[track] = service;
                if (this.newStreamNeeded) {
                    service = null;
                    service = createNewStream();
                    this.newStreamNeeded = false;
                }
            }
            if (!this.isPlaying) {
                if (this.trackHandlers[track].getReadyState() == 1) {
                    this.trackHandlers[track].send(Buffer.from(data.media.payload, "base64"));
                }
            }

            // only send new data if not currently transcribing
        } else if (message.type === "binary") {
            log("Media WS: binary message received (not supported)");
        }
    }

    close() {
        log("Media WS: closed");
        for (let track of Object.keys(this.trackHandlers)) {
            log(`Closing ${track} handler`);
            // updateIsDone(this.call_id, true)
        }
    }
}

function flattenObj(obj, parent = "", res = {}) {
    for (let key in obj) {
        let propName = parent ? `${parent}.${key}` : key;
        if (typeof obj[key] == "object") {
            flattenObj(obj[key], propName, res);
        } else {
            res[propName] = obj[key];
        }
    }
    return res;
}

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

app.post("/twiml", function (req, res) {
    log("Twilio: /twiml");
    const queryObject = req.query;
    const response = new VoiceResponse();
    if (queryObject) {
        const start_stream = response.connect();

        const websocket_stream = start_stream.stream({ url: `wss://${ngrokURL}` });
        for (let key in queryObject) {
            websocket_stream.parameter({ name: key, value: queryObject[key] });
            // paramsXML += `<Parameter name="${key}" value="${queryObject[key]}" />\n`;
        }
    }
    // log("-------------------------------------------TWIML----------------------------------------------")
    // response.gather({timeout: 60});
    // response.redirect(`https://${ngrokURL}/twiml`)
    res.set('Content-Type', 'text/xml');
    res.send(response.toString());
});


app.post("/stream", function (req, res) {
    const { sid } = req.body
    log("sid", sid)
    client.calls(sid)
        .streams
        .create({ url: 'wss://example.com/' })
        .then(stream => log(stream.sid));
    // res.json({"status":"success"})
});

app.post("/length", async function (req, res) {
    const { call_id } = req.body
    // Fetch the call_sid from the belva table
    let { data: belvaData, error: belvaError } = await supabase
        .from('belva')
        .select('call_sid')
        .eq('call_id', call_id)
    if (belvaError) {
        log('Error: ', belvaError)
        return res.status(500).send('Error in fetching call_sid');
    }
    // Create Twilio client
    client.calls(belvaData[0].call_sid)
        .fetch()
        .then(call => res.json({ "length": call.duration }))
        .catch(err => {
            log('Error: ', err);
            return res.status(500).send('Error in fetching call length from Twilio');
        });
})

app.post("/transcriptions", async function (req, res) {
    const apikey = req.headers['x-api-key']
    const { call_id } = req.body

    const transcripts = await getTranscripts(apikey, call_id)
    res.json(transcripts)
    // res.json({"status":"success"})
});

app.post("/getRecording", function (req, res) {
    const { sid } = req.body
    log("sid", sid)
    client.calls(sid)
        .streams
        .create({ url: 'wss://example.com/' })
        .then(stream => log(stream.sid));

    // res.json({"status":"success"})
});
const sensitiveNumbers = ['911', '112', '999'];

app.post('/call', async (req, res) => {
    const { phone_number, objective, params, v } = req.body;

    voice_to_use = "21m00Tcm4TlvDq8ikWAM"

    log("Voice to use ", voice_to_use)

    let flattenedParams = flattenObj(params);
    // log(voice_to_use)
    let callParams = {
        phone_number, objective, ...flattenedParams, voice_to_use
    };

    const call_id = uuidv4();
    let url = `https://${ngrokURL}/twiml?call_id=${call_id}`;
    // let url =`https://handler.twilio.com/twiml/EH3549f908e885721fe40ed2971d3ca91a`;
    log(url);
    client.calls
        .create({
            url: url,
            to: `+${phone_number}`,
            from: `+${TWILIO_PHONE_NUMBER}`,
            method: "POST",
            // machineDetection: "Enable",
        })
        .then(async (call) => {
            // await update_call_sid(call.sid, call_id)
            res.json({ status: "success", call_id: call_id, call_sid: call.sid })
        })
        .catch((error) => {
            console.error(error);
            res.json({ status: error })
        });
});
