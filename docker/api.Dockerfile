FROM node:22-alpine
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm install
COPY apps/api/ ./
RUN npm run build
EXPOSE 4000
CMD ["npm", "start"]
