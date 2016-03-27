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
    var trie_keys = App.getTrieKeys(c)

    var $childs = c[view].children.map(child => child.elm)

    if ($childs.length > 0) {
      trie_keys.push($childs.indexOf(ev.target))
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
      App.update(this.tb.recordEvent(this, e), { doPatch: false })
      return // prevent normal behavior
    }

    super.plus()
    App.update(this)
  }

  minus(e) {
    if (this.tb.isRecording) {
      App.update(this.tb.recordEvent(this, e), { doPatch: false })
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
      App.update(this.tb.recordEvent(this, e), { doPatch: false })
      return // prevent normal behavior
    }

    var top_view = App[view]

    this.def.forEach(step => {
      var view = top_view
      for (var i of step.trie_keys) {
        view = view.children[i]
      }
      view.data.on[step.ev_type].fn({ type: step.ev_type })
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
      $state: { value: $state, enumerable: false }
    })

    patch($view, this[view])
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
var App = new Demo(document.getElementById('CounterDemo'), document.getElementById('_state'), {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJhcHAvanMvbWFpbi4xLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL2guanMiLCJub2RlX21vZHVsZXMvc25hYmJkb20vaHRtbGRvbWFwaS5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9pcy5qcyIsIm5vZGVfbW9kdWxlcy9zbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3NuYWJiZG9tLmpzIiwibm9kZV9tb2R1bGVzL3NuYWJiZG9tL3Zub2RlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1V0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3REQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM1FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCdcbmNvbnN0IHNuYWJiZG9tID0gcmVxdWlyZSgnc25hYmJkb20nKVxuY29uc3QgcGF0Y2ggPSBzbmFiYmRvbS5pbml0KFsgLy8gSW5pdCBwYXRjaCBmdW5jdGlvbiB3aXRoIGNob29zZW4gbW9kdWxlc1xuICByZXF1aXJlKCdzbmFiYmRvbS9tb2R1bGVzL2V2ZW50bGlzdGVuZXJzJykgLy8gYXR0YWNoZXMgZXZlbnQgbGlzdGVuZXJzXG5dKVxuY29uc3QgaCA9IHJlcXVpcmUoJ3NuYWJiZG9tL2gnKVxuY29uc3QgdmlldyA9IFN5bWJvbCgndmlldycpXG4vKlxuX19MT1dFUiBDT01QT05FTlQtTEVWRUxfX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19cblxudGhpcyBsZXZlbCBpcyBmb3I6XG4gLSBkZWZpbmluZyBtZXRob2RzIHdoaWNoIG1hbmlwdWxhdGUgY29tcG9uZW50J3Mgb3duIGRhdGFcbiAtIGRlZmluaW5nIGNvbXBvbmVudCBwcmVzZW50YXRpb24gdmlhICNnZXRWaWV3IChob3dldmVyLCBtZXRob2RzIHNob3VsZCBOT1QgY2FsbCAjZ2V0VmlldyB0aGVtc2VsdmVzKVxuIC0gdGhlc2UgY29tcG9uZW50cyBkbyBub3QgY29tbXVuaWNhdGUgd2l0aCBvdGhlciBjb21wb25lbnRzIG9yIHRoZSBhcHBsaWNhdGlvblxuXG4gKi9cbmNsYXNzIFRvb2xiYXIge1xuICBjb25zdHJ1Y3Rvcih7IGlzUmVjb3JkaW5nID0gZmFsc2UgfSkge1xuICAgIHRoaXMuaXNSZWNvcmRpbmcgPSBpc1JlY29yZGluZ1xuICB9XG5cbiAgbmV3KCkgeyB9XG4gIHJlY29yZCgpIHtcbiAgICB0aGlzLmlzUmVjb3JkaW5nID8gdGhpcy5pc1JlY29yZGluZyA9IGZhbHNlIDogdGhpcy5pc1JlY29yZGluZyA9IHRydWVcbiAgfVxuICBjbGVhcigpIHsgfVxuXG4gIGdldFZpZXcoKSB7XG4gICAgcmV0dXJuIGgoJ2RpdicsIFtcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLm5ldyhlKSB9IH0sICdOZXcnKSxcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLnJlY29yZChlKSB9IH0sIHRoaXMuaXNSZWNvcmRpbmcgPyAnU3RvcCBSZWNvcmRpbmcnIDogJ1N0YXJ0IFJlY29yZGluZycpLFxuICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKGUpID0+IHRoaXMuY2xlYXIoZSkgfSB9LCAnQ2xlYXIgU3RhdGUnKVxuICAgIF0pXG4gIH1cbn1cblxuY2xhc3MgQ291bnRlciB7XG4gIGNvbnN0cnVjdG9yKHsgY291bnQgPSAwIH0pIHtcbiAgICB0aGlzLmNvdW50ID0gY291bnRcbiAgfVxuXG4gIHBsdXMoKSB7IHRoaXMuY291bnQgKz0gMSB9XG4gIG1pbnVzKCkgeyB0aGlzLmNvdW50IC09IDEgfVxuXG4gIGdldFZpZXcoKSB7XG4gICAgcmV0dXJuIGgoJ2RpdicsIFtcbiAgICAgIGgoJ2J1dHRvbicsIHsgb246IHsgY2xpY2s6IChlKSA9PiB0aGlzLnBsdXMoZSkgfSB9LCAnKycpLFxuICAgICAgaCgnYnV0dG9uJywgeyBvbjogeyBjbGljazogKGUpID0+IHRoaXMubWludXMoZSkgfSB9LCAnLScpLFxuICAgICAgaCgnZGl2JywgYENvdW50OiAkeyB0aGlzLmNvdW50IH1gKVxuICAgIF0pXG4gIH1cbn1cblxuY2xhc3MgTWFjcm8ge1xuICBjb25zdHJ1Y3Rvcih7IHZhbHVlID0gJ1BsYXkgTWFjcm8nIH0pIHtcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywgJ3ZhbHVlJywgeyB2YWx1ZSwgZW51bWVyYWJsZTogZmFsc2UgfSlcbiAgfVxuXG4gIHBsYXkoKSB7IH1cblxuICBnZXRWaWV3KCkge1xuICAgIHJldHVybiBoKCdkaXYnLCBbXG4gICAgICBoKCdidXR0b24nLCB7IG9uOiB7IGNsaWNrOiAoZSkgPT4gdGhpcy5wbGF5KGUpIH0gfSwgdGhpcy52YWx1ZSlcbiAgICBdKVxuICB9XG59XG4vKlxuX19VUFBFUiBDT01QT05FTlQtTEVWRUxfX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19cblxudGhpcyBsZXZlbCBpcyBmb3I6XG4gLSBzdWJjbGFzc2VzIG9mIGNvbXBvbmVudHMgKHdob3NlIGluc3RhbmNlcyBvZnRlbiBoYXZlIGFuIGlkIHRoYXQgaXMgdW5pcXVlIHRvIHRoZSBhcHApXG4gLSB0aGVzZSBjb21wb25lbnQgbWV0aG9kcyBhY3QgYXMgYXBwbGljYXRpb24tc3BlY2lmaWMgd3JhcHBlcnMgYXJvdW5kIHRoZSBzdXBlciBtZXRob2RcbiAtIHRoZXNlIGNvbXBvbmVudCBtZXRob2RzIGFyZSBhbGxvd2VkIHRvIGNvbW11bmljYXRlIHdpdGggY29tcG9uZW50IGluc3RhbmNlcyB1c2luZyBJZFxuXG4qL1xuY2xhc3MgQXBwVG9vbGJhciBleHRlbmRzIFRvb2xiYXIge1xuICBjb25zdHJ1Y3Rvcih7IG1hY3JvRGVmID0gW10sIGlzUmVjb3JkaW5nIH0pIHtcbiAgICBzdXBlcih7IGlzUmVjb3JkaW5nIH0pXG4gICAgdGhpcy5tYWNyb0RlZiA9IG1hY3JvRGVmXG4gICAgdGhpcy50eXBlID0gJ0FwcFRvb2xiYXInXG5cbiAgICBJZC5hc3NpZ24odGhpcywgJ2xzJywgJ2xpc3QnKVxuICB9XG5cbiAgbmV3KGUpIHtcbiAgICBpZiAodGhpcy5pc1JlY29yZGluZykge1xuICAgICAgQXBwLnVwZGF0ZSh0aGlzLnJlY29yZEV2ZW50KHRoaXMsIGUpLCB7IGRvUGF0Y2g6IGZhbHNlIH0pXG4gICAgICByZXR1cm4gLy8gcHJldmVudCBub3JtYWwgYmVoYXZpb3JcbiAgICB9XG5cbiAgICB0aGlzLmxzLmFkZCh7IHR5cGU6ICdBcHBDb3VudGVyJyB9KVxuICAgIEFwcC51cGRhdGUodGhpcy5scylcbiAgfVxuXG4gIHJlY29yZCgpIHtcbiAgICBzdXBlci5yZWNvcmQoKVxuXG4gICAgaWYgKHRoaXMuaXNSZWNvcmRpbmcpIEFwcC51cGRhdGUodGhpcylcbiAgICBlbHNlIGlmICh0aGlzLm1hY3JvRGVmLmxlbmd0aCkge1xuICAgICAgdGhpcy5scy5hZGQoeyB0eXBlOiAnQXBwTWFjcm8nLCBkZWY6IHRoaXMubWFjcm9EZWYgfSlcbiAgICAgIHRoaXMubWFjcm9EZWYgPSBbXVxuXG4gICAgICBBcHAudXBkYXRlKFt0aGlzLCB0aGlzLmxzXSlcbiAgICB9IGVsc2UgQXBwLnVwZGF0ZSh0aGlzKVxuICB9XG5cbiAgcmVjb3JkRXZlbnQoYywgZXYpIHtcbiAgICB2YXIgdHJpZV9rZXlzID0gQXBwLmdldFRyaWVLZXlzKGMpXG5cbiAgICB2YXIgJGNoaWxkcyA9IGNbdmlld10uY2hpbGRyZW4ubWFwKGNoaWxkID0+IGNoaWxkLmVsbSlcblxuICAgIGlmICgkY2hpbGRzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRyaWVfa2V5cy5wdXNoKCRjaGlsZHMuaW5kZXhPZihldi50YXJnZXQpKVxuICAgIH1cblxuICAgIHRoaXMubWFjcm9EZWYucHVzaCh7IHRyaWVfa2V5cywgZXZfdHlwZTogZXYudHlwZSB9KVxuXG4gICAgcmV0dXJuIHRoaXNcbiAgfVxuXG4gIGNsZWFyKCkge1xuICAgIEFwcC5jbGVhclN0YXRlKClcbiAgfVxufVxuXG5jbGFzcyBBcHBDb3VudGVyIGV4dGVuZHMgQ291bnRlciB7XG4gIGNvbnN0cnVjdG9yKHsgY291bnQgfSkge1xuICAgIHN1cGVyKHsgY291bnQgfSlcbiAgICB0aGlzLnR5cGUgPSAnQXBwQ291bnRlcidcblxuICAgIElkLmFzc2lnbih0aGlzLCAndGInLCAndG9vbGJhcicpXG4gIH1cblxuICBwbHVzKGUpIHtcbiAgICBpZiAodGhpcy50Yi5pc1JlY29yZGluZykge1xuICAgICAgQXBwLnVwZGF0ZSh0aGlzLnRiLnJlY29yZEV2ZW50KHRoaXMsIGUpLCB7IGRvUGF0Y2g6IGZhbHNlIH0pXG4gICAgICByZXR1cm4gLy8gcHJldmVudCBub3JtYWwgYmVoYXZpb3JcbiAgICB9XG5cbiAgICBzdXBlci5wbHVzKClcbiAgICBBcHAudXBkYXRlKHRoaXMpXG4gIH1cblxuICBtaW51cyhlKSB7XG4gICAgaWYgKHRoaXMudGIuaXNSZWNvcmRpbmcpIHtcbiAgICAgIEFwcC51cGRhdGUodGhpcy50Yi5yZWNvcmRFdmVudCh0aGlzLCBlKSwgeyBkb1BhdGNoOiBmYWxzZSB9KVxuICAgICAgcmV0dXJuIC8vIHByZXZlbnQgbm9ybWFsIGJlaGF2aW9yXG4gICAgfVxuXG4gICAgc3VwZXIubWludXMoKVxuICAgIEFwcC51cGRhdGUodGhpcylcbiAgfVxufVxuXG5jbGFzcyBBcHBNYWNybyBleHRlbmRzIE1hY3JvIHtcbiAgY29uc3RydWN0b3IoeyBkZWYgPSBbXSB9KSB7XG4gICAgc3VwZXIoeyB2YWx1ZTogYFBsYXkgTWFjcm8gKCR7ZGVmLmxlbmd0aH0gZXZlbnRzKWAgfSlcbiAgICB0aGlzLmRlZiA9IGRlZlxuICAgIHRoaXMudHlwZSA9ICdBcHBNYWNybydcblxuICAgIElkLmFzc2lnbih0aGlzLCAndGInLCAndG9vbGJhcicpXG4gIH1cblxuICBwbGF5KGUpIHtcbiAgICBpZiAodGhpcy50Yi5pc1JlY29yZGluZykge1xuICAgICAgQXBwLnVwZGF0ZSh0aGlzLnRiLnJlY29yZEV2ZW50KHRoaXMsIGUpLCB7IGRvUGF0Y2g6IGZhbHNlIH0pXG4gICAgICByZXR1cm4gLy8gcHJldmVudCBub3JtYWwgYmVoYXZpb3JcbiAgICB9XG5cbiAgICB2YXIgdG9wX3ZpZXcgPSBBcHBbdmlld11cblxuICAgIHRoaXMuZGVmLmZvckVhY2goc3RlcCA9PiB7XG4gICAgICB2YXIgdmlldyA9IHRvcF92aWV3XG4gICAgICBmb3IgKHZhciBpIG9mIHN0ZXAudHJpZV9rZXlzKSB7XG4gICAgICAgIHZpZXcgPSB2aWV3LmNoaWxkcmVuW2ldXG4gICAgICB9XG4gICAgICB2aWV3LmRhdGEub25bc3RlcC5ldl90eXBlXS5mbih7IHR5cGU6IHN0ZXAuZXZfdHlwZSB9KVxuICAgIH0pXG4gIH1cbn1cbi8qXG5fX0xPV0VSIEFQUC1MRVZFTF9fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX1xuXG50aGlzIGxldmVsIGlzIGZvcjpcbiAtIHNvcnRpbmcsIGdyb3VwaW5nLCBhbmQgbG9vay11cC9yZXRyaWV2YWwgb2YgY29tcG9uZW50cyBpbiB0aGUgYXBwbGljYXRpb25cbiAtIHRoZXkgaGF2ZSBubyBcIm93blwiIGRhdGEgcmVuZGVyZWQgb24gc2NyZWVuXG5cbiovXG5jbGFzcyBMaXN0IHtcbiAgY29uc3RydWN0b3IoeyBpZCwgdGFnID0gJ2RpdicsIGNvbXBvbmVudHMgPSBbXSB9KSB7XG4gICAgdGhpcy50eXBlID0gJ0xpc3QnIC8vIGZvcmNlXG4gICAgdGhpcy50YWcgPSB0YWdcbiAgICB0aGlzLmNvbXBvbmVudHMgPSBbXVxuICAgIGNvbXBvbmVudHMuZm9yRWFjaChjX3N0YXRlID0+IHRoaXMuYWRkKGNfc3RhdGUpKVxuICAgIHRoaXNbdmlld10gPSB0aGlzLmdldFZpZXcoKVxuICB9XG5cbiAgYWRkKGNfc3RhdGUpIHtcbiAgICB2YXIgbmV3X2MgPSBuZXcgVHlwZVtjX3N0YXRlLnR5cGVdKGNfc3RhdGUpXG4gICAgbmV3X2Nbdmlld10gPSBuZXdfYy5nZXRWaWV3KClcbiAgICB0aGlzLmNvbXBvbmVudHMucHVzaChuZXdfYylcbiAgICBpZiAoY19zdGF0ZS5pZCkgSWQuYWRkKG5ld19jLmlkID0gY19zdGF0ZS5pZCwgbmV3X2MpXG4gICAgcmV0dXJuIG5ld19jXG4gIH1cblxuICB1cGRhdGUodGhpc19jKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmNvbXBvbmVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHZhciBjID0gdGhpcy5jb21wb25lbnRzW2ldXG5cbiAgICAgIGlmIChjID09PSB0aGlzX2MpIHtcbiAgICAgICAgY1t2aWV3XSA9IGMuZ2V0VmlldygpXG4gICAgICAgIHJldHVybiBjXG4gICAgICB9XG5cbiAgICAgIGlmIChjIGluc3RhbmNlb2YgTGlzdCkge1xuICAgICAgICBpZiAoYy51cGRhdGUodGhpc19jKSkge1xuICAgICAgICAgIGNbdmlld10gPSBjLmdldFZpZXcoKVxuICAgICAgICAgIHJldHVybiBjXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXRUcmllS2V5cyh0aGlzX2MsIGtleXMgPSBbXSkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5jb21wb25lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgYyA9IHRoaXMuY29tcG9uZW50c1tpXVxuXG4gICAgICBpZiAoYyA9PT0gdGhpc19jKSB7XG4gICAgICAgIGtleXMucHVzaChpKVxuICAgICAgICByZXR1cm4ga2V5c1xuICAgICAgfVxuXG4gICAgICBpZiAoYyBpbnN0YW5jZW9mIExpc3QpIHtcbiAgICAgICAgaWYgKGMuZ2V0VHJpZUtleXModGhpc19jLCBrZXlzKSkge1xuICAgICAgICAgIGtleXMudW5zaGlmdChpKVxuICAgICAgICAgIHJldHVybiBrZXlzXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXRWaWV3KCkge1xuICAgIHJldHVybiBoKHRoaXMudGFnLCB0aGlzLmNvbXBvbmVudHMubWFwKGMgPT4gY1t2aWV3XSkpXG4gIH1cbn1cblxuLy8gY29tcG9uZW50IGNvbnN0cnVjdG9yc1xuY29uc3QgVHlwZSA9IHsgTGlzdCwgQXBwVG9vbGJhciwgQXBwTWFjcm8sIEFwcENvdW50ZXIgfVxuLy8gY29tcG9uZW50IGluc3RhbmNlcyB3aGljaCBhcmUgY3JlYXRlZCB3aXRoIGFuIGlkIHByb3BlcnR5IHdpbGwgZ28gaW4gSWRcbmNvbnN0IElkID0gKCgpID0+IHtcbiAgdmFyIHByb21pc2UgPSB7fVxuICB2YXIgcmVzb2x2ZXIgPSB7fVxuXG4gIHJldHVybiB7XG4gICAgYXNzaWduKGMsIHByb3AsIG5hbWUpIHtcbiAgICAgIHZhciBfYXNzaWduID0gKHZhbCkgPT4gT2JqZWN0LmRlZmluZVByb3BlcnR5KGMsIHByb3AsIHsgdmFsdWU6IHZhbCwgZW51bWVyYWJsZTogZmFsc2UgfSlcblxuICAgICAgaWYgKHByb21pc2VbbmFtZV0pIHtcbiAgICAgICAgcHJvbWlzZVtuYW1lXS50aGVuKF9hc3NpZ24pXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwcm9taXNlW25hbWVdID0gbmV3IFByb21pc2UocmVzID0+IHtcbiAgICAgICAgICB2YXIgciA9IGMgPT4gcmVzKGMpXG4gICAgICAgICAgcmVzb2x2ZXJbbmFtZV0gPSByXG4gICAgICAgIH0pLnRoZW4oX2Fzc2lnbilcbiAgICAgIH1cbiAgICB9LFxuICAgIGFkZChuYW1lLCBjKSB7XG4gICAgICBpZiAocHJvbWlzZVtuYW1lXSkge1xuICAgICAgICBpZiAoIXJlc29sdmVyW25hbWVdKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJZCBuYW1lICR7bmFtZX0gaGFzIGFscmVhZHkgYmVlbiBhZGRlZGApXG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZXJbbmFtZV0oYylcbiAgICAgICAgICBkZWxldGUgcmVzb2x2ZXJbbmFtZV1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIHByb21pc2VbbmFtZV0gPSBQcm9taXNlLnJlc29sdmUoYylcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pKClcblxuLypcbl9fVVBQRVIgQVBQLUxFVkVMX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXG5cbnRoaXMgbGV2ZWwgaXMgZm9yOlxuICAtIHBhdGNoaW5nIHRoZSBET00gb3Igc2F2aW5nIHRoZSBzdGF0ZSBvZiB0aGUgYXBwbGljYXRpb25cbiAgLSBkZWZpbmluZyB0aGUgcGVyc2lzdGVuY2UgbWVjaGFuaXNtIChsb2NhbFN0b3JhZ2UsIGluIHRoaXMgY2FzZSlcbiAgLSBkZWZpbmluZyB0aGUgaW5pdGlhbCBhcHBsaWNhdGlvbiBpbnN0YW5jZShzKSBhbmQgdGhlaXIgbG9jYXRpb24gaW4gdGhlIERPTVxuXG4qL1xuY2xhc3MgTG9jYWxTdG9yYWdlQXBwbGljYXRpb24gZXh0ZW5kcyBMaXN0IHtcbiAgY29uc3RydWN0b3IoeyBpZCwgdGFnLCBjb21wb25lbnRzIH0pIHtcbiAgICB2YXIgc2F2ZWRTdGF0ZSA9IEpTT04ucGFyc2UobG9jYWxTdG9yYWdlLmdldEl0ZW0oaWQpKVxuXG4gICAgaWYgKHNhdmVkU3RhdGUpIHN1cGVyKHNhdmVkU3RhdGUpXG4gICAgZWxzZSBzdXBlcih7IHRhZywgY29tcG9uZW50cyB9KVxuXG4gICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsICdpZCcsIHsgdmFsdWU6IGlkLCBlbnVtZXJhYmxlOiBmYWxzZSB9KVxuICB9XG5cbiAgdXBkYXRlKGNvbXBvbmVudCwgZG9QYXRjaCA9IHRydWUsIGRvU2F2ZSA9IHRydWUpIHtcbiAgICAvLyByZWNvbXBpbGUgdmlld3NcbiAgICBpZiAoQXJyYXkuaXNBcnJheShjb21wb25lbnQpKSB7XG4gICAgICBmb3IgKHZhciBjIG9mIGNvbXBvbmVudCkgc3VwZXIudXBkYXRlKGMpXG4gICAgfSBlbHNlIHN1cGVyLnVwZGF0ZShjb21wb25lbnQpXG5cbiAgICBpZiAoZG9QYXRjaCkge1xuICAgICAgLy8gcGF0Y2ggRE9NXG4gICAgICB2YXIgbmV3X3YgPSB0aGlzLmdldFZpZXcoKVxuICAgICAgcGF0Y2godGhpc1t2aWV3XSwgbmV3X3YpXG4gICAgICB0aGlzW3ZpZXddID0gbmV3X3ZcbiAgICB9XG5cbiAgICBpZiAoZG9TYXZlKSB7XG4gICAgICAvLyBzYXZlIHN0YXRlXG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbSh0aGlzLmlkLCBKU09OLnN0cmluZ2lmeSh0aGlzKSlcbiAgICB9XG4gIH1cblxuICBjbGVhclN0YXRlKCkge1xuICAgIGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKHRoaXMuaWQpXG4gIH1cbn1cblxuY2xhc3MgRGVtbyBleHRlbmRzIExvY2FsU3RvcmFnZUFwcGxpY2F0aW9uIHtcbiAgY29uc3RydWN0b3IoJHZpZXcsICRzdGF0ZSwgc3VwZXJTdGF0ZSkge1xuICAgIHN1cGVyKHN1cGVyU3RhdGUpXG5cbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgICAkc3RhdGU6IHsgdmFsdWU6ICRzdGF0ZSwgZW51bWVyYWJsZTogZmFsc2UgfVxuICAgIH0pXG5cbiAgICBwYXRjaCgkdmlldywgdGhpc1t2aWV3XSlcbiAgICB0aGlzLm91dHB1dFN0YXRlKClcbiAgfVxuXG4gIHVwZGF0ZSgpIHtcbiAgICBzdXBlci51cGRhdGUuYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICAgIHRoaXMub3V0cHV0U3RhdGUoKVxuICB9XG5cbiAgY2xlYXJTdGF0ZSgpIHtcbiAgICBzdXBlci5jbGVhclN0YXRlKClcbiAgICB3aW5kb3cuYWxlcnQoJ1RoZSBzdGF0ZSBoYXMgYmVlbiBjbGVhcmVkIGZyb20gbG9jYWxTdG9yYWdlLiBIb3dldmVyLCB0aGUgY3VycmVudCBzdGF0ZSBpcyBzdGlsbCBpbi1tZW1vcnkuIFRvIHJlc2V0IHRoZSBkZW1vLCB5b3UgbXVzdCByZWZyZXNoIHlvdXIgYnJvd3NlciBub3cuJylcbiAgfVxuICBvdXRwdXRTdGF0ZSgpIHtcbiAgICB0aGlzLiRzdGF0ZS5pbm5lclRleHQgPSBKU09OLnN0cmluZ2lmeSh0aGlzLCB1bmRlZmluZWQsIDEpXG4gIH1cbn1cblxuLypcbl9fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fX19fXG5cbiovXG52YXIgQXBwID0gbmV3IERlbW8oZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ0NvdW50ZXJEZW1vJyksIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdfc3RhdGUnKSwge1xuICBpZDogJ0NvdW50ZXJEZW1vJyxcbiAgY29tcG9uZW50czogW1xuICAgIHsgdHlwZTogJ0FwcFRvb2xiYXInLCBpZDogJ3Rvb2xiYXInIH0sXG4gICAgeyB0eXBlOiAnTGlzdCcsIGlkOiAnbGlzdCcgfVxuICBdXG59KVxuXG4iLCJ2YXIgVk5vZGUgPSByZXF1aXJlKCcuL3Zub2RlJyk7XG52YXIgaXMgPSByZXF1aXJlKCcuL2lzJyk7XG5cbmZ1bmN0aW9uIGFkZE5TKGRhdGEsIGNoaWxkcmVuKSB7XG4gIGRhdGEubnMgPSAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnO1xuICBpZiAoY2hpbGRyZW4gIT09IHVuZGVmaW5lZCkge1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgIGFkZE5TKGNoaWxkcmVuW2ldLmRhdGEsIGNoaWxkcmVuW2ldLmNoaWxkcmVuKTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoKHNlbCwgYiwgYykge1xuICB2YXIgZGF0YSA9IHt9LCBjaGlsZHJlbiwgdGV4dCwgaTtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDMpIHtcbiAgICBkYXRhID0gYjtcbiAgICBpZiAoaXMuYXJyYXkoYykpIHsgY2hpbGRyZW4gPSBjOyB9XG4gICAgZWxzZSBpZiAoaXMucHJpbWl0aXZlKGMpKSB7IHRleHQgPSBjOyB9XG4gIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgIGlmIChpcy5hcnJheShiKSkgeyBjaGlsZHJlbiA9IGI7IH1cbiAgICBlbHNlIGlmIChpcy5wcmltaXRpdmUoYikpIHsgdGV4dCA9IGI7IH1cbiAgICBlbHNlIHsgZGF0YSA9IGI7IH1cbiAgfVxuICBpZiAoaXMuYXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgKytpKSB7XG4gICAgICBpZiAoaXMucHJpbWl0aXZlKGNoaWxkcmVuW2ldKSkgY2hpbGRyZW5baV0gPSBWTm9kZSh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBjaGlsZHJlbltpXSk7XG4gICAgfVxuICB9XG4gIGlmIChzZWxbMF0gPT09ICdzJyAmJiBzZWxbMV0gPT09ICd2JyAmJiBzZWxbMl0gPT09ICdnJykge1xuICAgIGFkZE5TKGRhdGEsIGNoaWxkcmVuKTtcbiAgfVxuICByZXR1cm4gVk5vZGUoc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgdW5kZWZpbmVkKTtcbn07XG4iLCJmdW5jdGlvbiBjcmVhdGVFbGVtZW50KHRhZ05hbWUpe1xuICByZXR1cm4gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCh0YWdOYW1lKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudE5TKG5hbWVzcGFjZVVSSSwgcXVhbGlmaWVkTmFtZSl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMobmFtZXNwYWNlVVJJLCBxdWFsaWZpZWROYW1lKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlVGV4dE5vZGUodGV4dCl7XG4gIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KTtcbn1cblxuXG5mdW5jdGlvbiBpbnNlcnRCZWZvcmUocGFyZW50Tm9kZSwgbmV3Tm9kZSwgcmVmZXJlbmNlTm9kZSl7XG4gIHBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKG5ld05vZGUsIHJlZmVyZW5jZU5vZGUpO1xufVxuXG5cbmZ1bmN0aW9uIHJlbW92ZUNoaWxkKG5vZGUsIGNoaWxkKXtcbiAgbm9kZS5yZW1vdmVDaGlsZChjaGlsZCk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKG5vZGUsIGNoaWxkKXtcbiAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZCk7XG59XG5cbmZ1bmN0aW9uIHBhcmVudE5vZGUobm9kZSl7XG4gIHJldHVybiBub2RlLnBhcmVudEVsZW1lbnQ7XG59XG5cbmZ1bmN0aW9uIG5leHRTaWJsaW5nKG5vZGUpe1xuICByZXR1cm4gbm9kZS5uZXh0U2libGluZztcbn1cblxuZnVuY3Rpb24gdGFnTmFtZShub2RlKXtcbiAgcmV0dXJuIG5vZGUudGFnTmFtZTtcbn1cblxuZnVuY3Rpb24gc2V0VGV4dENvbnRlbnQobm9kZSwgdGV4dCl7XG4gIG5vZGUudGV4dENvbnRlbnQgPSB0ZXh0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgY3JlYXRlRWxlbWVudDogY3JlYXRlRWxlbWVudCxcbiAgY3JlYXRlRWxlbWVudE5TOiBjcmVhdGVFbGVtZW50TlMsXG4gIGNyZWF0ZVRleHROb2RlOiBjcmVhdGVUZXh0Tm9kZSxcbiAgYXBwZW5kQ2hpbGQ6IGFwcGVuZENoaWxkLFxuICByZW1vdmVDaGlsZDogcmVtb3ZlQ2hpbGQsXG4gIGluc2VydEJlZm9yZTogaW5zZXJ0QmVmb3JlLFxuICBwYXJlbnROb2RlOiBwYXJlbnROb2RlLFxuICBuZXh0U2libGluZzogbmV4dFNpYmxpbmcsXG4gIHRhZ05hbWU6IHRhZ05hbWUsXG4gIHNldFRleHRDb250ZW50OiBzZXRUZXh0Q29udGVudFxufTtcbiIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBhcnJheTogQXJyYXkuaXNBcnJheSxcbiAgcHJpbWl0aXZlOiBmdW5jdGlvbihzKSB7IHJldHVybiB0eXBlb2YgcyA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIHMgPT09ICdudW1iZXInOyB9LFxufTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4uL2lzJyk7XG5cbmZ1bmN0aW9uIGFyckludm9rZXIoYXJyKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAvLyBTcGVjaWFsIGNhc2Ugd2hlbiBsZW5ndGggaXMgdHdvLCBmb3IgcGVyZm9ybWFuY2VcbiAgICBhcnIubGVuZ3RoID09PSAyID8gYXJyWzBdKGFyclsxXSkgOiBhcnJbMF0uYXBwbHkodW5kZWZpbmVkLCBhcnIuc2xpY2UoMSkpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBmbkludm9rZXIobykge1xuICByZXR1cm4gZnVuY3Rpb24oZXYpIHsgby5mbihldik7IH07XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUV2ZW50TGlzdGVuZXJzKG9sZFZub2RlLCB2bm9kZSkge1xuICB2YXIgbmFtZSwgY3VyLCBvbGQsIGVsbSA9IHZub2RlLmVsbSxcbiAgICAgIG9sZE9uID0gb2xkVm5vZGUuZGF0YS5vbiB8fCB7fSwgb24gPSB2bm9kZS5kYXRhLm9uO1xuICBpZiAoIW9uKSByZXR1cm47XG4gIGZvciAobmFtZSBpbiBvbikge1xuICAgIGN1ciA9IG9uW25hbWVdO1xuICAgIG9sZCA9IG9sZE9uW25hbWVdO1xuICAgIGlmIChvbGQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgaWYgKGlzLmFycmF5KGN1cikpIHtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgYXJySW52b2tlcihjdXIpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGN1ciA9IHsgZm46IGN1ciB9O1xuICAgICAgICBvbltuYW1lXSA9IGN1cjtcbiAgICAgICAgZWxtLmFkZEV2ZW50TGlzdGVuZXIobmFtZSwgZm5JbnZva2VyKGN1cikpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaXMuYXJyYXkob2xkKSkge1xuICAgICAgLy8gRGVsaWJlcmF0ZWx5IG1vZGlmeSBvbGQgYXJyYXkgc2luY2UgaXQncyBjYXB0dXJlZCBpbiBjbG9zdXJlIGNyZWF0ZWQgd2l0aCBgYXJySW52b2tlcmBcbiAgICAgIG9sZC5sZW5ndGggPSBjdXIubGVuZ3RoO1xuICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBvbGQubGVuZ3RoOyArK2kpIG9sZFtpXSA9IGN1cltpXTtcbiAgICAgIG9uW25hbWVdICA9IG9sZDtcbiAgICB9IGVsc2Uge1xuICAgICAgb2xkLmZuID0gY3VyO1xuICAgICAgb25bbmFtZV0gPSBvbGQ7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge2NyZWF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnMsIHVwZGF0ZTogdXBkYXRlRXZlbnRMaXN0ZW5lcnN9O1xuIiwiLy8ganNoaW50IG5ld2NhcDogZmFsc2Vcbi8qIGdsb2JhbCByZXF1aXJlLCBtb2R1bGUsIGRvY3VtZW50LCBOb2RlICovXG4ndXNlIHN0cmljdCc7XG5cbnZhciBWTm9kZSA9IHJlcXVpcmUoJy4vdm5vZGUnKTtcbnZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkb21BcGkgPSByZXF1aXJlKCcuL2h0bWxkb21hcGkuanMnKTtcblxuZnVuY3Rpb24gaXNVbmRlZihzKSB7IHJldHVybiBzID09PSB1bmRlZmluZWQ7IH1cbmZ1bmN0aW9uIGlzRGVmKHMpIHsgcmV0dXJuIHMgIT09IHVuZGVmaW5lZDsgfVxuXG52YXIgZW1wdHlOb2RlID0gVk5vZGUoJycsIHt9LCBbXSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXG5mdW5jdGlvbiBzYW1lVm5vZGUodm5vZGUxLCB2bm9kZTIpIHtcbiAgcmV0dXJuIHZub2RlMS5rZXkgPT09IHZub2RlMi5rZXkgJiYgdm5vZGUxLnNlbCA9PT0gdm5vZGUyLnNlbDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5VG9PbGRJZHgoY2hpbGRyZW4sIGJlZ2luSWR4LCBlbmRJZHgpIHtcbiAgdmFyIGksIG1hcCA9IHt9LCBrZXk7XG4gIGZvciAoaSA9IGJlZ2luSWR4OyBpIDw9IGVuZElkeDsgKytpKSB7XG4gICAga2V5ID0gY2hpbGRyZW5baV0ua2V5O1xuICAgIGlmIChpc0RlZihrZXkpKSBtYXBba2V5XSA9IGk7XG4gIH1cbiAgcmV0dXJuIG1hcDtcbn1cblxudmFyIGhvb2tzID0gWydjcmVhdGUnLCAndXBkYXRlJywgJ3JlbW92ZScsICdkZXN0cm95JywgJ3ByZScsICdwb3N0J107XG5cbmZ1bmN0aW9uIGluaXQobW9kdWxlcywgYXBpKSB7XG4gIHZhciBpLCBqLCBjYnMgPSB7fTtcblxuICBpZiAoaXNVbmRlZihhcGkpKSBhcGkgPSBkb21BcGk7XG5cbiAgZm9yIChpID0gMDsgaSA8IGhvb2tzLmxlbmd0aDsgKytpKSB7XG4gICAgY2JzW2hvb2tzW2ldXSA9IFtdO1xuICAgIGZvciAoaiA9IDA7IGogPCBtb2R1bGVzLmxlbmd0aDsgKytqKSB7XG4gICAgICBpZiAobW9kdWxlc1tqXVtob29rc1tpXV0gIT09IHVuZGVmaW5lZCkgY2JzW2hvb2tzW2ldXS5wdXNoKG1vZHVsZXNbal1baG9va3NbaV1dKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbXB0eU5vZGVBdChlbG0pIHtcbiAgICByZXR1cm4gVk5vZGUoYXBpLnRhZ05hbWUoZWxtKS50b0xvd2VyQ2FzZSgpLCB7fSwgW10sIHVuZGVmaW5lZCwgZWxtKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZVJtQ2IoY2hpbGRFbG0sIGxpc3RlbmVycykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIGlmICgtLWxpc3RlbmVycyA9PT0gMCkge1xuICAgICAgICB2YXIgcGFyZW50ID0gYXBpLnBhcmVudE5vZGUoY2hpbGRFbG0pO1xuICAgICAgICBhcGkucmVtb3ZlQ2hpbGQocGFyZW50LCBjaGlsZEVsbSk7XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNyZWF0ZUVsbSh2bm9kZSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIGksIHRodW5rLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICBpZiAoaXNEZWYoZGF0YSkpIHtcbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS5ob29rKSAmJiBpc0RlZihpID0gaS5pbml0KSkgaSh2bm9kZSk7XG4gICAgICBpZiAoaXNEZWYoaSA9IGRhdGEudm5vZGUpKSB7XG4gICAgICAgICAgdGh1bmsgPSB2bm9kZTtcbiAgICAgICAgICB2bm9kZSA9IGk7XG4gICAgICB9XG4gICAgfVxuICAgIHZhciBlbG0sIGNoaWxkcmVuID0gdm5vZGUuY2hpbGRyZW4sIHNlbCA9IHZub2RlLnNlbDtcbiAgICBpZiAoaXNEZWYoc2VsKSkge1xuICAgICAgLy8gUGFyc2Ugc2VsZWN0b3JcbiAgICAgIHZhciBoYXNoSWR4ID0gc2VsLmluZGV4T2YoJyMnKTtcbiAgICAgIHZhciBkb3RJZHggPSBzZWwuaW5kZXhPZignLicsIGhhc2hJZHgpO1xuICAgICAgdmFyIGhhc2ggPSBoYXNoSWR4ID4gMCA/IGhhc2hJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIGRvdCA9IGRvdElkeCA+IDAgPyBkb3RJZHggOiBzZWwubGVuZ3RoO1xuICAgICAgdmFyIHRhZyA9IGhhc2hJZHggIT09IC0xIHx8IGRvdElkeCAhPT0gLTEgPyBzZWwuc2xpY2UoMCwgTWF0aC5taW4oaGFzaCwgZG90KSkgOiBzZWw7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBpc0RlZihkYXRhKSAmJiBpc0RlZihpID0gZGF0YS5ucykgPyBhcGkuY3JlYXRlRWxlbWVudE5TKGksIHRhZylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IGFwaS5jcmVhdGVFbGVtZW50KHRhZyk7XG4gICAgICBpZiAoaGFzaCA8IGRvdCkgZWxtLmlkID0gc2VsLnNsaWNlKGhhc2ggKyAxLCBkb3QpO1xuICAgICAgaWYgKGRvdElkeCA+IDApIGVsbS5jbGFzc05hbWUgPSBzZWwuc2xpY2UoZG90KzEpLnJlcGxhY2UoL1xcLi9nLCAnICcpO1xuICAgICAgaWYgKGlzLmFycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICBmb3IgKGkgPSAwOyBpIDwgY2hpbGRyZW4ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBjcmVhdGVFbG0oY2hpbGRyZW5baV0sIGluc2VydGVkVm5vZGVRdWV1ZSkpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKGlzLnByaW1pdGl2ZSh2bm9kZS50ZXh0KSkge1xuICAgICAgICBhcGkuYXBwZW5kQ2hpbGQoZWxtLCBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCkpO1xuICAgICAgfVxuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5jcmVhdGUubGVuZ3RoOyArK2kpIGNicy5jcmVhdGVbaV0oZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICBpID0gdm5vZGUuZGF0YS5ob29rOyAvLyBSZXVzZSB2YXJpYWJsZVxuICAgICAgaWYgKGlzRGVmKGkpKSB7XG4gICAgICAgIGlmIChpLmNyZWF0ZSkgaS5jcmVhdGUoZW1wdHlOb2RlLCB2bm9kZSk7XG4gICAgICAgIGlmIChpLmluc2VydCkgaW5zZXJ0ZWRWbm9kZVF1ZXVlLnB1c2godm5vZGUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSB2bm9kZS5lbG0gPSBhcGkuY3JlYXRlVGV4dE5vZGUodm5vZGUudGV4dCk7XG4gICAgfVxuICAgIGlmIChpc0RlZih0aHVuaykpIHRodW5rLmVsbSA9IHZub2RlLmVsbTtcbiAgICByZXR1cm4gdm5vZGUuZWxtO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCB2bm9kZXMsIHN0YXJ0SWR4LCBlbmRJZHgsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIGZvciAoOyBzdGFydElkeCA8PSBlbmRJZHg7ICsrc3RhcnRJZHgpIHtcbiAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBjcmVhdGVFbG0odm5vZGVzW3N0YXJ0SWR4XSwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSwgYmVmb3JlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpbnZva2VEZXN0cm95SG9vayh2bm9kZSkge1xuICAgIHZhciBpLCBqLCBkYXRhID0gdm5vZGUuZGF0YTtcbiAgICBpZiAoaXNEZWYoZGF0YSkpIHtcbiAgICAgIGlmIChpc0RlZihpID0gZGF0YS5ob29rKSAmJiBpc0RlZihpID0gaS5kZXN0cm95KSkgaSh2bm9kZSk7XG4gICAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLmRlc3Ryb3kubGVuZ3RoOyArK2kpIGNicy5kZXN0cm95W2ldKHZub2RlKTtcbiAgICAgIGlmIChpc0RlZihpID0gdm5vZGUuY2hpbGRyZW4pKSB7XG4gICAgICAgIGZvciAoaiA9IDA7IGogPCB2bm9kZS5jaGlsZHJlbi5sZW5ndGg7ICsraikge1xuICAgICAgICAgIGludm9rZURlc3Ryb3lIb29rKHZub2RlLmNoaWxkcmVuW2pdKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGlzRGVmKGkgPSBkYXRhLnZub2RlKSkgaW52b2tlRGVzdHJveUhvb2soaSk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgdm5vZGVzLCBzdGFydElkeCwgZW5kSWR4KSB7XG4gICAgZm9yICg7IHN0YXJ0SWR4IDw9IGVuZElkeDsgKytzdGFydElkeCkge1xuICAgICAgdmFyIGksIGxpc3RlbmVycywgcm0sIGNoID0gdm5vZGVzW3N0YXJ0SWR4XTtcbiAgICAgIGlmIChpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKGlzRGVmKGNoLnNlbCkpIHtcbiAgICAgICAgICBpbnZva2VEZXN0cm95SG9vayhjaCk7XG4gICAgICAgICAgbGlzdGVuZXJzID0gY2JzLnJlbW92ZS5sZW5ndGggKyAxO1xuICAgICAgICAgIHJtID0gY3JlYXRlUm1DYihjaC5lbG0sIGxpc3RlbmVycyk7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IGNicy5yZW1vdmUubGVuZ3RoOyArK2kpIGNicy5yZW1vdmVbaV0oY2gsIHJtKTtcbiAgICAgICAgICBpZiAoaXNEZWYoaSA9IGNoLmRhdGEpICYmIGlzRGVmKGkgPSBpLmhvb2spICYmIGlzRGVmKGkgPSBpLnJlbW92ZSkpIHtcbiAgICAgICAgICAgIGkoY2gsIHJtKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcm0oKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7IC8vIFRleHQgbm9kZVxuICAgICAgICAgIGFwaS5yZW1vdmVDaGlsZChwYXJlbnRFbG0sIGNoLmVsbSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVDaGlsZHJlbihwYXJlbnRFbG0sIG9sZENoLCBuZXdDaCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKSB7XG4gICAgdmFyIG9sZFN0YXJ0SWR4ID0gMCwgbmV3U3RhcnRJZHggPSAwO1xuICAgIHZhciBvbGRFbmRJZHggPSBvbGRDaC5sZW5ndGggLSAxO1xuICAgIHZhciBvbGRTdGFydFZub2RlID0gb2xkQ2hbMF07XG4gICAgdmFyIG9sZEVuZFZub2RlID0gb2xkQ2hbb2xkRW5kSWR4XTtcbiAgICB2YXIgbmV3RW5kSWR4ID0gbmV3Q2gubGVuZ3RoIC0gMTtcbiAgICB2YXIgbmV3U3RhcnRWbm9kZSA9IG5ld0NoWzBdO1xuICAgIHZhciBuZXdFbmRWbm9kZSA9IG5ld0NoW25ld0VuZElkeF07XG4gICAgdmFyIG9sZEtleVRvSWR4LCBpZHhJbk9sZCwgZWxtVG9Nb3ZlLCBiZWZvcmU7XG5cbiAgICB3aGlsZSAob2xkU3RhcnRJZHggPD0gb2xkRW5kSWR4ICYmIG5ld1N0YXJ0SWR4IDw9IG5ld0VuZElkeCkge1xuICAgICAgaWYgKGlzVW5kZWYob2xkU3RhcnRWbm9kZSkpIHtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdOyAvLyBWbm9kZSBoYXMgYmVlbiBtb3ZlZCBsZWZ0XG4gICAgICB9IGVsc2UgaWYgKGlzVW5kZWYob2xkRW5kVm5vZGUpKSB7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgfSBlbHNlIGlmIChzYW1lVm5vZGUob2xkU3RhcnRWbm9kZSwgbmV3U3RhcnRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRTdGFydFZub2RlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBvbGRTdGFydFZub2RlID0gb2xkQ2hbKytvbGRTdGFydElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdFbmRWbm9kZSkpIHtcbiAgICAgICAgcGF0Y2hWbm9kZShvbGRFbmRWbm9kZSwgbmV3RW5kVm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIG9sZEVuZFZub2RlID0gb2xkQ2hbLS1vbGRFbmRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCByaWdodFxuICAgICAgICBwYXRjaFZub2RlKG9sZFN0YXJ0Vm5vZGUsIG5ld0VuZFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgb2xkU3RhcnRWbm9kZS5lbG0sIGFwaS5uZXh0U2libGluZyhvbGRFbmRWbm9kZS5lbG0pKTtcbiAgICAgICAgb2xkU3RhcnRWbm9kZSA9IG9sZENoWysrb2xkU3RhcnRJZHhdO1xuICAgICAgICBuZXdFbmRWbm9kZSA9IG5ld0NoWy0tbmV3RW5kSWR4XTtcbiAgICAgIH0gZWxzZSBpZiAoc2FtZVZub2RlKG9sZEVuZFZub2RlLCBuZXdTdGFydFZub2RlKSkgeyAvLyBWbm9kZSBtb3ZlZCBsZWZ0XG4gICAgICAgIHBhdGNoVm5vZGUob2xkRW5kVm5vZGUsIG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICAgIGFwaS5pbnNlcnRCZWZvcmUocGFyZW50RWxtLCBvbGRFbmRWbm9kZS5lbG0sIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgb2xkRW5kVm5vZGUgPSBvbGRDaFstLW9sZEVuZElkeF07XG4gICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChpc1VuZGVmKG9sZEtleVRvSWR4KSkgb2xkS2V5VG9JZHggPSBjcmVhdGVLZXlUb09sZElkeChvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgICAgIGlkeEluT2xkID0gb2xkS2V5VG9JZHhbbmV3U3RhcnRWbm9kZS5rZXldO1xuICAgICAgICBpZiAoaXNVbmRlZihpZHhJbk9sZCkpIHsgLy8gTmV3IGVsZW1lbnRcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgY3JlYXRlRWxtKG5ld1N0YXJ0Vm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSksIG9sZFN0YXJ0Vm5vZGUuZWxtKTtcbiAgICAgICAgICBuZXdTdGFydFZub2RlID0gbmV3Q2hbKytuZXdTdGFydElkeF07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZWxtVG9Nb3ZlID0gb2xkQ2hbaWR4SW5PbGRdO1xuICAgICAgICAgIHBhdGNoVm5vZGUoZWxtVG9Nb3ZlLCBuZXdTdGFydFZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgICAgICAgIG9sZENoW2lkeEluT2xkXSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtVG9Nb3ZlLmVsbSwgb2xkU3RhcnRWbm9kZS5lbG0pO1xuICAgICAgICAgIG5ld1N0YXJ0Vm5vZGUgPSBuZXdDaFsrK25ld1N0YXJ0SWR4XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAob2xkU3RhcnRJZHggPiBvbGRFbmRJZHgpIHtcbiAgICAgIGJlZm9yZSA9IGlzVW5kZWYobmV3Q2hbbmV3RW5kSWR4KzFdKSA/IG51bGwgOiBuZXdDaFtuZXdFbmRJZHgrMV0uZWxtO1xuICAgICAgYWRkVm5vZGVzKHBhcmVudEVsbSwgYmVmb3JlLCBuZXdDaCwgbmV3U3RhcnRJZHgsIG5ld0VuZElkeCwgaW5zZXJ0ZWRWbm9kZVF1ZXVlKTtcbiAgICB9IGVsc2UgaWYgKG5ld1N0YXJ0SWR4ID4gbmV3RW5kSWR4KSB7XG4gICAgICByZW1vdmVWbm9kZXMocGFyZW50RWxtLCBvbGRDaCwgb2xkU3RhcnRJZHgsIG9sZEVuZElkeCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcGF0Y2hWbm9kZShvbGRWbm9kZSwgdm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSkge1xuICAgIHZhciBpLCBob29rO1xuICAgIGlmIChpc0RlZihpID0gdm5vZGUuZGF0YSkgJiYgaXNEZWYoaG9vayA9IGkuaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucHJlcGF0Y2gpKSB7XG4gICAgICBpKG9sZFZub2RlLCB2bm9kZSk7XG4gICAgfVxuICAgIGlmIChpc0RlZihpID0gb2xkVm5vZGUuZGF0YSkgJiYgaXNEZWYoaSA9IGkudm5vZGUpKSBvbGRWbm9kZSA9IGk7XG4gICAgaWYgKGlzRGVmKGkgPSB2bm9kZS5kYXRhKSAmJiBpc0RlZihpID0gaS52bm9kZSkpIHtcbiAgICAgIHBhdGNoVm5vZGUob2xkVm5vZGUsIGksIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB2bm9kZS5lbG0gPSBpLmVsbTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGVsbSA9IHZub2RlLmVsbSA9IG9sZFZub2RlLmVsbSwgb2xkQ2ggPSBvbGRWbm9kZS5jaGlsZHJlbiwgY2ggPSB2bm9kZS5jaGlsZHJlbjtcbiAgICBpZiAob2xkVm5vZGUgPT09IHZub2RlKSByZXR1cm47XG4gICAgaWYgKCFzYW1lVm5vZGUob2xkVm5vZGUsIHZub2RlKSkge1xuICAgICAgdmFyIHBhcmVudEVsbSA9IGFwaS5wYXJlbnROb2RlKG9sZFZub2RlLmVsbSk7XG4gICAgICBlbG0gPSBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICBhcGkuaW5zZXJ0QmVmb3JlKHBhcmVudEVsbSwgZWxtLCBvbGRWbm9kZS5lbG0pO1xuICAgICAgcmVtb3ZlVm5vZGVzKHBhcmVudEVsbSwgW29sZFZub2RlXSwgMCwgMCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChpc0RlZih2bm9kZS5kYXRhKSkge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGNicy51cGRhdGUubGVuZ3RoOyArK2kpIGNicy51cGRhdGVbaV0ob2xkVm5vZGUsIHZub2RlKTtcbiAgICAgIGkgPSB2bm9kZS5kYXRhLmhvb2s7XG4gICAgICBpZiAoaXNEZWYoaSkgJiYgaXNEZWYoaSA9IGkudXBkYXRlKSkgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgICBpZiAoaXNVbmRlZih2bm9kZS50ZXh0KSkge1xuICAgICAgaWYgKGlzRGVmKG9sZENoKSAmJiBpc0RlZihjaCkpIHtcbiAgICAgICAgaWYgKG9sZENoICE9PSBjaCkgdXBkYXRlQ2hpbGRyZW4oZWxtLCBvbGRDaCwgY2gsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKGNoKSkge1xuICAgICAgICBpZiAoaXNEZWYob2xkVm5vZGUudGV4dCkpIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgICAgYWRkVm5vZGVzKGVsbSwgbnVsbCwgY2gsIDAsIGNoLmxlbmd0aCAtIDEsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZENoKSkge1xuICAgICAgICByZW1vdmVWbm9kZXMoZWxtLCBvbGRDaCwgMCwgb2xkQ2gubGVuZ3RoIC0gMSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRGVmKG9sZFZub2RlLnRleHQpKSB7XG4gICAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sICcnKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG9sZFZub2RlLnRleHQgIT09IHZub2RlLnRleHQpIHtcbiAgICAgIGFwaS5zZXRUZXh0Q29udGVudChlbG0sIHZub2RlLnRleHQpO1xuICAgIH1cbiAgICBpZiAoaXNEZWYoaG9vaykgJiYgaXNEZWYoaSA9IGhvb2sucG9zdHBhdGNoKSkge1xuICAgICAgaShvbGRWbm9kZSwgdm5vZGUpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbihvbGRWbm9kZSwgdm5vZGUpIHtcbiAgICB2YXIgaSwgZWxtLCBwYXJlbnQ7XG4gICAgdmFyIGluc2VydGVkVm5vZGVRdWV1ZSA9IFtdO1xuICAgIGZvciAoaSA9IDA7IGkgPCBjYnMucHJlLmxlbmd0aDsgKytpKSBjYnMucHJlW2ldKCk7XG5cbiAgICBpZiAoaXNVbmRlZihvbGRWbm9kZS5zZWwpKSB7XG4gICAgICBvbGRWbm9kZSA9IGVtcHR5Tm9kZUF0KG9sZFZub2RlKTtcbiAgICB9XG5cbiAgICBpZiAoc2FtZVZub2RlKG9sZFZub2RlLCB2bm9kZSkpIHtcbiAgICAgIHBhdGNoVm5vZGUob2xkVm5vZGUsIHZub2RlLCBpbnNlcnRlZFZub2RlUXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbG0gPSBvbGRWbm9kZS5lbG07XG4gICAgICBwYXJlbnQgPSBhcGkucGFyZW50Tm9kZShlbG0pO1xuXG4gICAgICBjcmVhdGVFbG0odm5vZGUsIGluc2VydGVkVm5vZGVRdWV1ZSk7XG5cbiAgICAgIGlmIChwYXJlbnQgIT09IG51bGwpIHtcbiAgICAgICAgYXBpLmluc2VydEJlZm9yZShwYXJlbnQsIHZub2RlLmVsbSwgYXBpLm5leHRTaWJsaW5nKGVsbSkpO1xuICAgICAgICByZW1vdmVWbm9kZXMocGFyZW50LCBbb2xkVm5vZGVdLCAwLCAwKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgaW5zZXJ0ZWRWbm9kZVF1ZXVlLmxlbmd0aDsgKytpKSB7XG4gICAgICBpbnNlcnRlZFZub2RlUXVldWVbaV0uZGF0YS5ob29rLmluc2VydChpbnNlcnRlZFZub2RlUXVldWVbaV0pO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgY2JzLnBvc3QubGVuZ3RoOyArK2kpIGNicy5wb3N0W2ldKCk7XG4gICAgcmV0dXJuIHZub2RlO1xuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtpbml0OiBpbml0fTtcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oc2VsLCBkYXRhLCBjaGlsZHJlbiwgdGV4dCwgZWxtKSB7XG4gIHZhciBrZXkgPSBkYXRhID09PSB1bmRlZmluZWQgPyB1bmRlZmluZWQgOiBkYXRhLmtleTtcbiAgcmV0dXJuIHtzZWw6IHNlbCwgZGF0YTogZGF0YSwgY2hpbGRyZW46IGNoaWxkcmVuLFxuICAgICAgICAgIHRleHQ6IHRleHQsIGVsbTogZWxtLCBrZXk6IGtleX07XG59O1xuIl19
