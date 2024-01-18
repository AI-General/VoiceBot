const axios = require("axios");
const { Configuration, OpenAIApi } = require("azure-openai");
const { Configuration: Config2, OpenAIApi: OpenAi2 } = require("openai");

const configurationTwo = new Config2({
	apiKey: process.env.OPENAI_API_KEY,
});
const configuration = new Configuration({
	apiKey: process.env.AZURE_OPENAI_API_KEY,
	azure: {
		apiKey: process.env.AZURE_OPENAI_API_KEY,
		endpoint: "https://intelligaone.openai.azure.com",
		deploymentName: "GPT4",
		// deploymentName is optional, if you donot set it, you need to set it in the request parameter
	},
});
// const configuration = new Configuration({
// 	apiKey: "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",
// });
const openai = new OpenAIApi(configuration);
const oai2 = new OpenAi2(configurationTwo);
async function predict(prompt, model = "text-davinci-003", max_tokens = 100) {
	let messages = [{ role: "system", content: prompt }];
	if (model === "gpt-3.5-turbo" || model === "gpt-4") {
		return await chat(messages, model, max_tokens);
	} else if (model === "text-davinci-003") {
		const response = await oai2.createCompletion({
			model: "text-davinci-003",
			prompt: prompt.toString(),
			max_tokens: 4000,
			temperature: 0.2,
		});


		return response.data.choices[0].text.trim();
	}

	return "";
}
async function chat(messages, model = "gpt-4", max_tokens = 3000) {
	try {
	const response = await oai2.createChatCompletion({
		// model: "gpt-3.5-turbo-16k",
		model: "gpt-4",
		messages: messages,
		max_tokens: max_tokens,
		temperature: 1
	});

	return response.data.choices[0].message?.content?.trim()
} catch (error){
	console.log("Model error ", error)
	return "Something has gone wrong."
};
}

async function embed(text) {
	text = text.replace("\n", " ");
	let response = await axios.post(
		`https://api.openai.com/v1/engines/text-embedding-a3da-002/completions`,
		{
			input: [text],
		},
		{
			headers: {
				Authorization: `Bearer ${openai.apiKey}`,
				"Content-Type": "application/json",
			},
		}
	);

	return response.data.data[0].embedding;
}

module.exports = { chat, embed, predict };
