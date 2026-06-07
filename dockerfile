FROM node:lts-alpine 

WORKDIR /app

COPY ./dist ./
COPY package*.json ./

RUN npm install

CMD ["node", "index.js"]