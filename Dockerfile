FROM node:22-slim

WORKDIR /app
COPY package*.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
RUN npm install --omit=dev --workspace backend --workspace shared

COPY shared shared
COPY backend backend

ENV NODE_ENV=production
ENV PORT=7860
EXPOSE 7860

CMD ["npm", "--workspace", "backend", "start"]
