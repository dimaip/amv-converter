FROM node:20-slim

# Install FFmpeg
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user (required by HF Spaces)
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Copy package files and install dependencies
COPY --chown=user package*.json ./
RUN npm install --omit=dev

# Copy application code
COPY --chown=user . .

# Create directories for uploads with proper permissions
RUN mkdir -p uploads converted

# HF Spaces uses port 7860 by default
ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
