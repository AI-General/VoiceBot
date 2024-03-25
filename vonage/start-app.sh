#!/bin/sh

# Load environment variables from .env file
export $(cat .env | xargs)
# set -a; source .env; set +a

# Authenticate ngrok
# echo $NGROK_TOKEN
ngrok authtoken $NGROK_TOKEN

# Start ngrok and expose the desired port
ngrok http --domain=vonagebot.ngrok.dev 4000 &

# Start your application
node app.js

# Keep the script running
# wait
