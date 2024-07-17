FROM alpine
WORKDIR /work
RUN apk add --no-cache --repository=https://dl-cdn.alpinelinux.org/alpine/edge/community hugo
RUN apk update && apk add hugo asciidoctor
