(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(['exports', 'one-time-event'], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require('one-time-event'));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.oneTimeEvent);
    global.consistentObservable = mod.exports;
  }
})(this, function (exports, _oneTimeEvent) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.isObservable = exports.inTransition = exports.newTransition = exports.newComputed = exports.ComputedObservable = exports.newAction = exports.Action = exports.addROWrapper = exports.newROWrapper = exports.ROWrapper = exports.newIndependent = exports.IndependentObservable = exports.defaultEquals = undefined;

  function _possibleConstructorReturn(self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  var _slicedToArray = function () {
    function sliceIterator(arr, i) {
      var _arr = [];
      var _n = true;
      var _d = false;
      var _e = undefined;

      try {
        for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
          _arr.push(_s.value);

          if (i && _arr.length === i) break;
        }
      } catch (err) {
        _d = true;
        _e = err;
      } finally {
        try {
          if (!_n && _i["return"]) _i["return"]();
        } finally {
          if (_d) throw _e;
        }
      }

      return _arr;
    }

    return function (arr, i) {
      if (Array.isArray(arr)) {
        return arr;
      } else if (Symbol.iterator in Object(arr)) {
        return sliceIterator(arr, i);
      } else {
        throw new TypeError("Invalid attempt to destructure non-iterable instance");
      }
    };
  }();

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  var _createClass = function () {
    function defineProperties(target, props) {
      for (var i = 0; i < props.length; i++) {
        var descriptor = props[i];
        descriptor.enumerable = descriptor.enumerable || false;
        descriptor.configurable = true;
        if ("value" in descriptor) descriptor.writable = true;
        Object.defineProperty(target, descriptor.key, descriptor);
      }
    }

    return function (Constructor, protoProps, staticProps) {
      if (protoProps) defineProperties(Constructor.prototype, protoProps);
      if (staticProps) defineProperties(Constructor, staticProps);
      return Constructor;
    };
  }();

  var defaultEquals = exports.defaultEquals = function defaultEquals(x, y) {
    return x === y;
  };

  var IndependentObservable = exports.IndependentObservable = function () {
    function IndependentObservable(value) {
      _classCallCheck(this, IndependentObservable);

      this._value = value;
      this._baseChanged = (0, _oneTimeEvent.newOneTimeEvent)();
      this.baseChanged = this._baseChanged.pub;

      this._transitionEnded = (0, _oneTimeEvent.newOneTimeEvent)();
      this.transitionEnded = this._transitionEnded.pub;
      this._transitionEndedHandler = this._handleTransitionEnd.bind(this);
    }

    // equals get, set

    _createClass(IndependentObservable, [{
      key: 'peek',
      value: function peek() {
        return this._value;
      }
    }, {
      key: 'set',
      value: function set(newValue, transition) {
        if (!transition) {
          throw new Error('Can only set inside a transition.');
        }
        this._value = newValue;
        if (!this._transitionEnded.isEmpty) {
          /* [A] hidden feature: _transitionEnded
           * is not registered in transition when handlers registered after set */
          transition.ended.addHandler(this._transitionEndedHandler);
        }
        this._baseChanged.fire(this);
      }
    }, {
      key: '_handleTransitionEnd',
      value: function _handleTransitionEnd() {
        this._transitionEnded.fire(this);
      }
    }]);

    return IndependentObservable;
  }();

  var newIndependent = exports.newIndependent = function newIndependent(value) {
    return new IndependentObservable(value);
  };

  var ROWrapper = exports.ROWrapper = function () {
    function ROWrapper(baseObservable) {
      var _this = this;

      _classCallCheck(this, ROWrapper);

      this._baseObservable = baseObservable;

      this._baseChanged = (0, _oneTimeEvent.newOneTimeEvent)(function () {
        return _this._baseObservable.baseChanged.addHandler(_this._baseChangedHandler);
      });
      this._baseChangedHandler = this._baseChanged.fire.bind(this._baseChanged, this);
      this.baseChanged = this._baseChanged.pub;

      this._transitionEnded = (0, _oneTimeEvent.newOneTimeEvent)(function () {
        return _this._baseObservable.transitionEnded.addHandler(_this._transitionEndedHandler);
      });
      this._transitionEndedHandler = this._transitionEnded.fire.bind(this._transitionEnded, this);
      this.transitionEnded = this._transitionEnded.pub;
    }

    _createClass(ROWrapper, [{
      key: 'peek',
      value: function peek() {
        return this._baseObservable.peek();
      }
    }, {
      key: 'equals',
      get: function get() {
        return this._baseObservable.equals;
      }
    }]);

    return ROWrapper;
  }();

  var newROWrapper = exports.newROWrapper = function newROWrapper(baseObservable) {
    return new ROWrapper(baseObservable);
  };

  var addROWrapper = exports.addROWrapper = function addROWrapper(baseObservable) {
    baseObservable.pub = new ROWrapper(baseObservable);
    return baseObservable;
  };

  var Action = exports.Action = function () {
    function Action(action, cleanup) {
      var runAutomatically = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

      _classCallCheck(this, Action);

      this._cleanup = cleanup;
      this._action = action;
      this._runAutomatically = runAutomatically;

      this._baseChanged = (0, _oneTimeEvent.newOneTimeEvent)();
      // invoked, when any dependency in the computation graph changes
      this.baseChanged = this._baseChanged.pub;
      this._hasBaseChanged = true;
      this._baseChangedHandler = this._handleDependencyBaseChanged.bind(this);

      this._transitionEnded = (0, _oneTimeEvent.newOneTimeEvent)(this._startListeningForTransitionEnd.bind(this));
      this._transitionEndedHandler = this._handleTransitionEnd.bind(this);
      this.transitionEnded = this._transitionEnded.pub;

      this._dependencyInfos = new Map(); // dependency → dependencyInfo

      this._recordHandler = this._record.bind(this);

      this._clean = true;

      this._invalidated = false;

      if (this._runAutomatically) {
        this.run();
      }
    }

    _createClass(Action, [{
      key: 'run',
      value: function run() {
        this.close();
        this._action(this._recordHandler);
        this._clean = false;
        this._invalidated = false;
        this._hasBaseChanged = false;
      }

      /* runs the action,
       * if its computation is not in concert with its dependencies */

    }, {
      key: 'update',
      value: function update() {
        if (this._hasBaseChanged) {
          if (this._invalidated || this._clean || this._hasDependencyChanged()) {
            this.run();
            var _iteratorNormalCompletion = true;
            var _didIteratorError = false;
            var _iteratorError = undefined;

            try {
              for (var _iterator = this._dependencyInfos[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var _step$value = _slicedToArray(_step.value, 2);

                var dependency = _step$value[0];
                var dependencyInfo = _step$value[1];

                if (dependencyInfo.equalss.size === 0) {
                  this._dependencyInfos.delete(dependency);
                }
              }
            } catch (err) {
              _didIteratorError = true;
              _iteratorError = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                  _iterator.return();
                }
              } finally {
                if (_didIteratorError) {
                  throw _iteratorError;
                }
              }
            }

            return true;
          }
          this._hasBaseChanged = false;
        }
        return false;
      }
    }, {
      key: 'close',
      value: function close() {
        if (!this._clean) {
          this._clean = true;
          this._hasBaseChanged = true;
          var _iteratorNormalCompletion2 = true;
          var _didIteratorError2 = false;
          var _iteratorError2 = undefined;

          try {
            for (var _iterator2 = this._dependencyInfos[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
              var _step2$value = _slicedToArray(_step2.value, 2);

              var dependency = _step2$value[0];
              var dependencyInfo = _step2$value[1];

              dependency.baseChanged.removeHandler(this._baseChangedHandler);
              dependency.transitionEnded.removeHandler(this._transitionEndedHandler);
              dependencyInfo.equalss.clear();
            }
          } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
              }
            } finally {
              if (_didIteratorError2) {
                throw _iteratorError2;
              }
            }
          }

          if (this._cleanup) {
            this._cleanup();
          }
        }
      }

      // say that a not recorded dependency has changed

    }, {
      key: 'invalidate',
      value: function invalidate(transition) {
        if (!transition) {
          throw new Error('Can only invalidate inside a transition.');
        }
        this._invalidated = true;
        // see [A]
        if (!this._transitionEnded.isEmpty) {
          transition.ended.addHandler(this._transitionEndedHandler);
        }
        this._enableBaseChanged();
      }
    }, {
      key: '_startListeningForTransitionEnd',
      value: function _startListeningForTransitionEnd() {
        if (!this._clean) {
          var _iteratorNormalCompletion3 = true;
          var _didIteratorError3 = false;
          var _iteratorError3 = undefined;

          try {
            for (var _iterator3 = this._dependencyInfos.keys()[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
              var dependency = _step3.value;

              dependency.transitionEnded.addHandler(this._transitionEndedHandler);
            }
          } catch (err) {
            _didIteratorError3 = true;
            _iteratorError3 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
              }
            } finally {
              if (_didIteratorError3) {
                throw _iteratorError3;
              }
            }
          }
        }
      }
    }, {
      key: '_hasDependencyChanged',
      value: function _hasDependencyChanged() {
        var _iteratorNormalCompletion4 = true;
        var _didIteratorError4 = false;
        var _iteratorError4 = undefined;

        try {
          for (var _iterator4 = this._dependencyInfos[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var _step4$value = _slicedToArray(_step4.value, 2);

            var dependency = _step4$value[0];
            var dependencyInfo = _step4$value[1];

            if (dependencyInfo.baseChanged) {
              var currentValue = dependency.peek();
              if (Action._hasSingleDependencyChanged(dependencyInfo, currentValue)) {
                return true;
              }
              dependency.baseChanged.addHandler(this._baseChangedHandler);
            }
          }
        } catch (err) {
          _didIteratorError4 = true;
          _iteratorError4 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
              _iterator4.return();
            }
          } finally {
            if (_didIteratorError4) {
              throw _iteratorError4;
            }
          }
        }

        return false;
      }
    }, {
      key: '_handleDependencyBaseChanged',
      value: function _handleDependencyBaseChanged(dependency) {
        var dependencyInfo = this._dependencyInfos.get(dependency);
        dependencyInfo.baseChanged = true;
        this._enableBaseChanged();
      }
    }, {
      key: '_enableBaseChanged',
      value: function _enableBaseChanged() {
        if (!this._hasBaseChanged) {
          this._hasBaseChanged = true;
          this._baseChanged.fire(this);
        }
      }
    }, {
      key: '_handleTransitionEnd',
      value: function _handleTransitionEnd(dependency) {
        if (dependency) {
          var dependencyInfo = this._dependencyInfos.get(dependency);
          var currentValue = dependency.peek();
          if (!Action._hasSingleDependencyChanged(dependencyInfo, currentValue)) {
            dependencyInfo.baseChanged = false;
            dependency.baseChanged.addHandler(this._baseChangedHandler);
            dependency.transitionEnded.addHandler(this._transitionEndedHandler);
            return;
          }
        }
        if (this._runAutomatically) {
          this.run();
        }
        this._transitionEnded.fire(this);
      }
    }, {
      key: '_record',
      value: function _record(dependency, equals) {
        equals = equals || dependency.equals || defaultEquals;
        var dependencyInfo = this._dependencyInfos.get(dependency);
        if (!dependencyInfo) {
          dependencyInfo = {
            equalss: new Set(),
            baseChanged: false
          };
          this._dependencyInfos.set(dependency, dependencyInfo);
        }
        if (dependencyInfo.equalss.size === 0) {
          dependency.baseChanged.addHandler(this._baseChangedHandler);
          if (this._runAutomatically || !this._transitionEnded.isEmpty) {
            dependency.transitionEnded.addHandler(this._transitionEndedHandler);
          }
          dependencyInfo.value = dependency.peek();
        }
        dependencyInfo.equalss.add(equals);
        return dependencyInfo.value;
      }
    }], [{
      key: '_hasSingleDependencyChanged',
      value: function _hasSingleDependencyChanged(dependencyInfo, currentValue) {
        var _iteratorNormalCompletion5 = true;
        var _didIteratorError5 = false;
        var _iteratorError5 = undefined;

        try {
          for (var _iterator5 = dependencyInfo.equalss[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var equals = _step5.value;

            if (!equals(dependencyInfo.value, currentValue)) {
              return true;
            }
          }
        } catch (err) {
          _didIteratorError5 = true;
          _iteratorError5 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
              _iterator5.return();
            }
          } finally {
            if (_didIteratorError5) {
              throw _iteratorError5;
            }
          }
        }

        return false;
      }
    }]);

    return Action;
  }();

  var newAction = exports.newAction = function newAction(action, cleanup, runAutomatically) {
    return new Action(action, cleanup, runAutomatically);
  };

  var ComputedObservable = exports.ComputedObservable = function (_Action) {
    _inherits(ComputedObservable, _Action);

    function ComputedObservable(calculation, cleanup) {
      _classCallCheck(this, ComputedObservable);

      var _this2 = _possibleConstructorReturn(this, (ComputedObservable.__proto__ || Object.getPrototypeOf(ComputedObservable)).call(this, function (recorder) {
        _this2._value = _this2._calculation(recorder);
      }, cleanup, false));

      _this2._calculation = calculation;
      return _this2;
    }

    // equals get, set

    _createClass(ComputedObservable, [{
      key: 'peek',
      value: function peek() {
        this.update();
        return this._value;
      }
    }]);

    return ComputedObservable;
  }(Action);

  var newComputed = exports.newComputed = function newComputed(calculation, cleanup) {
    return new ComputedObservable(calculation, cleanup);
  };

  var newTransition = exports.newTransition = function newTransition(transitionEndedPub) {
    return {
      ended: transitionEndedPub
    };
  };

  var inTransition = exports.inTransition = function inTransition(operation, parentTransition) {
    if (parentTransition) {
      return operation(parentTransition);
    }

    var transitionEnded = (0, _oneTimeEvent.newOneTimeEvent)();
    var transition = newTransition(transitionEnded.pub);

    var result = void 0;
    try {
      result = operation(transition);
    } finally {
      transitionEnded.fire();
    }
    return result;
  };

  var isObservable = exports.isObservable = function isObservable(observable) {
    return observable.transitionEnded && observable.peek && observable.baseChanged;
  };
});
//# sourceMappingURL=consistentObservable.js.map