# 1. Using an official Node.js image as the base image
FROM node:20-slim

# 2. Installing ffmpeg for video processing
# To ensure that ffmpeg is available in the container, we update the package
# list, install ffmpeg, and then clean up to reduce the image size.
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 3. Setting the working directory inside the container
WORKDIR /usr/src/app

# 4. Copying package files first (for efficient layer caching)
COPY package*.json ./

# 5. Installing dependencies
RUN npm install

# 6. Copying the rest of the source code into the container
COPY . .

# 7. Building the TypeScript to JavaScript (dist directory)
RUN npm run build

# 8. Setting the port the server listens on
EXPOSE 3003

# 9. Command to run the server
CMD ["npm", "start"]