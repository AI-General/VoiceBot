# Twilio

## Install

### Ngrok

- Install ngrok via Apt with the following command:
    ```bash
    curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list && sudo apt update && sudo apt install ngrok
    ```

- Run the following command to add your authtoken to the default ngrok.yml
    ```bash
    ngrok config add-authtoken <Your Ngrok Token>
    ```

- You need to create new domain address in ngrok dash board.
  - Select `Domains` in left panel of dashboard
  - Select `New Domain` in right workspace
  - Write any domain name(e.g. massiveai.ngrok.io) you want and descripton, press continue button.

- Port mapping
    ```bash
    ngrok http --domain=<Domain Address> <Port Number>
    ```
    e.g. ngrok http --domain=massiveai.ngrok.io 3000

### Usage
- Cloning github repo
    ```bash
    git clone https://<your github token>@github.com/Massive-AI/VoiceBot.git
    cd VoiceBot/twilio/
    ```
    It is private repository, so it require authorized token when you clone.

- Edit environment file
    ```bash
    cp .env.example .env
    ```
    
    - `TO_NUMBER` is used when you do outbound call.
    - `NGROK_URL` is your public server url. e.g. massiveai.ngrok.io (**_Don't include http or https_**)
    - `DEEPGRAM_API_KEY` You can create one in [deepgram dashboard](https://console.deepgram.com/project/c69530cb-598c-4476-a4b1-ae772b12f216)
    - `XI_API_KEY` is elevenlabs api key. You can get this in your profiee settings in [elevenlabs.](https://elevenlabs.io/)
    - `OPENAI_API_KEY` 
    - `AZURE_OPENAI_API_KEY` is not used now
    - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` can be gotten in [twilio console.](https://console.twilio.com/)
 
- Running Server
    ```bash
    node server.js
    ```

### _Dockerization will be implemented soon._