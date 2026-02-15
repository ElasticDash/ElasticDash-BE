#!/bin/bash

# Get the absolute path of the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CLAUDE_CHECK_SCRIPT="$PROJECT_DIR/scripts/claudeLoginCheck.js"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js to run this cron job."
    exit 1
fi

# Make script executable
chmod +x "$CLAUDE_CHECK_SCRIPT"

# Create a temporary file for the crontab
TEMP_CRONTAB=$(mktemp)

# Export existing crontab
crontab -l > "$TEMP_CRONTAB" 2>/dev/null

# Check if the cron job already exists
if grep -q "claudeLoginCheck.js" "$TEMP_CRONTAB"; then
    echo "Claude login check cron job already exists."
else
    # Add new cron job to run every hour
    echo "# Check Claude Code login status every hour" >> "$TEMP_CRONTAB"
    echo "0 * * * * cd $PROJECT_DIR && /usr/local/bin/node $CLAUDE_CHECK_SCRIPT >> $PROJECT_DIR/logs/claude-login-check.log 2>&1" >> "$TEMP_CRONTAB"
    
    # Install the new crontab
    crontab "$TEMP_CRONTAB"
    echo "Claude login check cron job has been added to run every hour."
    
    # Create logs directory if it doesn't exist
    mkdir -p "$PROJECT_DIR/logs"
fi

# Clean up temporary file
rm "$TEMP_CRONTAB"

echo "Setup complete. The script will check Claude Code's login status every hour."
echo "Logs will be written to $PROJECT_DIR/logs/claude-login-check.log"