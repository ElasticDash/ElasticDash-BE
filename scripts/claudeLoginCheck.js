// import { exec } from 'child_process';
import { generalEmailSender } from '../controller/general/emailsender.js';
import path from 'path';
// import fs from 'fs';
import { fileURLToPath } from 'url';

// // Get the directory name of the current module
// const __dirname = path.dirname(fileURLToPath(import.meta.url));

// // Function to check if Claude Code is logged in
// export function checkClaudeLogin() {
//   const scriptPath = path.join(__dirname, 'claudeLoginCheck.sh');
//   const textPath = path.join(__dirname, '../temp/claudeOutput.txt');
  
//   exec(scriptPath, (error, stdout, stderr) => {
//     console.log('stdout:', stdout);
    
//     if (error) {
//       console.error(`Error executing script: ${error.message}`);
//       notifyLoginIssue('Error executing Claude Code command');
//       return;
//     }
    
//     // Check if claudeOutput.txt exists and contains "/help for help"
//     fs.access(textPath, fs.constants.F_OK, (err) => {
//       if (err) {
//         // File does not exist
//         notifyLoginIssue('Claude Code output file not found');
//         return;
//       }
      
//       // File exists, now check its contents
//       fs.readFile(textPath, 'utf8', (err, data) => {
//         if (err) {
//           notifyLoginIssue(`Error reading Claude Code output: ${err.message}`);
//           return;
//         }
        
//         if (
//           !data.includes("/help for help") &&
//           !data.includes("Do you trust the files in this folder?")
//         ) {
//           notifyLoginIssue('Claude Code is not logged in');
//           return;
//         }

//         console.log('Claude Code is logged in');
//         return;
//       });
//     });
//   });
// }

// Function to send notification email
function notifyLoginIssue(message) {
  const subject = '[ElasticDash] Claude Code Login Alert';
  const html = `
    <h2>Claude Code Login Issue</h2>
    <p>${message}</p>
    <p>Please login to Claude Code using 'claude login' command.</p>
    <p>This is an automated notification from your system.</p>
  `;
  
  generalEmailSender('terryjiang1996@gmail.com', subject, html);
}

// Now executed from index.js on startup and hourly