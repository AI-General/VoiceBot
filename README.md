# VoiceBot

## Config
```bash
cd vonage
cp .env.example .env
```
Configure nessesary enviroments.

## Run
```bash
docker build -t voicebot .
docker run -p 4000:4000 voicebot
```

Or you can use docker compose.
```bash
docker compose up --build
```