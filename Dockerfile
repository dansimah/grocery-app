# Use the official Node.js 18 LTS image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create a non-root user first
RUN addgroup -g 1001 -S botuser && \
    adduser -S botuser -u 1001 -G botuser

# Create data directory and set proper ownership
RUN mkdir -p data && \
    chown -R botuser:botuser /app

# Switch to non-root user
USER botuser

# Expose port (not strictly necessary for a bot, but good practice)
EXPOSE 3000

# Health check (optional)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('Bot is running')" || exit 1

# Start the application
CMD ["node", "index.js"] 