FROM node
WORKDIR /app
COPY ./src ./src
COPY ./package.json .
COPY ./package-lock.json .
COPY ./tsconfig.json .
COPY ./tsconfig.prod.json .
COPY ./webpack.config.js .
COPY ./webpack.config.prod.js .
RUN npm install && npm run build:prod

FROM nginx
WORKDIR /usr/share/nginx/html
COPY --from=0 /app/dist .
COPY ./docker/start-nginx.sh /usr/bin/start-nginx.sh
RUN chmod +x /usr/bin/start-nginx.sh
ENTRYPOINT [ "start-nginx.sh" ]
