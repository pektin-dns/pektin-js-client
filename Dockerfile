FROM node:alpine
WORKDIR /app/
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn
COPY ./dist/ ./dist/
COPY ./src/ ./src/
CMD echo "No script selected"