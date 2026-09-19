const fs = require('fs');
const path = require('path');

const replacements = {
  '#FFD23F': 'var(--ac-yellow)',
  '#FF5C8A': 'var(--ac-pink)',
  '#3DDC84': 'var(--ac-green)',
  '#B980F0': 'var(--ac-purple)',
  '#4D8BFF': 'var(--ac-blue)',
};

const dir = 'c:\\Users\\pavan\\Downloads\\Hackathon\\frontend';

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  for (const [hex, variable] of Object.entries(replacements)) {
    // Escape hash for regex
    const regex = new RegExp(hex, 'gi');
    newContent = newContent.replace(regex, variable);
  }
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

// process index.html
processFile(path.join(dir, 'index.html'));

// process js files
const jsDir = path.join(dir, 'js');
const files = fs.readdirSync(jsDir);
for (const file of files) {
  if (file.endsWith('.js')) {
    processFile(path.join(jsDir, file));
  }
}
