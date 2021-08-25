#!/bin/bash
set -euo pipefail

bash scripts/docker/build.sh

docker login --username $DOCKER_USER --password $DOCKER_PASSWORD
docker push --all-tags "contember/contember"
docker push --all-tags "contember/cli"
