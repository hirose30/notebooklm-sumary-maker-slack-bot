#!/bin/bash
# Start bot for Workspace 2 only
# This script loads ONLY .env.ws2, ignoring .env

set -a  # automatically export all variables
source .env.ws2
set +a

# Unset any WS1 variables that might conflict
# (Note: In .env.ws2, we use WS1 variable names but with WS2 values)

exec npx tsx src/index.ts
