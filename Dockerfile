FROM node:alpine
WORKDIR /app/
COPY ./package.json ./
COPY ./yarn.lock ./
RUN yarn
COPY ./dist/ ./dist/
CMD echo "No script selected"