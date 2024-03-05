const dotenv = require('dotenv');
const { pipeline, Transform } = require("node:stream");

dotenv.config();

const OpenAI_API_Key = process.env.OPENAI_API_KEY;
const OpenAI_API_Base = process.env.OPENAI_API_BASE;
const LLM_MODEL = process.env.LLM_MODEL;

prompt = [
    { role: "user", content: `Tell me whether following sentence is a rude sentence or not. Answer must be True or False. 
Sentence: I am not Johnson.` },
    { role: "assistant", content: "False", },
    { role: "user", content: "Sentence: like fuck you", },
    { role: "assistant", content: "True", },
    { role: "user", content: "Sentence: You are asshole", },
    { role: "assistant", content: "True", },
    { role: "user", content: "Sentence: You are ...", },
]

async function invokeStreamProcess() {
    let response = await fetch(`${OpenAI_API_Base}/chat/completions`, {
        headers: {
            "Content-Type": "application/json", "Authorization": `Bearer ${OpenAI_API_Key}`
        },
        method: "POST",
        body: JSON.stringify({
            model: LLM_MODEL,
            messages: prompt,
            temperature: 0,
            max_tokens: 10,
            stream: false, 
        }),
    });

    // console.log(response);
    if (response.ok) { // Check if the request was successful
        let jsonResponse = await response.json(); // Extract JSON data from the response
        console.log(jsonResponse.choices[0].message.content);
        // Use jsonResponse here - it contains the result you are looking for
    } else {
        // Handle HTTP errors
        console.error("HTTP Error: " + response.status);
    }
}

(async () => {
    await invokeStreamProcess();
})();