const { TEMPLATE_ONLY_COMPONENT } = require('@glimmer/runtime');
const { Context, Component, MINIMAL_CAPABILITIES } = require('@glimmer/opcode-compiler');
const { precompile } = require('@glimmer/compiler');
const { artifacts } = require('@glimmer/program');
const createHTMLDocument = require('@simple-dom/document');
const {AotRuntime, renderAot} = require('@glimmer/runtime');
const Serializer = require('@simple-dom/serializer');
const voidMap = require('@simple-dom/void-map');
const { State, map } = require('@glimmer/reference');
let source = `
{{~#let "hello" "world" as |hello world|~}}
  <Second
    @hello={{hello}}
    @world={{world}}
    @suffix={{this.suffix}}
    @num={{this.count}}
  />
{{~/let~}}
`;

function increment(args) {
  let input = args.positional.at(0);
  return map(input, i => i + 1);
}
// A map of helpers to runtime handles (that will be passed to the runtime resolver).
const HELPERS = {
  increment: 0,
};

// A map of components to their source code and the runtime handle (that will be passed
// to the runtime resolver).
const COMPONENTS = {
  Second: {
    source: `<p>{{@hello}} {{@world}}{{@suffix}} ({{increment @num}})</p>`,
    handle: 1,
  },
};

const RESOLVER_DELEGATE = {
  lookupComponent(name) {
    let component = COMPONENTS[name];
    if (component === null) return null;

    let { handle, source } = component;

    return {
      handle,
      compilable: Compilable(source),
      capabilities: MINIMAL_CAPABILITIES,
    };
  },

  lookupHelper(name) {
    if (name in HELPERS) return HELPERS[name];
  },
};

const RUNTIME_RESOLVER = {
  resolve(handle) {
    if (handle === 0) {
      return increment;
    }
    if (handle === 1) {
      return TEMPLATE_ONLY_COMPONENT;
    }
  }
};

let state = State({ prefix: '!', count: 5 });
let context = Context(RESOLVER_DELEGATE);
let component = Compilable(source);
let handle = component.compile(context);

let program = artifacts(context);
console.log((new Uint8Array(program.heap.buffer)).join(' '));
let document = createHTMLDocument();
let runtime = AotRuntime(document, program, RUNTIME_RESOLVER);
let element = document.createElement('main');
let cursor = { element, nextSibling: null };
let iterator = renderAot(runtime, handle, cursor, state);
let result = iterator.sync();
console.log(serialize(element)); // <main><p>hello world!</p></main>

state.update({
  prefix: '?'
});

result.rerender();

console.log(serialize(element)); // <main><p>hello world?</p></main>

function serialize(element){
  return new Serializer(voidMap).serialize(element);
}

function Compilable(source) {
  return Component(precompile(source));
}
