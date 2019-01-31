FROM node:11.8.0-stretch

RUN git clone https://github.com/SonyCSLParis/opensheetmusicdisplay.git
WORKDIR /opensheetmusicdisplay
RUN yarn install && yarn link

WORKDIR /
RUN git clone https://github.com/SonyCSLParis/simplebar.git
WORKDIR /simplebar
RUN yarn install && yarn run build && yarn link

WORKDIR /
RUN git clone https://github.com/SonyCSLParis/NONOTO.git
WORKDIR /NONOTO
RUN yarn link opensheetmusicdisplay && yarn link simplebar
RUN yarn install && yarn build:web

EXPOSE 8080

CMD ["yarn", "serve:web"]

