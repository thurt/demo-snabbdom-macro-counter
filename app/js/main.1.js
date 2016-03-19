'use strict'
const snabbdom = require('snabbdom')
const patch = snabbdom.init([ // Init patch function with choosen modules
  require('snabbdom/modules/class'), // makes it easy to toggle classes
  require('snabbdom/modules/props'), // for setting properties on DOM elements
  require('snabbdom/modules/style'), // handles styling on elements with support for animations
  require('snabbdom/modules/eventlisteners'), // attaches event listeners
])
const h = require('snabbdom/h')
const view = Symbol('view')

//HELPERS/////////////////////////////////////////////////
function create(constructor, data, parent) {
  var new_c = new constructor()
  Object.assign(new_c, data)

  list.components.push(new_c)

  update(new_c)
}

function update(component) {
  component[view] = component.getView()
  list.updateView()
}
function isRecording(component, ev) {
  var toolbar = list.components.filter(c => c instanceof Toolbar)[0]
  if (toolbar.isRecording) {
    // we need to know the location of the component in list
    // we need to know what child element the event is coming from in the component
    if (!toolbar.macroDef) toolbar.macroDef = []

    var list_idx = list.components.indexOf(component)
    var childs = list[view].elm.children[list_idx].children

    var component_child_idx = Array.prototype.indexOf.call(childs, ev.target)
    toolbar.macroDef.push({ list_idx, component_child_idx, ev_type: ev.type })

    return true
  } else return false
}

//COMPONENTS//////////////////////////////////////////////
const ComponentDict = { List, Toolbar, Counter, Macro }

function List() {
  this.components = []
}
List.prototype = {
  getView() {
    return h('div', this.components.map(c => c[view]))
  },
  updateView() {
    var new_v = this.getView()
    patch(this[view], new_v)
    this[view] = new_v
    localStorage.setItem('list', JSON.stringify(this))
  }
}

function Toolbar() { this._type = 'Toolbar' }
Toolbar.prototype = {
  getView() {
    var newButton = h('button', {
      on: { click: (ev) => {
        if (isRecording(this, ev)) return

        create(ComponentDict[this.newType], this.newData)
      } }
    }, 'New')

    var recordButton = h('button', {
      on: { click: () => {
        if (this.isRecording) {
          this.isRecording = false
          create(Macro, { macroDef: this.macroDef })
          this.macroDef = null
        } else {
          this.isRecording = true
        }

        update(this)
      }
    } }, this.isRecording ? 'Stop Recording' : 'Start Recording')

    var clearButton = h('button', {
      on: { click: () => {
        localStorage.clear()
        window.alert('Please refresh your browser now')
      }
    } }, 'Clear localStorage')

    return h('div', [newButton, recordButton, clearButton])
  }
}

function Counter() { this._type = 'Counter' }
Counter.prototype = {
  getView() {
    var plusButton = h('button', {
      on: { click: (ev) => {
        if (isRecording(this, ev)) return

        this.count += 1
        update(this)
      } }
    }, '+')
    var minusButton = h('button', {
      on: { click: (ev) => {
        if (isRecording(this, ev)) return

        this.count -= 1
        update(this)
      } }
    }, '-')
    var countDiv = h('div', `Count: ${ this.count }`)

    return h('div', [plusButton, minusButton, countDiv])
  }
}

function Macro() { this._type = 'Macro' }
Macro.prototype = {
  getView() {
    var macroButton = h('button', {
      on: { click: (ev) => {
        var el = list[view].elm
        this.macroDef.forEach(step => {
          var component = el.children[step.list_idx]
          var ev_target = component.children[step.component_child_idx]
          ev_target.dispatchEvent(new Event(step.ev_type))
        })
      }
    } }, 'Play Macro')

    return h('div', [macroButton])
  }
}

//SETUP//////////////////////////////////////////////////////////
var list = new List()
patch(document.getElementById('list'), list[view] = list.getView())

var list_data = JSON.parse(localStorage.getItem('list'))

if (!list_data) {
  create(Toolbar, { newType: 'Counter', newData: { count: 0 }, isRecording: false })
} else {
  list_data.components.forEach(data => {
    create(ComponentDict[data._type], data)
  })
}





