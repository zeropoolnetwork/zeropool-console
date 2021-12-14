FROM node
WORKDIR /app
COPY ./src ./src
COPY ./package.json .
COPY ./yarn.lock .
COPY ./tsconfig.json .
COPY ./.parcelrc .
RUN yarn && yarn build

FROM nginx
WORKDIR /usr/share/nginx/html
COPY --from=0 /app/dist .
COPY ./docker/start-nginx.sh /usr/bin/start-nginx.sh
RUN chmod +x /usr/bin/start-nginx.sh
ENTRYPOINT [ "start-nginx.sh" ]
