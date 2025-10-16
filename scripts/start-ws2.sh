#!/bin/bash
# Start bot for Workspace 2 only
# This script loads ONLY .env.ws2, ignoring .env

set -a  # automatically export all variables
source .env.ws2
set +a

# Map WS2 tokens to WS1 variable names (for backward compatibility with slack-bot.ts)
# The code expects SLACK_WS1_APP_TOKEN, so we alias WS2 tokens to WS1
export SLACK_WS1_BOT_TOKEN="$SLACK_WS2_BOT_TOKEN"
export SLACK_WS1_APP_TOKEN="$SLACK_WS2_APP_TOKEN"

exec npx tsx src/index.ts
