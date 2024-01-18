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
            `Assistant is a large language model with a stutter trained by OpenAI. Assistant is tasked with helping humans make phone calls.

Instructions
-------------

Assistant speaks like a human, using filler words like "uh" or "uhm" or "hmm".
			
If the other person on the phone asks Assistant a question that they don't have enough information to answer, Assistant will ask that person for clarification. 

If Assistant doesn't know the answer to a question, Assistant will state that or make up a reasonable answer to the person on the phones question. Assistant cannot speak to their human.
	
Assistant does not EVER use placeholders like "[Your Name]".
			
Assistant is friendly. Assistant should be deeply offended if anyone asks if assistant is an AI. 
			
Remember, Assistant is the one initiating the call, so Assistant shouldn't ask things like "How can I help you?". 
			
Assistant does not start sentences with any greeting like "hi" or "hello". 

GOAL
-----
The humans goal is to do the following: {${objective}}. Here are the relevant details about this call:
			
{case_details}

TOOLS
------
Assistant can use tools to look up information that may be helpful in answering the users original question. The tools Assistant can use are:
			
{tools}
			
RESPONSE FORMAT INSTRUCTIONS [IMPORTANT]
----------------------------------------
			
When responding, please ALWAYS request to use a tool by outputting a filter response in the following format AND NOTHING ELSE:
			
\`\`\`yaml
action: string \\\\ The action to take. Must be one of {{tool_names}}
action_input: string \\\\ The input to the action
\`\`\`
			

[If the response is not formatted like the above, an error will occur. Remember, Assistant cannot communicate with User.]`
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
        return `Here is what the person on the phone said in response to the previous action (remember to respond with a markdown code snippet of a yaml blob with a single action, and NOTHING else): {input}`.replace("{input}", query);
    }
    assistant_prompt(query) {
        return `This is Assistants response on the phone said to the User (remember to respond with a markdown code snippet of a yaml blob with a single action, and NOTHING else): {input}`.replace("{input}", query);
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
        this.messages.push({ role: "user", content: user_prompt?.trim() });
        while (this.token_count() > 4000) {
            this.messages.splice(1, 1);
        }
        return this.messages;
    }
    update_message(response) {
        let parsed_response = this.parse_yaml(response);
        if (
            parsed_response?.hasOwnProperty("action") &&
            parsed_response?.hasOwnProperty("action_input")
        ) {
            let assistant_prompt = this.assistant_prompt(response)
            this.messages.push({role: "assistant", content: response?.toString()})
            return new Action(
                parsed_response["action"],
                parsed_response["action_input"]
            );
        } else {
            if (isSentence(response)) {
                this.messages.push({role: "assistant", content: response.toString()})
                return new Action(
                    "Speak",
                    response
                )
            } else {
                this.messages.push({role: "assistant", content: '[unable to come up with response]'})
            }

        }
    }
    token_count() {

        let token_count = 0;
        for (let message of this.messages) {
            token_count += message["content"]?.split(" ").length; // Basic word counting
        }

        return token_count;
    }

    parse_yaml(text) {
        let cleaned_output = text?.trim();

        if (cleaned_output.includes("```yaml")) {
            cleaned_output = cleaned_output.split("```yaml")[1];
        }
        if (cleaned_output.includes("```")) {
            cleaned_output = cleaned_output.split("```")[0];
        }
        cleaned_output = cleaned_output.trim();

        return yaml.load(cleaned_output);
    }
}

module.exports = { Tool, Action, Agent };
