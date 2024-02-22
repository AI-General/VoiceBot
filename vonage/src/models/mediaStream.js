const dotenv = require('dotenv');
const fs = require('fs')
const { createClient, LiveTranscriptionEvents } = require("@deepgram/sdk");
const { pipeline, Transform } = require("node:stream");
const { default: axios } = require("axios");
const stream = require("stream");
const ffmpeg = require("fluent-ffmpeg");
const { Vonage } = require('@vonage/server-sdk');

const { Agent } = require('../models/agent.js');
const { log } = require('../utils/log.js');

dotenv.config();
const VONAGE_API_KEY = process.env.VONAGE_API_KEY
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET
const VONAGE_APPLICATION_ID = process.env.VONAGE_APPLICATION_ID
const VONAGE_APPLICATION_PRIVATE_KEY_PATH = process.env.VONAGE_APPLICATION_PRIVATE_KEY_PATH
const privateKey = fs.readFileSync(VONAGE_APPLICATION_PRIVATE_KEY_PATH);
const vonage = new Vonage({
    apiKey: VONAGE_API_KEY,
    apiSecret: VONAGE_API_SECRET,
    applicationId: VONAGE_APPLICATION_ID,
    privateKey: privateKey,
});

const chunkDuration = 20; // 20ms
const sampleRate = 16000; // 16kHz
const bytesPerSample = 2; // 16-bit audio, so 2 bytes per sample
const channels = 1; // Mono audio
const bytesPerChunk = (sampleRate * chunkDuration * bytesPerSample * channels) / 1000;
console.log(process.env.SPEAKER_PATH)
const speaker = require(`../../${process.env.SPEAKER_PATH}`);
const xTTS_server_url = process.env.XTTS_SERVER_URL;

const TO_NUMBER = process.env.TO_NUMBER
const VONAGE_NUMBER = process.env.VONAGE_NUMBER
const VONAGE_NUMBER2 = process.env.VONAGE_NUMBER2
const BOSS_NUMBER = process.env.BOSS_NUMBER;
// function sendWebSocketMessage(ws, message) {
//     return new Promise((resolve, reject) => {
//         ws.send(message, (error) => {
//             if (error) {
//                 return reject(error);
//             }
//             resolve(); // Resolve the promise after the message has been sent
//         });
//     });
// }

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class MediaStream {
    constructor(connection, call_id) {
        console.log('1');
        this.connection = connection;
        this.call_id = call_id;
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

        this.sendAudioStream("Hello, Step Enrollment Center. My name is Deidra. How can I help you today?");
    }

    processMessage(message) {
        // log(`Vonage WS: message`, message);
        // this.connection.send(message);
        if (typeof message === 'string') {
            let data = JSON.parse(message);
            log(`First Message: `, data);
            if (!data['event'] === "websocket:connected") {
                log('Error: no websocket:connected event');
            }
            this.firstMessage = data;
            this.agent = new Agent();
        } else {
            // this.connection.send(message);



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

    dgtranscript(data) {
        if (data['is_final'] && !this.isPlaying) {
            this.intermediateTranscript += data['channel']['alternatives'][0]['transcript'];
        }
        if (data['speech_final'] && data['channel']['alternatives'][0]['transcript'] && !this.isPlaying && this.agent.messages[this.agent.messages.length - 1]['role'] === 'assistant') {
            this.handleTranscript(this.intermediateTranscript);
            this.intermediateTranscript = "";
        }
    }

    async handleTranscript(transcript) {
        this.isPlaying = true;
        log(`[Human]: `, transcript);
        const prompt = await this.agent.ask(transcript);
        await this.invokeStreamProcess(prompt);
        // console.log("isPlaying: False");
        // this.isPlaying = false;
    }

    async sendAudioStream(text) {
        this.isPlaying = true;
        let count = 0;
        console.log("isPlaying: True");
        // const speaker = require(process.env.SPEAKER);
        // console.log("sending audio stream: ", text);
        const voiceId = this.voice ? this.voice : '21m00Tcm4TlvDq8ikWAM'; // Replace with your voiceId
        let response;
        const Elevenlabs_Key = process.env.XI_API_KEY;
        try {
            // Elevenlabs
            console.time("xtts");
            response = await axios({
                method: "post",
                url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=pcm_16000&optimize_streaming_latency=4`,
                headers: {
                    "xi-api-key": Elevenlabs_Key, "Content-Type": "application/json", accept: "audio/mpeg",
                },
                // query: {
                //     output_format: "pcm_16000",
                // },
                data: {
                    text: text,
                    model_id: "eleven_monolingual_v1",
                    voice_settings: {
                        stability: 0.15, similarity_boost: 0.5
                    },
                },
                responseType: "stream",
            });
            
            // xTTS
            // let data = speaker;
            // data["text"] = text;
            // data["language"] = "en";
            // data["stream_chunk_size"] = 20;
            // // console.log("data: ", data);
            // // console.time("xtts");
            // // let timestamp = Date.now();
            // // console.log("xTTS request timestamp: ", timestamp);

            // response = await axios({
            //     method: "post",
            //     url: `${xTTS_server_url}/tts_stream`,
            //     data: data,
            //     responseType: "stream"
            // })

            // Pheme
            // response = await axios({
            //     method: "post",
            //     url: `http://127.0.0.1:7000/synthesize`,
            //     data: { text: text, voice: "POD0000004393_S0000029" }, // POD0000004393_S0000029, male_voice, halle
            //     responseType: "stream"
            // })

        } catch (err) {
            log("ERROR: ", err);
        }

        // log("elevenlabs passed");

        const input = response.data;
        
        const startTime = Date.now();
        // const outputWav = new stream.PassThrough();
        // // Conversion of the MP3 stream to Mulaw (µ-law) format
        // ffmpeg(input)
        //     .audioFrequency(16000)
        //     .audioChannels(1)
        //     .audioCodec("pcm_s16le")
        //     .format("wav")
        //     .pipe(outputWav)
        //     .on("end", () => {
        //         // console.log('Conversion to WAV completed.');
        //     })
        //     .on("error", (err) => log("error: ", err));


        let buffer = Buffer.alloc(0);
        // Handle each chunk of data, convert to base64, and send as a media event
        input.on("data", (chunk) => {
            // let timestamp = Date.now();
            // console.log("message received timestamp: ", timestamp);

            // console.timeEnd("xtts");
            this.isPlaying = true;
            // console.log("in stream - isPlaying = True");
            buffer = Buffer.concat([buffer, chunk]);
            // console.log("Chunk Length is ", chunk.length);
            while (buffer.length >= bytesPerChunk) {
                count++;
                const currentChunk = buffer.slice(0, bytesPerChunk);
                buffer = buffer.slice(bytesPerChunk);

                // console.log("chunk", currentChunk);
                this.connection.send(currentChunk);
                // await sendWebSocketMessage(this.connection, currentChunk);
                // Send currentChunk as a media event here
            }
        });

        // On stream end, stop playing and transcribing if it is the second stream
        input.on("end", async () => {
            const processingTime = Date.now() - startTime;
            const additionalTime = (20 * count) - processingTime;
            // console.log("additionalTime: ", additionalTime);
            // console.log("count: ", count);
            await wait(additionalTime);
            this.isPlaying = false;
            console.log("Audio Stream ended - isPlaying = False");
        });

    }

    async invokeStreamProcess(prompt) {
        // this.isPlaying = true;
        const OpenAI_API_Key = process.env.OPENAI_API_KEY;
        const OpenAI_API_Base = process.env.OPENAI_API_BASE;
        const LLM_MODEL = process.env.LLM_MODEL;
        const IS_LOCAL = process.env.IS_LOCAL === "true";
        console.log("OpenAI_API_Base: ", OpenAI_API_Base);

        console.log(prompt);
        let fullResp = '';
        let generator;
        if (!IS_LOCAL) {

            let response = await fetch(`${OpenAI_API_Base}/chat/completions`, {
                headers: {
                    "Content-Type": "application/json", "Authorization": `Bearer ${OpenAI_API_Key}`
                }, method: "POST", body: JSON.stringify({
                    model: LLM_MODEL, messages: prompt, temperature: 0.75, top_p: 0.95, // stop: ["\n\n", "[INST]", '</s>'],
                    frequency_penalty: 0, presence_penalty: 0, max_tokens: 500, stream: true, n: 1,
                }),
            });

            generator = pipeline(response.body, new Transform({
                construct(callback) {
                    this.buffer = '';
                    callback();
                }, transform(chunk, encoding, callback) {
                    console.log(chunk.toString());
                    if (chunk.toString().startsWith("data: ")) {
                        this.buffer = "";
                    }
                    for (const data of (this.buffer + chunk).toString().split('\n')) {
                        if (data) {
                            log('data', data);
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
                    // this.isActionPart = false;
                    this.partialResp = '';
                    callback();
                }, transform(chunk, encoding, callback) {
                    // console.log(chunk.toString());
                    if (chunk.toString() !== `[DONE]`) {
                        const content = JSON.parse(chunk).choices[0].delta?.content || "";
                        // log(util.inspect(content));
                        // fullResp += content;
                        if ((content === '.' || content === '!' || content === '?' || content === '?\"' || content === '\\n' || content.endsWith('\n'))) {
                            this.push(this.partialResp + content);
                            this.partialResp = '';
                        }
                        else {
                            this.partialResp += content;
                        }
                    } else {
                        // log('partialResp', this.partialResp);
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
        } else {
            let response = await fetch(`${OpenAI_API_Base}/chat/completions`, {
                headers: {
                    "Content-Type": "application/json", "Authorization": `Bearer ${OpenAI_API_Key}`
                }, method: "POST", body: JSON.stringify({
                    model: LLM_MODEL, messages: prompt, temperature: 0.75, top_p: 0.95, stop: ["[", '</s>', "\n\n"],
                    frequency_penalty: 0, presence_penalty: 0, max_tokens: 500, stream: true, n: 1,
                }),
            });

            // let fullResp = '';
            generator = pipeline(response.body, new Transform({
                construct(callback) {
                    this.buffer = '';
                    callback();
                }, transform(chunk, encoding, callback) {
                    // console.log(chunk.toString());
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
                    // this.isActionPart = false;
                    this.partialResp = '';
                    this.isEnd = false;
                    callback();
                }, transform(chunk, encoding, callback) {
                    // console.log(chunk.toString());
                    if (chunk.toString() !== `[DONE]`) {
                        const content = JSON.parse(chunk).choices[0].delta?.content || "";
                        // log(util.inspect(content));
                        // fullResp += content;
                        if (!this.isEnd && (content === '.' || content === '!' || content === '?' || content === '?\"' || content === '\\n' || content.endsWith('\n'))) {
                            this.push(this.partialResp + content);
                            this.partialResp = '';
                        }
                        else if (this.partialResp === '' && (content === ' [' || content === ' ')) {
                            console.log('isEnd', this.isEnd);
                            this.isEnd = true;
                            // this.push(null);
                            // callback();
                        }
                        else {
                            this.partialResp += content;
                        }
                    } else {
                        log('ELSE partialResp', this.partialResp);
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
        }

        const waitToFinish = async () => {
            return new Promise((resolve) => {
                const interval = setInterval(async () => {
                    if (this.isPlaying === false) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 500); // Check every 1000ms (1 second)
            });
        };

        let ttsString = '';
        for await (const value of generator) {
            const string = value.toString();
            // log("~~~~~~~~~~~~ String ~~~~~~~~~~~~");
            // log(string);
            // log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");
            fullResp += string;
            // this.transfer();
            if (string.toLowerCase().startsWith('rude')) {
                const rude = string.toLowerCase().slice(6).startsWith('true');
                console.log("Rude: ", rude);
                if (rude) {
                    console.log("RUDE: HANGING UP");
                    this.hangup();
                }
                // console.log("Rude: ", rude);
            } else if (string.toLowerCase().startsWith('transfer')) {
                const transfer = string.toLowerCase().slice(10).startsWith('true');
                if (transfer) {
                    console.log("TRANSFER: HANGING UP");
                    this.transfer();
                }
                // console.log("Transfer: ", transfer);
            } else if (string.toLowerCase().startsWith('response')) {
                // console.log("Response: ", string.slice(10));
                await this.sendAudioStream(string.slice(10));
                // ttsString = string.slice(10);
                // await waitToFinish();
                // fullResp += string.slice(10);
            } else {
                // console.log("Response: " + string.slice(1));
                await this.sendAudioStream(string.slice(1));
                // ttsString += string;
                // await waitToFinish();
                // fullResp += string;
            }

        }

        // console.log("##############################################");
        // console.log(ttsString);
        // console.log("##############################################");
        // await this.sendAudioStream(ttsString);
        // await waitToFinish();

        // this.agent.update_message(fullResp);
        this.agent.update_message(fullResp);
        // this.isPlaying = false;
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
            // console.log("deepgram: keepalive");
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
            // deepgram.addListener(LiveTranscriptionEvents.Transcript, (data) => {
            //     console.log("deepgram: packet received");
            //     console.log("deepgram: transcript received");
            //     console.log(data);
            //     console.log(data['channel']['alternatives'][0]['transcript'])
            //     // ws.send(JSON.stringify(data));
            // });

            deepgram.addListener(LiveTranscriptionEvents.Transcript, this.dgtranscript.bind(this));

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

    hangup() {
        vonage.voice.hangupCall(this.call_id, (err, res) => {
            if (err) {
                console.error(err);
            } else {
                console.log(res);
            }
        });
        // vonage.call.update(this.call_id, {
        //     action: 'hangup'
        // }, (err, res) => {
        //     if (err) {
        //         console.error(err);
        //     } else {
        //         console.log(res);
        //     }
        // })
    };

    transfer() {
        vonage.voice.transferCallWithNCCO(this.call_id, [
            {
                action: 'talk',
                text: 'Hello, you are being connected, please wait...'
            },
            {
                "action": "connect",
                "from": VONAGE_NUMBER,
                "endpoint": [{
                    "type": "phone",
                    "number": BOSS_NUMBER
                }]
            }
        ], (err, res) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log(res);
                }
            });
    };
}

module.exports = { MediaStream }