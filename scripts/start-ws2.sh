#!/bin/bash
# Start bot for Workspace 2 only
# Loads unified .env but unsets WS1 variables and maps WS2 to WS1

set -a  # automatically export all variables
source .env
set +a

# Unset WS1 variables to ensure only WS2 is active
unset SLACK_WS1_BOT_TOKEN
unset SLACK_WS1_APP_TOKEN

# Map WS2 tokens to WS1 variable names (for backward compatibility with slack-bot.ts)
# The code expects SLACK_WS1_APP_TOKEN for Socket Mode connection
export SLACK_WS1_BOT_TOKEN="$SLACK_WS2_BOT_TOKEN"
export SLACK_WS1_APP_TOKEN="$SLACK_WS2_APP_TOKEN"

# Set workspace identifier for system log separation
export WORKSPACE_ID=ws2

exec npx tsx src/index.ts
