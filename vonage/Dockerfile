# Use the official Node.js 16 image as a parent image
FROM node:18


RUN curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null && echo "deb https://ngrok-agent.s3.amazonaws.com buster main" \
  | tee /etc/apt/sources.list.d/ngrok.list && apt update && apt install ngrok


# Set the working directory within the container
WORKDIR /app

# Copy package.json and package-lock.json (if available) into the container
COPY package*.json ./

# Install dependencies
# Note: Using `npm ci` here is recommended for production builds
RUN npm install

# Copy the rest of your application's code into the container
COPY /src .

# This line copies the .env file into the Docker image
COPY .env.deploy .env
COPY voiceai.key ./ 
COPY start-app.sh ./

# Your application binds to port 3000. Expose this port.
EXPOSE 4000

# Define the command to run your app (this matches your npm start script)
CMD [ "bash", "start-app.sh" ]
