FROM node:16.15.0-alpine3.15
WORKDIR /app/
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn
COPY ./dist/ ./dist/
COPY ./src/ ./src/
CMD echo "No script selected"