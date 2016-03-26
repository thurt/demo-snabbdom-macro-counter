(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict'
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/eventlisteners') // attaches event listeners
])
const h = require('snabbdom/h')
const view = Symbol('view')
/*
__LOWER COMPONENT-LEVEL_________________________________________________________

this level is for:
 - defining methods which manipulate component's own data
 - defining component presentation via #getView (however, methods should NOT call #getView themselves)
 - these components do not communicate with other components or the application

 */
class Toolbar {
  constructor({ isRecording = false }) {
    this.isRecording = isRecording
  }

  new() { }
  record() {
    this.isRecording ? this.isRecording = false : this.isRecording = true
  }
  clear() { }

  getView() {
    return h('div', [
      h('button', { on: { click: (e) => this.new(e) } }, 'New'),
      h('button', { on: { click: (e) => this.record(e) } }, this.isRecording ? 'Stop Recording' : 'Start Recording'),
      h('button', { on: { click: (e) => this.clear(e) } }, 'Clear State')
    ])
  }
}

class Counter {
  constructor({ count = 0 }) {
    this.count = count
  }

  plus() { this.count += 1 }
  minus() { this.count -= 1 }

  getView() {
    return h('div', [
      h('button', { on: { click: (e) => this.plus(e) } }, '+'),
      h('button', { on: { click: (e) => this.minus(e) } }, '-'),
      h('div', `Count: ${ this.count }`)
    ])
  }
}

class Macro {
  constructor({ value = 'Play Macro' }) {
    Object.defineProperty(this, 'value', { value, enumerable: false })
  }

  play() { }

  getView() {
    return h('div', [
      h('button', { on: { click: (e) => this.play(e) } }, this.value)
    ])
  }
}
/*
__UPPER COMPONENT-LEVEL_________________________________________________________

this level is for:
 - subclasses of components (whose instances often have an id that is unique to the app)
 - these component methods act as application-specific wrappers around the super method
 - these component methods are allowed to communicate with component instances using Id

*/
class AppToolbar extends Toolbar {
  constructor({ macroDef = [], isRecording }) {
    super({ isRecording })
    this.macroDef = macroDef
    this.type = 'AppToolbar'

    Id.assign(this, 'ls', 'list')
  }

  new(e) {
    if (this.isRecording) {
      App.update(this.recordEvent(this, e), { doPatch: false })
      return // prevent normal behavior
    }

    this.ls.add({ type: 'AppCounter' })
    App.update(this.ls)
  }

  record() {
    super.record()

    if (this.isRecording) App.update(this)
    else if (this.macroDef.length) {
      this.ls.add({ type: 'AppMacro', def: this.macroDef })
      this.macroDef = []

      App.update([this, this.ls])
    } else App.update(this)
  }

  recordEvent(c, ev) {
    if (!this.macroDef) this.macroDef = []

    var trie_keys = App.getTrieKeys(c)

    if (c[view].children) {
      trie_keys.push(Array.prototype.indexOf.call(ev.target.parentNode.children, ev.target))
    }

    this.macroDef.push({ trie_keys, ev_type: ev.type })

    return this
  }

  clear() {
    App.clearState()
  }
}

class AppCounter extends Counter {
  constructor({ count }) {
    super({ count })
    this.type = 'AppCounter'

    Id.assign(this, 'tb', 'toolbar')
  }

  plus(e) {
    if (this.tb.isRecording) {
      App.update(this.tb.recordEvent(this, e), false, true)
      return // prevent normal behavior
    }

    super.plus()
    App.update(this)
  }

  minus(e) {
    if (this.tb.isRecording) {
      App.update(this.tb.recordEvent(this, e), false, true)
      return // prevent normal behavior
    }

    super.minus()
    App.update(this)
  }
}

class AppMacro extends Macro {
  constructor({ def = [] }) {
    super({ value: `Play Macro (${def.length} events)` })
    this.def = def
    this.type = 'AppMacro'

    Id.assign(this, 'tb', 'toolbar')
  }

  play(e) {
    if (this.tb.isRecording) {
      App.update(this.tb.recordEvent(this, e), false, true)
      return // prevent normal behavior
    }

    this.def.forEach(step => {
      var el = App.$view
      for (var i of step.trie_keys) {
        el = el.children[i]
      }
      el.dispatchEvent(new Event(step.ev_type))
    })
  }
}
/*
__LOWER APP-LEVEL_______________________________________________________________

this level is for:
 - sorting, grouping, and look-up/retrieval of components in the application
 - they have no "own" data rendered on screen

*/
class List {
  constructor({ id, tag = 'div', components = [] }) {
    this.type = 'List' // force
    this.tag = tag
    this.components = []
    components.forEach(c_state => this.add(c_state))
    this[view] = this.getView()
  }

  add(c_state) {
    var new_c = new Type[c_state.type](c_state)
    new_c[view] = new_c.getView()
    this.components.push(new_c)
    if (c_state.id) Id.add(new_c.id = c_state.id, new_c)
    return new_c
  }

  update(this_c) {
    for (var i = 0; i < this.components.length; i++) {
      var c = this.components[i]

      if (c === this_c) {
        c[view] = c.getView()
        return c
      }

      if (c instanceof List) {
        if (c.update(this_c)) {
          c[view] = c.getView()
          return c
        }
      }
    }
  }

  getTrieKeys(this_c, keys = []) {
    for (var i = 0; i < this.components.length; i++) {
      var c = this.components[i]

      if (c === this_c) {
        keys.push(i)
        return keys
      }

      if (c instanceof List) {
        if (c.getTrieKeys(this_c, keys)) {
          keys.unshift(i)
          return keys
        }
      }
    }
  }

  getView() {
    return h(this.tag, this.components.map(c => c[view]))
  }

}

// component constructors
const Type = { List, AppToolbar, AppMacro, AppCounter }
// component instances which are created with an id property will go in Id
const Id = (() => {
  var promise = {}
  var resolver = {}

  return {
    assign(c, prop, name) {
      var _assign = (val) => Object.defineProperty(c, prop, { value: val, enumerable: false })

      if (promise[name]) {
        promise[name].then(_assign)
      } else {
        promise[name] = new Promise(res => {
          var r = c => res(c)
          resolver[name] = r
        }).then(_assign)
      }
    },
    add(name, c) {
      if (promise[name]) {
        if (!resolver[name]) {
          throw new Error(`Id name ${name} has already been added`)
        }
        else {
          resolver[name](c)
          delete resolver[name]
        }
      }
      else {
        promise[name] = Promise.resolve(c)
      }
    }
  }
})()

/*
__UPPER APP-LEVEL_______________________________________________________________

this level is for:
  - patching the DOM or saving the state of the application
  - defining the persistence mechanism (localStorage, in this case)
  - defining the initial application instance(s) and their location in the DOM

*/
class LocalStorageApplication extends List {
  constructor({ id, tag, components }) {
    var savedState = JSON.parse(localStorage.getItem(id))

    if (savedState) super(savedState)
    else super({ tag, components })

    Object.defineProperty(this, 'id', { value: id, enumerable: false })
  }

  update(component, doPatch = true, doSave = true) {
    // recompile views
    if (Array.isArray(component)) {
      for (var c of component) super.update(c)
    } else super.update(component)

    if (doPatch) {
      // patch DOM
      var new_v = this.getView()
      patch(this[view], new_v)
      this[view] = new_v
    }

    if (doSave) {
      // save state
      localStorage.setItem(this.id, JSON.stringify(this))
    }
  }

  clearState() {
    localStorage.removeItem(this.id)
  }

}

class Demo extends LocalStorageApplication {
  constructor($view, $state, superState) {
    super(superState)

    Object.defineProperties(this, {
      $view: { value: $view, enumerable: false },
      $state: { value: $state, enumerable: false }
    })

    patch(this.$view, this[view])
    this.outputState()
  }

  update() {
    super.update.apply(this, arguments)
    this.outputState()
  }

  clearState() {
    super.clearState()
    window.alert('The state has been cleared from localStorage. However, the current state is still in-memory. To reset the demo, you must refresh your browser now.')
  }
  outputState() {
    this.$state.innerText = JSON.stringify(this, undefined, 1)
  }
}

/*
________________________________________________________________________________

*/

const App = new Demo(document.getElementById('CounterDemo'), document.getElementById('_state'), {
  id: 'CounterDemo',
  components: [
    { type: 'AppToolbar', id: 'toolbar' },
    { type: 'List', id: 'list' }
  ]
})
},{"snabbdom":6,"snabbdom/h":2,"snabbdom/modules/eventlisteners":5}],2:[function(require,module,exports){
var VNode = require('./vnode');
var is = require('./is');

function addNS(data, children) {
  data.ns = 'http://www.w3.org/2000/svg';
  if (children !== undefined) {
    for (var i = 0; i < children.length; ++i) {
      addNS(children[i].data, children[i].children);
    }
  }
}

module.exports = function h(sel, b, c) {
  var data = {}, children, text, i;
  if (arguments.length === 3) {
    data = b;
    if (is.array(c)) { children = c; }
    else if (is.primitive(c)) { text = c; }
  } else if (arguments.length === 2) {
    if (is.array(b)) { children = b; }
    else if (is.primitive(b)) { text = b; }
    else { data = b; }
  }
  if (is.array(children)) {
    for (i = 0; i < children.length; ++i) {
      if (is.primitive(children[i])) children[i] = VNode(undefined, undefined, undefined, children[i]);
    }
  }
  if (sel[0] === 's' && sel[1] === 'v' && sel[2] === 'g') {
    addNS(data, children);
  }
  return VNode(sel, data, children, text, undefined);
};

},{"./is":4,"./vnode":7}],3:[function(require,module,exports){
function createElement(tagName){
  return document.createElement(tagName);
}

function createElementNS(namespaceURI, qualifiedName){
  return document.createElementNS(namespaceURI, qualifiedName);
}

function createTextNode(text){
  return document.createTextNode(text);
}


function insertBefore(parentNode, newNode, referenceNode){
  parentNode.insertBefore(newNode, referenceNode);
}


function removeChild(node, child){
  node.removeChild(child);
}

function appendChild(node, child){
  node.appendChild(child);
}

function parentNode(node){
  return node.parentElement;
}

function nextSibling(node){
  return node.nextSibling;
}

function tagName(node){
  return node.tagName;
}

function setTextContent(node, text){
  node.textContent = text;
}

module.exports = {
  createElement: createElement,
  createElementNS: createElementNS,
  createTextNode: createTextNode,
  appendChild: appendChild,
  removeChild: removeChild,
  insertBefore: insertBefore,
  parentNode: parentNode,
  nextSibling: nextSibling,
  tagName: tagName,
  setTextContent: setTextContent
};

},{}],4:[function(require,module,exports){
module.exports = {
  array: Array.isArray,
  primitive: function(s) { return typeof s === 'string' || typeof s === 'number'; },
};

},{}],5:[function(require,module,exports){
var is = require('../is');

function arrInvoker(arr) {
  return function() {
    // Special case when length is two, for performance
    arr.length === 2 ? arr[0](arr[1]) : arr[0].apply(undefined, arr.slice(1));
  };
}

function fnInvoker(o) {
  return function(ev) { o.fn(ev); };
}

function updateEventListeners(oldVnode, vnode) {
  var name, cur, old, elm = vnode.elm,
      oldOn = oldVnode.data.on || {}, on = vnode.data.on;
  if (!on) return;
  for (name in on) {
    cur = on[name];
    old = oldOn[name];
    if (old === undefined) {
      if (is.array(cur)) {
        elm.addEventListener(name, arrInvoker(cur));
      } else {
        cur = { fn: cur };
        on[name] = cur;
        elm.addEventListener(name, fnInvoker(cur));
      }
    } else if (is.array(old)) {
      // Deliberately modify old array since it's captured in closure created with `arrInvoker`
      old.length = cur.length;
      for (var i = 0; i < old.length; ++i) old[i] = cur[i];
      on[name]  = old;
    } else {
      old.fn = cur;
      on[name] = old;
    }
  }
}

module.exports = {create: updateEventListeners, update: updateEventListeners};

},{"../is":4}],6:[function(require,module,exports){
// jshint newcap: false
/* global require, module, document, Node */
'use strict';

var VNode = require('./vnode');
var is = require('./is');
var domApi = require('./htmldomapi.js');

function isUndef(s) { return s === undefined; }
function isDef(s) { return s !== undefined; }

var emptyNode = VNode('', {}, [], undefined, undefined);

function sameVnode(vnode1, vnode2) {
  return vnode1.key === vnode2.key && vnode1.sel === vnode2.sel;
}

function createKeyToOldIdx(children, beginIdx, endIdx) {
  var i, map = {}, key;
  for (i = beginIdx; i <= endIdx; ++i) {
    key = children[i].key;
    if (isDef(key)) map[key] = i;
  }
  return map;
}

var hooks = ['create', 'update', 'remove', 'destroy', 'pre', 'post'];

function init(modules, api) {
  var i, j, cbs = {};

  if (isUndef(api)) api = domApi;

  for (i = 0; i < hooks.length; ++i) {
    cbs[hooks[i]] = [];
    for (j = 0; j < modules.length; ++j) {
      if (modules[j][hooks[i]] !== undefined) cbs[hooks[i]].push(modules[j][hooks[i]]);
    }
  }

  function emptyNodeAt(elm) {
    return VNode(api.tagName(elm).toLowerCase(), {}, [], undefined, elm);
  }

  function createRmCb(childElm, listeners) {
    return function() {
      if (--listeners === 0) {
        var parent = api.parentNode(childElm);
        api.removeChild(parent, childElm);
      }
    };
  }

  function createElm(vnode, insertedVnodeQueue) {
    var i, thunk, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.init)) i(vnode);
      if (isDef(i = data.vnode)) {
          thunk = vnode;
          vnode = i;
      }
    }
    var elm, children = vnode.children, sel = vnode.sel;
    if (isDef(sel)) {
      // Parse selector
      var hashIdx = sel.indexOf('#');
      var dotIdx = sel.indexOf('.', hashIdx);
      var hash = hashIdx > 0 ? hashIdx : sel.length;
      var dot = dotIdx > 0 ? dotIdx : sel.length;
      var tag = hashIdx !== -1 || dotIdx !== -1 ? sel.slice(0, Math.min(hash, dot)) : sel;
      elm = vnode.elm = isDef(data) && isDef(i = data.ns) ? api.createElementNS(i, tag)
                                                          : api.createElement(tag);
      if (hash < dot) elm.id = sel.slice(hash + 1, dot);
      if (dotIdx > 0) elm.className = sel.slice(dot+1).replace(/\./g, ' ');
      if (is.array(children)) {
        for (i = 0; i < children.length; ++i) {
          api.appendChild(elm, createElm(children[i], insertedVnodeQueue));
        }
      } else if (is.primitive(vnode.text)) {
        api.appendChild(elm, api.createTextNode(vnode.text));
      }
      for (i = 0; i < cbs.create.length; ++i) cbs.create[i](emptyNode, vnode);
      i = vnode.data.hook; // Reuse variable
      if (isDef(i)) {
        if (i.create) i.create(emptyNode, vnode);
        if (i.insert) insertedVnodeQueue.push(vnode);
      }
    } else {
      elm = vnode.elm = api.createTextNode(vnode.text);
    }
    if (isDef(thunk)) thunk.elm = vnode.elm;
    return vnode.elm;
  }

  function addVnodes(parentElm, before, vnodes, startIdx, endIdx, insertedVnodeQueue) {
    for (; startIdx <= endIdx; ++startIdx) {
      api.insertBefore(parentElm, createElm(vnodes[startIdx], insertedVnodeQueue), before);
    }
  }

  function invokeDestroyHook(vnode) {
    var i, j, data = vnode.data;
    if (isDef(data)) {
      if (isDef(i = data.hook) && isDef(i = i.destroy)) i(vnode);
      for (i = 0; i < cbs.destroy.length; ++i) cbs.destroy[i](vnode);
      if (isDef(i = vnode.children)) {
        for (j = 0; j < vnode.children.length; ++j) {
          invokeDestroyHook(vnode.children[j]);
        }
      }
      if (isDef(i = data.vnode)) invokeDestroyHook(i);
    }
  }

  function removeVnodes(parentElm, vnodes, startIdx, endIdx) {
    for (; startIdx <= endIdx; ++startIdx) {
      var i, listeners, rm, ch = vnodes[startIdx];
      if (isDef(ch)) {
        if (isDef(ch.sel)) {
          invokeDestroyHook(ch);
          listeners = cbs.remove.length + 1;
          rm = createRmCb(ch.elm, listeners);
          for (i = 0; i < cbs.remove.length; ++i) cbs.remove[i](ch, rm);
          if (isDef(i = ch.data) && isDef(i = i.hook) && isDef(i = i.remove)) {
            i(ch, rm);
          } else {
            rm();
          }
        } else { // Text node
          api.removeChild(parentElm, ch.elm);
        }
      }
    }
  }

  function updateChildren(parentElm, oldCh, newCh, insertedVnodeQueue) {
    var oldStartIdx = 0, newStartIdx = 0;
    var oldEndIdx = oldCh.length - 1;
    var oldStartVnode = oldCh[0];
    var oldEndVnode = oldCh[oldEndIdx];
    var newEndIdx = newCh.length - 1;
    var newStartVnode = newCh[0];
    var newEndVnode = newCh[newEndIdx];
    var oldKeyToIdx, idxInOld, elmToMove, before;

    while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
      if (isUndef(oldStartVnode)) {
        oldStartVnode = oldCh[++oldStartIdx]; // Vnode has been moved left
      } else if (isUndef(oldEndVnode)) {
        oldEndVnode = oldCh[--oldEndIdx];
      } else if (sameVnode(oldStartVnode, newStartVnode)) {
        patchVnode(oldStartVnode, newStartVnode, insertedVnodeQueue);
        oldStartVnode = oldCh[++oldStartIdx];
        newStartVnode = newCh[++newStartIdx];
      } else if (sameVnode(oldEndVnode, newEndVnode)) {
        patchVnode(oldEndVnode, newEndVnode, insertedVnodeQueue);
        oldEndVnode = oldCh[--oldEndIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldStartVnode, newEndVnode)) { // Vnode moved right
        patchVnode(oldStartVnode, newEndVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldStartVnode.elm, api.nextSibling(oldEndVnode.elm));
        oldStartVnode = oldCh[++oldStartIdx];
        newEndVnode = newCh[--newEndIdx];
      } else if (sameVnode(oldEndVnode, newStartVnode)) { // Vnode moved left
        patchVnode(oldEndVnode, newStartVnode, insertedVnodeQueue);
        api.insertBefore(parentElm, oldEndVnode.elm, oldStartVnode.elm);
        oldEndVnode = oldCh[--oldEndIdx];
        newStartVnode = newCh[++newStartIdx];
      } else {
        if (isUndef(oldKeyToIdx)) oldKeyToIdx = createKeyToOldIdx(oldCh, oldStartIdx, oldEndIdx);
        idxInOld = oldKeyToIdx[newStartVnode.key];
        if (isUndef(idxInOld)) { // New element
          api.insertBefore(parentElm, createElm(newStartVnode, insertedVnodeQueue), oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        } else {
          elmToMove = oldCh[idxInOld];
          patchVnode(elmToMove, newStartVnode, insertedVnodeQueue);
          oldCh[idxInOld] = undefined;
          api.insertBefore(parentElm, elmToMove.elm, oldStartVnode.elm);
          newStartVnode = newCh[++newStartIdx];
        }
      }
    }
    if (oldStartIdx > oldEndIdx) {
      before = isUndef(newCh[newEndIdx+1]) ? null : newCh[newEndIdx+1].elm;
      addVnodes(parentElm, before, newCh, newStartIdx, newEndIdx, insertedVnodeQueue);
    } else if (newStartIdx > newEndIdx) {
      removeVnodes(parentElm, oldCh, oldStartIdx, oldEndIdx);
    }
  }

  function patchVnode(oldVnode, vnode, insertedVnodeQueue) {
    var i, hook;
    if (isDef(i = vnode.data) && isDef(hook = i.hook) && isDef(i = hook.prepatch)) {
      i(oldVnode, vnode);
    }
    if (isDef(i = oldVnode.data) && isDef(i = i.vnode)) oldVnode = i;
    if (isDef(i = vnode.data) && isDef(i = i.vnode)) {
      patchVnode(oldVnode, i, insertedVnodeQueue);
      vnode.elm = i.elm;
      return;
    }
    var elm = vnode.elm = oldVnode.elm, oldCh = oldVnode.children, ch = vnode.children;
    if (oldVnode === vnode) return;
    if (!sameVnode(oldVnode, vnode)) {
      var parentElm = api.parentNode(oldVnode.elm);
      elm = createElm(vnode, insertedVnodeQueue);
      api.insertBefore(parentElm, elm, oldVnode.elm);
      removeVnodes(parentElm, [oldVnode], 0, 0);
      return;
    }
    if (isDef(vnode.data)) {
      for (i = 0; i < cbs.update.length; ++i) cbs.update[i](oldVnode, vnode);
      i = vnode.data.hook;
      if (isDef(i) && isDef(i = i.update)) i(oldVnode, vnode);
    }
    if (isUndef(vnode.text)) {
      if (isDef(oldCh) && isDef(ch)) {
        if (oldCh !== ch) updateChildren(elm, oldCh, ch, insertedVnodeQueue);
      } else if (isDef(ch)) {
        if (isDef(oldVnode.text)) api.setTextContent(elm, '');
        addVnodes(elm, null, ch, 0, ch.length - 1, insertedVnodeQueue);
      } else if (isDef(oldCh)) {
        removeVnodes(elm, oldCh, 0, oldCh.length - 1);
      } else if (isDef(oldVnode.text)) {
        api.setTextContent(elm, '');
      }
    } else if (oldVnode.text !== vnode.text) {
      api.setTextContent(elm, vnode.text);
    }
    if (isDef(hook) && isDef(i = hook.postpatch)) {
      i(oldVnode, vnode);
    }
  }

  return function(oldVnode, vnode) {
    var i, elm, parent;
    var insertedVnodeQueue = [];
    for (i = 0; i < cbs.pre.length; ++i) cbs.pre[i]();

    if (isUndef(oldVnode.sel)) {
      oldVnode = emptyNodeAt(oldVnode);
    }

    if (sameVnode(oldVnode, vnode)) {
      patchVnode(oldVnode, vnode, insertedVnodeQueue);
    } else {
      elm = oldVnode.elm;
      parent = api.parentNode(elm);

      createElm(vnode, insertedVnodeQueue);

      if (parent !== null) {
        api.insertBefore(parent, vnode.elm, api.nextSibling(elm));
        removeVnodes(parent, [oldVnode], 0, 0);
      }
    }

    for (i = 0; i < insertedVnodeQueue.length; ++i) {
      insertedVnodeQueue[i].data.hook.insert(insertedVnodeQueue[i]);
    }
    for (i = 0; i < cbs.post.length; ++i) cbs.post[i]();
    return vnode;
  };
}

module.exports = {init: init};

},{"./htmldomapi.js":3,"./is":4,"./vnode":7}],7:[function(require,module,exports){
module.exports = function(sel, data, children, text, elm) {
  var key = data === undefined ? undefined : data.key;
  return {sel: sel, data: data, children: children,
          text: text, elm: elm, key: key};
};

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvanMvbWFpbi4xLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcbmNvbnN0IHNuYWJiZG9tID0gcmVxdWlyZSgnc25hYmJkb20nKVxuY29uc3QgcGF0Y2ggPSBzbmFiYmRvbS5pbml0KFsgLy8gSW5pdCBwYXRjaCBmdW5jdGlvbiB3aXRoIGNob29zZW4gbW9kdWxlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJykgLy8gYXR0YWNoZXMgZXZlbnQgbGlzdGVuZXJzXG5dKVxuY29uc3QgaCA9IHJlcXVpcmUoJ3NuYWJiZG9tL2gnKVxuY29uc3QgdmlldyA9IFN5bWJvbCgndmlldycpXG4vKlxuX19MT1dFUiBDT01QT05FTlQtTEVWRUxfX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19cblxudGhpcyBsZXZlbCBpcyBmb3I6XG4gLSBkZWZpbmluZyBtZXRob2RzIHdoaWNoIG1hbmlwdWxhdGUgY29tcG9uZW50J3Mgb3duIGRhdGFcbiAtIGRlZmluaW5nIGNvbXBvbmVudCBwcmVzZW50YXRpb24gdmlhICNnZXRWaWV3IChob3dldmVyLCBtZXRob2RzIHNob3VsZCBOT1QgY2FsbCAjZ2V0VmlldyB0aGVtc2VsdmVzKVxuIC0gdGhlc2UgY29tcG9uZW50cyBkbyBub3QgY29tbXVuaWNhdGUgd2l0aCBvdGhlciBjb21wb25lbnRzIG9yIHRoZSBhcHBsaWNhdGlvblxuXG4gKi9cbmNsYXNzIFRvb2xiYXIge1xuICBjb25zdHJ1Y3Rvcih7IGlzUmVjb3JkaW5nID0gZmFsc2UgfSkge1xuICAgIHRoaXMuaXNSZWNvcmRpbmcgPSBpc1JlY29yZGluZ1xuICB9XG5cbiAgbmV3KCkgeyB9XG4gIHJlY29yZCgpIHtcbiAgICB0aGlzLmlzUmVjb3JkaW5nID8gdGhpcy5pc1JlY29yZGluZyA9IGZhbHNlIDogdGhpcy5pc1JlY29yZGluZyA9IHRydWVcbiAgfVxuICBjbGVhcigpIHsgfVxuXG4gIGdldFZpZXcoKSB7XG4gICAgcmV0dXJuIGgoJ2RpdicsIFtcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLm5ldyhlKSB9IH0sICdOZXcnKSxcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLnJlY29yZChlKSB9IH0sIHRoaXMuaXNSZWNvcmRpbmcgPyAnU3RvcCBSZWNvcmRpbmcnIDogJ1N0YXJ0IFJlY29yZGluZycpLFxuICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKGUpID0+IHRoaXMuY2xlYXIoZSkgfSB9LCAnQ2xlYXIgU3RhdGUnKVxuICAgIF0pXG4gIH1cbn1cblxuY2xhc3MgQ291bnRlciB7XG4gIGNvbnN0cnVjdG9yKHsgY291bnQgPSAwIH0pIHtcbiAgICB0aGlzLmNvdW50ID0gY291bnRcbiAgfVxuXG4gIHBsdXMoKSB7IHRoaXMuY291bnQgKz0gMSB9XG4gIG1pbnVzKCkgeyB0aGlzLmNvdW50IC09IDEgfVxuXG4gIGdldFZpZXcoKSB7XG4gICAgcmV0dXJuIGgoJ2RpdicsIFtcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLnBsdXMoZSkgfSB9LCAnKycpLFxuICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKGUpID0+IHRoaXMubWludXMoZSkgfSB9LCAnLScpLFxuICAgICAgaCgnZGl2JywgYENvdW50OiAkeyB0aGlzLmNvdW50IH1gKVxuICAgIF0pXG4gIH1cbn1cblxuY2xhc3MgTWFjcm8ge1xuICBjb25zdHJ1Y3Rvcih7IHZhbHVlID0gJ1BsYXkgTWFjcm8nIH0pIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3ZhbHVlJywgeyB2YWx1ZSwgZW51bWVyYWJsZTogZmFsc2UgfSlcbiAgfVxuXG4gIHBsYXkoKSB7IH1cblxuICBnZXRWaWV3KCkge1xuICAgIHJldHVybiBoKCdkaXYnLCBbXG4gICAgICBoKCdidXR0b24nLCB7IG9uOiB7IGNsaWNrOiAoZSkgPT4gdGhpcy5wbGF5KGUpIH0gfSwgdGhpcy52YWx1ZSlcbiAgICBdKVxuICB9XG59XG4vKlxuX19VUFBFUiBDT01QT05FTlQtTEVWRUxfX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19cblxudGhpcyBsZXZlbCBpcyBmb3I6XG4gLSBzdWJjbGFzc2VzIG9mIGNvbXBvbmVudHMgKHdob3NlIGluc3RhbmNlcyBvZnRlbiBoYXZlIGFuIGlkIHRoYXQgaXMgdW5pcXVlIHRvIHRoZSBhcHApXG4gLSB0aGVzZSBjb21wb25lbnQgbWV0aG9kcyBhY3QgYXMgYXBwbGljYXRpb24tc3BlY2lmaWMgd3JhcHBlcnMgYXJvdW5kIHRoZSBzdXBlciBtZXRob2RcbiAtIHRoZXNlIGNvbXBvbmVudCBtZXRob2RzIGFyZSBhbGxvd2VkIHRvIGNvbW11bmljYXRlIHdpdGggY29tcG9uZW50IGluc3RhbmNlcyB1c2luZyBJZFxuXG4qL1xuY2xhc3MgQXBwVG9vbGJhciBleHRlbmRzIFRvb2xiYXIge1xuICBjb25zdHJ1Y3Rvcih7IG1hY3JvRGVmID0gW10sIGlzUmVjb3JkaW5nIH0pIHtcbiAgICBzdXBlcih7IGlzUmVjb3JkaW5nIH0pXG4gICAgdGhpcy5tYWNyb0RlZiA9IG1hY3JvRGVmXG4gICAgdGhpcy50eXBlID0gJ0FwcFRvb2xiYXInXG5cbiAgICBJZC5hc3NpZ24odGhpcywgJ2xzJywgJ2xpc3QnKVxuICB9XG5cbiAgbmV3KGUpIHtcbiAgICBpZiAodGhpcy5pc1JlY29yZGluZykge1xuICAgICAgQXBwLnVwZGF0ZSh0aGlzLnJlY29yZEV2ZW50KHRoaXMsIGUpLCB7IGRvUGF0Y2g6IGZhbHNlIH0pXG4gICAgICByZXR1cm4gLy8gcHJldmVudCBub3JtYWwgYmVoYXZpb3JcbiAgICB9XG5cbiAgICB0aGlzLmxzLmFkZCh7IHR5cGU6ICdBcHBDb3VudGVyJyB9KVxuICAgIEFwcC51cGRhdGUodGhpcy5scylcbiAgfVxuXG4gIHJlY29yZCgpIHtcbiAgICBzdXBlci5yZWNvcmQoKVxuXG4gICAgaWYgKHRoaXMuaXNSZWNvcmRpbmcpIEFwcC51cGRhdGUodGhpcylcbiAgICBlbHNlIGlmICh0aGlzLm1hY3JvRGVmLmxlbmd0aCkge1xuICAgICAgdGhpcy5scy5hZGQoeyB0eXBlOiAnQXBwTWFjcm8nLCBkZWY6IHRoaXMubWFjcm9EZWYgfSlcbiAgICAgIHRoaXMubWFjcm9EZWYgPSBbXVxuXG4gICAgICBBcHAudXBkYXRlKFt0aGlzLCB0aGlzLmxzXSlcbiAgICB9IGVsc2UgQXBwLnVwZGF0ZSh0aGlzKVxuICB9XG5cbiAgcmVjb3JkRXZlbnQoYywgZXYpIHtcbiAgICBpZiAoIXRoaXMubWFjcm9EZWYpIHRoaXMubWFjcm9EZWYgPSBbXVxuXG4gICAgdmFyIHRyaWVfa2V5cyA9IEFwcC5nZXRUcmllS2V5cyhjKVxuXG4gICAgaWYgKGNbdmlld10uY2hpbGRyZW4pIHtcbiAgICAgIHRyaWVfa2V5cy5wdXNoKEFycmF5LnByb3RvdHlwZS5pbmRleE9mLmNhbGwoZXYudGFyZ2V0LnBhcmVudE5vZGUuY2hpbGRyZW4sIGV2LnRhcmdldCkpXG4gICAgfVxuXG4gICAgdGhpcy5tYWNyb0RlZi5wdXNoKHsgdHJpZV9rZXlzLCBldl90eXBlOiBldi50eXBlIH0pXG5cbiAgICByZXR1cm4gdGhpc1xuICB9XG5cbiAgY2xlYXIoKSB7XG4gICAgQXBwLmNsZWFyU3RhdGUoKVxuICB9XG59XG5cbmNsYXNzIEFwcENvdW50ZXIgZXh0ZW5kcyBDb3VudGVyIHtcbiAgY29uc3RydWN0b3IoeyBjb3VudCB9KSB7XG4gICAgc3VwZXIoeyBjb3VudCB9KVxuICAgIHRoaXMudHlwZSA9ICdBcHBDb3VudGVyJ1xuXG4gICAgSWQuYXNzaWduKHRoaXMsICd0YicsICd0b29sYmFyJylcbiAgfVxuXG4gIHBsdXMoZSkge1xuICAgIGlmICh0aGlzLnRiLmlzUmVjb3JkaW5nKSB7XG4gICAgICBBcHAudXBkYXRlKHRoaXMudGIucmVjb3JkRXZlbnQodGhpcywgZSksIGZhbHNlLCB0cnVlKVxuICAgICAgcmV0dXJuIC8vIHByZXZlbnQgbm9ybWFsIGJlaGF2aW9yXG4gICAgfVxuXG4gICAgc3VwZXIucGx1cygpXG4gICAgQXBwLnVwZGF0ZSh0aGlzKVxuICB9XG5cbiAgbWludXMoZSkge1xuICAgIGlmICh0aGlzLnRiLmlzUmVjb3JkaW5nKSB7XG4gICAgICBBcHAudXBkYXRlKHRoaXMudGIucmVjb3JkRXZlbnQodGhpcywgZSksIGZhbHNlLCB0cnVlKVxuICAgICAgcmV0dXJuIC8vIHByZXZlbnQgbm9ybWFsIGJlaGF2aW9yXG4gICAgfVxuXG4gICAgc3VwZXIubWludXMoKVxuICAgIEFwcC51cGRhdGUodGhpcylcbiAgfVxufVxuXG5jbGFzcyBBcHBNYWNybyBleHRlbmRzIE1hY3JvIHtcbiAgY29uc3RydWN0b3IoeyBkZWYgPSBbXSB9KSB7XG4gICAgc3VwZXIoeyB2YWx1ZTogYFBsYXkgTWFjcm8gKCR7ZGVmLmxlbmd0aH0gZXZlbnRzKWAgfSlcbiAgICB0aGlzLmRlZiA9IGRlZlxuICAgIHRoaXMudHlwZSA9ICdBcHBNYWNybydcblxuICAgIElkLmFzc2lnbih0aGlzLCAndGInLCAndG9vbGJhcicpXG4gIH1cblxuICBwbGF5KGUpIHtcbiAgICBpZiAodGhpcy50Yi5pc1JlY29yZGluZykge1xuICAgICAgQXBwLnVwZGF0ZSh0aGlzLnRiLnJlY29yZEV2ZW50KHRoaXMsIGUpLCBmYWxzZSwgdHJ1ZSlcbiAgICAgIHJldHVybiAvLyBwcmV2ZW50IG5vcm1hbCBiZWhhdmlvclxuICAgIH1cblxuICAgIHRoaXMuZGVmLmZvckVhY2goc3RlcCA9PiB7XG4gICAgICB2YXIgZWwgPSBBcHAuJHZpZXdcbiAgICAgIGZvciAodmFyIGkgb2Ygc3RlcC50cmllX2tleXMpIHtcbiAgICAgICAgZWwgPSBlbC5jaGlsZHJlbltpXVxuICAgICAgfVxuICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoc3RlcC5ldl90eXBlKSlcbiAgICB9KVxuICB9XG59XG4vKlxuX19MT1dFUiBBUFAtTEVWRUxfX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19cblxudGhpcyBsZXZlbCBpcyBmb3I6XG4gLSBzb3J0aW5nLCBncm91cGluZywgYW5kIGxvb2stdXAvcmV0cmlldmFsIG9mIGNvbXBvbmVudHMgaW4gdGhlIGFwcGxpY2F0aW9uXG4gLSB0aGV5IGhhdmUgbm8gXCJvd25cIiBkYXRhIHJlbmRlcmVkIG9uIHNjcmVlblxuXG4qL1xuY2xhc3MgTGlzdCB7XG4gIGNvbnN0cnVjdG9yKHsgaWQsIHRhZyA9ICdkaXYnLCBjb21wb25lbnRzID0gW10gfSkge1xuICAgIHRoaXMudHlwZSA9ICdMaXN0JyAvLyBmb3JjZVxuICAgIHRoaXMudGFnID0gdGFnXG4gICAgdGhpcy5jb21wb25lbnRzID0gW11cbiAgICBjb21wb25lbnRzLmZvckVhY2goY19zdGF0ZSA9PiB0aGlzLmFkZChjX3N0YXRlKSlcbiAgICB0aGlzW3ZpZXddID0gdGhpcy5nZXRWaWV3KClcbiAgfVxuXG4gIGFkZChjX3N0YXRlKSB7XG4gICAgdmFyIG5ld19jID0gbmV3IFR5cGVbY19zdGF0ZS50eXBlXShjX3N0YXRlKVxuICAgIG5ld19jW3ZpZXddID0gbmV3X2MuZ2V0VmlldygpXG4gICAgdGhpcy5jb21wb25lbnRzLnB1c2gobmV3X2MpXG4gICAgaWYgKGNfc3RhdGUuaWQpIElkLmFkZChuZXdfYy5pZCA9IGNfc3RhdGUuaWQsIG5ld19jKVxuICAgIHJldHVybiBuZXdfY1xuICB9XG5cbiAgdXBkYXRlKHRoaXNfYykge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYyA9IHRoaXMuY29tcG9uZW50c1tpXVxuXG4gICAgICBpZiAoYyA9PT0gdGhpc19jKSB7XG4gICAgICAgIGNbdmlld10gPSBjLmdldFZpZXcoKVxuICAgICAgICByZXR1cm4gY1xuICAgICAgfVxuXG4gICAgICBpZiAoYyBpbnN0YW5jZW9mIExpc3QpIHtcbiAgICAgICAgaWYgKGMudXBkYXRlKHRoaXNfYykpIHtcbiAgICAgICAgICBjW3ZpZXddID0gYy5nZXRWaWV3KClcbiAgICAgICAgICByZXR1cm4gY1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0VHJpZUtleXModGhpc19jLCBrZXlzID0gW10pIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuY29tcG9uZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGMgPSB0aGlzLmNvbXBvbmVudHNbaV1cblxuICAgICAgaWYgKGMgPT09IHRoaXNfYykge1xuICAgICAgICBrZXlzLnB1c2goaSlcbiAgICAgICAgcmV0dXJuIGtleXNcbiAgICAgIH1cblxuICAgICAgaWYgKGMgaW5zdGFuY2VvZiBMaXN0KSB7XG4gICAgICAgIGlmIChjLmdldFRyaWVLZXlzKHRoaXNfYywga2V5cykpIHtcbiAgICAgICAgICBrZXlzLnVuc2hpZnQoaSlcbiAgICAgICAgICByZXR1cm4ga2V5c1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0VmlldygpIHtcbiAgICByZXR1cm4gaCh0aGlzLnRhZywgdGhpcy5jb21wb25lbnRzLm1hcChjID0+IGNbdmlld10pKVxuICB9XG5cbn1cblxuLy8gY29tcG9uZW50IGNvbnN0cnVjdG9yc1xuY29uc3QgVHlwZSA9IHsgTGlzdCwgQXBwVG9vbGJhciwgQXBwTWFjcm8sIEFwcENvdW50ZXIgfVxuLy8gY29tcG9uZW50IGluc3RhbmNlcyB3aGljaCBhcmUgY3JlYXRlZCB3aXRoIGFuIGlkIHByb3BlcnR5IHdpbGwgZ28gaW4gSWRcbmNvbnN0IElkID0gKCgpID0+IHtcbiAgdmFyIHByb21pc2UgPSB7fVxuICB2YXIgcmVzb2x2ZXIgPSB7fVxuXG4gIHJldHVybiB7XG4gICAgYXNzaWduKGMsIHByb3AsIG5hbWUpIHtcbiAgICAgIHZhciBfYXNzaWduID0gKHZhbCkgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGMsIHByb3AsIHsgdmFsdWU6IHZhbCwgZW51bWVyYWJsZTogZmFsc2UgfSlcblxuICAgICAgaWYgKHByb21pc2VbbmFtZV0pIHtcbiAgICAgICAgcHJvbWlzZVtuYW1lXS50aGVuKF9hc3NpZ24pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlW25hbWVdID0gbmV3IFByb21pc2UocmVzID0+IHtcbiAgICAgICAgICB2YXIgciA9IGMgPT4gcmVzKGMpXG4gICAgICAgICAgcmVzb2x2ZXJbbmFtZV0gPSByXG4gICAgICAgIH0pLnRoZW4oX2Fzc2lnbilcbiAgICAgIH1cbiAgICB9LFxuICAgIGFkZChuYW1lLCBjKSB7XG4gICAgICBpZiAocHJvbWlzZVtuYW1lXSkge1xuICAgICAgICBpZiAoIXJlc29sdmVyW25hbWVdKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJZCBuYW1lICR7bmFtZX0gaGFzIGFscmVhZHkgYmVlbiBhZGRlZGApXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZXJbbmFtZV0oYylcbiAgICAgICAgICBkZWxldGUgcmVzb2x2ZXJbbmFtZV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHByb21pc2VbbmFtZV0gPSBQcm9taXNlLnJlc29sdmUoYylcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKClcblxuLypcbl9fVVBQRVIgQVBQLUxFVkVMX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXG5cbnRoaXMgbGV2ZWwgaXMgZm9yOlxuICAtIHBhdGNoaW5nIHRoZSBET00gb3Igc2F2aW5nIHRoZSBzdGF0ZSBvZiB0aGUgYXBwbGljYXRpb25cbiAgLSBkZWZpbmluZyB0aGUgcGVyc2lzdGVuY2UgbWVjaGFuaXNtIChsb2NhbFN0b3JhZ2UsIGluIHRoaXMgY2FzZSlcbiAgLSBkZWZpbmluZyB0aGUgaW5pdGlhbCBhcHBsaWNhdGlvbiBpbnN0YW5jZShzKSBhbmQgdGhlaXIgbG9jYXRpb24gaW4gdGhlIERPTVxuXG4qL1xuY2xhc3MgTG9jYWxTdG9yYWdlQXBwbGljYXRpb24gZXh0ZW5kcyBMaXN0IHtcbiAgY29uc3RydWN0b3IoeyBpZCwgdGFnLCBjb21wb25lbnRzIH0pIHtcbiAgICB2YXIgc2F2ZWRTdGF0ZSA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oaWQpKVxuXG4gICAgaWYgKHNhdmVkU3RhdGUpIHN1cGVyKHNhdmVkU3RhdGUpXG4gICAgZWxzZSBzdXBlcih7IHRhZywgY29tcG9uZW50cyB9KVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpZCcsIHsgdmFsdWU6IGlkLCBlbnVtZXJhYmxlOiBmYWxzZSB9KVxuICB9XG5cbiAgdXBkYXRlKGNvbXBvbmVudCwgZG9QYXRjaCA9IHRydWUsIGRvU2F2ZSA9IHRydWUpIHtcbiAgICAvLyByZWNvbXBpbGUgdmlld3NcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjb21wb25lbnQpKSB7XG4gICAgICBmb3IgKHZhciBjIG9mIGNvbXBvbmVudCkgc3VwZXIudXBkYXRlKGMpXG4gICAgfSBlbHNlIHN1cGVyLnVwZGF0ZShjb21wb25lbnQpXG5cbiAgICBpZiAoZG9QYXRjaCkge1xuICAgICAgLy8gcGF0Y2ggRE9NXG4gICAgICB2YXIgbmV3X3YgPSB0aGlzLmdldFZpZXcoKVxuICAgICAgcGF0Y2godGhpc1t2aWV3XSwgbmV3X3YpXG4gICAgICB0aGlzW3ZpZXddID0gbmV3X3ZcbiAgICB9XG5cbiAgICBpZiAoZG9TYXZlKSB7XG4gICAgICAvLyBzYXZlIHN0YXRlXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLmlkLCBKU09OLnN0cmluZ2lmeSh0aGlzKSlcbiAgICB9XG4gIH1cblxuICBjbGVhclN0YXRlKCkge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRoaXMuaWQpXG4gIH1cblxufVxuXG5jbGFzcyBEZW1vIGV4dGVuZHMgTG9jYWxTdG9yYWdlQXBwbGljYXRpb24ge1xuICBjb25zdHJ1Y3RvcigkdmlldywgJHN0YXRlLCBzdXBlclN0YXRlKSB7XG4gICAgc3VwZXIoc3VwZXJTdGF0ZSlcblxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICAgICR2aWV3OiB7IHZhbHVlOiAkdmlldywgZW51bWVyYWJsZTogZmFsc2UgfSxcbiAgICAgICRzdGF0ZTogeyB2YWx1ZTogJHN0YXRlLCBlbnVtZXJhYmxlOiBmYWxzZSB9XG4gICAgfSlcblxuICAgIHBhdGNoKHRoaXMuJHZpZXcsIHRoaXNbdmlld10pXG4gICAgdGhpcy5vdXRwdXRTdGF0ZSgpXG4gIH1cblxuICB1cGRhdGUoKSB7XG4gICAgc3VwZXIudXBkYXRlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB0aGlzLm91dHB1dFN0YXRlKClcbiAgfVxuXG4gIGNsZWFyU3RhdGUoKSB7XG4gICAgc3VwZXIuY2xlYXJTdGF0ZSgpXG4gICAgd2luZG93LmFsZXJ0KCdUaGUgc3RhdGUgaGFzIGJlZW4gY2xlYXJlZCBmcm9tIGxvY2FsU3RvcmFnZS4gSG93ZXZlciwgdGhlIGN1cnJlbnQgc3RhdGUgaXMgc3RpbGwgaW4tbWVtb3J5LiBUbyByZXNldCB0aGUgZGVtbywgeW91IG11c3QgcmVmcmVzaCB5b3VyIGJyb3dzZXIgbm93LicpXG4gIH1cbiAgb3V0cHV0U3RhdGUoKSB7XG4gICAgdGhpcy4kc3RhdGUuaW5uZXJUZXh0ID0gSlNPTi5zdHJpbmdpZnkodGhpcywgdW5kZWZpbmVkLCAxKVxuICB9XG59XG5cbi8qXG5fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX1xuXG4qL1xuXG5jb25zdCBBcHAgPSBuZXcgRGVtbyhkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnQ291bnRlckRlbW8nKSwgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ19zdGF0ZScpLCB7XG4gIGlkOiAnQ291bnRlckRlbW8nLFxuICBjb21wb25lbnRzOiBbXG4gICAgeyB0eXBlOiAnQXBwVG9vbGJhcicsIGlkOiAndG9vbGJhcicgfSxcbiAgICB7IHR5cGU6ICdMaXN0JywgaWQ6ICdsaXN0JyB9XG4gIF1cbn0pIiwidmFyIFZOb2RlID0gcmVxdWlyZSgnLi92bm9kZScpO1xudmFyIGlzID0gcmVxdWlyZSgnLi9pcycpO1xuXG5mdW5jdGlvbiBhZGROUyhkYXRhLCBjaGlsZHJlbikge1xuICBkYXRhLm5zID0gJ2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJztcbiAgaWYgKGNoaWxkcmVuICE9PSB1bmRlZmluZWQpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBhZGROUyhjaGlsZHJlbltpXS5kYXRhLCBjaGlsZHJlbltpXS5jaGlsZHJlbik7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaChzZWwsIGIsIGMpIHtcbiAgdmFyIGRhdGEgPSB7fSwgY2hpbGRyZW4sIHRleHQsIGk7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgZGF0YSA9IGI7XG4gICAgaWYgKGlzLmFycmF5KGMpKSB7IGNoaWxkcmVuID0gYzsgfVxuICAgIGVsc2UgaWYgKGlzLnByaW1pdGl2ZShjKSkgeyB0ZXh0ID0gYzsgfVxuICB9IGVsc2UgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBpZiAoaXMuYXJyYXkoYikpIHsgY2hpbGRyZW4gPSBiOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGIpKSB7IHRleHQgPSBiOyB9XG4gICAgZWxzZSB7IGRhdGEgPSBiOyB9XG4gIH1cbiAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7ICsraSkge1xuICAgICAgaWYgKGlzLnByaW1pdGl2ZShjaGlsZHJlbltpXSkpIGNoaWxkcmVuW2ldID0gVk5vZGUodW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY2hpbGRyZW5baV0pO1xuICAgIH1cbiAgfVxuICBpZiAoc2VsWzBdID09PSAncycgJiYgc2VsWzFdID09PSAndicgJiYgc2VsWzJdID09PSAnZycpIHtcbiAgICBhZGROUyhkYXRhLCBjaGlsZHJlbik7XG4gIH1cbiAgcmV0dXJuIFZOb2RlKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIHVuZGVmaW5lZCk7XG59O1xuIiwiZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh0YWdOYW1lKXtcbiAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQodGFnTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnROUyhuYW1lc3BhY2VVUkksIHF1YWxpZmllZE5hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVRleHROb2RlKHRleHQpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCk7XG59XG5cblxuZnVuY3Rpb24gaW5zZXJ0QmVmb3JlKHBhcmVudE5vZGUsIG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpe1xuICBwYXJlbnROb2RlLmluc2VydEJlZm9yZShuZXdOb2RlLCByZWZlcmVuY2VOb2RlKTtcbn1cblxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUucmVtb3ZlQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBhcHBlbmRDaGlsZChub2RlLCBjaGlsZCl7XG4gIG5vZGUuYXBwZW5kQ2hpbGQoY2hpbGQpO1xufVxuXG5mdW5jdGlvbiBwYXJlbnROb2RlKG5vZGUpe1xuICByZXR1cm4gbm9kZS5wYXJlbnRFbGVtZW50O1xufVxuXG5mdW5jdGlvbiBuZXh0U2libGluZyhub2RlKXtcbiAgcmV0dXJuIG5vZGUubmV4dFNpYmxpbmc7XG59XG5cbmZ1bmN0aW9uIHRhZ05hbWUobm9kZSl7XG4gIHJldHVybiBub2RlLnRhZ05hbWU7XG59XG5cbmZ1bmN0aW9uIHNldFRleHRDb250ZW50KG5vZGUsIHRleHQpe1xuICBub2RlLnRleHRDb250ZW50ID0gdGV4dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGNyZWF0ZUVsZW1lbnQ6IGNyZWF0ZUVsZW1lbnQsXG4gIGNyZWF0ZUVsZW1lbnROUzogY3JlYXRlRWxlbWVudE5TLFxuICBjcmVhdGVUZXh0Tm9kZTogY3JlYXRlVGV4dE5vZGUsXG4gIGFwcGVuZENoaWxkOiBhcHBlbmRDaGlsZCxcbiAgcmVtb3ZlQ2hpbGQ6IHJlbW92ZUNoaWxkLFxuICBpbnNlcnRCZWZvcmU6IGluc2VydEJlZm9yZSxcbiAgcGFyZW50Tm9kZTogcGFyZW50Tm9kZSxcbiAgbmV4dFNpYmxpbmc6IG5leHRTaWJsaW5nLFxuICB0YWdOYW1lOiB0YWdOYW1lLFxuICBzZXRUZXh0Q29udGVudDogc2V0VGV4dENvbnRlbnRcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgYXJyYXk6IEFycmF5LmlzQXJyYXksXG4gIHByaW1pdGl2ZTogZnVuY3Rpb24ocykgeyByZXR1cm4gdHlwZW9mIHMgPT09ICdzdHJpbmcnIHx8IHR5cGVvZiBzID09PSAnbnVtYmVyJzsgfSxcbn07XG4iLCJ2YXIgaXMgPSByZXF1aXJlKCcuLi9pcycpO1xuXG5mdW5jdGlvbiBhcnJJbnZva2VyKGFycikge1xuICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgLy8gU3BlY2lhbCBjYXNlIHdoZW4gbGVuZ3RoIGlzIHR3bywgZm9yIHBlcmZvcm1hbmNlXG4gICAgYXJyLmxlbmd0aCA9PT0gMiA/IGFyclswXShhcnJbMV0pIDogYXJyWzBdLmFwcGx5KHVuZGVmaW5lZCwgYXJyLnNsaWNlKDEpKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZm5JbnZva2VyKG8pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uKGV2KSB7IG8uZm4oZXYpOyB9O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVFdmVudExpc3RlbmVycyhvbGRWbm9kZSwgdm5vZGUpIHtcbiAgdmFyIG5hbWUsIGN1ciwgb2xkLCBlbG0gPSB2bm9kZS5lbG0sXG4gICAgICBvbGRPbiA9IG9sZFZub2RlLmRhdGEub24gfHwge30sIG9uID0gdm5vZGUuZGF0YS5vbjtcbiAgaWYgKCFvbikgcmV0dXJuO1xuICBmb3IgKG5hbWUgaW4gb24pIHtcbiAgICBjdXIgPSBvbltuYW1lXTtcbiAgICBvbGQgPSBvbGRPbltuYW1lXTtcbiAgICBpZiAob2xkID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGlmIChpcy5hcnJheShjdXIpKSB7XG4gICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGFyckludm9rZXIoY3VyKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjdXIgPSB7IGZuOiBjdXIgfTtcbiAgICAgICAgb25bbmFtZV0gPSBjdXI7XG4gICAgICAgIGVsbS5hZGRFdmVudExpc3RlbmVyKG5hbWUsIGZuSW52b2tlcihjdXIpKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzLmFycmF5KG9sZCkpIHtcbiAgICAgIC8vIERlbGliZXJhdGVseSBtb2RpZnkgb2xkIGFycmF5IHNpbmNlIGl0J3MgY2FwdHVyZWQgaW4gY2xvc3VyZSBjcmVhdGVkIHdpdGggYGFyckludm9rZXJgXG4gICAgICBvbGQubGVuZ3RoID0gY3VyLmxlbmd0aDtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgb2xkLmxlbmd0aDsgKytpKSBvbGRbaV0gPSBjdXJbaV07XG4gICAgICBvbltuYW1lXSAgPSBvbGQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9sZC5mbiA9IGN1cjtcbiAgICAgIG9uW25hbWVdID0gb2xkO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtjcmVhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzLCB1cGRhdGU6IHVwZGF0ZUV2ZW50TGlzdGVuZXJzfTtcbiIsIi8vIGpzaGludCBuZXdjYXA6IGZhbHNlXG4vKiBnbG9iYWwgcmVxdWlyZSwgbW9kdWxlLCBkb2N1bWVudCwgTm9kZSAqL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG52YXIgZG9tQXBpID0gcmVxdWlyZSgnLi9odG1sZG9tYXBpLmpzJyk7XG5cbmZ1bmN0aW9uIGlzVW5kZWYocykgeyByZXR1cm4gcyA9PT0gdW5kZWZpbmVkOyB9XG5mdW5jdGlvbiBpc0RlZihzKSB7IHJldHVybiBzICE9PSB1bmRlZmluZWQ7IH1cblxudmFyIGVtcHR5Tm9kZSA9IFZOb2RlKCcnLCB7fSwgW10sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblxuZnVuY3Rpb24gc2FtZVZub2RlKHZub2RlMSwgdm5vZGUyKSB7XG4gIHJldHVybiB2bm9kZTEua2V5ID09PSB2bm9kZTIua2V5ICYmIHZub2RlMS5zZWwgPT09IHZub2RlMi5zZWw7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUtleVRvT2xkSWR4KGNoaWxkcmVuLCBiZWdpbklkeCwgZW5kSWR4KSB7XG4gIHZhciBpLCBtYXAgPSB7fSwga2V5O1xuICBmb3IgKGkgPSBiZWdpbklkeDsgaSA8PSBlbmRJZHg7ICsraSkge1xuICAgIGtleSA9IGNoaWxkcmVuW2ldLmtleTtcbiAgICBpZiAoaXNEZWYoa2V5KSkgbWFwW2tleV0gPSBpO1xuICB9XG4gIHJldHVybiBtYXA7XG59XG5cbnZhciBob29rcyA9IFsnY3JlYXRlJywgJ3VwZGF0ZScsICdyZW1vdmUnLCAnZGVzdHJveScsICdwcmUnLCAncG9zdCddO1xuXG5mdW5jdGlvbiBpbml0KG1vZHVsZXMsIGFwaSkge1xuICB2YXIgaSwgaiwgY2JzID0ge307XG5cbiAgaWYgKGlzVW5kZWYoYXBpKSkgYXBpID0gZG9tQXBpO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBob29rcy5sZW5ndGg7ICsraSkge1xuICAgIGNic1tob29rc1tpXV0gPSBbXTtcbiAgICBmb3IgKGogPSAwOyBqIDwgbW9kdWxlcy5sZW5ndGg7ICsraikge1xuICAgICAgaWYgKG1vZHVsZXNbal1baG9va3NbaV1dICE9PSB1bmRlZmluZWQpIGNic1tob29rc1tpXV0ucHVzaChtb2R1bGVzW2pdW2hvb2tzW2ldXSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gZW1wdHlOb2RlQXQoZWxtKSB7XG4gICAgcmV0dXJuIFZOb2RlKGFwaS50YWdOYW1lKGVsbSkudG9Mb3dlckNhc2UoKSwge30sIFtdLCB1bmRlZmluZWQsIGVsbSk7XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVSbUNiKGNoaWxkRWxtLCBsaXN0ZW5lcnMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBpZiAoLS1saXN0ZW5lcnMgPT09IDApIHtcbiAgICAgICAgdmFyIHBhcmVudCA9IGFwaS5wYXJlbnROb2RlKGNoaWxkRWxtKTtcbiAgICAgICAgYXBpLnJlbW92ZUNoaWxkKHBhcmVudCwgY2hpbGRFbG0pO1xuICAgICAgfVxuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCB0aHVuaywgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuaW5pdCkpIGkodm5vZGUpO1xuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLnZub2RlKSkge1xuICAgICAgICAgIHRodW5rID0gdm5vZGU7XG4gICAgICAgICAgdm5vZGUgPSBpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgZWxtLCBjaGlsZHJlbiA9IHZub2RlLmNoaWxkcmVuLCBzZWwgPSB2bm9kZS5zZWw7XG4gICAgaWYgKGlzRGVmKHNlbCkpIHtcbiAgICAgIC8vIFBhcnNlIHNlbGVjdG9yXG4gICAgICB2YXIgaGFzaElkeCA9IHNlbC5pbmRleE9mKCcjJyk7XG4gICAgICB2YXIgZG90SWR4ID0gc2VsLmluZGV4T2YoJy4nLCBoYXNoSWR4KTtcbiAgICAgIHZhciBoYXNoID0gaGFzaElkeCA+IDAgPyBoYXNoSWR4IDogc2VsLmxlbmd0aDtcbiAgICAgIHZhciBkb3QgPSBkb3RJZHggPiAwID8gZG90SWR4IDogc2VsLmxlbmd0aDtcbiAgICAgIHZhciB0YWcgPSBoYXNoSWR4ICE9PSAtMSB8fCBkb3RJZHggIT09IC0xID8gc2VsLnNsaWNlKDAsIE1hdGgubWluKGhhc2gsIGRvdCkpIDogc2VsO1xuICAgICAgZWxtID0gdm5vZGUuZWxtID0gaXNEZWYoZGF0YSkgJiYgaXNEZWYoaSA9IGRhdGEubnMpID8gYXBpLmNyZWF0ZUVsZW1lbnROUyhpLCB0YWcpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgOiBhcGkuY3JlYXRlRWxlbWVudCh0YWcpO1xuICAgICAgaWYgKGhhc2ggPCBkb3QpIGVsbS5pZCA9IHNlbC5zbGljZShoYXNoICsgMSwgZG90KTtcbiAgICAgIGlmIChkb3RJZHggPiAwKSBlbG0uY2xhc3NOYW1lID0gc2VsLnNsaWNlKGRvdCsxKS5yZXBsYWNlKC9cXC4vZywgJyAnKTtcbiAgICAgIGlmIChpcy5hcnJheShjaGlsZHJlbikpIHtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICAgICAgYXBpLmFwcGVuZENoaWxkKGVsbSwgY3JlYXRlRWxtKGNoaWxkcmVuW2ldLCBpbnNlcnRlZFZub2RlUXVldWUpKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIGlmIChpcy5wcmltaXRpdmUodm5vZGUudGV4dCkpIHtcbiAgICAgICAgYXBpLmFwcGVuZENoaWxkKGVsbSwgYXBpLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpKTtcbiAgICAgIH1cbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMuY3JlYXRlLmxlbmd0aDsgKytpKSBjYnMuY3JlYXRlW2ldKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgaSA9IHZub2RlLmRhdGEuaG9vazsgLy8gUmV1c2UgdmFyaWFibGVcbiAgICAgIGlmIChpc0RlZihpKSkge1xuICAgICAgICBpZiAoaS5jcmVhdGUpIGkuY3JlYXRlKGVtcHR5Tm9kZSwgdm5vZGUpO1xuICAgICAgICBpZiAoaS5pbnNlcnQpIGluc2VydGVkVm5vZGVRdWV1ZS5wdXNoKHZub2RlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWxtID0gdm5vZGUuZWxtID0gYXBpLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYodGh1bmspKSB0aHVuay5lbG0gPSB2bm9kZS5lbG07XG4gICAgcmV0dXJuIHZub2RlLmVsbTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4LCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICBmb3IgKDsgc3RhcnRJZHggPD0gZW5kSWR4OyArK3N0YXJ0SWR4KSB7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKHZub2Rlc1tzdGFydElkeF0sIGluc2VydGVkVm5vZGVRdWV1ZSksIGJlZm9yZSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gaW52b2tlRGVzdHJveUhvb2sodm5vZGUpIHtcbiAgICB2YXIgaSwgaiwgZGF0YSA9IHZub2RlLmRhdGE7XG4gICAgaWYgKGlzRGVmKGRhdGEpKSB7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEuaG9vaykgJiYgaXNEZWYoaSA9IGkuZGVzdHJveSkpIGkodm5vZGUpO1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5kZXN0cm95Lmxlbmd0aDsgKytpKSBjYnMuZGVzdHJveVtpXSh2bm9kZSk7XG4gICAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGogPSAwOyBqIDwgdm5vZGUuY2hpbGRyZW4ubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayh2bm9kZS5jaGlsZHJlbltqXSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS52bm9kZSkpIGludm9rZURlc3Ryb3lIb29rKGkpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIHZub2Rlcywgc3RhcnRJZHgsIGVuZElkeCkge1xuICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgIHZhciBpLCBsaXN0ZW5lcnMsIHJtLCBjaCA9IHZub2Rlc1tzdGFydElkeF07XG4gICAgICBpZiAoaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChpc0RlZihjaC5zZWwpKSB7XG4gICAgICAgICAgaW52b2tlRGVzdHJveUhvb2soY2gpO1xuICAgICAgICAgIGxpc3RlbmVycyA9IGNicy5yZW1vdmUubGVuZ3RoICsgMTtcbiAgICAgICAgICBybSA9IGNyZWF0ZVJtQ2IoY2guZWxtLCBsaXN0ZW5lcnMpO1xuICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucmVtb3ZlLmxlbmd0aDsgKytpKSBjYnMucmVtb3ZlW2ldKGNoLCBybSk7XG4gICAgICAgICAgaWYgKGlzRGVmKGkgPSBjaC5kYXRhKSAmJiBpc0RlZihpID0gaS5ob29rKSAmJiBpc0RlZihpID0gaS5yZW1vdmUpKSB7XG4gICAgICAgICAgICBpKGNoLCBybSk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJtKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgeyAvLyBUZXh0IG5vZGVcbiAgICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50RWxtLCBjaC5lbG0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlQ2hpbGRyZW4ocGFyZW50RWxtLCBvbGRDaCwgbmV3Q2gsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBvbGRTdGFydElkeCA9IDAsIG5ld1N0YXJ0SWR4ID0gMDtcbiAgICB2YXIgb2xkRW5kSWR4ID0gb2xkQ2gubGVuZ3RoIC0gMTtcbiAgICB2YXIgb2xkU3RhcnRWbm9kZSA9IG9sZENoWzBdO1xuICAgIHZhciBvbGRFbmRWbm9kZSA9IG9sZENoW29sZEVuZElkeF07XG4gICAgdmFyIG5ld0VuZElkeCA9IG5ld0NoLmxlbmd0aCAtIDE7XG4gICAgdmFyIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFswXTtcbiAgICB2YXIgbmV3RW5kVm5vZGUgPSBuZXdDaFtuZXdFbmRJZHhdO1xuICAgIHZhciBvbGRLZXlUb0lkeCwgaWR4SW5PbGQsIGVsbVRvTW92ZSwgYmVmb3JlO1xuXG4gICAgd2hpbGUgKG9sZFN0YXJ0SWR4IDw9IG9sZEVuZElkeCAmJiBuZXdTdGFydElkeCA8PSBuZXdFbmRJZHgpIHtcbiAgICAgIGlmIChpc1VuZGVmKG9sZFN0YXJ0Vm5vZGUpKSB7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTsgLy8gVm5vZGUgaGFzIGJlZW4gbW92ZWQgbGVmdFxuICAgICAgfSBlbHNlIGlmIChpc1VuZGVmKG9sZEVuZFZub2RlKSkge1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld1N0YXJ0Vm5vZGUpKSB7XG4gICAgICAgIHBhdGNoVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRFbmRWbm9kZSwgbmV3RW5kVm5vZGUpKSB7XG4gICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBvbGRFbmRWbm9kZSA9IG9sZENoWy0tb2xkRW5kSWR4XTtcbiAgICAgICAgbmV3RW5kVm5vZGUgPSBuZXdDaFstLW5ld0VuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRTdGFydFZub2RlLCBuZXdFbmRWbm9kZSkpIHsgLy8gVm5vZGUgbW92ZWQgcmlnaHRcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdFbmRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtLCBhcGkubmV4dFNpYmxpbmcob2xkRW5kVm5vZGUuZWxtKSk7XG4gICAgICAgIG9sZFN0YXJ0Vm5vZGUgPSBvbGRDaFsrK29sZFN0YXJ0SWR4XTtcbiAgICAgICAgbmV3RW5kVm5vZGUgPSBuZXdDaFstLW5ld0VuZElkeF07XG4gICAgICB9IGVsc2UgaWYgKHNhbWVWbm9kZShvbGRFbmRWbm9kZSwgbmV3U3RhcnRWbm9kZSkpIHsgLy8gVm5vZGUgbW92ZWQgbGVmdFxuICAgICAgICBwYXRjaFZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgb2xkRW5kVm5vZGUuZWxtLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoaXNVbmRlZihvbGRLZXlUb0lkeCkpIG9sZEtleVRvSWR4ID0gY3JlYXRlS2V5VG9PbGRJZHgob2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgICAgICBpZHhJbk9sZCA9IG9sZEtleVRvSWR4W25ld1N0YXJ0Vm5vZGUua2V5XTtcbiAgICAgICAgaWYgKGlzVW5kZWYoaWR4SW5PbGQpKSB7IC8vIE5ldyBlbGVtZW50XG4gICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGNyZWF0ZUVsbShuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpLCBvbGRTdGFydFZub2RlLmVsbSk7XG4gICAgICAgICAgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWysrbmV3U3RhcnRJZHhdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGVsbVRvTW92ZSA9IG9sZENoW2lkeEluT2xkXTtcbiAgICAgICAgICBwYXRjaFZub2RlKGVsbVRvTW92ZSwgbmV3U3RhcnRWbm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICAgICAgICBvbGRDaFtpZHhJbk9sZF0gPSB1bmRlZmluZWQ7XG4gICAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbVRvTW92ZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9sZFN0YXJ0SWR4ID4gb2xkRW5kSWR4KSB7XG4gICAgICBiZWZvcmUgPSBpc1VuZGVmKG5ld0NoW25ld0VuZElkeCsxXSkgPyBudWxsIDogbmV3Q2hbbmV3RW5kSWR4KzFdLmVsbTtcbiAgICAgIGFkZFZub2RlcyhwYXJlbnRFbG0sIGJlZm9yZSwgbmV3Q2gsIG5ld1N0YXJ0SWR4LCBuZXdFbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgfSBlbHNlIGlmIChuZXdTdGFydElkeCA+IG5ld0VuZElkeCkge1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgb2xkQ2gsIG9sZFN0YXJ0SWR4LCBvbGRFbmRJZHgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpIHtcbiAgICB2YXIgaSwgaG9vaztcbiAgICBpZiAoaXNEZWYoaSA9IHZub2RlLmRhdGEpICYmIGlzRGVmKGhvb2sgPSBpLmhvb2spICYmIGlzRGVmKGkgPSBob29rLnByZXBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYoaSA9IG9sZFZub2RlLmRhdGEpICYmIGlzRGVmKGkgPSBpLnZub2RlKSkgb2xkVm5vZGUgPSBpO1xuICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaSA9IGkudm5vZGUpKSB7XG4gICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCBpLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgdm5vZGUuZWxtID0gaS5lbG07XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBlbG0gPSB2bm9kZS5lbG0gPSBvbGRWbm9kZS5lbG0sIG9sZENoID0gb2xkVm5vZGUuY2hpbGRyZW4sIGNoID0gdm5vZGUuY2hpbGRyZW47XG4gICAgaWYgKG9sZFZub2RlID09PSB2bm9kZSkgcmV0dXJuO1xuICAgIGlmICghc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHZhciBwYXJlbnRFbG0gPSBhcGkucGFyZW50Tm9kZShvbGRWbm9kZS5lbG0pO1xuICAgICAgZWxtID0gY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnRFbG0sIGVsbSwgb2xkVm5vZGUuZWxtKTtcbiAgICAgIHJlbW92ZVZub2RlcyhwYXJlbnRFbG0sIFtvbGRWbm9kZV0sIDAsIDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoaXNEZWYodm5vZGUuZGF0YSkpIHtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBjYnMudXBkYXRlLmxlbmd0aDsgKytpKSBjYnMudXBkYXRlW2ldKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rO1xuICAgICAgaWYgKGlzRGVmKGkpICYmIGlzRGVmKGkgPSBpLnVwZGF0ZSkpIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gICAgaWYgKGlzVW5kZWYodm5vZGUudGV4dCkpIHtcbiAgICAgIGlmIChpc0RlZihvbGRDaCkgJiYgaXNEZWYoY2gpKSB7XG4gICAgICAgIGlmIChvbGRDaCAhPT0gY2gpIHVwZGF0ZUNoaWxkcmVuKGVsbSwgb2xkQ2gsIGNoLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICAgIGFkZFZub2RlcyhlbG0sIG51bGwsIGNoLCAwLCBjaC5sZW5ndGggLSAxLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRDaCkpIHtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKGVsbSwgb2xkQ2gsIDAsIG9sZENoLmxlbmd0aCAtIDEpO1xuICAgICAgfSBlbHNlIGlmIChpc0RlZihvbGRWbm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCAnJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvbGRWbm9kZS50ZXh0ICE9PSB2bm9kZS50ZXh0KSB7XG4gICAgICBhcGkuc2V0VGV4dENvbnRlbnQoZWxtLCB2bm9kZS50ZXh0KTtcbiAgICB9XG4gICAgaWYgKGlzRGVmKGhvb2spICYmIGlzRGVmKGkgPSBob29rLnBvc3RwYXRjaCkpIHtcbiAgICAgIGkob2xkVm5vZGUsIHZub2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZnVuY3Rpb24ob2xkVm5vZGUsIHZub2RlKSB7XG4gICAgdmFyIGksIGVsbSwgcGFyZW50O1xuICAgIHZhciBpbnNlcnRlZFZub2RlUXVldWUgPSBbXTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnByZS5sZW5ndGg7ICsraSkgY2JzLnByZVtpXSgpO1xuXG4gICAgaWYgKGlzVW5kZWYob2xkVm5vZGUuc2VsKSkge1xuICAgICAgb2xkVm5vZGUgPSBlbXB0eU5vZGVBdChvbGRWbm9kZSk7XG4gICAgfVxuXG4gICAgaWYgKHNhbWVWbm9kZShvbGRWbm9kZSwgdm5vZGUpKSB7XG4gICAgICBwYXRjaFZub2RlKG9sZFZub2RlLCB2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZWxtID0gb2xkVm5vZGUuZWxtO1xuICAgICAgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoZWxtKTtcblxuICAgICAgY3JlYXRlRWxtKHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuXG4gICAgICBpZiAocGFyZW50ICE9PSBudWxsKSB7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50LCB2bm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhlbG0pKTtcbiAgICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudCwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChpID0gMDsgaSA8IGluc2VydGVkVm5vZGVRdWV1ZS5sZW5ndGg7ICsraSkge1xuICAgICAgaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldLmRhdGEuaG9vay5pbnNlcnQoaW5zZXJ0ZWRWbm9kZVF1ZXVlW2ldKTtcbiAgICB9XG4gICAgZm9yIChpID0gMDsgaSA8IGNicy5wb3N0Lmxlbmd0aDsgKytpKSBjYnMucG9zdFtpXSgpO1xuICAgIHJldHVybiB2bm9kZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7aW5pdDogaW5pdH07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHNlbCwgZGF0YSwgY2hpbGRyZW4sIHRleHQsIGVsbSkge1xuICB2YXIga2V5ID0gZGF0YSA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDogZGF0YS5rZXk7XG4gIHJldHVybiB7c2VsOiBzZWwsIGRhdGE6IGRhdGEsIGNoaWxkcmVuOiBjaGlsZHJlbixcbiAgICAgICAgICB0ZXh0OiB0ZXh0LCBlbG06IGVsbSwga2V5OiBrZXl9O1xufTtcbiJdfQ==
