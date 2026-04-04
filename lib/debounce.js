/**
 * Creates a debounced version of a function that delays invoking until
 * after `ms` milliseconds have elapsed since the last call.
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced function with .cancel() method
 */
export function debounce(fn, ms) {
  let timeout;
  function debounced(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  }
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}
