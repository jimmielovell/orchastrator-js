'use strict';

import os from 'os';
import path from 'path';
import fs from 'fs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul',
  'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ALPHANUMERIC = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f',
  'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y',
  'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R',
  'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

const ESCAPE_REG_EXP = /[-/\\^$*+?.()|[\]{}]/g;
const HEXADECIMAL = /^[0-9a-f]+$/i;
const MEMOIZE_MAX_SIZE = 500;

const lut = [];
for (let i=0; i<256; i++) { lut[i] = (i<16?'0':'')+(i).toString(16); }

const RegexCache = new Map();

const byteMultipliers = {
	b:  1,
	kb: 1 << 10,
	mb: 1 << 20,
	gb: 1 << 30,
	tb: Math.pow(1024, 4),
	pb: Math.pow(1024, 5),
};
// eslint-disable-next-line security/detect-unsafe-regex
const parseByteStringRe = /^((-|\+)?(\d+(?:\.\d+)?)) *(kb|mb|gb|tb|pb)$/i;

/**
 * Circular replacing of unsafe properties in object
 *
 * @param {Object=} options List of options to change circularReplacer behaviour
 * @param {number=} options.maxSafeObjectSize Maximum size of objects for safe object converting
 * @return {function(...[*]=)}
 */
function circularReplacer(options = { maxSafeObjectSize: Infinity }) {
	const seen = new WeakSet();
	return function(key, value) {
		if (typeof value === 'object' && value !== null) {
			const objectType = value.constructor && value.constructor.name || typeof value;

			if (options.maxSafeObjectSize && 'length' in value && value.length > options.maxSafeObjectSize) {
				return `[${objectType} ${value.length}]`;
			}

			if (options.maxSafeObjectSize && 'size' in value && value.size > options.maxSafeObjectSize) {
				return `[${objectType} ${value.size}]`;
			}

			if (seen.has(value)) {
				//delete this[key];
				return;
			}
			seen.add(value);
		}
		return value;
	};
}

const units = ['h', 'm', 's', 'ms', 'μs', 'ns'];
const divisors = [60 * 60 * 1000, 60 * 1000, 1000, 1, 1e-3, 1e-6];

export function flatten(arr) {
	return Array.prototype.reduce.call(arr, (a, b) => a.concat(b), []);
}

export function humanize(milli) {
	if (milli == null) return '?';

	for (let i = 0; i < divisors.length; i++) {
		const val = milli / divisors[i];
		if (val >= 1.0)
			return '' + Math.floor(val) + units[i];
	}

	return 'now';
}

// Fast UUID generator
export function generateUUID() {
	const d0 = Math.random()*0xffffffff|0;
	const d1 = Math.random()*0xffffffff|0;
	const d2 = Math.random()*0xffffffff|0;
	const d3 = Math.random()*0xffffffff|0;
	return lut[d0&0xff]+lut[d0>>8&0xff]+lut[d0>>16&0xff]+lut[d0>>24&0xff]+'-'+
		lut[d1&0xff]+lut[d1>>8&0xff]+'-'+lut[d1>>16&0x0f|0x40]+lut[d1>>24&0xff]+'-'+
		lut[d2&0x3f|0x80]+lut[d2>>8&0xff]+'-'+lut[d2>>16&0xff]+lut[d2>>24&0xff]+
		lut[d3&0xff]+lut[d3>>8&0xff]+lut[d3>>16&0xff]+lut[d3>>24&0xff];
}

export function removeFromArray(arr, item) {
	if (!arr || arr.length == 0){
		return arr;
	}
	const idx = arr.indexOf(item);
	if (idx !== -1) {
		arr.splice(idx, 1);
	}

	return arr;
}

/**
 * Get default NodeID (computerName)
 *
 * @returns
 */
export function getNodeID() {
	return os.hostname().toLowerCase() + '-' + process.pid;
}

/**
 * Make directories recursively
 * @param {String} p - directory path
 */
export function makeDirs(p) {
	p.split(path.sep)
		.reduce((prevPath, folder) => {
			const currentPath = path.join(prevPath, folder, path.sep);
			if (!fs.existsSync(currentPath)) {
				fs.mkdirSync(currentPath);
			}
			return currentPath;
		}, '');
}

/**
 * Parse a byte string to number of bytes. E.g '1kb' -> 1024
 * Credits: https://github.com/visionmedia/bytes.js
 *
 * @param {String} v
 * @returns {Number}
 */
export function parseByteString(v) {
	if (typeof v === 'number' && !isNaN(v)) {
		return v;
	}

	if (typeof v !== 'string') {
		return null;
	}

	// Test if the string passed is valid
	let results = parseByteStringRe.exec(v);
	let floatValue;
	let unit = 'b';

	if (!results) {
		// Nothing could be extracted from the given string
		floatValue = parseInt(v, 10);
		if (Number.isNaN(floatValue))
			return null;

		unit = 'b';
	} else {
		// Retrieve the value and the unit
		floatValue = parseFloat(results[1]);
		unit = results[4].toLowerCase();
	}

	return Math.floor(byteMultipliers[unit] * floatValue);
}

/**
 * Date object to readable date string.
 * @param {Date} [date=new Date()] The date object.
 * @return {String} The date string.
 */
export function dateToString(date = new Date()) {
  const dd = numberToString(date.getDate());
  const mm = MONTHS[date.getMonth()];
  const yyyy = numberToString(date.getFullYear());
  const hh = numberToString(date.getHours());
  const min = numberToString(date.getMinutes());
  const ss = numberToString(date.getSeconds());

  return `${paddingLeft(dd, '0', 2)}-${mm}-${yyyy.substring(2)} ${
    paddingLeft(hh, '0', 2)}:${paddingLeft(min, '0', 2)}:${paddingLeft(ss, '0', 2)}`;
}

/**
 * Get the actual date as a readable string.
 * @return {String} A readable date string.
 */
export function now() {
  const date = new Date();
  const string = dateToString(date);
  const millis = numberToString(date.getMilliseconds());
  return `${string}.${paddingLeft(millis, '0', 3)}`;
}

/**
 * Clone a Date object.
 * @param {Date} date The original Date object.
 * @return {Date} The cloned Date.
 */
export function cloneDate(date) {
  return new Date(date.getTime());
}

// Array

/**
 * Split an array into chunks.
 * @param {Array} array The array.
 * @param {Number} chunkSize The chunk size.
 * @return {Array} An array of chunks.
 */
export function arrayChunk(array, chunkSize) {
  const size = array.length;
  const tempArray = new Array(Math.ceil(size / chunkSize));

  for (let i = 0, j = 0; j < size; j += chunkSize, i++) {
    tempArray[i] = copyArray(array, j, j + chunkSize);
  }

  return tempArray;
}

/**
 * Recursive quicksort using Hoare partitioning with random pivot and cut off to insertion sort.
 * @param {Array} array The array to sort.
 * @param {Function} [comparator=_numericComparator] An optional comparator, it will be called
 *   with two values and must return 1 if the first is greater than the second, 0 if they are
 *   equals or -1 if the second is greater than the first one.
 * @param {Number} [left=0] The left index.
 * @param {Number} [right=array.length-1] the right index.
 */
export function sort(array, comparator, left, right) {
  if (isNumber(comparator)) {
    right = left;
    left = comparator;
    comparator = undefined;
  }

  left = left || 0;
  right = right || array.length - 1;
  comparator = comparator || _numericComparator;

  _quickSort(array, comparator, left, right);
}

function _quickSort(array, comparator, left, right) {
  if (right - left < 27) {
    _insertionSort(array, comparator, left, right);
    return;
  }

  let leftIndex = left;
  let rightIndex = right;
  const pivot = array[randomNumber(left, right + 1)];

  while (leftIndex <= rightIndex) {
    while (comparator(array[leftIndex], pivot) < 0) {
      leftIndex++;
    }

    while (comparator(array[rightIndex], pivot) > 0) {
      rightIndex--;
    }

    if (leftIndex <= rightIndex) {
      swap(array, leftIndex, rightIndex);
      leftIndex++;
      rightIndex--;
    }
  }

  if (left < rightIndex) {
    _quickSort(array, comparator, left, rightIndex);
  }

  if (right > leftIndex) {
    _quickSort(array, comparator, leftIndex, right);
  }
}

function _insertionSort(array, comparator, left, right) {
  for (let i = left; i <= right; i++) {
    for (let j = i; j > left && comparator(array[j], array[j - 1]) < 0; j--) {
      swap(array, j, j - 1);
    }
  }
}

function _numericComparator(number1, number2) {
  return number1 - number2;
}

/**
 * Swap the two values in an array.
 * @param {Array} array The array.
 * @param {Number} from From index.
 * @param {Number} to To index.
 */
export function swap(array, from, to) {
  const aux = array[from];
  array[from] = array[to];
  array[to] = aux;
}

/**
 * Add all the elements in source at the end of dest.
 * @param {Array} dest The destiny array.
 * @param {Array} source The source array.
 */
export function concatArrays(dest, source) {
  const destLength = dest.length;
  dest.length += source.length;

  for (let i = 0; i < source.length; i++) {
    dest[destLength + i] = source[i];
  }
}

/**
 * Shallow copy of an array.
 * @param {Array} array The array to copy.
 * @param {Number} [start=0] The start inclusive index.
 * @param {Number} [end=array.length] The end exclusive index.
 * @return {Array} The copied array.
 */
export function copyArray(array, start = 0, end = array.length) {
  if (end > array.length) {
    end = array.length;
  }

  const copyLength = end - start;

  if (copyLength === 1) {
    return [array[start]];
  }

  if (copyLength < 50) {
    const copy = new Array(copyLength);
    for (let i = 0; i < copyLength; i++) {
      copy[i] = array[i + start];
    }

    return copy;
  }

  return array.slice(start, end);
}

/**
 * Empty the content of an array.
 * @param {Array} array The array to clear.
 */
export function clearArray(array) {
  array.length = 0;
}

function _defaultDataGenerator() {
  return randomNumber(1, 100);
}

/**
 * Return a random array of generated elements by dataGenerator.
 * @param {Number} length The length.
 * @param {Function} [dataGenerator=_defaultDataGenerator] The data generator.
 * @return {Array} The array.
 */
export function randomArray(length, dataGenerator = _defaultDataGenerator) {
  const array = new Array(length);

  for (let i = 0; i < length; i++) {
    array[i] = dataGenerator();
  }

  return array;
}

/**
 * Intersect two sorted arrays.
 * @param {Array} array1 The first array.
 * @param {Array} array2 The second array.
 * @return {Array} The interected array.
 * @param {Function} [comparator=_numericComparator] An optional comparator, it will be called
 *   with two values and must return 1 if the first is greater than the second, 0 if they are
 *   equals or -1 if the second is greater than the first one.
 */
export function intersectSorted(array1, array2, comparator = _numericComparator) {
  let i1 = 0;
  let i2 = 0;
  const result = [];
  let previous = Infinity;

  while (i1 < array1.length && i2 < array2.length) {
    if (comparator(array1[i1], array2[i2]) < 0) {
      i1++;
    } else if (comparator(array1[i1], array2[i2]) > 0) {
      i2++;
    } else {
      if (array1[i1] !== previous) {
        previous = array1[i1];
        result.push(previous);
      }

      i1++;
      i2++;
    }
  }

  return result;
}

/**
 * About 1.5x faster than the two-arg version of Array#splice(). This
 * algorithm was taken from the core of Node.js.
 * @param {Array} array The array.
 * @param {Number} index The element to remove.
 */
export function spliceOne(array, index) {
  if (index === 0) {
    array.shift();
    return;
  }

  for (; index + 1 < array.length; index++) {
    array[index] = array[index + 1];
  }

  array.pop();
}

/**
 * Inserts a value into a sorted array using an iterative binary search to find
 * the insertion index. 'rejectDuplicates' defines the behaviour when the value
 * that will be inserted is already in the array.
 * @param {*} value The value to insert.
 * @param {Array} array The array.
 * @param {Function} [comparator=_numericComparator] An optional comparator, it will be called
 *   with two values and must return 1 if the first is greater than the second, 0 if they are
 *   equals or -1 if the second is greater than the first one.
 * @param {Boolean} [rejectDuplicates=false] Specify if duplicated values will be rejected.
 */
export function binaryInsert(value, array, comparator, rejectDuplicates) {
  if (isBoolean(comparator)) {
    rejectDuplicates = comparator;
    comparator = undefined;
  }

  rejectDuplicates = rejectDuplicates || false;
  comparator = comparator || _numericComparator;

  let left = 0;
  let right = array.length - 1;

  while (left <= right) {
    const middle = (left + right) >>> 1;
    const computed = array[middle];
    const cmpValue = comparator(computed, value);

    if (cmpValue > 0) {
      right = middle - 1;
      continue;
    }

    left = middle + 1;
    if (cmpValue === 0) {
      if (rejectDuplicates) {
        return;
      }
      break;
    }
  }

  array.splice(left, 0, value);
}

/**
 * Find a value into a sorted array using an iterative binary search.
 * @param {*} value The value to search.
 * @param {Array} array The array.
 * @param {Function} [comparator=_numericComparator] An optional comparator, it will be called
 *   with two values and must return 1 if the first is greater than the second, 0 if they are
 *   equals or -1 if the second is greater than the first one.
 * @param {Number} [left=0] The left index.
 * @param {Number} [right=array.length-1] The right index.
 * @return {Number} The index if the value was found or -1.
 */
export function binarySearch(value, array, comparator, left, right) {
  if (isNumber(comparator)) {
    right = left;
    left = comparator;
    comparator = undefined;
  }

  left = left || 0;
  right = right || array.length - 1;
  comparator = comparator || _numericComparator;

  while (left <= right) {
    const middle = (left + right) >>> 1;
    const computed = array[middle];
    const cmpValue = comparator(computed, value);

    if (cmpValue > 0) {
      right = middle - 1;
      continue;
    }

    left = middle + 1;
    if (cmpValue === 0) {
      return middle;
    }
  }

  return -1;
}

/**
 * Returns a random value within the provided array.
 * @param {Array} array The array.
 * @param {Number} [start=0] The start inclusive index.
 * @param {Number} [end=array.length] The end exclusive index.
 * @return {*} A random item.
 */
export function randomArrayItem(array, start = 0, end = array.length) {
  if (end > array.length) {
    end = array.length;
  }

  return array[randomNumber(start, end)];
}

// Arguments

/**
 * Convert arguments to array.
 * @param {arguments} args The arguments object.
 * @return {Array} The array.
 */
export function argumentsToArray(args) {
  return copyArray(args);
}

// String

/**
 * Return a random alphanumeric string.
 * @param {Number} size The size
 * @param {Boolean} [caseInsensitive=false] If true, only lower case letters will be returned.
 * @return {String} The random string.
 */
export function randomString(size, caseInsensitive = false) {
  let string = '';
  const limit = caseInsensitive ? 36 : 62;

  for (let i = 0; i < size; i++) {
    string += ALPHANUMERIC[randomNumber(0, limit)];
  }

  return string;
}

/**
 * Convert a string to a number.
 * @param {String} string The string.
 * @return {Number} The number.
 */
export function stringToNumber(string) {
  return string * 1;
}

/**
 * Add a left padding to string.
 * @param {String} string The string.
 * @param {String} pad The pad.
 * @param {Number} length The length final length.
 * @return {String} The padded string.
 */
export function paddingLeft(string, pad, length) {
  return repeat(pad, length - string.length) + string;
}

/**
 * Add a right padding to string.
 * @param {String} string The string.
 * @param {String} pad The pad.
 * @param {Number} length The length final length.
 * @return {String} The padded string.
 */
export function paddingRight(string, pad, length) {
  return string + repeat(pad, length - string.length);
}

/**
 * Add a left and right padding to string.
 * @param {String} string The string.
 * @param {String} pad The pad.
 * @param {Number} length The length final length.
 * @return {String} The padded string.
 */
export function paddingBoth(string, pad, length) {
  const right = Math.ceil((length - string.length) / 2);
  const left = length - (right + string.length);
  return repeat(pad, left) + string + repeat(pad, right);
}

/**
 * Repeat a string N times.
 * @param {String} string The string to repeat.
 * @param {Number} times The times to repeat.
 * @return {String} The repeated string.
 */
export function repeat(string, times) {
  const length = times * string.length;
  const n1 = Math.floor(logN(2, string.length));
  const n2 = Math.ceil(logN(2, length));

  for (let i = n1; i < n2; i++) {
    string += string;
  }

  return string.substring(0, length);
}

/**
 * Replace all ocurrences in string.
 * @param {String} string The string.
 * @param {String} substr The substring to be replaced.
 * @param {String} newSubstr The String that replaces the substr param.
 * @param {Boolean} [ignoreCase=false] If ignore case or not.
 * @return {String} The final string.
 */
export function replaceAll(string, substr, newSubstr, ignoreCase = false) {
  const flags = ignoreCase ? 'gi' : 'g';
  return string.replace(new RegExp(escapeRegExp(substr), flags), newSubstr);
}

/**
 * Check if a string starts by a given prefix.
 * @param {String} string The string.
 * @param {String} prefix The prefix.
 * @return {boolean} If the string starts by prefix of not.
 */
export function startsWith(string, prefix) {
  return string.slice(0, prefix.length) === prefix;
}

/**
 * Check if a string ends by a given suffix.
 * @param {String} string The string.
 * @param {String} suffix The suffix.
 * @return {boolean} If the string ends by suffix of not.
 */
export function endsWith(string, suffix) {
  const { length } = suffix;
  return length === 0 || string.slice(-length) === suffix;
}

/**
 * Escapes a regex expression string.
 * @param {String} string The string to be escaped.
 * @return {String} The escaped string.
 */
export function escapeRegExp(string) {
  return string.replace(ESCAPE_REG_EXP, '\\$&');
}

/**
 * If is a string value representing a date. The string should be in a format
 * recognized by the Date.parse().
 * @param {String} string The string.
 * @return {Boolean} If is a valid date string or not.
 */
export function isDateString(string) {
  const date = new Date(string);
  return !isNaN(date.getTime());
}

/**
 * Check whether a string represent a hexadecimal string or not.
 * @param {String} string The string.
 * @return {Boolean} If is a valid hexadecimal string or not.
 */
export function isHexString(string) {
  return HEXADECIMAL.test(string);
}

/**
 * Split a string into chunks.
 * @param {String} string The string.
 * @param {Number} chunkSize The chunk size.
 * @return {Array} An array of chunks.
 */
export function stringChunk(string, chunkSize) {
  const size = string.length;
  const tempArray = new Array(Math.ceil(size / chunkSize));

  for (let i = 0, j = 0; j < size; j += chunkSize, i++) {
    tempArray[i] = string.substring(j, j + chunkSize);
  }

  return tempArray;
}

/**
 * Splits an object path into an array of tokens.
 * @param {String} path the object path.
 * @return {Array} The path tokens.
 * @function
 */
const splitPath = _memoize((path) => {
  const arr = [];
  let first = 0;
  let last = 0;
  for (; last < path.length; last++) {
    if (path[last] === '[' || path[last] === '.') {
      if (first < last) {
        arr.push(path.substring(first, last));
      }

      first = last + 1;
    } else if (path[last] === ']') {
      arr.push(path.substring(first, last));
      first = last + 1;
    }
  }

  if (first < last) {
    arr.push(path.substring(first, last));
  }

  return arr;
});

function _memoize(fn, maxSize = MEMOIZE_MAX_SIZE) {
  function memoize(...args) {
    if (memoize.cache[args[0]] !== undefined) return memoize.cache[args[0]];
    const result = fn(...args);
    if (memoize.size === maxSize) {
      memoize.cache = {};
      memoize.size = 0;
    }
    memoize.cache[args[0]] = result;
    memoize.size++;
    return result;
  }

  memoize.cache = {};
  memoize.size = 0;
  return memoize;
}

// Number

/**
 * Convert a number to string.
 * @param {Number} number The number.
 * @return {String} The string.
 */
export function numberToString(number) {
  return `${number}`;
}

/**
 * Get a random number.
 * @param {Number} min The inclusive min value.
 * @param {Number} max The exclusive max value.
 * @return {Number} The random number.
 */
export function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min) + min);
}

/**
 * Get the middle value.
 * @param {Number} a The first number.
 * @param {Number} b The second number.
 * @param {Number} c The third number.
 * @return {Number} The middle number.
 */
export function getMiddleNumber(a, b, c) {
  if ((a > b && b > c) || (c > b && b > a)) return b;
  if ((b > a && a > c) || (c > a && a > b)) return a;
  return c;
}

/**
 * Get the number of digits in a number. See
 * <a href="http://stackoverflow.com/questions/14879691/get-number-of-digits-with-javascript/
 * 28203456#28203456">link</a>.
 * @param {Number} integer The integer.
 * @param {Number} [base=10] The base of the number.
 * @return {Number} The number of digits.
 */
export function numDigits(integer, base = 10) {
  return Math.max(Math.floor(logN(base, Math.abs(integer))), 0) + 1;
}

/**
 * Check if a number is an integer or not.
 * @param {Number} number The number to check.
 * @return {Boolean} If the number is an integer.
 */
export function isInteger(number) {
  return number % 1 === 0;
}

/**
 * Checks if a number is NaN. Taken from <a href="http://jacksondunstan.com/articles/983">link</a>.
 * @param {number} number The number to ckeck.
 * @return {Boolean} If the number is NaN.
 */
export function isNaN(number) {
  // eslint-disable-next-line no-self-compare
  return number !== number;
}

/**
 * Checks if a number is NaN, Infinity or -Infinity.
 * Taken from <a href="http://jacksondunstan.com/articles/983">link</a>.
 * @param {Number} number The number to ckeck.
 * @return {Boolean} If the number is NaN, Infinity or -Infinity.
 */
export function isNaNOrInfinity(number) {
  return (number * 0) !== 0;
}

/**
 * Truncates the number. This method is as fast as "number | 0" but it's
 * able to handle correctly numbers greater than 2^31 or lower than -2^31.
 * @param {Number} number The number to be truncated.
 * @return {Number} The truncated number.
 */
export function truncateNumber(number) {
  return number - (number % 1);
}

// Object

/**
 * Merge the source object into dest. This export function only works for object,
 * arrays and primitive data types, references will be copied.
 * @param {Object|Array} dest The destiny object or array.
 * @param {Object|Array} source The source object or array.
 */
export function mergeObjects(dest, source) {
  if (isPlainObject(source)) {
    for (const i in source) {
      if (!Object.prototype.hasOwnProperty.call(source, i)) continue;
      _mergeObjects(dest, source, i);
    }
  } else if (isArray(source)) {
    for (let i = 0; i < source.length; i++) {
      _mergeObjects(dest, source, i);
    }
  }
}

function _mergeObjects(dest, source, i) {
  if (isPlainObject(source[i])) {
    if (!isPlainObject(dest[i])) {
      dest[i] = {};
    }

    mergeObjects(dest[i], source[i]);
  } else if (isArray(source[i])) {
    if (!isArray(dest[i])) {
      dest[i] = new Array(source[i].length);
    }

    mergeObjects(dest[i], source[i]);
  } else {
    dest[i] = source[i];
  }
}

/**
 * Update an object or array using a given path string.
 * @param {Object|Array} dest The object or array to update.
 * @param {*} value The value to place in path.
 * @param {String|Array} path The path where to place the new value.
 */
export function updateObject(dest, value, path) {
  const keys = isArray(path) ? path : splitPath(path);
  const parentPath = keys.slice(0, keys.length - 1);

  const parent = parentPath.length ? get(dest, parentPath) : dest;
  if (isObject(parent)) {
    const key = keys[keys.length - 1];
    parent[key] = value;
  }
}

function _defaultKeyGenerator() {
  return randomString(6);
}

function _defaultValueGenerator() {
  return randomNumber(1, 1000000);
}

/**
 * Get a random object.
 * @param {Number[]|Number} lengths Number of items per level.
 * @param {Function} [keyGenerator=_defaultKeyGenerator] The key generator.
 * @param {Function} [valueGenerator=_defaultValueGenerator] The value generator.
 * @return {Object} The random object.
 */
export function randomObject(lengths, keyGenerator = _defaultKeyGenerator,
  valueGenerator = _defaultValueGenerator) {
  lengths = isNumber(lengths) ? [lengths] : lengths;

  const object = {};
  _randomObject(lengths, keyGenerator, valueGenerator, object, 1);
  return object;
}

function _randomObject(lengths, keyGenerator, valueGenerator, object, actualDepth) {
  const maxDepth = lengths.length;

  if (actualDepth > maxDepth) {
    return;
  }

  for (let i = 0; i < lengths[actualDepth - 1]; i++) {
    const key = keyGenerator();
    object[key] = actualDepth === maxDepth ? valueGenerator() : {};
    _randomObject(lengths, keyGenerator, valueGenerator, object[key], actualDepth + 1);
  }
}

/**
 * Divide an object into chunks by keys number.
 * @param {Object} object The object.
 * @param {Number} chunkSize The max key number per chunk.
 * @return {Object[]} An array of chunks objects.
 */
export function objectChunk(object, chunkSize) {
  const chunks = [];
  let index = 0;
  let counter = 0;

  for (const key in object) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
    if (chunks[index] === undefined) {
      chunks[index] = {};
    }

    chunks[index][key] = object[key];

    if (++counter % chunkSize === 0) {
      index++;
    }
  }

  return chunks;
}

/**
 * Deep copy of object or array.
 * @param {Object|Array} object The object or array.
 * @return {Object|Array} The cloned object.
 */
export function cloneObject(original) {
  const clone = isArray(original) ? [] : {};
  mergeObjects(clone, original);
  return clone;
}

/**
 * Get the value using a path in an object.
 * @param {Object|Array} object The object or array.
 * @param {String|Array} path The path.
 * @param {*} [def] Value to return if no value is found in path.
 * @return {*} The found value in path.
 */
export function get(obj: ObjectConstructor | [], path: string | [], def?: any) {
  const keys = isArray(path) ? path : splitPath(path);
  let value = keys.length ? obj : undefined;
  for (let i = 0; i < keys.length && value !== undefined; i++) {
    value = value !== null ? value[keys[i]] : undefined;
  }

  return value !== undefined ? value : def;
}

/**
 * Performs a deep comparison between two values to determine if they are equivalent. Plain
 * objects and arrays will be recursively iterated and primitive values and references
 * will be compared using the identity operator (===). Even though it's still a bit slower than
 * JSON.stringify(), this method works well with unsorted objects.
 * @param {Object|Array} value The first value.
 * @param {Object|Array} other The other value to compare against.
 * @return {Boolean} If the objects are equal or not.
 */
export function equals(value, other) {
  if (value === other || (isNaN(value) && isNaN(other))) {
    return true;
  }

  if (!isObject(other)) {
    return false;
  }

  if (isPlainObject(value)) {
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (!equals(value[key], other[key])) {
        return false;
      }
    }

    for (const key in other) {
      if (!Object.prototype.hasOwnProperty.call(other, key)) continue;
      if (value[key] === undefined
          && other[key] !== undefined) {
        return false;
      }
    }

    return true;
  } if (isArray(value)) {
    if (value.length !== other.length) {
      return false;
    }

    for (let i = 0; i < value.length; i++) {
      if (!equals(value[i], other[i])) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * Group an array of objects using the values of a list of keys.
 * Usage:
 * <pre>
 *   var array = [{lang:'spanish', age: 2}, {lang:'spanish', age:5}, {lang:'english', age:25}]
 *   ut.groupBy(array, 'lang', function(obj) { return obj.age; })
 *   return -> { spanish: [ 2, 5 ], english: [ 25 ] }
 * </pre>
 * @param {Object[]} data An array of objects.
 * @param {String|String[]} keys The key or keys to group by.
 * @param {Function} [iteratee] A export function to modify the final grouped objects.
 * @return {Object} The grouped object.
 */
export function groupBy(array, keys, iteratee) {
  keys = isString(keys) ? [keys] : keys;

  const result = {};
  const lastKeyIndex = keys.length - 1;

  for (let i = 0; i < array.length; i++) {
    const obj = array[i];

    const pointer = obj;
    let resultPointer = result;

    for (let j = 0; j < keys.length; j++) {
      const key = keys[j];
      const keyValue = pointer[key];

      if (keyValue === undefined) {
        break;
      }

      if (resultPointer[keyValue] === undefined) {
        resultPointer[keyValue] = j < lastKeyIndex ? {} : [];
      }

      if (j === lastKeyIndex) {
        resultPointer[keyValue].push(iteratee ? iteratee(obj) : obj);
      }

      resultPointer = resultPointer[keyValue];
    }
  }

  return result;
}

/**
 * Counts and returns the length of the given object.
 * @param {Object} object The object.
 * @return {Number} The length of the object.
 */
export function objectLength(object) {
  let length = 0;
  // eslint-disable-next-line no-unused-vars
  for (const i in object) {
    if (!Object.prototype.hasOwnProperty.call(object, i)) continue;
    length++;
  }

  return length;
}

/**
 * Empty the content of an object. It uses "delete" so the object will be converted into a
 * hash table mode (slow properties).
 * @see {@link toFastProperties}
 * @param {Object} object The plain object to clear.
 */
export function clearObject(object) {
  for (const key in object) {
    if (!Object.prototype.hasOwnProperty.call(object, key)) continue;
    delete object[key];
  }
}

// Boolean

/**
 * Returns a random boolean.
 * @return {Boolean} The random boolean.
 */
export function randomBoolean() {
  return Math.random() < 0.5;
}

// Type

/**
 * If value has a numeric value or not. It can be a Number or a String.
 * @param {*} value The value.
 * @return {Boolean} If has a numeric value or not.
 */
export function isNumeric(value: any) {
  return !isNaNOrInfinity(parseFloat(value));
}

/**
 * If is a Number or not.
 * @param {*} value The value.
 * @return {Boolean} If is a Number or not.
 */
export function isNumber(value: any) {
  return typeof value === 'number'
      || (isObject(value) && value.constructor === Number);
}

/**
 * If is a String or not.
 * @param {*} value The value.
 * @return {Boolean} If is a String or not.
 */
export function isString(value: any) {
  return typeof value === 'string'
      || (isObject(value) && value.constructor === String);
}

/**
 * If is an Array or not.
 * @param {*} value The value.
 * @return {Boolean} If is an Array or not.
 * @function
 */
const { isArray } = Array;

/**
 * If is an Object or not.
 * @param {*} value The value.
 * @return {Boolean} If is an Object or not.
 */
export function isObject(value: any) {
  return typeof value === 'object' && value !== null;
}

/**
 * If is a plain object (not an array) or not.
 * @param {*} value The value.
 * @return {Boolean} If is an Object and not an Array.
 */
export function isPlainObject(value: any) {
  if (isObject(value)) {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  return false;
}
/**
 * If is a Boolean or not.
 * @param {*} value The value.
 * @return {Boolean} If is a Boolean or not.
 */
export function isBoolean(value: any) {
  return typeof value === 'boolean'
      || (isObject(value) && value.constructor === Boolean);
}

/**
 * If is export Function or not.
 * @param {*} value The value.
 * @return {Boolean} If is a export Function or not.
 */
export function isFunction(value: any) {
  return typeof value === 'function';
};

/**
 * If is a RegExp or not.
 * @param {*} value The value.
 * @return {Boolean} If is a RegExp or not.
 */
export function isRegExp(value: any) {
  return value instanceof RegExp;
}

/**
 * If is a Date or not.
 * @param {*} value The value.
 * @return {Boolean} If is a Date or not.
 */
export function isDate(value: any) {
  return value instanceof Date;
}

/**
 * If is a Number or not. NaN, Infinity or -Infinity aren't considered valid numbers.
 * @param {*} value The value.
 * @return {Boolean} If is a Number or not.
 */
export function isValidNumber(value: any) {
  return isNumber(value) && !isNaNOrInfinity(value);
}

// Math

/**
 * Calculate the log using a given base and value.
 * @param {Number} base The base.
 * @param {Number} value The value.
 * @return {Number} The log result.
 */
export function logN(base: number, value: number) {
  const i = base === 2 ? Math.LN2
    : base === 10 ? Math.LN10 : Math.log(base);
  return Math.log(value) / i;
}

// Logging

/**
 * A simple logger.
 * @namespace logger
 */
export const logger = {
  /**
   * The log level debug.
   * @type {Number}
   * @memberOf logger
   */
  DEBUG:<number> 1,

  /**
   * The log level info.
   * @type {Number}
   * @memberOf logger
   */
  INFO:<number> 2,

  /**
   * The log level warn.
   * @type {Number}
   * @memberOf logger
   */
  WARN:<number> 3,

  /**
   * The log level error.
   * @type {Number}
   * @memberOf logger
   */
  ERROR:<number> 4,

  /**
   * Disable all logs.
   * @type {Number}
   * @memberOf  logger
   */
  NONE: Number.MAX_VALUE,

  _logLevel:<number> 1,
  _usingDate:<boolean> true,
  _prettify:<boolean> false,
  _prefix:<string | null> null,

  /**
   * Set the log level.
   * @param {Number} logLevel The new log level.
   * @memberOf logger
   */
  setLogLevel: function setLogLevel(logLevel) {
    this._logLevel = logLevel;
  },

  /**
   * If date will appear in the log string or not.
   * @param {Boolean} usingDate If using date or not.
   * @memberOf logger
   */
  setUsingDate: function setUsingDate(usingDate: boolean) {
    this._usingDate = usingDate;
  },

  /**
   * If plain objects should be printed prettified or not.
   * @param {Boolean} prettify If prettify plain objects or not.
   * @memberOf logger
   */
  setPrettify: function setPrettify(prettify: boolean) {
    this._prettify = prettify;
  },

  /**
   * If plain objects should be printed prettified or not.
   * @param {Boolean} prettify If prettify plain objects or not.
   * @memberOf logger
   */
   setPrefix: function setPrefix(prefix: string) {
    this._prefix = prefix;
  },

  /**
   * Print a debug log.
   * @param {...*} args The arguments
   * @memberOf logger
   */
  debug: function debug(...args) {
    if (this._checkLogLevel(1)) {
      process.stdout.write(this._createHeader('[DBG]') + this._createbody(args));
    }
  },

  /**
   * Print a info log.
   * @param {...*} args The arguments
   * @memberOf logger
   */
  info: function info(...args) {
    if (this._checkLogLevel(2)) {
      process.stdout.write(this._createHeader('[INF]') + this._createbody(args));
    }
  },

  /**
   * Print a warn log.
   * @param {...*} args The arguments
   * @memberOf logger
   */
  warn: function warn(...args) {
    if (this._checkLogLevel(3)) {
      process.stdout.write(this._createHeader('[WRN]') + this._createbody(args));
    }
  },

  /**
   * Print a error log.
   * @param {...*} args The arguments
   * @memberOf logger
   */
  error: function loggerError(...args) {
    if (this._checkLogLevel(4)) {
      process.stdout.write(this._createHeader('[ERR]') + this._createbody(args));
    }
  },

  _createHeader: function _createHeader(label) {
    if (this._usingDate) {
      label = `${now()} ${label}`;
    }

    if (this._prefix !== null) {
       return `${label} ${this._prefix} `;
    }

    return `${label} `;
  },

  _createbody: function _createbody(args) {
    if (args.length > 0) {
      let data = '';
      const { length } = args;

      for (let i = 0; i < length; i++) {
        const arg = args[i];

        if (isObject(arg)) {
          if (arg instanceof Error) {
            data += `Error: ${arg.message}`;
          } else if (this._prettify && (isArray(arg) || isPlainObject(arg))) {
            data += JSON.stringify(arg, null, 2);
          } else {
            data += JSON.stringify(arg);
          }
        } else {
          data += arg;
        }

        if (i < length - 1) {
          data += ' ';
        }
      }

      return `${data}\n`;
    }

    return '\n';
  },

  _checkLogLevel: function _checkLogLevel(methodLogLevel) {
    return this._logLevel <= methodLogLevel;
  },
};
