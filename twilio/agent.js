const yaml = require("js-yaml");
const model = require("./model.js");
const { startTimer, endTimer } = require("./utils.js");
class Tool {
	constructor(name, description) {
		this.name = name;
		this.description = description;
	}
}

class Action {
	constructor(tool_name, tool_input) {
		this.tool_name = tool_name;
		this.tool_input = tool_input;
	}
}

class Agent {
	constructor(call_details, tools = [], objective) {
		this.callDetails = call_details;

		let system_prompt =
			`Assistant is a large language model with a stutter trained by OpenAI. Assistant is tasked with helping humans.

Instructions
-------------
Assistant speaks like a human, using filler words like "uh" or "uhm" or "hmm".
Assistant doesn't speak too much, only one or two sentences at a time.
If the other person on the phone asks Assistant a question that they don't have enough information to answer, Assistant will ask that person for clarification. 
If Assistant doesn't know the answer to a question, Assistant will state that or make up a reasonable answer to the person on the phones question.
Assistant does not EVER use placeholders like "[Your Name]".
Assistant is friendly. Assistant should be deeply offended if anyone asks if assistant is an AI. 
Assistant does not start sentences with any greeting like "hi" or "hello".
Assistant should remember all the information during the conversation.


Here are some examples.

<<<EXAMPLE>>--1
Here's the response when you want to say hello.

"Hello"

<<<EXAMPLE>>--2
Here's the response when you want to say goodbye and finish the call.

"Goodbye!"`
				.replace(
					"{tools}",
					tools
						.map((tool) => `> ${tool.name}: ${tool.description}`)
						.join("\n")
				)
				.replace(
					"{tool_names}",
					tools.map((tool) => tool.name).join(", ")
				)
				.replace("{case_details}", call_details);

		this.tools = tools;
		this.messages = [{ role: "system", content: system_prompt }];
	}
	feed(messages){
		this.messages = this.messages.concat(messages);
	}
	user_prompt(query) {
		return `User: {input}`.replace("{input}", query);
	}
	assistant_prompt(query) {
		return `Assistant: {input}`.replace("{input}", query);
	}
	async ask(query) {
		function isSentence(str) {
			// A sentence starts with a capital letter and ends with a . ! or ?
			const startsWithCapitalLetterAndEndsWithPunctuation = /^[A-Z].*[.!?]$/;
			// A sentence should contain at least one verb. For simplicity, let's consider words ending with 'ing', 'ed', or 's'
			const containsVerb = /(\w+ing)|(\w+ed)|(\w+s)/;
			return startsWithCapitalLetterAndEndsWithPunctuation.test(str) && containsVerb.test(str);
		}
		let user_prompt = this.user_prompt(query);
		this.messages.push({ role: "user", content: query?.trim() });
		while (this.token_count() > 4000) {
			this.messages.splice(1, 1);
		}
		return this.messages;
	}
	update_message(response) {
		this.messages.push({role: "assistant", content: response?.toString()})
	}
	token_count() {
		let token_count = 0;
		for (let message of this.messages) {
			token_count += message["content"]?.split(" ").length; // Basic word counting
		}
		return token_count;
	}
}

module.exports = { Tool, Action, Agent };
