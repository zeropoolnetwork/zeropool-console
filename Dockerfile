FROM node
WORKDIR /app
COPY ./src ./src
COPY ./package.json .
COPY ./package-lock.json .
COPY ./tsconfig.json .
COPY ./.parcelrc .
RUN npm install && npm run build

FROM nginx
WORKDIR /usr/share/nginx/html
COPY --from=0 /app/dist .
COPY ./docker/start-nginx.sh /usr/bin/start-nginx.sh
RUN chmod +x /usr/bin/start-nginx.sh
ENTRYPOINT [ "start-nginx.sh" ]
