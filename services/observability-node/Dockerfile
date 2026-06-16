FROM node:20-alpine
WORKDIR /app
COPY services/observability-node/package.json ./
RUN npm install --omit=dev
COPY services/observability-node/index.js ./
EXPOSE 8008
CMD ["npm", "start"]
