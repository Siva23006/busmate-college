# BusMate backend container (used by Northflank or any Docker host).
# Build from the repository root so the database migrations are included:
#   docker build -t busmate-api .
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first (cached between builds)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

# App code + SQL migrations (the server applies new migrations on start)
COPY backend ./backend
COPY database ./database

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "src/server.js"]
