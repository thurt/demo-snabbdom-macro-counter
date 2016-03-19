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
function create(constructor, data) {
  var new_c = new constructor()
  Object.assign(new_c, data)

  new_c[view] = new_c.getView()

  list.components.push(new_c)
  list.updateView()
}
//COMPONENTS//////////////////////////////////////////////
const ComponentDict = { List, Toolbar, Counter }

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
      on: { click: () => {
        create(ComponentDict[this.newType], this.newData)
      } }
    }, 'New')
    return h('div', [newButton])
  }
}

function Counter() { this._type = 'Counter' }
Counter.prototype = {
  getView() {
    var plusButton = h('button', {
      on: { click: () => {
        this.count += 1
        this[view] = this.getView()

        list.updateView()
      } }
    }, '+')
    var minusButton = h('button', {
      on: { click: () => {
        this.count -= 1
        this[view] = this.getView()

        list.updateView()
      } }
    }, '-')
    var countDiv = h('div', `Count: ${ this.count }`)

    return h('div', [plusButton, minusButton, countDiv])
  }
}

//SETUP//////////////////////////////////////////////////////////
var list = new List()
patch(document.getElementById('list'), list[view] = list.getView())

var list_data = JSON.parse(localStorage.getItem('list'))

if (!list_data) {
  create(Toolbar, { newType: 'Counter', newData: { count: 0 } })
} else {
  list_data.components.forEach(data => {
    create(ComponentDict[data._type], data)
  })
}





