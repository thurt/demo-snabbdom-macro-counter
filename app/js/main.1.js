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

