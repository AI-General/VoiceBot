// const fetch = require("node-fetch");
const {createParser} = require('eventsource-parser');
const {Transform, pipeline} = require('node:stream');
const fs = require('node:fs');

function generatePrompt(prompt) {
    return [
        {
            "role": "system",
            "content": "The following is a conversation with an AI assistant. The assistant is helpful, creative, clever, and very friendly."
        },
        {"role": "user", "content": "Hello, who are you?"},
        {"role": "system", "content": `I am an AI created by OpenAI. How can I help you today?`},
        {"role": "user", "content": `${prompt}`},
    ]
}

async function invokeChatCompletion() {
    let response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer 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`
            },
            method: "POST",
            body: JSON.stringify({
                model: "gpt-4",
                messages: generatePrompt("Tell me about python in detail in AI area."),
                temperature: 0.75,
                top_p: 0.95,
                // stop: ["\n\n"],
                frequency_penalty: 0,
                presence_penalty: 0,
                max_tokens: 500,
                stream: true,
                n: 1,
            }),
        }
    );
    let fullResp = '';
    const generator = pipeline(
        response.body,
        new Transform({
           transform(chunk, encoding, callback) {
               for (const data of chunk.toString().split('\n')){
                   if (data) {
                        this.push(data.slice(6));
                   }
               }
               callback();
           }
        }),
        new Transform({
            construct(callback) {
                this.isActionPart = false;
                this.partialResp = '';
                callback();
            },
            transform(chunk, encoding, callback) {
                if (chunk.toString() !== `[DONE]`) {
                    const content = JSON.parse(chunk).choices[0].delta?.content || "";
                    // console.log("=========" + JSON.stringify(content));
                    fullResp += content;
                    if ((content === '.' || content === '!' || content === '?' || content.includes('\n')) && this.partialResp !== '') {
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
                            this.partialResp = ''
                        } else {
                            this.partialResp += content;
                        }
                    }
                } else {
                    this.push(this.partialResp);
                }
                callback();
            }
        }),
        (err) => {
            if (err) {
                console.error('failed', err);
            } else {
                console.log('completed');
            }
        },
    );
    for await (const value of generator){
        console.log("####################" + JSON.stringify(value.toString().trim()));
    }
}
invokeChatCompletion()
