FROM node:16
WORKDIR /app
COPY . .
RUN npm install && npm run build:prod

FROM nginx
WORKDIR /usr/share/nginx/html
COPY --from=0 /app/dist .
COPY ./docker/start-nginx.sh /usr/bin/start-nginx.sh
RUN sed -i 's/gzip_http_version 1.1;/gzip_http_version 1.0;/g' /etc/nginx/conf.d/default.conf
RUN chmod +x /usr/bin/start-nginx.sh
ENTRYPOINT [ "start-nginx.sh" ]
