#!/bin/bash
# Start bot for Workspace 1 only
# Loads unified .env but unsets WS2 variables

set -a  # automatically export all variables
source .env
set +a

# Unset WS2 variables to ensure only WS1 is active
unset SLACK_WS2_BOT_TOKEN
unset SLACK_WS2_APP_TOKEN

# Set workspace identifier for system log separation
export WORKSPACE_ID=ws1

exec npx tsx src/index.ts
