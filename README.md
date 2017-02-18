# `consistent-observable`

[![npm](https://img.shields.io/npm/v/consistent-observable.svg)](https://www.npmjs.com/package/consistent-observable)
[![license](https://img.shields.io/npm/l/consistent-observable.svg)](https://opensource.org/licenses/ISC)
[![github-issues](https://img.shields.io/github/issues/c7hm4r/consistent-observable.svg)](https://github.com/c7hm4r/consistent-observable/issues)

Little framework for simplifying reaction to values changing over time.

## Install

- [NPM package](https://www.npmjs.com/package/consistent-observable):
  ```bash
  npm install -S consistent-observable
  ```
- [Bower](https://bower.io/) package
  ```bash
  bower install -S consistent-observable
  ```
- Manual download: [consistent-observable](https://raw.githubusercontent.com/c7hm4r/consistent-observable/master/dist/lib/consistentObservable.js) and dependency [one-time-event](https://raw.githubusercontent.com/c7hm4r/one-time-event/89c65ecf616a0d47ac85d57b28e43d200dfba459/oneTimeEvent.es5.js)

Together with its dependency, `consistent-observable` requires the following ES2015 features:

- [`Set`](http://kangax.github.io/compat-table/es6/#test-Set)
- [`Map`](http://kangax.github.io/compat-table/es6/#test-Map)
- [`Array.from`](http://kangax.github.io/compat-table/es6/#test-Array_static_methods)

So if you want to support old browsers you may need a polyfill, for example [babel-polyfill](https://babeljs.io/docs/usage/polyfill/).

## Usage

If no CommonJS or AMD module loader is available, the module is exposed globally as `consistentObservable`.

```JavaScript
var co = window.consistentObservable;

// CommonJS
var co = require('consistent-observable');
```

A “consistent observable” is an object which represents a value which may change over time. There are currently two types of  consistent observables:

- `IndependentObservable`: Stores the value like a box. Exhibits a `set` method to change the value.

  ```JavaScript
  var task = co.newIndependent('6 * 7');
  var solution = co.newIndependent('42');

  console.log(task.peek()); // Logs '6 * 7'
  ```

- `ComputedObservable`: Depends on other consistent observables. The value is computed when it is accessed (and has not been computed before). If a dependency changes, the value of the `ComputedObservable` changes, too.

  ```JavaScript
  var equation = co.newComputed(function (r) {
    return r(task) + ' == ' + r(solution);
  });

  console.log(together.peek()); // Logs '6 * 7 == 42'
  ```

  Note the recording function `r`. It is required because the `ComputedObservable` needs to track which consistent observable it depends on.

Futhermore there are `Action`s, which—like `ComputedObservable`s—depend on any amount of consistent observables, but `Actions` are no observables themselves. They can be used to align some external state according to their dependencies.

```JavaScript
var logger = co.newAction(function (r) {
  console.log('This is true: ' + r(together));
}); // Logs 'This is true: 6 * 7 == 42'.
```

Changing values can be performed in the following way:

```JavaScript
co.inTransition(function(tr) {
  task.set('7 * 8', tr);
  end.set('56', tr);
}); // Logs 'This is true: 7 * 8 == 56'
```

These two `set` operations are performed inside a “transition”.  This means that all updates caused by the changes are propagated only at the end of the `inTransition` call. This avoids that `'This is true: 7 * 8 == 42'` is logged. Transitions should not be confused with transactions as they do not support rollbacks.

After an `Action` is stopped, it does not react to dependency changes anymore:

```JavaScript
logger.close();
```

One target of the implementation of `consistent-observable` has been to minimize the count of executed computations so that unnecessary updates are avoided. It was primarily developed for UI coordination but it is purpose neutral.

## Contributing

If you want to build the project or run the tests, please overwrite `npm-shrinkwrap.json` by `npm-shrinkwrap.dev.json`. Then run `npm i`. That is a work around for the multiple problems npm currently has with its npm-shrinkwrap.json files and dev dependencies ([https://github.com/npm/npm/issues/6298](https://github.com/npm/npm/issues/6298)).

Build command: `npm run rebuild`

Test command: `npm run test`

Coverage command: `npm run coverage`

[https://github.com/c7hm4r/consistent-observable](https://github.com/c7hm4r/consistent-observable)

## Similar projects

Sometimes you just don’t find the right words to put into the search engines…

- [`mobx`](https://github.com/mobxjs/mobx)

## License

Copyright (c) 2016, Christoph Müller <iblzm@hotmail.de>

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
