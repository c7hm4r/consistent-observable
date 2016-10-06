import test from 'tape';

import * as co from '../src/lib/consistentObservable.js';
import { newOneTimeEvent } from 'one-time-event';

/* eslint no-magic-numbers: "off" */

const i = co.newIndependent('4');

test('IndependentObservable: set peek', (t) => {
  t.ok(co.IndependentObservable.prototype.isPrototypeOf(i));
  co.inTransition((tr) => {
    i.set('5', tr);
  });
  t.ok(i.peek() === '5');
  t.end();
});

test('IndependentObservable: when set then baseChanged', (t) => {
  t.plan(1);
  i.baseChanged.addHandler(() => t.pass());
  co.inTransition((tr) => {
    i.set('-', tr);
  });
  t.end();
});

test('IndependentObservable: Set outside transition fails', (t) => {
  t.plan(1);
  try {
    i.set(4);
  } catch (e) {
    t.equals(e.message, 'Can only set inside a transition.');
  }
  t.end();
});

test('Action initial', (t) => {
  t.plan(2);

  const a = co.newAction(() => {
    t.pass();
  });

  t.ok(co.Action.prototype.isPrototypeOf(a));

  a.close();
  t.end();
});

test('Action: close handler called', (t) => {
  let passes = 0;

  const a = new co.Action((r) => r(i), function pass() {
    passes++;
  });

  t.equals(passes, 0);
  co.inTransition((tr) => i.set('6', tr));
  t.equals(passes, 1);
  a.update();
  t.equals(passes, 1);
  a.close();
  t.equals(passes, 2);
  a.close();
  t.equals(passes, 2);
  t.end();
});

test('Action: when runAutomatically = false and no update() or run(), ' +
    'action and cleanup is not executed', (t) => {
  t.plan(0);

  const a = new co.Action(() => {
    t.pass();
  }, () => {
    t.pass();
  }, false);

  a.close();
  t.end();
});

test('Action: when runAutomatically = false, the Action is only run ' +
    'with run() and (if base changed) on update()', (t) => {
  t.plan(1 + 5);

  const a = new co.Action((r) => {
    r(i);
    t.pass();
  }, () => { /* Do nothing. */ }, false);

  for (let j = 0; j < 4; j++) {
    a.update();
  }
  for (let j = 0; j < 5; j++) {
    a.run();
  }
  a.close();
  t.end();
});

test('Action: when runAutomatically = false, the Action is not run ' +
    'automatically after its base changed', (t) => {
  t.plan(1);
  co.inTransition((tr) => i.set(6, tr));

  const a = new co.Action((r) => {
    r(i);
    t.pass();
  }, null, false);

  a.update();
  co.inTransition((tr) => i.set(7, tr));
  a.close();
  t.end();
});

test('Action: without dependencies', (t) => {
  let runs = 0;
  const a = co.newAction(() => runs++);

  t.equals(runs, 1);
  a.update();
  t.equals(runs, 1);
  a.run();
  t.equals(runs, 2);
  a.close();
  t.end();
});

test('Action: reduce dependencies', (t) => {
  const j = co.newIndependent(true);
  const k = co.newIndependent(2);

  let cPasses = 0;
  const c = co.newComputed((rec) => {
    cPasses++;
    return rec(k);
  });

  co.newAction((rec) => {
    if (rec(j)) {
      rec(c);
    }
  });
  t.equals(cPasses, 1);

  co.inTransition((tr) => {
    k.set(4, tr);
  });
  t.equals(cPasses, 2);

  co.inTransition((tr) => {
    j.set(false, tr);
    k.set(6, tr);
  });
  t.equals(cPasses, 2);
  t.end();
});

test('Action: Update', (t) => {
  const j = co.newIndependent(1);
  const k = co.newIndependent(true);
  const l = co.newIndependent(4);
  const a = co.newAction((rec) => {
    rec(j);
    if (rec(k)) {
      rec(l);
    }
  }, null, false);
  a.update();
  co.inTransition((tr) => {
    k.set(false, tr);
  });
  a.update();
  t.end();
});

test('When nesting transitions, changes are signaled only after the ' +
    'outermost transition', (t) => {
  const j = co.newIndependent(1);
  let runs = 0;

  co.newAction((r) => {
    r(j);
    runs++;
  });

  t.equals(runs, 1);
  co.inTransition((tr) => {
    j.set(2, tr);
    co.inTransition((tr2) => {
      j.set(3, tr2);
    }, tr);
    t.equals(runs, 1);
  });
  t.equals(runs, 2);
  t.end();
});

test('isObservable detects only observables', (t) => {
  t.ok(co.isObservable(i));
  t.ok(co.isObservable(new co.ComputedObservable(() => { /* do nothing */ })));
  t.notOk(co.isObservable(new co.Action(() => { /* do nothing */ })));
  t.notOk(co.isObservable({}));
  t.notOk(co.isObservable(void 0));
  t.end();
});

test('equals function suppresses computation', (t) => {
  t.plan(4 + 1);
  co.inTransition((tr) => i.set(0.9, tr));

  const newValues = [];
  const a = co.newAction((r) => {
    const iVal = r(i, (x, y) => Math.round(x) === Math.round(y));
    newValues.push(Math.round(iVal * 100) / 100);
    t.pass();
  });

  for (let j = 1.1; j <= 3.6; j += 0.2) {
    co.inTransition((tr) => i.set(j, tr));
  }
  t.deepEqual(newValues, [0.9, 1.5, 2.5, 3.5]);
  a.close();
  t.end();
});

test('two equals functions', (t) => {
  co.inTransition((tr) => i.set(4, tr));
  const a = co.newComputed((r) => {
    r(i, (x, y) => {
      return x % 2 === y % 2;
    });
    r(i, (x, y) => {
      return Math.abs(x - y) <= 10;
    });
    return i.peek() * 10;
  });

  t.equals(a.peek(), 40);
  co.inTransition((tr) => i.set(5, tr));
  t.equals(a.peek(), 50);
  co.inTransition((tr) => i.set(15, tr));
  t.equals(a.peek(), 50);
  co.inTransition((tr) => i.set(17, tr));
  t.equals(a.peek(), 170);
  t.end();
});

test('Default equals functions can be specified for observables', (t) => {
  t.plan(6 + 14);

  const floorEquals = (a, b) => Math.floor(a) === Math.floor(b);
  const roundEquals = (a, b) => Math.round(a) === Math.round(b);

  const indep0 = co.newIndependent(0);
  const indep1 = co.newIndependent(0);
  const comp = co.newComputed((r) => r(indep1));

  indep0.equals = roundEquals;
  comp.equals = roundEquals;

  let passCount0 = 0;
  let passCount1 = 0;

  co.newAction((r) => {
    r(indep0);
    r(comp);
    passCount0++;
    t.pass();
  });
  co.newAction((r) => {
    r(indep0, floorEquals);
    r(comp, floorEquals);
    passCount1++;
    t.pass();
  });
  t.equals(passCount0, 1);
  t.equals(passCount1, 1);

  passCount0 = 0;
  passCount1 = 0;

  co.inTransition((tr) => indep0.set(0.3, tr));
  t.equals(passCount0, 0);
  t.equals(passCount1, 0);

  co.inTransition((tr) => indep0.set(0.5, tr));
  t.equals(passCount0, 1);
  t.equals(passCount1, 0);

  co.inTransition((tr) => indep0.set(1, tr));
  t.equals(passCount0, 1);
  t.equals(passCount1, 1);

  passCount0 = 0;
  passCount1 = 0;

  co.inTransition((tr) => indep1.set(0.3, tr));
  t.equals(passCount0, 0);
  t.equals(passCount1, 0);

  co.inTransition((tr) => indep1.set(0.5, tr));
  t.equals(passCount0, 1);
  t.equals(passCount1, 0);

  co.inTransition((tr) => indep1.set(1, tr));
  t.equals(passCount0, 1);
  t.equals(passCount1, 1);

  t.end();
});

test('ComputedObservable: peek returns the computed value', (t) => {
  t.plan(5);
  co.inTransition((tr) => i.set(4, tr));

  const c = co.newComputed((rec) => {
    t.pass();
    return rec(i) + 10;
  });

  t.ok(co.ComputedObservable.prototype.isPrototypeOf(c));
  t.equals(c.peek(), 14);
  co.inTransition((tr) => i.set(5, tr));
  t.equals(c.peek(), 15);
  t.end();
});

test('ComputedObservable: depending Actions are invoked', (t) => {
  t.plan(1 + 5);
  co.inTransition((tr) => i.set(4, tr));
  const c = new co.ComputedObservable((r) => r(i) + 12);
  const a = new co.Action((r) => {
    r(c);
    r(c);
    t.pass();
  });

  for (let j = 0; j < 5; j++) {
    co.inTransition((tr) => i.set(j, tr));
  }
  t.end();
  a.close();
  c.close();
  co.inTransition((tr) => i.set(0, tr));
});

const newNitpicker = () => {
  let ordered = 0;
  let orderedValue;
  const result = {
    once: (operation, value) => {
      const previous = ordered;
      result.order(value);
      operation();
      if (previous !== ordered) {
        throw new Error('tick ordered, but not performed (or too often)');
      }
    },
    tick: (value) => {
      if (ordered <= 0) {
        throw new Error('tick not allowed');
      }
      if (orderedValue !== value) {
        throw new Error('wrong value');
      }
      ordered--;
    },
    isDone: () => {
      return ordered === 0;
    },
    order: (value) => {
      ++ordered;
      orderedValue = value;
    }
  };
  return result;
};

test('ComputedObservable: cleanup', (t) => {
  t.plan(1);
  const comp = co.newComputed(() => 4, () => t.pass());
  comp.update();
  comp.run();
  t.end();
});

test('ComputedObservable: Invalidate forces run on next access', (t) => {
  const calculationCounter = newNitpicker();
  const cleanupCounter = newNitpicker();

  const j = co.newIndependent(1);
  const ob = co.newComputed((r) => {
    r(j);
    calculationCounter.tick();
  }, () => cleanupCounter.tick());

  co.inTransition((tr) => {
    ob.invalidate(tr);
  });

  calculationCounter.once(() => {
    ob.peek();
  });
  ob.peek();

  co.inTransition((tr) => {
    ob.invalidate(tr);
  });

  calculationCounter.once(() => {
    cleanupCounter.once(() => {
      ob.peek();
    });
  });
  ob.peek();

  co.newAction((r) => {
    r(ob);
  });

  co.inTransition((tr) => {
    ob.invalidate(tr);
    cleanupCounter.order();
    calculationCounter.order();
  });
  t.ok(cleanupCounter.isDone());
  t.ok(calculationCounter.isDone());

  t.end();
});

test('Action: invalidation outside transition fails', (t) => {
  const a = co.newAction(() => { /* empty */ });
  t.throws(() => {
    a.invalidate();
  });
  t.end();
});

test('Wrapper works', (t) => {
  t.plan(6);
  const j = co.newIndependent(2);
  const w = co.newROWrapper(j);
  let passCount = 0;
  let lastPassValue = null;
  co.newAction((record) => {
    passCount++;
    lastPassValue = record(w);
    t.pass();
  });
  t.equals(passCount, 1);
  t.equals(lastPassValue, 2);
  co.inTransition((tr) => {
    j.set(j.peek() + 1, tr);
  });
  t.equals(passCount, 2);
  t.equals(lastPassValue, 3);
  t.end();
});

test('addROWrapper', (t) => {
  const j = co.addROWrapper(co.newIndependent(1));
  t.equals(j.pub.peek(), 1);
  t.notOk(j.pub.set);
  t.end();
});

test('transition exposed', (t) => {
  t.plan(2);
  const j = co.newIndependent(1);
  co.newAction((r) => {
    r(j);
    t.pass();
  });

  const transitionEnded = newOneTimeEvent();
  const transition = co.newTransition(transitionEnded.pub);

  setTimeout(() => {
    transitionEnded.fire();
  });
  j.set(2, transition);
});

test('isFinal parameter', (t) => {
  const isFinalPicker = newNitpicker();

  const j = co.newIndependent(1);
  const c = co.newComputed(
    (r) => r(j),
    (isFinal) => isFinalPicker.tick(isFinal));

  c.update();
  co.inTransition((tr) => {
    j.set(0, tr);
  });
  isFinalPicker.once(() => {
    c.update();
  }, false);
  isFinalPicker.once(() => {
    c.close();
  }, true);
  t.end();
});

test('Cannot pull away transition event', (t) => {
  const j = co.newIndependent(0);
  const c = co.newComputed((r) => r(j) + 1);
  let valueA, valueA1;
  const a = co.newAction((r) => { valueA = r(j) + r(c); });
  const a1 = co.newAction((r) => { valueA1 = r(c); });

  co.inTransition((tr) => {
    j.set(1, tr);
  });
  t.equals(valueA, 3);
  t.equals(c.peek(), 2);
  t.equals(valueA1, 2);
  a.close();
  a1.close();
  t.end();
});

test('Cannot pull away transition event II', (t) => {
  const j = co.newIndependent(0);
  const c = co.newComputed((r) => r(j) + 1);
  let valueA;
  co.newAction((r) => { valueA = r(c); });

  co.inTransition((tr) => {
    j.set(1, tr);
    c.peek();
  });
  t.equals(c.peek(), 2);
  t.equals(valueA, 2);
  t.end();
});
