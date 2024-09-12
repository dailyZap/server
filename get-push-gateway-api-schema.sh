#!/bin/bash

source .env

npx @hey-api/openapi-ts -i $PUSH_GATEWAY_URL/swagger.yaml -o src/libs/push-gateway -c @hey-api/client-fetch && yarn format