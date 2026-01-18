FROM node:20-slim

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Switch to non-root user (node image already has user with UID 1000)
USER node
WORKDIR /home/node/app

# Copy package files and install dependencies
COPY --chown=node package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY --chown=node . .

# Create directories for uploads with proper permissions
RUN mkdir -p uploads converted

# HF Spaces uses port 7860 by default
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
