function isGenerator (val) {
  return val && typeof val.next === 'function' && typeof val.throw === 'function'
}
function isPromise (val) {
  return val && typeof val.then === 'function'
}

// default yieldable mapper
function defaultMapper (val, cb) {
  if (isPromise(val)) {
    val.then(function (value) {
      cb(null, value)
    }, function (err) {
      cb(err || new Error())
    })
    return true
  }

  if (isGenerator(val)) {
    caco(val)(cb)
    return true
  }

  return false
}

function caco (gen, mapper) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    var self = this
    var callback
    if (typeof args[args.length - 1] === 'function') callback = args.pop()

    args.push(next)

    var iter = isGenerator(gen) ? gen : gen.apply(self, args)

    function step (err, res) {
      if (!iter) return callback.apply(self, arguments)
      // generator step
      try {
        var state = err ? iter.throw(err) : iter.next(res)
        if (state.done) iter = null

        var yieldable = defaultMapper(state.value, step) || (
          typeof mapper === 'function' && mapper(state.value, step)
        )

        if (!yieldable && state.done) step(null, state.value)
      } catch (err) {
        // catch err, break iteration
        return callback.call(self, err)
      }
    }

    function next (err, res) {
      process.nextTick(function () {
        step(err, res)
      })
    }

    if (callback) {
      step()
    } else {
      // use promise if no callback
      return new Promise(function (resolve, reject) {
        callback = function (err, result) {
          if (err) return reject(err)
          resolve(result)
        }
        step()
      })
    }
  }
}

module.exports = caco
