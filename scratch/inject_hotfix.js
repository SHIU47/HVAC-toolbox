const fs = require('fs');
let html = fs.readFileSync('public/code_artifact.html', 'utf8');
if (!html.includes('hotfix_pipes.js')) {
    html = html.replace('</head>', '<script src="hotfix_pipes.js"></script></head>');
    fs.writeFileSync('public/code_artifact.html', html, 'utf8');
    console.log('Injected hotfix script tag!');
} else {
    console.log('Already injected.');
}
