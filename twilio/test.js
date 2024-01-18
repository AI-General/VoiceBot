const { Agent, Action } = require("./agent");

callLog = [
	{
		role: "insurance",
		content:
			"Your call may be recorded or monitored for training, quality assurance, and other purposes. Please press 1 to be connected to the next available communication specialist.",
	},
	{ role: "lawfirm", content: "[Press 1]" },
	{
		role: "insurance",
		content:
			"Thank you for calling. Please remain on the line. Your call will be answered in the order it was received.",
	},
	{ role: "lawfirm", content: "[Hold]" },
	{
		role: "insurance",
		content:
			"Thank you for continuing to hold. Your call will be answered in the order it was received.",
	},
	{ role: "lawfirm", content: "[Hold]" },
	{
		role: "insurance",
		content: "Hi my name is Edith may I have the location code?",
	},
	{
		role: "lawfirm",
		content: "I don't have a location code. I have a policy number.",
	},
	{ role: "insurance", content: "Are you trying to file a claim?" },
	{
		role: "lawfirm",
		content:
			"Yes, I'm trying to file a claim and I'm from the UValle law firm.",
	},
	{
		role: "insurance",
		content: "What type of claim would that be, auto accident?",
	},
	{ role: "lawfirm", content: "Yes it is." },
	{
		role: "insurance",
		content:
			"Do you have the names of the drivers or any individuals involved in the accident?",
	},
	{
		role: "lawfirm",
		content:
			"I have the name of the claimant but I don't have the name of your driver.",
	},
	{ role: "insurance", content: "Ok what is their first and last name?" },
	{ role: "lawfirm", content: "First name is Patrick, last name is Taylor." },
	{
		role: "insurance",
		content: "And the date of the accident, when was it?",
	},
	{ role: "lawfirm", content: "4-10-23" },
	{
		role: "insurance",
		content: "And which state did this accident occur in?",
	},
	{ role: "lawfirm", content: "Ohio." },
	{
		role: "insurance",
		content: "What type of vehicle is your client's vehicle?",
	},
	{ role: "lawfirm", content: "They were in a 2016 toyota subaru." },
	{ role: "insurance", content: "You said you have the insurance policy?" },
	{ role: "lawfirm", content: "Yes." },
	{ role: "insurance", content: "Lets hear that number." },
	{ role: "lawfirm", content: "TCA-P111135-01" },
	{ role: "insurance", content: "And the name on the policy?" },
	{ role: "lawfirm", content: "That is actually unknown." },
	{
		role: "insurance",
		content: "And you said the accident occured in the state of Texas?",
	},
	{ role: "lawfirm", content: "Yes." },
	{
		role: "insurance",
		content:
			"Ok, is there anything else you would like me to include in this report? Any additional comments? Any additional notes? Anything else?",
	},
	{ role: "lawfirm", content: "No, that's it." },
	{
		role: "insurance",
		content:
			"All right. One moment and I'll provide you with a report number.",
	},
	{ role: "lawfirm", content: "Ok." },
	{
		role: "insurance",
		content:
			"And so your report number is the number 1, E as in echo, 0, 1, E as in echo, 0, 1, 4, 2, 3, 2, 3, 0. Is there anything else I can help you with today?",
	},
	{ role: "lawfirm", content: "[Retrieve claim number]" },
];

function wrapYaml(text) {
	if (text.startsWith("[")) {
		text = text.slice(1, -1);
		if (text.startsWith("Press")) {
			return (
				"```yaml\naction: Press Buttons\naction_input: " +
				text.split(" ")[1] +
				"```"
			);
		} else if (text.startsWith("Retrieve")) {
			return "```yaml\naction: Store Case Number\naction_input: N/A```";
		} else if (text.startsWith("Hold")) {
			return "```yaml\naction: Wait\naction_input: N/A```";
		}
	}

	return "```yaml\naction: Speak\naction_input: " + text + "```";
}

async function test() {
	const caseDetails = `
Client's Name: Patrick Taylor
Date of Birth: Unknown
Social Security Number: Unknown
Injury Description:
    * Automobile accident
    * Claimant was in a 2016 toyota subaru
    * Accident occured in Ohio
    * Accident occured on 04/10/23
Insurance Policy Number: TCA-P111135-01
    `;

	const tools = [
		{ name: "Speak", description: "Talk to the insurance agent." },
		{
			name: "Press Buttons",
			description:
				"Press buttons on phone. Each character is a different button.",
		},
		{
			name: "Store Case Number",
			description: "Store the claim number for later use.",
		},
		{
			name: "Wait",
			description: "Wait for the insurance agent to continue speaking.",
		},
	];

	for (let index = 0; index < callLog.length; index++) {
		if (callLog[index].role === "lawfirm") {
			continue;
		}

		const callAgent = new Agent(caseDetails, tools);

		const conversation = callAgent.messages;
		for (let i = 0; i < index; i++) {
			if (callLog[i].role === "lawfirm") {
				conversation.push({
					role: "assistant",
					content: wrapYaml(callLog[i].content),
				});
			} else {
				conversation.push({
					role: "user",
					content: callAgent.user_prompt(callLog[i].content),
				});
			}
		}

		callAgent.messages = conversation;
		const response = await callAgent.ask(callLog[index].content);

		if (index > 0) {
			console.log("Previous Message: " + callLog[index - 1].content);
		}

		console.log("Current Message: " + callLog[index].content);
		console.log(
			"Generated Next Message: " + JSON.stringify(response, null, 2)
		);
		console.log("Expected Next Message: " + callLog[index + 1].content);

		await new Promise((resolve) => setTimeout(resolve, 2000));

		console.log("\n\n\n");
	}
}

// Call the test function
test();
