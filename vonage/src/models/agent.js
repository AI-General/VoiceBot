class Agent {
    constructor() {
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
`;
        this.messages = [
            // { role: "system", content: system_prompt },
            { role: "user", content: "Hello!" },
            { role: "assistant", content: "Hi, how can I help you today?"}];
    }

    async ask(query) {
        this.messages.push({ role: "user", content: query });
        while (this.token_count() > 4000) {
            this.messages.splice(1, 1);
        }
        return this.messages;
    }

    update_message(response) {
        this.messages.push({ role: "assistant", content: response?.toString() })
    }

    token_count() {
        let token_count = 0;
        for (let message of this.messages) {
            token_count += message["content"]?.split(" ").length; // Basic word counting
        }
        return token_count;
    }
}


module.exports = { Agent };