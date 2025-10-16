# NotebookLM Login Script for Workspace 1 (Windows PowerShell)

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

# Set USER_DATA_DIR
$env:USER_DATA_DIR = "./user-data-ws1"
Write-Host "USER_DATA_DIR set to: $env:USER_DATA_DIR" -ForegroundColor Green

# Run login script
Write-Host "Starting NotebookLM login..." -ForegroundColor Green
npm run notebooklm:login
