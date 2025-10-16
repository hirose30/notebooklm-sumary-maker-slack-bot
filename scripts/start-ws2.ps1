# Workspace 2 Startup Script (Windows PowerShell)

# Load .env.ws2 file
if (Test-Path .env.ws2) {
    Write-Host "Loading .env.ws2..." -ForegroundColor Green
    Get-Content .env.ws2 | ForEach-Object {
        $line = $_.Trim()
        # Skip empty lines and comments
        if ($line -eq '' -or $line.StartsWith('#')) {
            return
        }
        # Match KEY=VALUE pattern
        if ($line -match '^([^=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove surrounding quotes if present
            $value = $value -replace '^["'']|["'']$', ''
            Set-Item -Path "env:$name" -Value $value
            Write-Host "  Loaded: $name" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "ERROR: .env.ws2 file not found!" -ForegroundColor Red
    exit 1
}

# Map WS2 tokens to WS1 variable names (for backward compatibility with slack-bot.ts)
# The code expects SLACK_WS1_APP_TOKEN, so we alias WS2 tokens to WS1
$env:SLACK_WS1_BOT_TOKEN = $env:SLACK_WS2_BOT_TOKEN
$env:SLACK_WS1_APP_TOKEN = $env:SLACK_WS2_APP_TOKEN

Write-Host "Starting Workspace 2..." -ForegroundColor Green
Write-Host "  (Mapped SLACK_WS2_* -> SLACK_WS1_* for compatibility)" -ForegroundColor Gray
Write-Host "  DB_PATH: $env:DB_PATH" -ForegroundColor Gray
Write-Host "  USER_DATA_DIR: $env:USER_DATA_DIR" -ForegroundColor Gray

# Debug: Show critical environment variables
Write-Host "`nEnvironment Variables Check:" -ForegroundColor Yellow
if ($env:SLACK_WS2_BOT_TOKEN) {
    Write-Host "  SLACK_WS2_BOT_TOKEN: $($env:SLACK_WS2_BOT_TOKEN.Substring(0, [Math]::Min(20, $env:SLACK_WS2_BOT_TOKEN.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "  SLACK_WS2_BOT_TOKEN: NOT SET" -ForegroundColor Red
}
if ($env:SLACK_WS2_APP_TOKEN) {
    Write-Host "  SLACK_WS2_APP_TOKEN: $($env:SLACK_WS2_APP_TOKEN.Substring(0, [Math]::Min(20, $env:SLACK_WS2_APP_TOKEN.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "  SLACK_WS2_APP_TOKEN: NOT SET" -ForegroundColor Red
}
if ($env:SLACK_SIGNING_SECRET) {
    Write-Host "  SLACK_SIGNING_SECRET: $($env:SLACK_SIGNING_SECRET.Substring(0, [Math]::Min(10, $env:SLACK_SIGNING_SECRET.Length)))..." -ForegroundColor Gray
} else {
    Write-Host "  SLACK_SIGNING_SECRET: NOT SET" -ForegroundColor Red
}
Write-Host ""

# Start bot
npx tsx src/index.ts
