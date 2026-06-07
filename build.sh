#!/bin/bash

npm run build
echo "Building TS Build"

docker build -t cex-spot-eng .
echo "Docker Image Build"

