# Workspace 1 Startup Script (Windows PowerShell)

# Load .env.ws1 file
if (Test-Path .env.ws1) {
    Write-Host "Loading .env.ws1..." -ForegroundColor Green
    Get-Content .env.ws1 | ForEach-Object {
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
    Write-Host "ERROR: .env.ws1 file not found!" -ForegroundColor Red
    exit 1
}

# Ensure no WS2 variables leak in
Remove-Item Env:\SLACK_WS2_BOT_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:\SLACK_WS2_APP_TOKEN -ErrorAction SilentlyContinue

Write-Host "Starting Workspace 1..." -ForegroundColor Green
Write-Host "  DB_PATH: $env:DB_PATH" -ForegroundColor Gray
Write-Host "  USER_DATA_DIR: $env:USER_DATA_DIR" -ForegroundColor Gray

# Start bot
npx tsx src/index.ts
