ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine
WORKDIR /usr/src/app

# Copy dependency manifests first so npm install can be cached.
COPY package*.json ./
RUN npm ci --omit=dev

# Copy app code after dependencies to preserve the cached npm layer.
COPY . .
EXPOSE 80
CMD ["node", "index.js", "80"]
