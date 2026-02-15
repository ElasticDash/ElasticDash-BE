/**
 * Converts a git diff output to an array of objects with file path, added lines, and removed lines
 * @param {string[]} diffOutput - Array of strings containing git diff output
 * @returns {Array<{path: string, addedLines: string[], removedLines: string[]}>} - Structured array
 */
function convertDiffToArray(diffOutput) {
  const result = [];
  let currentFile = null;
  let addedLines = [];
  let removedLines = [];
  let currentFilePath = null;
  let inHunk = false;

  for (let i = 0; i < diffOutput.length; i++) {
    const line = diffOutput[i];

    // Detect file path
    if (line.startsWith('diff --git')) {
      // Save previous file if it exists
      if (currentFilePath) {
        result.push({
          path: currentFilePath,
          addedLines,
          removedLines
        });
        addedLines = [];
        removedLines = [];
      }

      // Extract new file path from b/... part
      const match = line.match(/diff --git a\/(.*) b\/(.*)/);
      if (match) {
        currentFilePath = match[2];
      }
      inHunk = false;
    } 
    // Skip index and +++ / --- lines
    else if (line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
      continue;
    }
    // Detect hunk header
    else if (line.startsWith('@@')) {
      inHunk = true;
    }
    // In a hunk, capture added and removed lines
    else if (inHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push(line.substring(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removedLines.push(line.substring(1));
      }
    }
  }

  // Add the last file
  if (currentFilePath) {
    result.push({
      path: currentFilePath,
      addedLines,
      removedLines
    });
  }

  return result;
}

// Export the function
module.exports = convertDiffToArray;

// If running directly from command line, process stdin
if (require.main === module) {
  const fs = require('fs');
  
  // Check if file path is provided as argument
  if (process.argv.length > 2) {
    const filePath = process.argv[2];
    const diffContent = fs.readFileSync(filePath, 'utf8').split('\n');
    const result = convertDiffToArray(diffContent);
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Read from stdin
    let input = '';
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    
    process.stdin.on('end', () => {
      const diffContent = input.split('\n');
      const result = convertDiffToArray(diffContent);
      console.log(JSON.stringify(result, null, 2));
    });
  }
}
