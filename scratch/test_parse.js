const fs = require('fs');
const path = require('path');
const vm = require('vm');

// 1. Read HTML
const htmlPath = path.join(__dirname, '../dist/冰水管路計算.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 2. Extract script content
const scriptMatch = html.match(/<script type="text\/babel">([\s\S]*?)<\/script>/);
if (!scriptMatch) {
    console.error("Could not find Babel script block!");
    process.exit(1);
}
const code = scriptMatch[1];

// 3. Load Babel standalone
const babelCode = fs.readFileSync(path.join(__dirname, 'babel.js'), 'utf8');
const contextObject = {
    console: console,
    exports: {},
    module: { exports: {} }
};
contextObject.global = contextObject;
contextObject.window = contextObject;
contextObject.globalThis = contextObject;

const context = vm.createContext(contextObject);

try {
    vm.runInContext(babelCode, context, { filename: 'babel.js' });
} catch (err) {
    console.error("Failed to load babel.js", err);
    process.exit(1);
}

const Babel = context.exports;
if (!Babel || typeof Babel.transform !== 'function') {
    console.error("Babel.transform not found! Keys in exports:", Object.keys(context.exports));
    process.exit(1);
}

// 4. Compile JSX code
try {
    console.log("Compiling JSX code using Babel...");
    const result = Babel.transform(code, {
        presets: ['react'],
        filename: '冰水管路計算.html'
    });
    console.log("Compilation successful! No syntax errors.");
} catch (err) {
    console.error("Babel Compilation Error:");
    console.error(err.message);
}
