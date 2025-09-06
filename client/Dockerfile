# Frontend Dockerfile for development
FROM node:18-alpine

WORKDIR /app

# Copy package files (build context is repo root)
COPY package*.json ./
COPY client/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client .

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
