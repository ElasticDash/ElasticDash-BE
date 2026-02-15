#!/usr/bin/env expect

# Set timeout to 10 seconds
set timeout 10

# Open file for writing
set outfile [open "temp/claudeOutput.txt" w]

# Spawn claude
spawn claude

# Log the command execution
puts $outfile "Starting claude process...\n"
flush $outfile

# Loop to capture all output until timeout
expect {
    -re "(.+)\r?\n" {
        # Write captured line to file
        puts $outfile $expect_out(0,string)
        flush $outfile
        exp_continue
    }
    -re "(.+)" {
        # Capture partial lines without newlines
        puts $outfile $expect_out(0,string)
        flush $outfile
        exp_continue
    }
    timeout {
        # After 30 seconds, write timeout message and exit
        puts $outfile "\nTimeout reached after 30 seconds."
        flush $outfile
    }
    eof {
        # Handle end of file
        puts $outfile "\nEOF reached - claude process terminated."
        flush $outfile
    }
}

# Close the output file
close $outfile

# Exit with success code
exit 0