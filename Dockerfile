FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Create directory for collections
RUN mkdir -p Collections

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "src/index.js"]
