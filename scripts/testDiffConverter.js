// Sample diff content from the provided input
const sampleDiff = [
  'diff --git a/controller/database/repository.js b/controller/database/repository.js',
  'index 85f831e..01a5bf7 100644',
  '--- a/controller/database/repository.js',
  '+++ b/controller/database/repository.js',
  "@@ -6,6 +6,8 @@ import { promptIdentifierClaude, optimizedPromptTemplate } from '../../src/const",
  " import AWS from 'aws-sdk';",
  " import { getObject, getObjectInString } from '../general/file';",
  " import { messageNotificationSender } from '../general/emailsender';",
  "+import fs from 'fs';",
  "+import path from 'path';",
  ' ',
  " AWS.config.update({ region: 'us-east-1' });",
  ' const sqs = new AWS.SQS();',
  '@@ -197,7 +199,9 @@ export const generatePromptWithClaudeAi = async (repoUrl, prompt, changedFiles)',
  '             status: 500,',
  "             message: 'Failed to locate relevant items with Claude AI'",
  '         };',
  '-    })',
  '+    });',
  '+',
  "+    fs.writeFileSync(path.join(__dirname, '../../temp/relevantItems.md'), relevantItems);"
];

const convertDiffToArray = require('./convertDiffToArray');
const result = convertDiffToArray(sampleDiff);

console.log(JSON.stringify(result, null, 2));
