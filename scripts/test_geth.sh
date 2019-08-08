#!/usr/bin/env bash

# Exit script as soon as a command fails.
set -o errexit

source "$(dirname $0)/start_geth.sh"
RPC_PORT=$geth_port yarn mocha --timeout 60000 "$@"
