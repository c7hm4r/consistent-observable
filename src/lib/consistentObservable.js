import { newOneTimeEvent } from 'one-time-event';

export const defaultEquals = (x, y) => {
  return x === y;
};

export class IndependentObservable {
  constructor(value) {
    this._value = value;
    this._baseChanged = newOneTimeEvent();
    this.baseChanged = this._baseChanged.pub;

    this._transitionEnded = newOneTimeEvent();
    this.transitionEnded = this._transitionEnded.pub;
    this._transitionEndedHandler = this._handleTransitionEnd.bind(this);
  }

  // equals get, set

  peek() {
    return this._value;
  }

  set(newValue, transition) {
    if (!transition) {
      throw new Error('Can only set inside a transition.');
    }
    this._value = newValue;
    if (!this._transitionEnded.isEmpty()) {
      /* [A] hidden feature: _transitionEnded
       * is not registered in transition when handlers registered after set */
      transition.ended.addHandler(this._transitionEndedHandler);
    }
    this._baseChanged.fire(this);
  }

  _handleTransitionEnd(_, rerunSignal) {
    this._transitionEnded.fire(this, rerunSignal);
  }
}

export const newIndependent = (value) => {
  return new IndependentObservable(value);
};

export class ROWrapper {
  constructor(baseObservable) {
    this._baseObservable = baseObservable;

    this._baseChanged = newOneTimeEvent(() =>
      this._baseObservable.baseChanged.addHandler(this._baseChangedHandler));
    this._baseChangedHandler =
      this._baseChanged.fire.bind(this._baseChanged, this);
    this.baseChanged = this._baseChanged.pub;

    this._transitionEnded = newOneTimeEvent(() =>
      this._baseObservable.transitionEnded.addHandler(
        this._transitionEndedHandler));
    this._transitionEndedHandler = (dependency, rerunSignal) => {
      this._transitionEnded.fire(this, rerunSignal);
    };
    this.transitionEnded = this._transitionEnded.pub;
  }

  get equals() { return this._baseObservable.equals; }

  peek() { return this._baseObservable.peek(); }
}

export const newROWrapper = (baseObservable) => {
  return new ROWrapper(baseObservable);
};

export const addROWrapper = (baseObservable) => {
  baseObservable.pub = new ROWrapper(baseObservable);
  return baseObservable;
};

export class Action {
  constructor(
    action /* (recorder) */,
    cleanup /* (isFinal) */,
    runAutomatically = true) {
    this._cleanup = cleanup;
    this._action = action;
    this._runAutomatically = runAutomatically;

    this._baseChanged = newOneTimeEvent();
    // invoked, when any dependency in the computation graph changes
    this.baseChanged = this._baseChanged.pub;
    this._hasBaseChanged = true;
    this._baseChangedHandler = this._handleDependencyBaseChanged.bind(this);

    this._transitionEnded = newOneTimeEvent(
      this._startListeningForTransitionEnd.bind(this));
    this.transitionEnded = this._transitionEnded.pub;
    this._transitionEndedHandler = this._handleTransitionEnd.bind(this);

    this._rerunSignalHandler = this._handleRerunSignal.bind(this);

    this._dependencyInfos = new Map(); // dependency → dependencyInfo

    this._recordHandler = this._record.bind(this);

    this._clean = true;
    this._isFinallyClosed = false;

    this._invalidated = false;

    this._runAfterLastTransition = false;
    this._runTwiceAfterLastTransition = false;

    if (this._runAutomatically) {
      this.run();
    }
  }

  run() {
    if (this._isFinallyClosed) {
      throw new Error('already finally closed');
    }
    if (this._runAfterLastTransition) {
      this._runTwiceAfterLastTransition = true;
    } else {
      this._runAfterLastTransition = true;
    }
    this._close(false);
    this._action(this._recordHandler);
    this._clean = false;
    this._invalidated = false;
    this._hasBaseChanged = false;
    for (const [dependency, dependencyInfo] of this._dependencyInfos) {
      if (dependencyInfo.equalss.size === 0) {
        this._dependencyInfos.delete(dependency);
      }
    }
  }

  /* runs the action,
   * if its computation is not in concert with its dependencies */
  update() {
    if (!this._hasBaseChanged) {
      return false;
    }
    if (this._invalidated || this._clean || this._hasDependencyChanged()) {
      this.run();
      return true;
    }
    this._hasBaseChanged = false;
    return false;
  }

  close() {
    this._close(true);
  }

  _close(isFinal) {
    if (!this._clean) {
      this._hasBaseChanged = true;
      for (const [dependency, dependencyInfo] of this._dependencyInfos) {
        dependency.baseChanged.removeHandler(this._baseChangedHandler);
        dependency.transitionEnded.removeHandler(this._transitionEndedHandler);
        dependencyInfo.equalss.clear();
      }
      if (this._cleanup) {
        this._cleanup(isFinal);
      }
      this._clean = true;
    }
    if (isFinal) {
      this._isFinallyClosed = true;
    }
  }

  // say that a not recorded dependency has changed
  invalidate(transition) {
    if (!transition) {
      throw new Error('Can only invalidate inside a transition.');
    }
    this._invalidated = true;
    // see [A]
    if (!this._transitionEnded.isEmpty()) {
      transition.ended.addHandler(this._transitionEndedHandler);
    }
    this._enableBaseChanged();
  }

  _startListeningForTransitionEnd() {
    if (!this._clean) {
      for (const dependency of this._dependencyInfos.keys()) {
        dependency.transitionEnded.addHandler(this._transitionEndedHandler);
      }
    }
  }

  _hasDependencyChanged() {
    for (const [dependency, dependencyInfo] of this._dependencyInfos) {
      if (dependencyInfo.baseChanged) {
        const currentValue = dependency.peek();
        if (Action._hasSingleDependencyChanged(dependencyInfo, currentValue)) {
          return true;
        }
        dependency.baseChanged.addHandler(this._baseChangedHandler);
      }
    }
    return false;
  }

  _handleDependencyBaseChanged(dependency) {
    const dependencyInfo = this._dependencyInfos.get(dependency);
    dependencyInfo.baseChanged = true;
    this._enableBaseChanged();
  }

  _enableBaseChanged() {
    if (!this._hasBaseChanged) {
      this._hasBaseChanged = true;
      this._baseChanged.fire(this);
    }
  }

  _handleTransitionEnd(dependency, rerunSignal) {
    if (dependency) {
      const dependencyInfo = this._dependencyInfos.get(dependency);
      if (!dependencyInfo) {
        return;
        /* may happen when transitionEnded event processing of dependency
         * is in progress, as part of that has already triggered
         * a rerun of `this` and dependency is not necessary anymore for
         * `this`. */
      }
      const currentValue = dependency.peek();
      if (!this._runTwiceAfterLastTransition &&
        !Action._hasSingleDependencyChanged(dependencyInfo, currentValue)) {
        dependencyInfo.baseChanged = false;
        dependency.baseChanged.addHandler(this._baseChangedHandler);
        dependency.transitionEnded.addHandler(this._transitionEndedHandler);
        return;
      }
    }
    this._runAfterLastTransition = false;
    this._runTwiceAfterLastTransition = false;
    this._close(false);

    rerunSignal.addHandler(this._rerunSignalHandler);
    this._transitionEnded.fire(this, rerunSignal);
  }

  _handleRerunSignal() {
    if (this._runAutomatically && !this._isFinallyClosed) {
      this.run();
    }
  }

  _record(dependency, equals) {
    equals = equals || dependency.equals || defaultEquals;
    let dependencyInfo = this._dependencyInfos.get(dependency);
    if (!dependencyInfo) {
      dependencyInfo = {
        equalss: new Set(),
        baseChanged: false
      };
      this._dependencyInfos.set(dependency, dependencyInfo);
    }
    if (dependencyInfo.equalss.size === 0) {
      dependency.baseChanged.addHandler(this._baseChangedHandler);
      if (this._runAutomatically || !this._transitionEnded.isEmpty()) {
        dependency.transitionEnded.addHandler(this._transitionEndedHandler);
      }
      dependencyInfo.value = dependency.peek();
    }
    dependencyInfo.equalss.add(equals);
    return dependencyInfo.value;
  }

  static _hasSingleDependencyChanged(dependencyInfo, currentValue) {
    for (const equals of dependencyInfo.equalss) {
      if (!equals(dependencyInfo.value, currentValue)) {
        return true;
      }
    }
    return false;
  }
}

export const newAction = (action, cleanup, runAutomatically) => {
  return new Action(action, cleanup, runAutomatically);
};

export class ComputedObservable extends Action {
  constructor(calculation, cleanup) {
    super((recorder) => {
      this._value = this._calculation(recorder);
    }, cleanup, false);
    this._calculation = calculation;
  }

  // equals get, set

  peek() {
    this.update();
    return this._value;
  }
}

export const newComputed = (calculation, cleanup) => {
  return new ComputedObservable(calculation, cleanup);
};

export const newTransition = (transitionEndedPub) => {
  return {
    ended: transitionEndedPub
  };
};

export const inTransition = (operation, parentTransition) => {
  if (parentTransition) {
    return operation(parentTransition);
  }

  const transitionEnded = newOneTimeEvent();
  const transition = newTransition(transitionEnded.pub);

  const rerunSignal = newOneTimeEvent();

  let result;
  try {
    result = operation(transition);
  } finally {
    transitionEnded.fire(null, rerunSignal.pub);
    rerunSignal.fire();
  }
  return result;
};

export const isObservable = (observable) => {
  return observable && observable.transitionEnded &&
    observable.peek && observable.baseChanged;
};
