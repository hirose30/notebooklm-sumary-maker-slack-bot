#!/bin/bash
# Start bot for Workspace 1 only
# This script loads ONLY .env.ws1, ignoring .env

set -a  # automatically export all variables
source .env.ws1
set +a

# Unset any WS2 variables that might have been loaded
unset SLACK_WS2_BOT_TOKEN
unset SLACK_WS2_APP_TOKEN

exec npx tsx src/index.ts
