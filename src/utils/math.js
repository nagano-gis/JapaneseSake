export function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

export function createThrottled(fn, waitMs = 120) {
  let timer = null;
  let lastArgs = null;

  return (...args) => {
    lastArgs = args;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn(...lastArgs);
    }, waitMs);
  };
}

export function createDebounced(fn, waitMs = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}