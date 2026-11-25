
FROM node:24-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["npm", "run", "server"]
