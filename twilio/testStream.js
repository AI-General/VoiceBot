const fs = require("fs");
const path = require("path");
const twilio = require("twilio");
const speech = require("@google-cloud/speech");
const speechClient = new speech.SpeechClient();
const { Agent, Tool } = require("./agent.js");
var http = require("http");
var HttpDispatcher = require("httpdispatcher");
var WebSocketServer = require("websocket").server;
const TranscriptionService = require("./transcription_service");
const { default: axios } = require("axios");
const streamToPromise = require("stream-to-promise");
const alawmulaw = require("alawmulaw");
var dispatcher = new HttpDispatcher();
const cors = require("cors");
var wsserver = http.createServer(handleRequest);
const url = require("url");
const { Deepgram } = require("@deepgram/sdk");
const fetch = require("cross-fetch");
const stream = require("stream");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const authToken = "c74af4295b411c3692f75964ceb5b17a";
const accountSid = "ACbed526cc84d22837928b906e9f4cb96e";
const deepgramApiKey = "22e70a786347ced4ef1057f1d4e59481a5029df3";
const client = twilio(accountSid, authToken);
const HTTP_SERVER_PORT = 5001;
const REPEAT_THRESHOLD = 50;
const { Configuration, OpenAIApi } = require("azure-openai");
const { create } = require("domain");
const { sampleB } = require("./sampleB.js");
const deepgram = new Deepgram(deepgramApiKey);

const configuration = new Configuration({
	apiKey: "cce2f8c2210942e49bce8d2aca73ff50",
	azure: {
		apiKey: "cce2f8c2210942e49bce8d2aca73ff50",
		endpoint: "https://intelligaone.openai.azure.com",
		deploymentName: "DAV03",
		// deploymentName is optional, if you donot set it, you need to set it in the request parameter
	},
});
const openai = new OpenAIApi(configuration);
var mediaws = new WebSocketServer({
	httpServer: wsserver,
	autoAcceptConnections: true,
});

function log(message, ...args) {
	console.log(new Date(), message, ...args);
}

function handleRequest(request, response) {
	response.setHeader("Access-Control-Allow-Origin", "*");
	response.setHeader("Access-Control-Request-Method", "*");
	response.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
	response.setHeader("Access-Control-Allow-Headers", "*");
	if (request.method === "OPTIONS") {
		response.writeHead(200);
		response.end();
		return;
	}
	try {
		dispatcher.dispatch(request, response);
	} catch (err) {
		console.error(err);
	}
}

dispatcher.onPost("/twiml", function (req, res) {
	/**
     * 	phoneNumber,
		clientName,
		dateOfBirth,
		socialSecurityNumber,
		injuryDescription,
		insurancePolicyNumber,
     */
	console.log(req.url);

	const queryObject = url.parse(req.url, true).query;
	console.log(queryObject);

	let paramsXML = "";
	for (let key in queryObject) {
		paramsXML += `<Parameter name="${key}" value="${queryObject[key]}" />\n`;
	}

	let filePath = `<?xml version="1.0" encoding="UTF-8" ?>
        <Response>
          <Say>Connecting with Uvalle Law.</Say>
          <Connect>
            <Stream url="wss://d947-69-42-12-62.ngrok-free.app">
              ${paramsXML}
            </Stream>
          </Connect>
          <Say>Thank you! The WebSocket has been closed and the next TwiML verb was reached.</Say>
        </Response>`;

	res.writeHead(200, {
		"Content-Type": "text/xml",
		"Content-Length": Buffer.byteLength(filePath, "utf8"),
	});

	res.end(filePath);
});

mediaws.on("connect", function (connection) {
	log("From Twilio: Connection accepted");
	new MediaStream(connection);
});

class MediaStream {
	constructor(connection) {
		this.connection = connection;
		this.metaData = null;
		this.trackHandlers = {};
		connection.on("message", this.processMessage.bind(this));
		connection.on("close", this.close.bind(this));
		this.isTranscribing = false; // add a new state
		this.isPlaying = false;
		this.caseDetails = "";
		this.agent = "";
		this.clientName = "";
		this.dateOfBirth = "";
		this.socialSecurityNumber = "";
		this.injuryDescription = "";
		this.insurancePolicyNumber = "";
		this.claimNumber = "";
		this.newStreamNeeded = false;
		this.intermediateTranscript = "";
	}

	processMessage(message) {
		function debounce(func, wait, immediate) {
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
		if (message.type === "utf8") {
			const data = JSON.parse(message.utf8Data);
			if (data.event === "start") {
				console.log("STARTING DATA ", data.start);
				const customParams = data.start.customParameters;
				this.metaData = data.start;
				this.clientName = customParams.clientName;
				this.dateOfBirth = customParams.dateOfBirth;
				this.socialSecurityNumber = customParams.socialSecurityNumber;
				this.injuryDescription = customParams.injuryDescription;
				this.insurancePolicyNumber = customParams.insurancePolicyNumber;
				this.claimNumber = customParams.claimNumber;
				let combinedString =
					`Client Name: ${this.clientName}\n` +
					`Date of Birth: ${this.dateOfBirth}\n` +
					`Social Security Number: ${this.socialSecurityNumber}\n` +
					`Injury Description: ${this.injuryDescription}\n` +
					`Insurance Policy Number: ${this.insurancePolicyNumber}\n` +
					`Claim Number: ${this.claimNumber}`;

				console.log(combinedString);

				this.agent = new Agent(combinedString, [
					new Tool("Speak", "Talk to the insurance agent."),
					new Tool(
						"Press Buttons",
						"Press buttons on phone. Each character is a different button."
					),
					new Tool(
						"Store Case Number",
						"Store the claim number for later use."
					),
					new Tool(
						"Wait",
						"Wait for the insurance agent to continue speaking."
					),
				]);
			}
			if (data.event !== "media") {
				return;
			}
			const track = data.media.track;
			if (
				this.trackHandlers[track] === undefined &&
				!this.isPlaying &&
				!this.isTranscribing
			) {
				// const service = new TranscriptionService();
				const createNewStream = () => {
					const newservice = deepgram.transcription.live({
						smart_format: true,
						interim_results: true,
						language: "en-US",
						model: "nova",
						encoding: "mulaw",
						sample_rate: 8000,
						endpointing: 500,
						punctuate: true,
					});
					return newservice;
				};
				const createAudioStream = async (chunk) => {
					const voice_id = "1Kz9pOCevRqmRHrDVKL6"; // Replace with your voice_id
					const xi_api_key = "18e93f4ca093bd1a3490119df681c2d7"; // Replace with your xi-api-key
					const response = await axios({
						method: "post",
						url: `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}/stream`,
						headers: {
							"xi-api-key": xi_api_key,
							"Content-Type": "application/json",
							accept: "audio/mpeg",
						},
						data: {
							text: chunk,
							optimize_streaming_latency: 4,
							model_id: "eleven_monolingual_v1",
							voice_settings: {
								stability: 1,
								similarity_boost: 0.5,
							},
						},
						responseType: "stream",
					});
					const input = response.data;

					const outputMP3 = new stream.PassThrough();

					// Use Ffmpeg to convert the stream
					ffmpeg(input)
						.format("mp3")
						.pipe(outputMP3)
						.on("end", function () {
							console.log("Conversion to MP3 ended");
						})
						.on("error", function (err) {
							console.log("error: ", +err);
						});

					// Now outputMP3 stream contains the MP3 audio
					// Create another PassThrough stream for the µ-law conversion
					const outputMulaw = new stream.PassThrough();

					// Convert the MP3 stream to Mulaw (µ-law) format
					ffmpeg(outputMP3)
						.withAudioBitrate("8")
						.audioFrequency(8000)
						.audioChannels(1)
						.audioCodec("pcm_mulaw")
						.format("wav")
						.pipe(outputMulaw)
						.on("end", function () {
							console.log("Conversion to Mulaw ended");
						})
						.on("error", function (err) {
							console.log("error: ", +err);
						});
					// Handle each chunk of data

					outputMulaw.on("data", (chunk) => {
						// Convert each chunk to base64
						const base64Data =
							Buffer.from(chunk).toString("base64");
						if (!base64Data) {
							console.log("DATA ERROR");
						} else {
							const mediaData = {
								event: "media",
								streamSid: data.streamSid,
								media: {
									payload: base64Data,
								},
							};
							this.connection.sendUTF(JSON.stringify(mediaData));
						}
					});

					outputMulaw.on("end", (chunk) => {
						this.isPlaying = false;
						this.isTranscribing = false;
					});
				};
				let service = createNewStream();
				const handleTranscription = debounce(async (transcription) => {
					if (this.isTranscribing || this.isPlaying) {
						return;
					} // add this line to prevent a new transcription
					this.isTranscribing = true;
					log(`Transcription To Be Sent: ${transcription}`);
					let startTime = new Date();

					const text = data.media.payload;
					const voice_id = "21m00Tcm4TlvDq8ikWAM"; // Replace with your voice_id
					const xi_api_key = "18e93f4ca093bd1a3490119df681c2d7"; // Replace with your xi-api-key

					// let toReturn = await this.agent.ask(transcription);
					// console.log("L143 ", toReturn);
					// const openAITEXT = toReturn
					// 	? toReturn?.tool_input
					// 		? toReturn?.tool_input
					// 		: " "
					// 	: "Sorry, I didn't quite get that.";

					// const openAITEXT = toReturn.data.choices[0].text.trim();
					this.isPlaying = true;

					let openAIEnd = new Date();
					let openAITimeDiff = openAIEnd - startTime; // in ms
					openAITimeDiff /= 1000; // convert to seconds
					console.log(
						"TIME TO GENERATE OPENAI RESPONSE",
						openAITimeDiff
					);

					const transcription_start_time = new Date();
					// const configuration = new Configuration({
					// 	apiKey: "cce2f8c2210942e49bce8d2aca73ff50",
					// 	azure: {
					// 		apiKey: "cce2f8c2210942e49bce8d2aca73ff50",
					// 		endpoint: "https://intelligaone.openai.azure.com",
					// 		deploymentName: "GPT4",
					// 		// deploymentName is optional, if you donot set it, you need to set it in the request parameter
					// 	},
					// });
					const configuration = new Configuration({
						apiKey: process.env.OPENAI_API_KEY,
					});
					const openai = new OpenAIApi(configuration);

					const completion = await openai.createCompletion(
						{
							model: "text-davinci-003",
							prompt: transcription,
							stream: true,
							max_tokens: 150,
						},
						{ responseType: "stream" }
					);

					const openStream = completion.data;

					let currWords = [];
					let lastWords = [];
					let queue = [];
					let isPlaying = false;

					// This function will convert text to audio and play it, then set isPlaying to false when it's done
					async function processQueue() {
						while (true) {
							if (!isPlaying && queue.length > 0) {
								console.log(queue);
								const text = queue.shift(); // Dequeue the first item
								isPlaying = true; // Flag the audio as currently playing
								createAudioStream(text).then(() => {
									isPlaying = false;
								}); // Convert to audio and play
								// Reset the flag when done
							} else {
								await new Promise((resolve) =>
									setTimeout(resolve, 10)
								); // Wait 500 ms if there's nothing to process or audio is playing
							}
						}
					}

					// Start the queue processing loop
					processQueue().catch(console.error);
					let wordBuffer = "";
					let wordCount = 0;
					let wordGroupBuffer = [];
					let incompleteFragment = "";

					openStream.on("data", async (chunk) => {
						const payloads = chunk.toString().split("\n\n");
						for (const payload of payloads) {
							if (payload.includes("[DONE]")) return;
							if (payload.startsWith("data:")) {
								const data = JSON.parse(
									payload.replace("data: ", "")
								);
								let token = data.choices[0]?.text;

								if (token) {
									// Prepend any previously-stored fragment to the current token
									token = incompleteFragment + token;
									incompleteFragment = ""; // Reset the fragment

									// If the token does not end with a space, it might be incomplete
									if (!token.endsWith(" ")) {
										// Split the token by its last space into a word and a possible fragment
										const lastSpaceIndex =
											token.lastIndexOf(" ");
										if (lastSpaceIndex != -1) {
											const word = token.substring(
												0,
												lastSpaceIndex
											);
											incompleteFragment =
												token.substring(
													lastSpaceIndex + 1
												);
											token = word;
										}
									} else if (
										token.startsWith(" ") &&
										incompleteFragment
									) {
										// If the token starts with a space, the incomplete fragment was actually a complete word
										wordGroupBuffer.push(
											incompleteFragment.trim()
										);
										wordCount++;
										incompleteFragment = "";
									}

									// Add token to word buffer
									wordBuffer += token;

									// Add the word to the word group buffer

									wordGroupBuffer.push(wordBuffer.trim());
									wordBuffer = ""; // Clear the word buffer for the next word
									wordCount++;

									const totalWords = wordGroupBuffer
										.join(" ")
										.split(" ").length;

									// If 3 words have been added to the buffer, add the group to the queue
									if (totalWords > 2) {
										const wordGroup =
											wordGroupBuffer.join(" ");
										queue.push(wordGroup);
										wordGroupBuffer = []; // Clear the word group buffer for the next group of words
										wordCount = 0;
									}
								}
							}
						}
					});

					openStream.on("end", async () => {
						console.log("Steram ended");
						// setTimeout(() => {
						// 	console.log("\nStream done");
						// 	// res.send({ message: "Stream done" });
						// }, 10000);
						if (wordBuffer.length > 0) {
							queue.push(wordGroupBuffer.join(" "));
							wordBuffer = [];
						}
					});

					openStream.on("error", (err) => {
						console.log(err);
						// res.send(err);
					});

					transcription = "";
					this.intermediateTranscript = "";
					// reset the flag when transcription is done

					let endTime = new Date();

					let timeDiff = endTime - startTime; // in ms
					timeDiff /= 1000; // convert to seconds
					console.log("TIME DIFF ", timeDiff);
				}, 10);
				// service.on("transcription", handleTranscription);
				service.addListener("transcriptReceived", (message) => {
					const data = JSON.parse(message);

					// Write the entire response to the console

					if (data.is_final) {
						this.intermediateTranscript =
							this.intermediateTranscript +
							data?.channel?.alternatives[0]?.transcript;
					}
					console.log(this.intermediateTranscript);

					if (
						data.speech_final &&
						data?.channel?.alternatives[0]?.transcript
					) {
						handleTranscription(this.intermediateTranscript);
					}

					// this.isTranscribing = true;
					// Write only the transcript to the console
					//console.dir(data.channel.alternatives[0].transcript, { depth: null });
				});
				service.addListener("close", (e) => {
					console.log("Connection closed.");
					if (e.reason === "NET-0001") {
						console.log("TIMED OUT \n\n\n\n");
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
			if (!this.isTranscribing && !this.isPlaying) {
				if (this.trackHandlers[track].getReadyState() == 1) {
					this.trackHandlers[track].send(
						Buffer.from(data.media.payload, "base64")
					);
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
			// this.trackHandlers[track].close();
		}
	}
}
dispatcher.onPost("/call", async (req, res) => {
	res.setHeader(
		"Access-Control-Allow-Origin",
		"*"
	); /* @dev First, read about security */
	res.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET");
	res.setHeader("Access-Control-Max-Age", 2592000);
	console.log(req.body);
	const {
		phoneNumber,
		clientName,
		dateOfBirth,
		socialSecurityNumber,
		injuryDescription,
		insurancePolicyNumber,
	} = JSON.parse(req.body);

	let callParams = {
		phoneNumber,
		clientName,
		dateOfBirth,
		socialSecurityNumber,
		injuryDescription,
		insurancePolicyNumber,
	};

	let queryString = Object.keys(callParams)
		.map((key) => key + "=" + encodeURIComponent(callParams[key]))
		.join("&");

	let url = `https://d947-69-42-12-62.ngrok-free.app/twiml?${queryString}`;

	client.calls
		.create({
			url: url,
			to: `+1${phoneNumber}`,
			from: "+18173306146",
		})
		.then((call) => console.log(call.sid))
		.catch((error) => console.error(error));
});

wsserver.listen(HTTP_SERVER_PORT, function () {
	console.log("Server listening on: http://localhost:%s", HTTP_SERVER_PORT);

	let callParams = {
		phoneNumber: "6197872450",
		clientName: "Isaiah",
		dateOfBirth: "0316200",
		socialSecurityNumber: "99",
		injuryDescription: "broken leg",
		insurancePolicyNumber: "99",
	};

	let queryString = Object.keys(callParams)
		.map((key) => key + "=" + encodeURIComponent(callParams[key]))
		.join("&");

	let url = `https://d947-69-42-12-62.ngrok-free.app/twiml?${queryString}`;

	client.calls
		.create({
			url: url,
			to: `+16197872450`,
			from: "+18173306146",
		})
		.then((call) => console.log(call.sid))
		.catch((error) => console.error(error));
});
