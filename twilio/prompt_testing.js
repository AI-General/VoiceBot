var readline = require('node:readline');
const {Agent, Tool} = require("./agent_testing.js");
const model = require("./model.js");

objective = 'Order pizza for me.'
agent = new Agent('',
    [
        new Tool("Speak", "Talk to the person on the other end of the line"),
        new Tool("Press Buttons", "Press buttons on phone. Each character is a different button."),
        new Tool("Wait", "Wait for the person to continue speaking."),
        new Tool("Hold", "Wait for the new person to come."),
        new Tool("Finish", "Hang up the call."),
        new Tool("Dial", "Dial boss.")
    ], objective);

let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

continuouslyPrompt();

function continuouslyPrompt() {
    rl.question('Enter something: ', async (answer) => {
        await agent.ask(answer);
        let response = await model.chat(agent.messages);
        console.log(response);
        // Continue prompting
        continuouslyPrompt();
    });
}
