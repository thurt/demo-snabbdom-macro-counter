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

//COMPONENTS//////////////////////////////////////////////
function List() {
  this.components = []
}
List.prototype.getView = function() {
  return h('div', this.components.map(c => c[view]))
}

function Toolbar() {}
Toolbar.prototype.getView = function() {
  var newButton = h('button', {
    on: { click: this.new }
  }, 'New')
  return h('div', [newButton])
}

function Counter() {}
Counter.prototype = {
  getView() {
    var plusButton = h('button', {
      on: { click: this.plus }
    }, '+')
    var minusButton = h('button', {
      on: { click: this.minus }
    }, '-')
    var countDiv = h('div', `Count: ${ this.count }`)
    return h('div', [plusButton, minusButton, countDiv])
  }
}
////////////////////////////////////////////////////////

var list = new List()
var toolbar = Object.assign(new Toolbar(), {
  new() {
    var counter = Object.assign(new Counter(), {
      count: 0,
      plus: function() {},
      minus: function() {}
    })

    list.components.push(counter)

    counter[view] = counter.getView()

    patch(list[view], list.getView())
  }
})

list.components.push(toolbar)
toolbar[view] = toolbar.getView()
patch(document.getElementById('list'), list[view] = list.getView())