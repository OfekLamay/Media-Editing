# 1. Using an official Node.js image as the base image
FROM node:20-slim

# 2. Setting the working directory inside the container
WORKDIR /usr/src/app

# 3. Copying package files first (for efficient layer caching)
COPY package*.json ./

# 4. Installing dependencies
RUN npm install

# 5. Copying the rest of the source code into the container
COPY . .

# 6. Building the TypeScript to JavaScript (dist directory)
RUN npm run build

# 7. Setting the port the server listens on
EXPOSE 3003

# 8. Command to run the server
CMD ["npm", "start"]