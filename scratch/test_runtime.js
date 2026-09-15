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
vm.runInContext(babelCode, context, { filename: 'babel.js' });
const Babel = context.exports;

// 4. Compile JSX code
const compiledCode = Babel.transform(code, {
    presets: [['react', { runtime: 'classic' }]],
    filename: '冰水管路計算.html'
}).code;

// 5. Mock browser & React environment
const mockReact = {
    useState: (val) => {
        let stateVal = val;
        const setter = (newVal) => {
            stateVal = newVal;
            if (Array.isArray(newVal) && newVal.length > 0 && newVal[0].fromId) {
                console.log("Results State updated! Pipe results:");
                newVal.forEach(p => {
                    console.log(`Pipe ${p.id} (${p.fromId} -> ${p.toId}): flow = ${p.lpm} LPM, DN = ${p.dn}, vel = ${p.velocity} m/s, pd = ${p.pressureDropPa} Pa`);
                });
            } else if (newVal && typeof newVal === 'object' && !Array.isArray(newVal) && Object.keys(newVal).length > 0) {
                console.log("NodeCalculatedFlows State updated! Node flows:");
                console.log(newVal);
            }
        };
        return [stateVal, setter];
    },
    useMemo: (fn, deps) => fn(),
    useCallback: (fn, deps) => fn,
    useRef: (val) => ({ current: val }),
    useEffect: (fn, deps) => {
        try {
            fn();
        } catch (err) {
            console.error("Effect Execution Error:", err);
        }
    },
    createElement: (type, props, ...children) => {
        if (typeof type === 'function') {
            try {
                console.log("Calling component:", type.name);
                type(props || {});
            } catch (err) {
                console.error(`Error in component ${type.name}:`, err);
            }
        }
        return {};
    }
};

const mockLocalStorage = {
    getItem: (key) => null,
    setItem: (key, val) => {}
};

const mockWindow = {
    location: { search: '' },
    innerWidth: 1920,
    innerHeight: 1080,
    addEventListener: () => {},
    removeEventListener: () => {}
};

class MockURLSearchParams {
    constructor() { }
    get(name) { return null; }
}

const runtimeContextObject = {
    console: console,
    React: mockReact,
    ReactDOM: {
        createRoot: () => ({
            render: () => {}
        })
    },
    localStorage: mockLocalStorage,
    window: mockWindow,
    location: { search: '' },
    URLSearchParams: MockURLSearchParams,
    addEventListener: () => {},
    removeEventListener: () => {},
    document: {
        getElementById: () => ({}),
        addEventListener: () => {}
    },
    navigator: { userAgent: 'Node' }
};

// Set up self-referential globals
runtimeContextObject.global = runtimeContextObject;
runtimeContextObject.window = runtimeContextObject;

const runtimeContext = vm.createContext(runtimeContextObject);

// 6. Run compiled code
try {
    console.log("Running compiled code in mock browser environment...");
    vm.runInContext(compiledCode, runtimeContext, { filename: 'compiled.js' });
    console.log("Execution successful! No runtime errors during initialization.");
} catch (err) {
    console.error("Runtime Initialization Error:");
    console.error(err.stack);
}
