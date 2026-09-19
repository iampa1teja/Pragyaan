const fs = require('fs');
const path = require('path');

const indexHtmlPath = 'c:\\Users\\pavan\\Downloads\\Hackathon\\frontend\\index.html';
let html = fs.readFileSync(indexHtmlPath, 'utf8');

// h2 tracking-tight
html = html.replace(/<h2([^>]*)class="([^"]*)"/g, (match, before, classes) => {
    if (!classes.includes('tracking-tight')) {
        return `<h2${before}class="${classes} tracking-tight"`;
    }
    return match;
});

// Studio landing cards & buttons
// Character Design card is first, so we'll just replace the specific text
html = html.replace(/bg-\[var\(--ac-purple\)\]([\s\S]*?)Create Character/g, 'bg-[var(--ac-pink)]$1Generate Character');
html = html.replace(/Create Concept Art/g, 'Generate Concept Art');

// #studio-preview min-h
html = html.replace(/min-h-\[280px\]/g, 'min-h-[420px]');

// Studio grid layout
html = html.replace(/lg:grid-cols-2/g, 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]');

// Save button
html = html.replace(/⤓ Save Image/g, '⤓ Save to Assets');

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('Updated index.html');

// layout.js
const layoutJsPath = 'c:\\Users\\pavan\\Downloads\\Hackathon\\frontend\\js\\layout.js';
if (fs.existsSync(layoutJsPath)) {
    let layoutJs = fs.readFileSync(layoutJsPath, 'utf8');
    layoutJs = layoutJs.replace(/if \(!leftSidebar \|\| !rightSidebar\) return;/g, 'if (!leftSidebar) return;');
    
    // Guard rightSidebar uses
    layoutJs = layoutJs.replace(/rightSidebar\.classList/g, 'rightSidebar?.classList');
    
    fs.writeFileSync(layoutJsPath, layoutJs, 'utf8');
    console.log('Updated layout.js');
}

// studio.js
const studioJsPath = 'c:\\Users\\pavan\\Downloads\\Hackathon\\frontend\\js\\studio.js';
if (fs.existsSync(studioJsPath)) {
    let studioJs = fs.readFileSync(studioJsPath, 'utf8');
    
    // ACCENT definition is already updated by the hex replacer, but we need to ensure character is pink, concept is green
    // Wait, let's just rewrite the ACCENT constant to be sure
    studioJs = studioJs.replace(/const ACCENT = \{[^}]*\};/g, "const ACCENT = { character: 'var(--ac-pink)', concept: 'var(--ac-green)' };");
    
    // in openMode(), generate button background
    studioJs = studioJs.replace(/\$\('studio-generate'\)\.style\.background = isChar \? '[^']*' : '[^']*';/g, "$('studio-generate').style.background = 'var(--ac-yellow)';");
    
    // also set $('studio-detail-icon').style.background = ACCENT[m]
    // Let's add it right after setting the title
    if (!studioJs.includes("$('studio-detail-icon').style.background = ACCENT[m]")) {
        studioJs = studioJs.replace(/const m = e\.target\.dataset\.studioOpen;[\s\S]*?openMode\(m\);/g, match => {
            return match; // this is the event listener, we want openMode function
        });
        
        studioJs = studioJs.replace(/(function openMode\(m\) \{[\s\S]*?\$\('studio-detail-sub'\)\.textContent = isChar)/g, "$1");
        
        // Let's just find `$('studio-detail-title').textContent = isChar`
        studioJs = studioJs.replace(/\$\('studio-detail-title'\)\.textContent = isChar \? 'Character Design' : 'Concept Art Design';/g, 
            "$('studio-detail-title').textContent = isChar ? 'Character Design' : 'Concept Art Design';\n  $('studio-detail-icon').style.background = ACCENT[m];");
    }

    fs.writeFileSync(studioJsPath, studioJs, 'utf8');
    console.log('Updated studio.js');
}
