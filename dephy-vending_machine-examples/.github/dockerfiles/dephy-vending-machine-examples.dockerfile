FROM alpine:3.21

ARG TARGETPLATFORM

ENV RUST_LOG=info

WORKDIR /opt/dephy-vending-machine-examples
RUN adduser -D dephy --uid 1573 && chown -R dephy:dephy /opt/dephy-vending-machine-examples

COPY ./${TARGETPLATFORM}/dephy-decharge-controller-server /usr/bin/dephy-decharge-controller-server
COPY ./${TARGETPLATFORM}/dephy-decharge-controller-node /usr/bin/dephy-decharge-controller-node
COPY ./${TARGETPLATFORM}/dephy-gacha-controller /usr/bin/dephy-gacha-controller

USER dephy
