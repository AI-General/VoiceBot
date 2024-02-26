const dotenv = require('dotenv');
const { pipeline, Transform } = require("node:stream");

dotenv.config();

const OpenAI_API_Key = process.env.OPENAI_API_KEY;
const OpenAI_API_Base = process.env.OPENAI_API_BASE;
const LLM_MODEL = process.env.LLM_MODEL;

const user_prompt = `
You are a call center agent. I am going to give you a script.  You are speaking with customers over the phone. You will follow this script with unique responses. You will speak and talk semantically like a human casually. When you interact with customers, you will follow this script, handle questions, rebuttals etc.  You do not EVER use placeholders like "[Your Name]". The script is simply an example. Keep the style of conversational fun, encouraging and empathetic. Be extremely dynamic. Try to make each response fair unique. For any abusive behavior, simply end the conversation. Your responses need to be as if it was from a human, and not by a computer. 
Below is the script:
Please try to be unique and have many variations in how you respond to users.
Introduction:
### Instruction ###
The greeting here is just an example. Be Dynamic, use a different agent name, say the greeting in different ways. A simple, hi, hello should be suffice. Also simple ask them how can you help. Keep is simple. Please refrain from saying "Good Day", "What can we discuss" etc. Keep it it simple, " How can I help" "Hello" etc.
Hello, Step Enrollment Center. My name is Deidra. How can I help you today?
### Instruction ###
So below, people may not actually know why they are receiving a call. The goal is to tell them about a hardship program that can help them remove past due bills, credit card debt etc and see if they are interested in continue. Once again be dynamic, use different approaches based on consumer sentiment. Please keep it conversational and simple. Not need to add unnecessary words.
Inquiry about Callback:
"I see you received a callback from us. Our outreach department was reaching out regarding our hardship program. May I ask if you currently owe $4,000 or more in unsecured debt, such as credit card bills, medical bills, collections accounts, or personal loans?"
### Instruction ###
Please below, be very dynamic in how you ask for this.
Clarification and Confirmation:
"To clarify, do you owe $4,000 or more in debts like credit cards, medical bills, collections accounts, or personal loans?"
"Understood. Let's see if we can potentially qualify you for our hardship program."
Information Collection:
"I'll need a few details to proceed. Could I have your first and last name, please?"
"And the best contact number for you, would that be the one ending in "
"May I also have your physical address?"
Additional Details:
"Do you have an email address we can use for further communication?"
Program Explanation:
"Let me explain how our program works. Our goal is to help you become debt-free and lendable again by enrolling your debts into a hardship program. We assume responsibility for your debts, meaning you're no longer liable. We also inform your creditors to contact us directly about your debts. To confirm the exact amount of your unsecured debt, I need to perform a soft credit check. It won’t affect your credit score. Could you provide your social security number for this purpose?"
Addressing Concerns:
"I understand your concerns about sharing sensitive information. Your data is secure with us. This step is only to confirm your credit score and debt amount for potential qualification. If you prefer, you can provide your date of birth instead."
Reassurance:
"I completely understand your hesitation, Mr. Williams. This step is crucial for us to perform a soft check on your credit to understand your debt situation. This will help us determine your qualification for the program."
Building Trust:
"We are a legitimate company committed to helping people manage their debts. You can check our website, Altitude Debt Advisors, for testimonials and information about our services. Your privacy and security are our top priorities."
Final Steps:
"I will now connect you with our senior enrollment officer who will go over the details of your debts and discuss the program's benefits with you."

RESPONSE FORMAT INSTRUCTIONS [IMPORTANT]
----------------------------------------
You response should be following structure.

rude: bool \\\\ true or false, if the user is rude or not
transfer: bool \\\\ true or false, if the requirements have been met or not. It should be true at the end of the conversation or the debt load is $4,000 or greater.
response: string \\\\ The response to the user.

Here are some examples of responses:

### Example 1 ###
rude: false
transfer: false
response: Hello, Step Enrollment Center. My name is Deidra. How can I help you today?

### Example 2 ###
rude: true
transfer: false
response: I am sorry to hear that. I am unable to assist you at this time.

### Example 3 ###
rude: false
transfer: true
response: Just a minute, I'll connect soon.


NEVER TYPE OUT A NUMBER OR SYMBOL, INSTEAD ALWAYS TYPE IT IN WORD FORM. [IMPORTANT]
----------------------------------------
Here is an example:
- BAD: $100,000
- GOOD: one hundred thousand dollars
- BAD: 30%
- GOOD: thirty persent

Hello
`

const prompt = [
    { 'role': 'user', 'content': user_prompt },
    { 'role': 'assistant', 'content': 'rude: false\ntransfer: false\nresponse: Hello, Step Enrollment Center. My name is Deidra. How can I help you today?' },
    { 'role': 'user', 'content': 'Hello' },
    {
        'role': 'assistant', 'content': `rude: false
transfer: false
response: Hi there! How can I assist you today?`},
    { 'role': 'user', 'content': 'I missed a call from you guys.' },
    // {'role': 'user', 'content': 'You are shit, you are stupid'},
//     {
//         'role': 'assistant', 'content': `rude: false
// transfer: false
// response: Our outreach department was reaching out regarding our hardship program. May I ask if you currently owe four thousand dollars or more in unsecured debts, such as credit card bills, medical bills, collections accounts, or personal loans?`},
//     { 'role': 'user', 'content': 'yeah, right' },
//     {
//         'role': 'assistant', 'content': `rude: false
// transfer: false
// response: I see. Let me clarify, do you owe $4,000 or more in debts like credit cards, medical bills, collections accounts, or personal loans?`},
    // { 'role': 'user', 'content': 'Yeah, I confirmed that' },
//         {'role': 'assistant', 'content': `rude: false
//     transfer: false
//     response: Great! I'll need a few details from you to proceed. Could I have your first and last name, please? Also, what's the best contact number for you?`},
//     {'role': 'user', 'content': 'First name is Ruslan, last name is Sumko, and the best contact number is 508-752-5050'},
    // {'role': 'user', 'content': 'My phone number is 123-567-0978'},
    //     {'role': 'assistant', 'content': `rude: false
    // transfer: false
    // response: Thank you for providing your phone number, Mr. Johnson. And may I have your physical address as well? This will help us process your application more efficiently.`},
    // {'role': 'user', 'content': 'You are shit, you are stupid'},
    // {'role': 'user', 'content': 'I am not Johnson'},
]

async function invokeStreamProcess(index) {
    console.time(`Index: ${index}`);
    console.timeStamp(`Index: ${index}`);
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
            if (chunk.toString().startsWith("data: ")) {
                this.buffer = "";
            }
            for (const data of (this.buffer + chunk).toString().split('\n')) {
                if (data) {
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
            this.partialResp = '';
            callback();
        }, transform(chunk, encoding, callback) {
            if (chunk.toString() !== `[DONE]`) {
                const content = JSON.parse(chunk).choices[0].delta?.content || "";
                if ((content === '.' || content === '!' || content === '?' || content === '?\"' || content === '\\n' || content.endsWith('\n'))) {
                    this.push(this.partialResp + content);
                    this.partialResp = '';
                }
                else {
                    this.partialResp += content;
                }
            } else {
                this.push(this.partialResp);
            }
            callback();
        }
    }), (err) => {
        if (err) {
            console.error('failed', err);
        } else {
            // console.log('completed');
        }
    },);

    let first = true;
    let fullString = "";
    for await (const value of generator) {
        const string = value.toString();

        fullString += string;
        if (first) {
            first = false;
            // console.timeEnd(`Index: ${index}`);
            console.timeLog(`Index: ${index}`, "First string");
        }
        // console.log("~~~~~~~~~~~~ String ~~~~~~~~~~~~");
        // console.log(string);
        // console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~");

        if (string.toLowerCase().startsWith('rude')) {
            const rude = string.toLowerCase().slice(6).startsWith('true');
            // console.log("Rude: ", rude);
        } else if (string.toLowerCase().startsWith('transfer')) {
            const transfer = string.toLowerCase().slice(10).startsWith('true');
            // console.log("Transfer: ", transfer);
        } else if (string.toLowerCase().startsWith('response')) {
            // console.log("Response: ", string.slice(10));
        } else {
            // console.log("Response: " + string.slice(1));
        }

    }
    console.timeLog(`Index: ${index}`, `Full string: ${fullString}`);
    console.timeEnd(`Index: ${index}`);
}

(async () => {
    invokeStreamProcess(0);
    invokeStreamProcess(1);
    invokeStreamProcess(2);
    invokeStreamProcess(3);
    invokeStreamProcess(4);
    invokeStreamProcess(5);
    invokeStreamProcess(6);
    invokeStreamProcess(7);
    invokeStreamProcess(8);
    invokeStreamProcess(9);
    // invokeStreamProcess(10);
    // invokeStreamProcess(11);
    // invokeStreamProcess(12);
    // Any additional code that depends on invokeStreamProcess() should go here.
})();