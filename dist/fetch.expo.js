'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var AsyncStorage = require('@react-native-async-storage/async-storage');
var crypto__default = require('crypto');
var require$$2 = require('stream');
var events = require('events');
var process$1 = require('process');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n["default"] = e;
  return Object.freeze(n);
}

var AsyncStorage__default = /*#__PURE__*/_interopDefaultLegacy(AsyncStorage);
var crypto__default__default = /*#__PURE__*/_interopDefaultLegacy(crypto__default);
var crypto__default__namespace = /*#__PURE__*/_interopNamespace(crypto__default);
var require$$2__default = /*#__PURE__*/_interopDefaultLegacy(require$$2);
var process__namespace = /*#__PURE__*/_interopNamespace(process$1);

var global$2 = (typeof global$1 !== "undefined" ? global$1 :
  typeof self !== "undefined" ? self :
  typeof window !== "undefined" ? window : {});

var global$1 = (typeof global$2 !== "undefined" ? global$2 :
            typeof self !== "undefined" ? self :
            typeof window !== "undefined" ? window : {});

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init () {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}

function toByteArray (b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders);

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len;

  var L = 0;

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = (tmp >> 16) & 0xFF;
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var output = '';
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[(tmp << 4) & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    output += lookup[tmp >> 10];
    output += lookup[(tmp >> 4) & 0x3F];
    output += lookup[(tmp << 2) & 0x3F];
    output += '=';
  }

  parts.push(output);

  return parts.join('')
}

function read (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
}

var toString = {}.toString;

var isArray = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

var INSPECT_MAX_BYTES = 50;

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
  ? global$1.TYPED_ARRAY_SUPPORT
  : true;

/*
 * Export kMaxLength after typed array support is determined.
 */
kMaxLength();

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192; // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype;
  return arr
};

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
};

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) ;
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
};

function allocUnsafe (that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
};

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);

  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }
  return that
}

function fromObject (that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len);
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;

function slowToString (encoding, start, end) {
  var loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true;

function swap (b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer.prototype.toString = function toString () {
  var length = this.length | 0;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer.prototype.equals = function equals (b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
};

Buffer.prototype.inspect = function inspect () {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>'
};

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);

  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];

  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4)
};

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4)
};

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8)
};

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = (value & 0xff);
  return offset + 1
};

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24);
    this[offset + 2] = (value >>> 16);
    this[offset + 1] = (value >>> 8);
    this[offset] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
    this[offset + 2] = (value >>> 16);
    this[offset + 3] = (value >>> 24);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}


function base64ToBytes (str) {
  return toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}


// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
}

function isFastBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
}

class Storage {
  constructor(namespace, service) {
    this._service = service;
    this._namespace = namespace;
  }

  async getItem(key) {
    const str = await this._service.getItem(this._namespace, key);
    return JSON.parse(str);
  }

  async setItem(key, value) {
    return this._service.setItem(this._namespace, key, JSON.stringify(value));
  }
}

class LocalStorageService {
  constructor(service) {
    this.localStorage = service;
    this._job = Promise.resolve();
  }

  async setItem(namespace, key, value) {
    const prom = (this._job = this._job.then(() =>
      this._setItem(namespace, key, value)
    ));
    return prom;
  }

  async getItem(namespace, key) {
    const prom = (this._job = this._job.then(() =>
      this._getItem(namespace, key)
    ));
    return prom;
  }

  async _setItem(namespace, key, value) {
    return this.localStorage.setItem(`${namespace}:${key}`, value);
  }

  async _getItem(namespace, key) {
    return this.localStorage.getItem(`${namespace}:${key}`);
  }
}

class ExpoStorageService extends LocalStorageService {
  constructor() {
    super(AsyncStorage__default["default"]);
  }
}

class ExpoStorage extends Storage {
  constructor(namespace) {
    super(namespace, new ExpoStorageService());
  }

  async doJob({ action, request, value }, postMessage) {
    if (action === "GET") {
      value = await this.getItem(request);
    } else {
      value = await this.setItem(request, value);
    }

    const res = { action, request, value };
    postMessage(JSON.stringify(res));
  }

  async onMessage(str, postMessage) {
    const { type, action, request, value } = JSON.parse(str);

    switch (type) {
      case "STORAGE_REQUEST":
        return this.doJob({ action, request, value }, postMessage);
      default:
        console.debug("ignoring message", type);
    }
  }
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

var lobEnc = {};

var chacha20 = {};

// Written in 2014 by Devi Mandiri. Public domain.
//
// Implementation derived from chacha-ref.c version 20080118
// See for details: http://cr.yp.to/chacha/chacha-20080128.pdf

function U8TO32_LE(x, i) {
  return x[i] | (x[i+1]<<8) | (x[i+2]<<16) | (x[i+3]<<24);
}

function U32TO8_LE(x, i, u) {
  x[i]   = u; u >>>= 8;
  x[i+1] = u; u >>>= 8;
  x[i+2] = u; u >>>= 8;
  x[i+3] = u;
}

function ROTATE(v, c) {
  return (v << c) | (v >>> (32 - c));
}

var Chacha20 = function(key, nonce, counter) {
  this.input = new Uint32Array(16);

  // https://tools.ietf.org/html/draft-irtf-cfrg-chacha20-poly1305-01#section-2.3
  this.input[0] = 1634760805;
  this.input[1] =  857760878;
  this.input[2] = 2036477234;
  this.input[3] = 1797285236;
  this.input[4] = U8TO32_LE(key, 0);
  this.input[5] = U8TO32_LE(key, 4);
  this.input[6] = U8TO32_LE(key, 8);
  this.input[7] = U8TO32_LE(key, 12);
  this.input[8] = U8TO32_LE(key, 16);
  this.input[9] = U8TO32_LE(key, 20);
  this.input[10] = U8TO32_LE(key, 24);
  this.input[11] = U8TO32_LE(key, 28);
  // be compatible with the reference ChaCha depending on the nonce size
  if(nonce.length == 12)
  {
    this.input[12] = counter;
    this.input[13] = U8TO32_LE(nonce, 0);
    this.input[14] = U8TO32_LE(nonce, 4);
    this.input[15] = U8TO32_LE(nonce, 8);
  }else {
    this.input[12] = counter;
    this.input[13] = 0;
    this.input[14] = U8TO32_LE(nonce, 0);
    this.input[15] = U8TO32_LE(nonce, 4);
    
  }
};

Chacha20.prototype.quarterRound = function(x, a, b, c, d) {
  x[a] += x[b]; x[d] = ROTATE(x[d] ^ x[a], 16);
  x[c] += x[d]; x[b] = ROTATE(x[b] ^ x[c], 12);
  x[a] += x[b]; x[d] = ROTATE(x[d] ^ x[a],  8);
  x[c] += x[d]; x[b] = ROTATE(x[b] ^ x[c],  7);
};

Chacha20.prototype.encrypt = function(dst, src, len) {
  var x = new Uint32Array(16);
  var output = new Uint8Array(64);
  var i, dpos = 0, spos = 0;

  while (len > 0 ) {
    for (i = 16; i--;) x[i] = this.input[i];
    for (i = 20; i > 0; i -= 2) {
      this.quarterRound(x, 0, 4, 8,12);
      this.quarterRound(x, 1, 5, 9,13);
      this.quarterRound(x, 2, 6,10,14);
      this.quarterRound(x, 3, 7,11,15);
      this.quarterRound(x, 0, 5,10,15);
      this.quarterRound(x, 1, 6,11,12);
      this.quarterRound(x, 2, 7, 8,13);
      this.quarterRound(x, 3, 4, 9,14);
    }
    for (i = 16; i--;) x[i] += this.input[i];
    for (i = 16; i--;) U32TO8_LE(output, 4*i, x[i]);

    this.input[12] += 1;
    if (!this.input[12]) {
      this.input[13] += 1;
    }
    if (len <= 64) {
      for (i = len; i--;) {
        dst[i+dpos] = src[i+spos] ^ output[i];
      }
      return;
    }
    for (i = 64; i--;) {
      dst[i+dpos] = src[i+spos] ^ output[i];
    }
    len -= 64;
    spos += 64;
    dpos += 64;
  }
};

Chacha20.prototype.keystream = function(dst, len) {
  for (var i = 0; i < len; ++i) dst[i] = 0;
  this.encrypt(dst, dst, len);
};

// additions to make it easier and export it as a module

chacha20.Cipher = Chacha20;

chacha20.encrypt = chacha20.decrypt = function(key, nonce, data)
{
  var cipher = new Chacha20(key, nonce);
  var ret = new Buffer(data.length);
  cipher.encrypt(ret, data, data.length);
  return ret;
};

(function (exports) {
	var crypto = crypto__default__default["default"];
	var chacha20$1 = chacha20;

	// encode a packet
	exports.encode = function(head, body)
	{
	  // support different arg types
	  if(head === null) head = false; // grrrr
	  if(typeof head == 'number') head = new Buffer(String.fromCharCode(json));
	  if(typeof head == 'object')
	  {
	    // accept a packet as the first arg
	    if(isBuffer(head.body) && body === undefined)
	    {
	      body = head.body;
	      head = head.head || head.json;
	    }
	    // serialize raw json
	    if(!isBuffer(head))
	    {
	      head = new Buffer(JSON.stringify(head));
	      // require real json object
	      if(head.length < 7) head = false;
	    }
	  }
	  head = head || new Buffer(0);
	  if(typeof body == 'string') body = new Buffer(body, 'binary');
	  body = body || new Buffer(0);
	  var len = new Buffer(2);
	  len.writeInt16BE(head.length, 0);
	  return Buffer.concat([len, head, body]);
	};

	// packet decoding, add values to a buffer return
	exports.decode =function(bin)
	{
	  if(!bin) return undefined;
	  var buf = (typeof bin == 'string') ? new Buffer(bin, 'binary') : bin;
	  if(bin.length < 2) return undefined;

	  // read and validate the json length
	  var len = buf.readUInt16BE(0);
	  if(len > (buf.length - 2)) return undefined;
	  buf.head = buf.slice(2, len+2);
	  buf.body = buf.slice(len + 2);

	  // parse out the json
	  buf.json = {};
	  if(len >= 7)
	  {
	    try {
	      buf.json = JSON.parse(buf.head.toString('utf8'));
	    } catch(E) {
	      return undefined;
	    }
	  }
	  return buf;
	};

	// convenience to create a valid packet object
	exports.packet = function(head, body)
	{
	  return exports.decode(exports.encode(head, body));
	};

	exports.isPacket = function(packet)
	{
	  if(!isBuffer(packet)) return false;
	  if(packet.length < 2) return false;
	  if(typeof packet.json != 'object') return false;
	  if(!isBuffer(packet.head)) return false;
	  if(!isBuffer(packet.body)) return false;
	  return true;
	};

	// read a bytestream for a packet, decode the header and pass body through
	var Transform = require$$2__default["default"].Transform;
	exports.stream = function(cbHead){
	  var stream = new Transform();
	  var buf = new Buffer(0);
	  stream._transform = function(data,enc,cbTransform)
	  {
	    // no buffer means pass everything through
	    if(!buf)
	    {
	      stream.push(data);
	      return cbTransform();
	    }
	    // gather until full header
	    buf = Buffer.concat([buf,data]);
	    var packet = exports.decode(buf);
	    if(!packet) return cbTransform();
	    buf = false; // pass through all future data
	    // give to the app
	    cbHead(packet, function(err){
	      if(err) return cbTransform(err);
	      stream.push(packet.body);
	      cbTransform();
	    });
	  };
	  return stream;
	};

	// chunking stream
	var Duplex = require$$2__default["default"].Duplex;
	exports.chunking = function(args, cbPacket){
	  if(!args) args = {};
	  if(!cbPacket) cbPacket = function(err, packet){ };

	  // chunks can have space for 1 to 255 bytes
	  if(!args.size || args.size > 256) args.size = 256;
	  var space = args.size - 1;
	  if(space < 1) space = 1; // minimum
	  
	  var blocked = false;
	  if(args.blocking) args.ack = true; // blocking requires acks

	  var stream = new Duplex({allowHalfOpen:false});
	  var queue = [];
	  
	  // incoming chunked data coming from another stream
	  var chunks = new Buffer(0);
	  var data = new Buffer(0);
	  stream._write = function(data2,enc,cbWrite)
	  {
	    // trigger an error when http is detected, but otherwise continue
	    if(data.length == 0 && data2.slice(0,5).toString() == 'GET /')
	    {
	      cbPacket("HTTP detected",data2);
	    }
	    data = Buffer.concat([data,data2]);
	    while(data.length)
	    {
	      var len = data.readUInt8(0);
	      // packet done or ack
	      if(len === 0)
	      {
	        blocked = false;
	        if(chunks.length)
	        {
	          var packet = exports.decode(chunks);
	          chunks = new Buffer(0);
	          if(packet) cbPacket(false, packet);
	        }
	        data = data.slice(1);
	        continue;
	      }
	      // not a full chunk yet, wait for more
	      if(data.length < (len+1)) break;

	      // full chunk, buffer it up
	      blocked = false;
	      chunks = Buffer.concat([chunks,data.slice(1,len+1)]);
	      data = data.slice(len+1);
	      // ensure a response when enabled
	      if(args.ack)
	      {
	        if(!queue.length) queue.push(new Buffer("\0"));
	      }
	    }
	    stream.send(); // always try sending more data
	    cbWrite();
	  };

	  // accept packets to be chunked
	  stream.send = function(packet)
	  {
	    // break packet into chunks and add to queue
	    while(packet)
	    {
	      var len = new Buffer(1);
	      var chunk = packet.slice(0,space);
	      packet = packet.slice(chunk.length);
	      len.writeUInt8(chunk.length,0);
	      // check if we can include the packet terminating zero
	      var zero = new Buffer(0);
	      if(packet.length == 0 && chunk.length <= space)
	      {
	        zero = new Buffer("\0");
	        packet = false;
	      }
	      queue.push(Buffer.concat([len,chunk,zero]));
	    }

	    // pull next chunk off the queue
	    if(queue.length && !blocked)
	    {
	      var chunk = queue.shift();
	      if(args.blocking && chunk.length > 1) blocked = true;
	      if(stream.push(chunk)) stream.send(); // let the loop figure itself out
	    }
	  };

	  // try sending more chunks
	  stream._read = function(size)
	  {
	    stream.send();
	  };

	  return stream;
	};

	function keyize(key)
	{
	  if(!key) key = "telehash";
	  if(isBuffer(key) && key.length == 32) return key;
	  return crypto.createHash('sha256').update(key).digest();
	}

	exports.cloak = function(packet, key, rounds)
	{
	  if(!(key = keyize(key)) || !isBuffer(packet)) return undefined;
	  if(!rounds) rounds = 1;
	  // get a non-zero start
	  while(1)
	  {
	    var nonce = crypto.randomBytes(8);
	    if(nonce[0] == 0) continue;
	    break;
	  }
	  var cloaked = Buffer.concat([nonce, chacha20$1.encrypt(key, nonce, packet)]);
	  rounds--;
	  return (rounds) ? exports.cloak(cloaked, key, rounds) : cloaked;
	};

	exports.decloak = function(cloaked, key, rounds)
	{
	  if(!(key = keyize(key)) || !isBuffer(cloaked) || cloaked.length < 2) return undefined;
	  if(!rounds) rounds = 0;
	  if(cloaked[0] == 0)
	  {
	    var packet = exports.decode(cloaked);
	    if(packet) packet.cloaked = rounds;
	    return packet;
	  }
	  if(cloaked.length < 10) return undefined; // must have cloak and a minimum packet
	  rounds++;
	  return exports.decloak(chacha20$1.decrypt(key, cloaked.slice(0,8), cloaked.slice(8)), key, rounds);
	};
} (lobEnc));

// shim for using process in browser
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
if (typeof global$1.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof global$1.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}

function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser = true;
var env = {};
var argv = [];
var version = ''; // empty string to avoid regexp issues
var versions = {};
var release = {};
var config = {};

function noop$1() {}

var on = noop$1;
var addListener = noop$1;
var once = noop$1;
var off = noop$1;
var removeListener = noop$1;
var removeAllListeners = noop$1;
var emit = noop$1;

function binding(name) {
    throw new Error('process.binding is not supported');
}

function cwd () { return '/' }
function chdir (dir) {
    throw new Error('process.chdir is not supported');
}function umask() { return 0; }

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = global$1.performance || {};
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)*1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor((clocktime%1)*1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds<0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds,nanoseconds]
}

var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1000;
}

var process = {
  nextTick: nextTick,
  title: title,
  browser: browser,
  env: env,
  argv: argv,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config,
  uptime: uptime
};

/*!
 * MIT License
 * 
 * Copyright (c) 2017-2022 Peculiar Ventures, LLC
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * 
 */

const ARRAY_BUFFER_NAME = "[object ArrayBuffer]";
class BufferSourceConverter {
    static isArrayBuffer(data) {
        return Object.prototype.toString.call(data) === ARRAY_BUFFER_NAME;
    }
    static toArrayBuffer(data) {
        if (this.isArrayBuffer(data)) {
            return data;
        }
        if (data.byteLength === data.buffer.byteLength) {
            return data.buffer;
        }
        return this.toUint8Array(data).slice().buffer;
    }
    static toUint8Array(data) {
        return this.toView(data, Uint8Array);
    }
    static toView(data, type) {
        if (data.constructor === type) {
            return data;
        }
        if (this.isArrayBuffer(data)) {
            return new type(data);
        }
        if (this.isArrayBufferView(data)) {
            return new type(data.buffer, data.byteOffset, data.byteLength);
        }
        throw new TypeError("The provided value is not of type '(ArrayBuffer or ArrayBufferView)'");
    }
    static isBufferSource(data) {
        return this.isArrayBufferView(data)
            || this.isArrayBuffer(data);
    }
    static isArrayBufferView(data) {
        return ArrayBuffer.isView(data)
            || (data && this.isArrayBuffer(data.buffer));
    }
    static isEqual(a, b) {
        const aView = BufferSourceConverter.toUint8Array(a);
        const bView = BufferSourceConverter.toUint8Array(b);
        if (aView.length !== bView.byteLength) {
            return false;
        }
        for (let i = 0; i < aView.length; i++) {
            if (aView[i] !== bView[i]) {
                return false;
            }
        }
        return true;
    }
    static concat(...args) {
        if (Array.isArray(args[0])) {
            const buffers = args[0];
            let size = 0;
            for (const buffer of buffers) {
                size += buffer.byteLength;
            }
            const res = new Uint8Array(size);
            let offset = 0;
            for (const buffer of buffers) {
                const view = this.toUint8Array(buffer);
                res.set(view, offset);
                offset += view.length;
            }
            if (args[1]) {
                return this.toView(res, args[1]);
            }
            return res.buffer;
        }
        else {
            return this.concat(args);
        }
    }
}

class Utf8Converter {
    static fromString(text) {
        const s = unescape(encodeURIComponent(text));
        const uintArray = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) {
            uintArray[i] = s.charCodeAt(i);
        }
        return uintArray.buffer;
    }
    static toString(buffer) {
        const buf = BufferSourceConverter.toUint8Array(buffer);
        let encodedString = "";
        for (let i = 0; i < buf.length; i++) {
            encodedString += String.fromCharCode(buf[i]);
        }
        const decodedString = decodeURIComponent(escape(encodedString));
        return decodedString;
    }
}
class Utf16Converter {
    static toString(buffer, littleEndian = false) {
        const arrayBuffer = BufferSourceConverter.toArrayBuffer(buffer);
        const dataView = new DataView(arrayBuffer);
        let res = "";
        for (let i = 0; i < arrayBuffer.byteLength; i += 2) {
            const code = dataView.getUint16(i, littleEndian);
            res += String.fromCharCode(code);
        }
        return res;
    }
    static fromString(text, littleEndian = false) {
        const res = new ArrayBuffer(text.length * 2);
        const dataView = new DataView(res);
        for (let i = 0; i < text.length; i++) {
            dataView.setUint16(i * 2, text.charCodeAt(i), littleEndian);
        }
        return res;
    }
}
class Convert {
    static isHex(data) {
        return typeof data === "string"
            && /^[a-z0-9]+$/i.test(data);
    }
    static isBase64(data) {
        return typeof data === "string"
            && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data);
    }
    static isBase64Url(data) {
        return typeof data === "string"
            && /^[a-zA-Z0-9-_]+$/i.test(data);
    }
    static ToString(buffer, enc = "utf8") {
        const buf = BufferSourceConverter.toUint8Array(buffer);
        switch (enc.toLowerCase()) {
            case "utf8":
                return this.ToUtf8String(buf);
            case "binary":
                return this.ToBinary(buf);
            case "hex":
                return this.ToHex(buf);
            case "base64":
                return this.ToBase64(buf);
            case "base64url":
                return this.ToBase64Url(buf);
            case "utf16le":
                return Utf16Converter.toString(buf, true);
            case "utf16":
            case "utf16be":
                return Utf16Converter.toString(buf);
            default:
                throw new Error(`Unknown type of encoding '${enc}'`);
        }
    }
    static FromString(str, enc = "utf8") {
        if (!str) {
            return new ArrayBuffer(0);
        }
        switch (enc.toLowerCase()) {
            case "utf8":
                return this.FromUtf8String(str);
            case "binary":
                return this.FromBinary(str);
            case "hex":
                return this.FromHex(str);
            case "base64":
                return this.FromBase64(str);
            case "base64url":
                return this.FromBase64Url(str);
            case "utf16le":
                return Utf16Converter.fromString(str, true);
            case "utf16":
            case "utf16be":
                return Utf16Converter.fromString(str);
            default:
                throw new Error(`Unknown type of encoding '${enc}'`);
        }
    }
    static ToBase64(buffer) {
        const buf = BufferSourceConverter.toUint8Array(buffer);
        if (typeof btoa !== "undefined") {
            const binary = this.ToString(buf, "binary");
            return btoa(binary);
        }
        else {
            return Buffer.from(buf).toString("base64");
        }
    }
    static FromBase64(base64) {
        const formatted = this.formatString(base64);
        if (!formatted) {
            return new ArrayBuffer(0);
        }
        if (!Convert.isBase64(formatted)) {
            throw new TypeError("Argument 'base64Text' is not Base64 encoded");
        }
        if (typeof atob !== "undefined") {
            return this.FromBinary(atob(formatted));
        }
        else {
            return new Uint8Array(Buffer.from(formatted, "base64")).buffer;
        }
    }
    static FromBase64Url(base64url) {
        const formatted = this.formatString(base64url);
        if (!formatted) {
            return new ArrayBuffer(0);
        }
        if (!Convert.isBase64Url(formatted)) {
            throw new TypeError("Argument 'base64url' is not Base64Url encoded");
        }
        return this.FromBase64(this.Base64Padding(formatted.replace(/\-/g, "+").replace(/\_/g, "/")));
    }
    static ToBase64Url(data) {
        return this.ToBase64(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/\=/g, "");
    }
    static FromUtf8String(text, encoding = Convert.DEFAULT_UTF8_ENCODING) {
        switch (encoding) {
            case "ascii":
                return this.FromBinary(text);
            case "utf8":
                return Utf8Converter.fromString(text);
            case "utf16":
            case "utf16be":
                return Utf16Converter.fromString(text);
            case "utf16le":
            case "usc2":
                return Utf16Converter.fromString(text, true);
            default:
                throw new Error(`Unknown type of encoding '${encoding}'`);
        }
    }
    static ToUtf8String(buffer, encoding = Convert.DEFAULT_UTF8_ENCODING) {
        switch (encoding) {
            case "ascii":
                return this.ToBinary(buffer);
            case "utf8":
                return Utf8Converter.toString(buffer);
            case "utf16":
            case "utf16be":
                return Utf16Converter.toString(buffer);
            case "utf16le":
            case "usc2":
                return Utf16Converter.toString(buffer, true);
            default:
                throw new Error(`Unknown type of encoding '${encoding}'`);
        }
    }
    static FromBinary(text) {
        const stringLength = text.length;
        const resultView = new Uint8Array(stringLength);
        for (let i = 0; i < stringLength; i++) {
            resultView[i] = text.charCodeAt(i);
        }
        return resultView.buffer;
    }
    static ToBinary(buffer) {
        const buf = BufferSourceConverter.toUint8Array(buffer);
        let res = "";
        for (let i = 0; i < buf.length; i++) {
            res += String.fromCharCode(buf[i]);
        }
        return res;
    }
    static ToHex(buffer) {
        const buf = BufferSourceConverter.toUint8Array(buffer);
        const splitter = "";
        const res = [];
        const len = buf.length;
        for (let i = 0; i < len; i++) {
            const char = buf[i].toString(16).padStart(2, "0");
            res.push(char);
        }
        return res.join(splitter);
    }
    static FromHex(hexString) {
        let formatted = this.formatString(hexString);
        if (!formatted) {
            return new ArrayBuffer(0);
        }
        if (!Convert.isHex(formatted)) {
            throw new TypeError("Argument 'hexString' is not HEX encoded");
        }
        if (formatted.length % 2) {
            formatted = `0${formatted}`;
        }
        const res = new Uint8Array(formatted.length / 2);
        for (let i = 0; i < formatted.length; i = i + 2) {
            const c = formatted.slice(i, i + 2);
            res[i / 2] = parseInt(c, 16);
        }
        return res.buffer;
    }
    static ToUtf16String(buffer, littleEndian = false) {
        return Utf16Converter.toString(buffer, littleEndian);
    }
    static FromUtf16String(text, littleEndian = false) {
        return Utf16Converter.fromString(text, littleEndian);
    }
    static Base64Padding(base64) {
        const padCount = 4 - (base64.length % 4);
        if (padCount < 4) {
            for (let i = 0; i < padCount; i++) {
                base64 += "=";
            }
        }
        return base64;
    }
    static formatString(data) {
        return (data === null || data === void 0 ? void 0 : data.replace(/[\n\r\t ]/g, "")) || "";
    }
}
Convert.DEFAULT_UTF8_ENCODING = "utf8";

function assign(target, ...sources) {
    const res = arguments[0];
    for (let i = 1; i < arguments.length; i++) {
        const obj = arguments[i];
        for (const prop in obj) {
            res[prop] = obj[prop];
        }
    }
    return res;
}
function combine(...buf) {
    const totalByteLength = buf.map((item) => item.byteLength).reduce((prev, cur) => prev + cur);
    const res = new Uint8Array(totalByteLength);
    let currentPos = 0;
    buf.map((item) => new Uint8Array(item)).forEach((arr) => {
        for (const item2 of arr) {
            res[currentPos++] = item2;
        }
    });
    return res.buffer;
}
function isEqual(bytes1, bytes2) {
    if (!(bytes1 && bytes2)) {
        return false;
    }
    if (bytes1.byteLength !== bytes2.byteLength) {
        return false;
    }
    const b1 = new Uint8Array(bytes1);
    const b2 = new Uint8Array(bytes2);
    for (let i = 0; i < bytes1.byteLength; i++) {
        if (b1[i] !== b2[i]) {
            return false;
        }
    }
    return true;
}

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __decorate$2(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

var protobufjs = {exports: {}};

var src = {exports: {}};

var indexLight = {exports: {}};

var indexMinimal = {};

var minimal = {};

var aspromise = asPromise;

/**
 * Callback as used by {@link util.asPromise}.
 * @typedef asPromiseCallback
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {...*} params Additional arguments
 * @returns {undefined}
 */

/**
 * Returns a promise from a node-style callback function.
 * @memberof util
 * @param {asPromiseCallback} fn Function to call
 * @param {*} ctx Function context
 * @param {...*} params Function arguments
 * @returns {Promise<*>} Promisified function
 */
function asPromise(fn, ctx/*, varargs */) {
    var params  = new Array(arguments.length - 1),
        offset  = 0,
        index   = 2,
        pending = true;
    while (index < arguments.length)
        params[offset++] = arguments[index++];
    return new Promise(function executor(resolve, reject) {
        params[offset] = function callback(err/*, varargs */) {
            if (pending) {
                pending = false;
                if (err)
                    reject(err);
                else {
                    var params = new Array(arguments.length - 1),
                        offset = 0;
                    while (offset < params.length)
                        params[offset++] = arguments[offset];
                    resolve.apply(null, params);
                }
            }
        };
        try {
            fn.apply(ctx || null, params);
        } catch (err) {
            if (pending) {
                pending = false;
                reject(err);
            }
        }
    });
}

var base64$1 = {};

(function (exports) {

	/**
	 * A minimal base64 implementation for number arrays.
	 * @memberof util
	 * @namespace
	 */
	var base64 = exports;

	/**
	 * Calculates the byte length of a base64 encoded string.
	 * @param {string} string Base64 encoded string
	 * @returns {number} Byte length
	 */
	base64.length = function length(string) {
	    var p = string.length;
	    if (!p)
	        return 0;
	    var n = 0;
	    while (--p % 4 > 1 && string.charAt(p) === "=")
	        ++n;
	    return Math.ceil(string.length * 3) / 4 - n;
	};

	// Base64 encoding table
	var b64 = new Array(64);

	// Base64 decoding table
	var s64 = new Array(123);

	// 65..90, 97..122, 48..57, 43, 47
	for (var i = 0; i < 64;)
	    s64[b64[i] = i < 26 ? i + 65 : i < 52 ? i + 71 : i < 62 ? i - 4 : i - 59 | 43] = i++;

	/**
	 * Encodes a buffer to a base64 encoded string.
	 * @param {Uint8Array} buffer Source buffer
	 * @param {number} start Source start
	 * @param {number} end Source end
	 * @returns {string} Base64 encoded string
	 */
	base64.encode = function encode(buffer, start, end) {
	    var parts = null,
	        chunk = [];
	    var i = 0, // output index
	        j = 0, // goto index
	        t;     // temporary
	    while (start < end) {
	        var b = buffer[start++];
	        switch (j) {
	            case 0:
	                chunk[i++] = b64[b >> 2];
	                t = (b & 3) << 4;
	                j = 1;
	                break;
	            case 1:
	                chunk[i++] = b64[t | b >> 4];
	                t = (b & 15) << 2;
	                j = 2;
	                break;
	            case 2:
	                chunk[i++] = b64[t | b >> 6];
	                chunk[i++] = b64[b & 63];
	                j = 0;
	                break;
	        }
	        if (i > 8191) {
	            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
	            i = 0;
	        }
	    }
	    if (j) {
	        chunk[i++] = b64[t];
	        chunk[i++] = 61;
	        if (j === 1)
	            chunk[i++] = 61;
	    }
	    if (parts) {
	        if (i)
	            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
	        return parts.join("");
	    }
	    return String.fromCharCode.apply(String, chunk.slice(0, i));
	};

	var invalidEncoding = "invalid encoding";

	/**
	 * Decodes a base64 encoded string to a buffer.
	 * @param {string} string Source string
	 * @param {Uint8Array} buffer Destination buffer
	 * @param {number} offset Destination offset
	 * @returns {number} Number of bytes written
	 * @throws {Error} If encoding is invalid
	 */
	base64.decode = function decode(string, buffer, offset) {
	    var start = offset;
	    var j = 0, // goto index
	        t;     // temporary
	    for (var i = 0; i < string.length;) {
	        var c = string.charCodeAt(i++);
	        if (c === 61 && j > 1)
	            break;
	        if ((c = s64[c]) === undefined)
	            throw Error(invalidEncoding);
	        switch (j) {
	            case 0:
	                t = c;
	                j = 1;
	                break;
	            case 1:
	                buffer[offset++] = t << 2 | (c & 48) >> 4;
	                t = c;
	                j = 2;
	                break;
	            case 2:
	                buffer[offset++] = (t & 15) << 4 | (c & 60) >> 2;
	                t = c;
	                j = 3;
	                break;
	            case 3:
	                buffer[offset++] = (t & 3) << 6 | c;
	                j = 0;
	                break;
	        }
	    }
	    if (j === 1)
	        throw Error(invalidEncoding);
	    return offset - start;
	};

	/**
	 * Tests if the specified string appears to be base64 encoded.
	 * @param {string} string String to test
	 * @returns {boolean} `true` if probably base64 encoded, otherwise false
	 */
	base64.test = function test(string) {
	    return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(string);
	};
} (base64$1));

var eventemitter = EventEmitter;

/**
 * Constructs a new event emitter instance.
 * @classdesc A minimal event emitter.
 * @memberof util
 * @constructor
 */
function EventEmitter() {

    /**
     * Registered listeners.
     * @type {Object.<string,*>}
     * @private
     */
    this._listeners = {};
}

/**
 * Registers an event listener.
 * @param {string} evt Event name
 * @param {function} fn Listener
 * @param {*} [ctx] Listener context
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.on = function on(evt, fn, ctx) {
    (this._listeners[evt] || (this._listeners[evt] = [])).push({
        fn  : fn,
        ctx : ctx || this
    });
    return this;
};

/**
 * Removes an event listener or any matching listeners if arguments are omitted.
 * @param {string} [evt] Event name. Removes all listeners if omitted.
 * @param {function} [fn] Listener to remove. Removes all listeners of `evt` if omitted.
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.off = function off(evt, fn) {
    if (evt === undefined)
        this._listeners = {};
    else {
        if (fn === undefined)
            this._listeners[evt] = [];
        else {
            var listeners = this._listeners[evt];
            for (var i = 0; i < listeners.length;)
                if (listeners[i].fn === fn)
                    listeners.splice(i, 1);
                else
                    ++i;
        }
    }
    return this;
};

/**
 * Emits an event by calling its listeners with the specified arguments.
 * @param {string} evt Event name
 * @param {...*} args Arguments
 * @returns {util.EventEmitter} `this`
 */
EventEmitter.prototype.emit = function emit(evt) {
    var listeners = this._listeners[evt];
    if (listeners) {
        var args = [],
            i = 1;
        for (; i < arguments.length;)
            args.push(arguments[i++]);
        for (i = 0; i < listeners.length;)
            listeners[i].fn.apply(listeners[i++].ctx, args);
    }
    return this;
};

var float = factory(factory);

/**
 * Reads / writes floats / doubles from / to buffers.
 * @name util.float
 * @namespace
 */

/**
 * Writes a 32 bit float to a buffer using little endian byte order.
 * @name util.float.writeFloatLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Writes a 32 bit float to a buffer using big endian byte order.
 * @name util.float.writeFloatBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Reads a 32 bit float from a buffer using little endian byte order.
 * @name util.float.readFloatLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Reads a 32 bit float from a buffer using big endian byte order.
 * @name util.float.readFloatBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Writes a 64 bit double to a buffer using little endian byte order.
 * @name util.float.writeDoubleLE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Writes a 64 bit double to a buffer using big endian byte order.
 * @name util.float.writeDoubleBE
 * @function
 * @param {number} val Value to write
 * @param {Uint8Array} buf Target buffer
 * @param {number} pos Target buffer offset
 * @returns {undefined}
 */

/**
 * Reads a 64 bit double from a buffer using little endian byte order.
 * @name util.float.readDoubleLE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

/**
 * Reads a 64 bit double from a buffer using big endian byte order.
 * @name util.float.readDoubleBE
 * @function
 * @param {Uint8Array} buf Source buffer
 * @param {number} pos Source buffer offset
 * @returns {number} Value read
 */

// Factory function for the purpose of node-based testing in modified global environments
function factory(exports) {

    // float: typed array
    if (typeof Float32Array !== "undefined") (function() {

        var f32 = new Float32Array([ -0 ]),
            f8b = new Uint8Array(f32.buffer),
            le  = f8b[3] === 128;

        function writeFloat_f32_cpy(val, buf, pos) {
            f32[0] = val;
            buf[pos    ] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
        }

        function writeFloat_f32_rev(val, buf, pos) {
            f32[0] = val;
            buf[pos    ] = f8b[3];
            buf[pos + 1] = f8b[2];
            buf[pos + 2] = f8b[1];
            buf[pos + 3] = f8b[0];
        }

        /* istanbul ignore next */
        exports.writeFloatLE = le ? writeFloat_f32_cpy : writeFloat_f32_rev;
        /* istanbul ignore next */
        exports.writeFloatBE = le ? writeFloat_f32_rev : writeFloat_f32_cpy;

        function readFloat_f32_cpy(buf, pos) {
            f8b[0] = buf[pos    ];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            return f32[0];
        }

        function readFloat_f32_rev(buf, pos) {
            f8b[3] = buf[pos    ];
            f8b[2] = buf[pos + 1];
            f8b[1] = buf[pos + 2];
            f8b[0] = buf[pos + 3];
            return f32[0];
        }

        /* istanbul ignore next */
        exports.readFloatLE = le ? readFloat_f32_cpy : readFloat_f32_rev;
        /* istanbul ignore next */
        exports.readFloatBE = le ? readFloat_f32_rev : readFloat_f32_cpy;

    // float: ieee754
    })(); else (function() {

        function writeFloat_ieee754(writeUint, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign)
                val = -val;
            if (val === 0)
                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos);
            else if (isNaN(val))
                writeUint(2143289344, buf, pos);
            else if (val > 3.4028234663852886e+38) // +-Infinity
                writeUint((sign << 31 | 2139095040) >>> 0, buf, pos);
            else if (val < 1.1754943508222875e-38) // denormal
                writeUint((sign << 31 | Math.round(val / 1.401298464324817e-45)) >>> 0, buf, pos);
            else {
                var exponent = Math.floor(Math.log(val) / Math.LN2),
                    mantissa = Math.round(val * Math.pow(2, -exponent) * 8388608) & 8388607;
                writeUint((sign << 31 | exponent + 127 << 23 | mantissa) >>> 0, buf, pos);
            }
        }

        exports.writeFloatLE = writeFloat_ieee754.bind(null, writeUintLE);
        exports.writeFloatBE = writeFloat_ieee754.bind(null, writeUintBE);

        function readFloat_ieee754(readUint, buf, pos) {
            var uint = readUint(buf, pos),
                sign = (uint >> 31) * 2 + 1,
                exponent = uint >>> 23 & 255,
                mantissa = uint & 8388607;
            return exponent === 255
                ? mantissa
                ? NaN
                : sign * Infinity
                : exponent === 0 // denormal
                ? sign * 1.401298464324817e-45 * mantissa
                : sign * Math.pow(2, exponent - 150) * (mantissa + 8388608);
        }

        exports.readFloatLE = readFloat_ieee754.bind(null, readUintLE);
        exports.readFloatBE = readFloat_ieee754.bind(null, readUintBE);

    })();

    // double: typed array
    if (typeof Float64Array !== "undefined") (function() {

        var f64 = new Float64Array([-0]),
            f8b = new Uint8Array(f64.buffer),
            le  = f8b[7] === 128;

        function writeDouble_f64_cpy(val, buf, pos) {
            f64[0] = val;
            buf[pos    ] = f8b[0];
            buf[pos + 1] = f8b[1];
            buf[pos + 2] = f8b[2];
            buf[pos + 3] = f8b[3];
            buf[pos + 4] = f8b[4];
            buf[pos + 5] = f8b[5];
            buf[pos + 6] = f8b[6];
            buf[pos + 7] = f8b[7];
        }

        function writeDouble_f64_rev(val, buf, pos) {
            f64[0] = val;
            buf[pos    ] = f8b[7];
            buf[pos + 1] = f8b[6];
            buf[pos + 2] = f8b[5];
            buf[pos + 3] = f8b[4];
            buf[pos + 4] = f8b[3];
            buf[pos + 5] = f8b[2];
            buf[pos + 6] = f8b[1];
            buf[pos + 7] = f8b[0];
        }

        /* istanbul ignore next */
        exports.writeDoubleLE = le ? writeDouble_f64_cpy : writeDouble_f64_rev;
        /* istanbul ignore next */
        exports.writeDoubleBE = le ? writeDouble_f64_rev : writeDouble_f64_cpy;

        function readDouble_f64_cpy(buf, pos) {
            f8b[0] = buf[pos    ];
            f8b[1] = buf[pos + 1];
            f8b[2] = buf[pos + 2];
            f8b[3] = buf[pos + 3];
            f8b[4] = buf[pos + 4];
            f8b[5] = buf[pos + 5];
            f8b[6] = buf[pos + 6];
            f8b[7] = buf[pos + 7];
            return f64[0];
        }

        function readDouble_f64_rev(buf, pos) {
            f8b[7] = buf[pos    ];
            f8b[6] = buf[pos + 1];
            f8b[5] = buf[pos + 2];
            f8b[4] = buf[pos + 3];
            f8b[3] = buf[pos + 4];
            f8b[2] = buf[pos + 5];
            f8b[1] = buf[pos + 6];
            f8b[0] = buf[pos + 7];
            return f64[0];
        }

        /* istanbul ignore next */
        exports.readDoubleLE = le ? readDouble_f64_cpy : readDouble_f64_rev;
        /* istanbul ignore next */
        exports.readDoubleBE = le ? readDouble_f64_rev : readDouble_f64_cpy;

    // double: ieee754
    })(); else (function() {

        function writeDouble_ieee754(writeUint, off0, off1, val, buf, pos) {
            var sign = val < 0 ? 1 : 0;
            if (sign)
                val = -val;
            if (val === 0) {
                writeUint(0, buf, pos + off0);
                writeUint(1 / val > 0 ? /* positive */ 0 : /* negative 0 */ 2147483648, buf, pos + off1);
            } else if (isNaN(val)) {
                writeUint(0, buf, pos + off0);
                writeUint(2146959360, buf, pos + off1);
            } else if (val > 1.7976931348623157e+308) { // +-Infinity
                writeUint(0, buf, pos + off0);
                writeUint((sign << 31 | 2146435072) >>> 0, buf, pos + off1);
            } else {
                var mantissa;
                if (val < 2.2250738585072014e-308) { // denormal
                    mantissa = val / 5e-324;
                    writeUint(mantissa >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | mantissa / 4294967296) >>> 0, buf, pos + off1);
                } else {
                    var exponent = Math.floor(Math.log(val) / Math.LN2);
                    if (exponent === 1024)
                        exponent = 1023;
                    mantissa = val * Math.pow(2, -exponent);
                    writeUint(mantissa * 4503599627370496 >>> 0, buf, pos + off0);
                    writeUint((sign << 31 | exponent + 1023 << 20 | mantissa * 1048576 & 1048575) >>> 0, buf, pos + off1);
                }
            }
        }

        exports.writeDoubleLE = writeDouble_ieee754.bind(null, writeUintLE, 0, 4);
        exports.writeDoubleBE = writeDouble_ieee754.bind(null, writeUintBE, 4, 0);

        function readDouble_ieee754(readUint, off0, off1, buf, pos) {
            var lo = readUint(buf, pos + off0),
                hi = readUint(buf, pos + off1);
            var sign = (hi >> 31) * 2 + 1,
                exponent = hi >>> 20 & 2047,
                mantissa = 4294967296 * (hi & 1048575) + lo;
            return exponent === 2047
                ? mantissa
                ? NaN
                : sign * Infinity
                : exponent === 0 // denormal
                ? sign * 5e-324 * mantissa
                : sign * Math.pow(2, exponent - 1075) * (mantissa + 4503599627370496);
        }

        exports.readDoubleLE = readDouble_ieee754.bind(null, readUintLE, 0, 4);
        exports.readDoubleBE = readDouble_ieee754.bind(null, readUintBE, 4, 0);

    })();

    return exports;
}

// uint helpers

function writeUintLE(val, buf, pos) {
    buf[pos    ] =  val        & 255;
    buf[pos + 1] =  val >>> 8  & 255;
    buf[pos + 2] =  val >>> 16 & 255;
    buf[pos + 3] =  val >>> 24;
}

function writeUintBE(val, buf, pos) {
    buf[pos    ] =  val >>> 24;
    buf[pos + 1] =  val >>> 16 & 255;
    buf[pos + 2] =  val >>> 8  & 255;
    buf[pos + 3] =  val        & 255;
}

function readUintLE(buf, pos) {
    return (buf[pos    ]
          | buf[pos + 1] << 8
          | buf[pos + 2] << 16
          | buf[pos + 3] << 24) >>> 0;
}

function readUintBE(buf, pos) {
    return (buf[pos    ] << 24
          | buf[pos + 1] << 16
          | buf[pos + 2] << 8
          | buf[pos + 3]) >>> 0;
}

var inquire_1 = inquire;

/**
 * Requires a module only if available.
 * @memberof util
 * @param {string} moduleName Module to require
 * @returns {?Object} Required module if available and not empty, otherwise `null`
 */
function inquire(moduleName) {
    try {
        var mod = eval("quire".replace(/^/,"re"))(moduleName); // eslint-disable-line no-eval
        if (mod && (mod.length || Object.keys(mod).length))
            return mod;
    } catch (e) {} // eslint-disable-line no-empty
    return null;
}

var utf8$2 = {};

(function (exports) {

	/**
	 * A minimal UTF8 implementation for number arrays.
	 * @memberof util
	 * @namespace
	 */
	var utf8 = exports;

	/**
	 * Calculates the UTF8 byte length of a string.
	 * @param {string} string String
	 * @returns {number} Byte length
	 */
	utf8.length = function utf8_length(string) {
	    var len = 0,
	        c = 0;
	    for (var i = 0; i < string.length; ++i) {
	        c = string.charCodeAt(i);
	        if (c < 128)
	            len += 1;
	        else if (c < 2048)
	            len += 2;
	        else if ((c & 0xFC00) === 0xD800 && (string.charCodeAt(i + 1) & 0xFC00) === 0xDC00) {
	            ++i;
	            len += 4;
	        } else
	            len += 3;
	    }
	    return len;
	};

	/**
	 * Reads UTF8 bytes as a string.
	 * @param {Uint8Array} buffer Source buffer
	 * @param {number} start Source start
	 * @param {number} end Source end
	 * @returns {string} String read
	 */
	utf8.read = function utf8_read(buffer, start, end) {
	    var len = end - start;
	    if (len < 1)
	        return "";
	    var parts = null,
	        chunk = [],
	        i = 0, // char offset
	        t;     // temporary
	    while (start < end) {
	        t = buffer[start++];
	        if (t < 128)
	            chunk[i++] = t;
	        else if (t > 191 && t < 224)
	            chunk[i++] = (t & 31) << 6 | buffer[start++] & 63;
	        else if (t > 239 && t < 365) {
	            t = ((t & 7) << 18 | (buffer[start++] & 63) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63) - 0x10000;
	            chunk[i++] = 0xD800 + (t >> 10);
	            chunk[i++] = 0xDC00 + (t & 1023);
	        } else
	            chunk[i++] = (t & 15) << 12 | (buffer[start++] & 63) << 6 | buffer[start++] & 63;
	        if (i > 8191) {
	            (parts || (parts = [])).push(String.fromCharCode.apply(String, chunk));
	            i = 0;
	        }
	    }
	    if (parts) {
	        if (i)
	            parts.push(String.fromCharCode.apply(String, chunk.slice(0, i)));
	        return parts.join("");
	    }
	    return String.fromCharCode.apply(String, chunk.slice(0, i));
	};

	/**
	 * Writes a string as UTF8 bytes.
	 * @param {string} string Source string
	 * @param {Uint8Array} buffer Destination buffer
	 * @param {number} offset Destination offset
	 * @returns {number} Bytes written
	 */
	utf8.write = function utf8_write(string, buffer, offset) {
	    var start = offset,
	        c1, // character 1
	        c2; // character 2
	    for (var i = 0; i < string.length; ++i) {
	        c1 = string.charCodeAt(i);
	        if (c1 < 128) {
	            buffer[offset++] = c1;
	        } else if (c1 < 2048) {
	            buffer[offset++] = c1 >> 6       | 192;
	            buffer[offset++] = c1       & 63 | 128;
	        } else if ((c1 & 0xFC00) === 0xD800 && ((c2 = string.charCodeAt(i + 1)) & 0xFC00) === 0xDC00) {
	            c1 = 0x10000 + ((c1 & 0x03FF) << 10) + (c2 & 0x03FF);
	            ++i;
	            buffer[offset++] = c1 >> 18      | 240;
	            buffer[offset++] = c1 >> 12 & 63 | 128;
	            buffer[offset++] = c1 >> 6  & 63 | 128;
	            buffer[offset++] = c1       & 63 | 128;
	        } else {
	            buffer[offset++] = c1 >> 12      | 224;
	            buffer[offset++] = c1 >> 6  & 63 | 128;
	            buffer[offset++] = c1       & 63 | 128;
	        }
	    }
	    return offset - start;
	};
} (utf8$2));

var pool_1 = pool;

/**
 * An allocator as used by {@link util.pool}.
 * @typedef PoolAllocator
 * @type {function}
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */

/**
 * A slicer as used by {@link util.pool}.
 * @typedef PoolSlicer
 * @type {function}
 * @param {number} start Start offset
 * @param {number} end End offset
 * @returns {Uint8Array} Buffer slice
 * @this {Uint8Array}
 */

/**
 * A general purpose buffer pool.
 * @memberof util
 * @function
 * @param {PoolAllocator} alloc Allocator
 * @param {PoolSlicer} slice Slicer
 * @param {number} [size=8192] Slab size
 * @returns {PoolAllocator} Pooled allocator
 */
function pool(alloc, slice, size) {
    var SIZE   = size || 8192;
    var MAX    = SIZE >>> 1;
    var slab   = null;
    var offset = SIZE;
    return function pool_alloc(size) {
        if (size < 1 || size > MAX)
            return alloc(size);
        if (offset + size > SIZE) {
            slab = alloc(SIZE);
            offset = 0;
        }
        var buf = slice.call(slab, offset, offset += size);
        if (offset & 7) // align to 32 bit
            offset = (offset | 7) + 1;
        return buf;
    };
}

var longbits;
var hasRequiredLongbits;

function requireLongbits () {
	if (hasRequiredLongbits) return longbits;
	hasRequiredLongbits = 1;
	longbits = LongBits;

	var util = requireMinimal();

	/**
	 * Constructs new long bits.
	 * @classdesc Helper class for working with the low and high bits of a 64 bit value.
	 * @memberof util
	 * @constructor
	 * @param {number} lo Low 32 bits, unsigned
	 * @param {number} hi High 32 bits, unsigned
	 */
	function LongBits(lo, hi) {

	    // note that the casts below are theoretically unnecessary as of today, but older statically
	    // generated converter code might still call the ctor with signed 32bits. kept for compat.

	    /**
	     * Low bits.
	     * @type {number}
	     */
	    this.lo = lo >>> 0;

	    /**
	     * High bits.
	     * @type {number}
	     */
	    this.hi = hi >>> 0;
	}

	/**
	 * Zero bits.
	 * @memberof util.LongBits
	 * @type {util.LongBits}
	 */
	var zero = LongBits.zero = new LongBits(0, 0);

	zero.toNumber = function() { return 0; };
	zero.zzEncode = zero.zzDecode = function() { return this; };
	zero.length = function() { return 1; };

	/**
	 * Zero hash.
	 * @memberof util.LongBits
	 * @type {string}
	 */
	var zeroHash = LongBits.zeroHash = "\0\0\0\0\0\0\0\0";

	/**
	 * Constructs new long bits from the specified number.
	 * @param {number} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.fromNumber = function fromNumber(value) {
	    if (value === 0)
	        return zero;
	    var sign = value < 0;
	    if (sign)
	        value = -value;
	    var lo = value >>> 0,
	        hi = (value - lo) / 4294967296 >>> 0;
	    if (sign) {
	        hi = ~hi >>> 0;
	        lo = ~lo >>> 0;
	        if (++lo > 4294967295) {
	            lo = 0;
	            if (++hi > 4294967295)
	                hi = 0;
	        }
	    }
	    return new LongBits(lo, hi);
	};

	/**
	 * Constructs new long bits from a number, long or string.
	 * @param {Long|number|string} value Value
	 * @returns {util.LongBits} Instance
	 */
	LongBits.from = function from(value) {
	    if (typeof value === "number")
	        return LongBits.fromNumber(value);
	    if (util.isString(value)) {
	        /* istanbul ignore else */
	        if (util.Long)
	            value = util.Long.fromString(value);
	        else
	            return LongBits.fromNumber(parseInt(value, 10));
	    }
	    return value.low || value.high ? new LongBits(value.low >>> 0, value.high >>> 0) : zero;
	};

	/**
	 * Converts this long bits to a possibly unsafe JavaScript number.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {number} Possibly unsafe number
	 */
	LongBits.prototype.toNumber = function toNumber(unsigned) {
	    if (!unsigned && this.hi >>> 31) {
	        var lo = ~this.lo + 1 >>> 0,
	            hi = ~this.hi     >>> 0;
	        if (!lo)
	            hi = hi + 1 >>> 0;
	        return -(lo + hi * 4294967296);
	    }
	    return this.lo + this.hi * 4294967296;
	};

	/**
	 * Converts this long bits to a long.
	 * @param {boolean} [unsigned=false] Whether unsigned or not
	 * @returns {Long} Long
	 */
	LongBits.prototype.toLong = function toLong(unsigned) {
	    return util.Long
	        ? new util.Long(this.lo | 0, this.hi | 0, Boolean(unsigned))
	        /* istanbul ignore next */
	        : { low: this.lo | 0, high: this.hi | 0, unsigned: Boolean(unsigned) };
	};

	var charCodeAt = String.prototype.charCodeAt;

	/**
	 * Constructs new long bits from the specified 8 characters long hash.
	 * @param {string} hash Hash
	 * @returns {util.LongBits} Bits
	 */
	LongBits.fromHash = function fromHash(hash) {
	    if (hash === zeroHash)
	        return zero;
	    return new LongBits(
	        ( charCodeAt.call(hash, 0)
	        | charCodeAt.call(hash, 1) << 8
	        | charCodeAt.call(hash, 2) << 16
	        | charCodeAt.call(hash, 3) << 24) >>> 0
	    ,
	        ( charCodeAt.call(hash, 4)
	        | charCodeAt.call(hash, 5) << 8
	        | charCodeAt.call(hash, 6) << 16
	        | charCodeAt.call(hash, 7) << 24) >>> 0
	    );
	};

	/**
	 * Converts this long bits to a 8 characters long hash.
	 * @returns {string} Hash
	 */
	LongBits.prototype.toHash = function toHash() {
	    return String.fromCharCode(
	        this.lo        & 255,
	        this.lo >>> 8  & 255,
	        this.lo >>> 16 & 255,
	        this.lo >>> 24      ,
	        this.hi        & 255,
	        this.hi >>> 8  & 255,
	        this.hi >>> 16 & 255,
	        this.hi >>> 24
	    );
	};

	/**
	 * Zig-zag encodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzEncode = function zzEncode() {
	    var mask =   this.hi >> 31;
	    this.hi  = ((this.hi << 1 | this.lo >>> 31) ^ mask) >>> 0;
	    this.lo  = ( this.lo << 1                   ^ mask) >>> 0;
	    return this;
	};

	/**
	 * Zig-zag decodes this long bits.
	 * @returns {util.LongBits} `this`
	 */
	LongBits.prototype.zzDecode = function zzDecode() {
	    var mask = -(this.lo & 1);
	    this.lo  = ((this.lo >>> 1 | this.hi << 31) ^ mask) >>> 0;
	    this.hi  = ( this.hi >>> 1                  ^ mask) >>> 0;
	    return this;
	};

	/**
	 * Calculates the length of this longbits when encoded as a varint.
	 * @returns {number} Length
	 */
	LongBits.prototype.length = function length() {
	    var part0 =  this.lo,
	        part1 = (this.lo >>> 28 | this.hi << 4) >>> 0,
	        part2 =  this.hi >>> 24;
	    return part2 === 0
	         ? part1 === 0
	           ? part0 < 16384
	             ? part0 < 128 ? 1 : 2
	             : part0 < 2097152 ? 3 : 4
	           : part1 < 16384
	             ? part1 < 128 ? 5 : 6
	             : part1 < 2097152 ? 7 : 8
	         : part2 < 128 ? 9 : 10;
	};
	return longbits;
}

var hasRequiredMinimal;

function requireMinimal () {
	if (hasRequiredMinimal) return minimal;
	hasRequiredMinimal = 1;
	(function (exports) {
		var util = exports;

		// used to return a Promise where callback is omitted
		util.asPromise = aspromise;

		// converts to / from base64 encoded strings
		util.base64 = base64$1;

		// base class of rpc.Service
		util.EventEmitter = eventemitter;

		// float handling accross browsers
		util.float = float;

		// requires modules optionally and hides the call from bundlers
		util.inquire = inquire_1;

		// converts to / from utf8 encoded strings
		util.utf8 = utf8$2;

		// provides a node-like buffer pool in the browser
		util.pool = pool_1;

		// utility to work with the low and high bits of a 64 bit value
		util.LongBits = requireLongbits();

		/**
		 * Whether running within node or not.
		 * @memberof util
		 * @type {boolean}
		 */
		util.isNode = Boolean(typeof commonjsGlobal !== "undefined"
		                   && commonjsGlobal
		                   && commonjsGlobal.process
		                   && commonjsGlobal.process.versions
		                   && commonjsGlobal.process.versions.node);

		/**
		 * Global object reference.
		 * @memberof util
		 * @type {Object}
		 */
		util.global = util.isNode && commonjsGlobal
		           || typeof window !== "undefined" && window
		           || typeof self   !== "undefined" && self
		           || commonjsGlobal; // eslint-disable-line no-invalid-this

		/**
		 * An immuable empty array.
		 * @memberof util
		 * @type {Array.<*>}
		 * @const
		 */
		util.emptyArray = Object.freeze ? Object.freeze([]) : /* istanbul ignore next */ []; // used on prototypes

		/**
		 * An immutable empty object.
		 * @type {Object}
		 * @const
		 */
		util.emptyObject = Object.freeze ? Object.freeze({}) : /* istanbul ignore next */ {}; // used on prototypes

		/**
		 * Tests if the specified value is an integer.
		 * @function
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is an integer
		 */
		util.isInteger = Number.isInteger || /* istanbul ignore next */ function isInteger(value) {
		    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
		};

		/**
		 * Tests if the specified value is a string.
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is a string
		 */
		util.isString = function isString(value) {
		    return typeof value === "string" || value instanceof String;
		};

		/**
		 * Tests if the specified value is a non-null object.
		 * @param {*} value Value to test
		 * @returns {boolean} `true` if the value is a non-null object
		 */
		util.isObject = function isObject(value) {
		    return value && typeof value === "object";
		};

		/**
		 * Checks if a property on a message is considered to be present.
		 * This is an alias of {@link util.isSet}.
		 * @function
		 * @param {Object} obj Plain object or message instance
		 * @param {string} prop Property name
		 * @returns {boolean} `true` if considered to be present, otherwise `false`
		 */
		util.isset =

		/**
		 * Checks if a property on a message is considered to be present.
		 * @param {Object} obj Plain object or message instance
		 * @param {string} prop Property name
		 * @returns {boolean} `true` if considered to be present, otherwise `false`
		 */
		util.isSet = function isSet(obj, prop) {
		    var value = obj[prop];
		    if (value != null && obj.hasOwnProperty(prop)) // eslint-disable-line eqeqeq, no-prototype-builtins
		        return typeof value !== "object" || (Array.isArray(value) ? value.length : Object.keys(value).length) > 0;
		    return false;
		};

		/**
		 * Any compatible Buffer instance.
		 * This is a minimal stand-alone definition of a Buffer instance. The actual type is that exported by node's typings.
		 * @interface Buffer
		 * @extends Uint8Array
		 */

		/**
		 * Node's Buffer class if available.
		 * @type {Constructor<Buffer>}
		 */
		util.Buffer = (function() {
		    try {
		        var Buffer = util.inquire("buffer").Buffer;
		        // refuse to use non-node buffers if not explicitly assigned (perf reasons):
		        return Buffer.prototype.utf8Write ? Buffer : /* istanbul ignore next */ null;
		    } catch (e) {
		        /* istanbul ignore next */
		        return null;
		    }
		})();

		// Internal alias of or polyfull for Buffer.from.
		util._Buffer_from = null;

		// Internal alias of or polyfill for Buffer.allocUnsafe.
		util._Buffer_allocUnsafe = null;

		/**
		 * Creates a new buffer of whatever type supported by the environment.
		 * @param {number|number[]} [sizeOrArray=0] Buffer size or number array
		 * @returns {Uint8Array|Buffer} Buffer
		 */
		util.newBuffer = function newBuffer(sizeOrArray) {
		    /* istanbul ignore next */
		    return typeof sizeOrArray === "number"
		        ? util.Buffer
		            ? util._Buffer_allocUnsafe(sizeOrArray)
		            : new util.Array(sizeOrArray)
		        : util.Buffer
		            ? util._Buffer_from(sizeOrArray)
		            : typeof Uint8Array === "undefined"
		                ? sizeOrArray
		                : new Uint8Array(sizeOrArray);
		};

		/**
		 * Array implementation used in the browser. `Uint8Array` if supported, otherwise `Array`.
		 * @type {Constructor<Uint8Array>}
		 */
		util.Array = typeof Uint8Array !== "undefined" ? Uint8Array /* istanbul ignore next */ : Array;

		/**
		 * Any compatible Long instance.
		 * This is a minimal stand-alone definition of a Long instance. The actual type is that exported by long.js.
		 * @interface Long
		 * @property {number} low Low bits
		 * @property {number} high High bits
		 * @property {boolean} unsigned Whether unsigned or not
		 */

		/**
		 * Long.js's Long class if available.
		 * @type {Constructor<Long>}
		 */
		util.Long = /* istanbul ignore next */ util.global.dcodeIO && /* istanbul ignore next */ util.global.dcodeIO.Long
		         || /* istanbul ignore next */ util.global.Long
		         || util.inquire("long");

		/**
		 * Regular expression used to verify 2 bit (`bool`) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key2Re = /^true|false|0|1$/;

		/**
		 * Regular expression used to verify 32 bit (`int32` etc.) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key32Re = /^-?(?:0|[1-9][0-9]*)$/;

		/**
		 * Regular expression used to verify 64 bit (`int64` etc.) map keys.
		 * @type {RegExp}
		 * @const
		 */
		util.key64Re = /^(?:[\\x00-\\xff]{8}|-?(?:0|[1-9][0-9]*))$/;

		/**
		 * Converts a number or long to an 8 characters long hash string.
		 * @param {Long|number} value Value to convert
		 * @returns {string} Hash
		 */
		util.longToHash = function longToHash(value) {
		    return value
		        ? util.LongBits.from(value).toHash()
		        : util.LongBits.zeroHash;
		};

		/**
		 * Converts an 8 characters long hash string to a long or number.
		 * @param {string} hash Hash
		 * @param {boolean} [unsigned=false] Whether unsigned or not
		 * @returns {Long|number} Original value
		 */
		util.longFromHash = function longFromHash(hash, unsigned) {
		    var bits = util.LongBits.fromHash(hash);
		    if (util.Long)
		        return util.Long.fromBits(bits.lo, bits.hi, unsigned);
		    return bits.toNumber(Boolean(unsigned));
		};

		/**
		 * Merges the properties of the source object into the destination object.
		 * @memberof util
		 * @param {Object.<string,*>} dst Destination object
		 * @param {Object.<string,*>} src Source object
		 * @param {boolean} [ifNotSet=false] Merges only if the key is not already set
		 * @returns {Object.<string,*>} Destination object
		 */
		function merge(dst, src, ifNotSet) { // used by converters
		    for (var keys = Object.keys(src), i = 0; i < keys.length; ++i)
		        if (dst[keys[i]] === undefined || !ifNotSet)
		            dst[keys[i]] = src[keys[i]];
		    return dst;
		}

		util.merge = merge;

		/**
		 * Converts the first character of a string to lower case.
		 * @param {string} str String to convert
		 * @returns {string} Converted string
		 */
		util.lcFirst = function lcFirst(str) {
		    return str.charAt(0).toLowerCase() + str.substring(1);
		};

		/**
		 * Creates a custom error constructor.
		 * @memberof util
		 * @param {string} name Error name
		 * @returns {Constructor<Error>} Custom error constructor
		 */
		function newError(name) {

		    function CustomError(message, properties) {

		        if (!(this instanceof CustomError))
		            return new CustomError(message, properties);

		        // Error.call(this, message);
		        // ^ just returns a new error instance because the ctor can be called as a function

		        Object.defineProperty(this, "message", { get: function() { return message; } });

		        /* istanbul ignore next */
		        if (Error.captureStackTrace) // node
		            Error.captureStackTrace(this, CustomError);
		        else
		            Object.defineProperty(this, "stack", { value: new Error().stack || "" });

		        if (properties)
		            merge(this, properties);
		    }

		    (CustomError.prototype = Object.create(Error.prototype)).constructor = CustomError;

		    Object.defineProperty(CustomError.prototype, "name", { get: function() { return name; } });

		    CustomError.prototype.toString = function toString() {
		        return this.name + ": " + this.message;
		    };

		    return CustomError;
		}

		util.newError = newError;

		/**
		 * Constructs a new protocol error.
		 * @classdesc Error subclass indicating a protocol specifc error.
		 * @memberof util
		 * @extends Error
		 * @template T extends Message<T>
		 * @constructor
		 * @param {string} message Error message
		 * @param {Object.<string,*>} [properties] Additional properties
		 * @example
		 * try {
		 *     MyMessage.decode(someBuffer); // throws if required fields are missing
		 * } catch (e) {
		 *     if (e instanceof ProtocolError && e.instance)
		 *         console.log("decoded so far: " + JSON.stringify(e.instance));
		 * }
		 */
		util.ProtocolError = newError("ProtocolError");

		/**
		 * So far decoded message instance.
		 * @name util.ProtocolError#instance
		 * @type {Message<T>}
		 */

		/**
		 * A OneOf getter as returned by {@link util.oneOfGetter}.
		 * @typedef OneOfGetter
		 * @type {function}
		 * @returns {string|undefined} Set field name, if any
		 */

		/**
		 * Builds a getter for a oneof's present field name.
		 * @param {string[]} fieldNames Field names
		 * @returns {OneOfGetter} Unbound getter
		 */
		util.oneOfGetter = function getOneOf(fieldNames) {
		    var fieldMap = {};
		    for (var i = 0; i < fieldNames.length; ++i)
		        fieldMap[fieldNames[i]] = 1;

		    /**
		     * @returns {string|undefined} Set field name, if any
		     * @this Object
		     * @ignore
		     */
		    return function() { // eslint-disable-line consistent-return
		        for (var keys = Object.keys(this), i = keys.length - 1; i > -1; --i)
		            if (fieldMap[keys[i]] === 1 && this[keys[i]] !== undefined && this[keys[i]] !== null)
		                return keys[i];
		    };
		};

		/**
		 * A OneOf setter as returned by {@link util.oneOfSetter}.
		 * @typedef OneOfSetter
		 * @type {function}
		 * @param {string|undefined} value Field name
		 * @returns {undefined}
		 */

		/**
		 * Builds a setter for a oneof's present field name.
		 * @param {string[]} fieldNames Field names
		 * @returns {OneOfSetter} Unbound setter
		 */
		util.oneOfSetter = function setOneOf(fieldNames) {

		    /**
		     * @param {string} name Field name
		     * @returns {undefined}
		     * @this Object
		     * @ignore
		     */
		    return function(name) {
		        for (var i = 0; i < fieldNames.length; ++i)
		            if (fieldNames[i] !== name)
		                delete this[fieldNames[i]];
		    };
		};

		/**
		 * Default conversion options used for {@link Message#toJSON} implementations.
		 *
		 * These options are close to proto3's JSON mapping with the exception that internal types like Any are handled just like messages. More precisely:
		 *
		 * - Longs become strings
		 * - Enums become string keys
		 * - Bytes become base64 encoded strings
		 * - (Sub-)Messages become plain objects
		 * - Maps become plain objects with all string keys
		 * - Repeated fields become arrays
		 * - NaN and Infinity for float and double fields become strings
		 *
		 * @type {IConversionOptions}
		 * @see https://developers.google.com/protocol-buffers/docs/proto3?hl=en#json
		 */
		util.toJSONOptions = {
		    longs: String,
		    enums: String,
		    bytes: String,
		    json: true
		};

		// Sets up buffer utility according to the environment (called in index-minimal)
		util._configure = function() {
		    var Buffer = util.Buffer;
		    /* istanbul ignore if */
		    if (!Buffer) {
		        util._Buffer_from = util._Buffer_allocUnsafe = null;
		        return;
		    }
		    // because node 4.x buffers are incompatible & immutable
		    // see: https://github.com/dcodeIO/protobuf.js/pull/665
		    util._Buffer_from = Buffer.from !== Uint8Array.from && Buffer.from ||
		        /* istanbul ignore next */
		        function Buffer_from(value, encoding) {
		            return new Buffer(value, encoding);
		        };
		    util._Buffer_allocUnsafe = Buffer.allocUnsafe ||
		        /* istanbul ignore next */
		        function Buffer_allocUnsafe(size) {
		            return new Buffer(size);
		        };
		};
} (minimal));
	return minimal;
}

var writer = Writer$1;

var util$8      = requireMinimal();

var BufferWriter$1; // cyclic

var LongBits$1  = util$8.LongBits,
    base64    = util$8.base64,
    utf8$1      = util$8.utf8;

/**
 * Constructs a new writer operation instance.
 * @classdesc Scheduled writer operation.
 * @constructor
 * @param {function(*, Uint8Array, number)} fn Function to call
 * @param {number} len Value byte length
 * @param {*} val Value to write
 * @ignore
 */
function Op(fn, len, val) {

    /**
     * Function to call.
     * @type {function(Uint8Array, number, *)}
     */
    this.fn = fn;

    /**
     * Value byte length.
     * @type {number}
     */
    this.len = len;

    /**
     * Next operation.
     * @type {Writer.Op|undefined}
     */
    this.next = undefined;

    /**
     * Value to write.
     * @type {*}
     */
    this.val = val; // type varies
}

/* istanbul ignore next */
function noop() {} // eslint-disable-line no-empty-function

/**
 * Constructs a new writer state instance.
 * @classdesc Copied writer state.
 * @memberof Writer
 * @constructor
 * @param {Writer} writer Writer to copy state from
 * @ignore
 */
function State(writer) {

    /**
     * Current head.
     * @type {Writer.Op}
     */
    this.head = writer.head;

    /**
     * Current tail.
     * @type {Writer.Op}
     */
    this.tail = writer.tail;

    /**
     * Current buffer length.
     * @type {number}
     */
    this.len = writer.len;

    /**
     * Next state.
     * @type {State|null}
     */
    this.next = writer.states;
}

/**
 * Constructs a new writer instance.
 * @classdesc Wire format writer using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 */
function Writer$1() {

    /**
     * Current length.
     * @type {number}
     */
    this.len = 0;

    /**
     * Operations head.
     * @type {Object}
     */
    this.head = new Op(noop, 0, 0);

    /**
     * Operations tail
     * @type {Object}
     */
    this.tail = this.head;

    /**
     * Linked forked states.
     * @type {Object|null}
     */
    this.states = null;

    // When a value is written, the writer calculates its byte length and puts it into a linked
    // list of operations to perform when finish() is called. This both allows us to allocate
    // buffers of the exact required size and reduces the amount of work we have to do compared
    // to first calculating over objects and then encoding over objects. In our case, the encoding
    // part is just a linked list walk calling operations with already prepared values.
}

var create$1 = function create() {
    return util$8.Buffer
        ? function create_buffer_setup() {
            return (Writer$1.create = function create_buffer() {
                return new BufferWriter$1();
            })();
        }
        /* istanbul ignore next */
        : function create_array() {
            return new Writer$1();
        };
};

/**
 * Creates a new writer.
 * @function
 * @returns {BufferWriter|Writer} A {@link BufferWriter} when Buffers are supported, otherwise a {@link Writer}
 */
Writer$1.create = create$1();

/**
 * Allocates a buffer of the specified size.
 * @param {number} size Buffer size
 * @returns {Uint8Array} Buffer
 */
Writer$1.alloc = function alloc(size) {
    return new util$8.Array(size);
};

// Use Uint8Array buffer pool in the browser, just like node does with buffers
/* istanbul ignore else */
if (util$8.Array !== Array)
    Writer$1.alloc = util$8.pool(Writer$1.alloc, util$8.Array.prototype.subarray);

/**
 * Pushes a new operation to the queue.
 * @param {function(Uint8Array, number, *)} fn Function to call
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @returns {Writer} `this`
 * @private
 */
Writer$1.prototype._push = function push(fn, len, val) {
    this.tail = this.tail.next = new Op(fn, len, val);
    this.len += len;
    return this;
};

function writeByte(val, buf, pos) {
    buf[pos] = val & 255;
}

function writeVarint32(val, buf, pos) {
    while (val > 127) {
        buf[pos++] = val & 127 | 128;
        val >>>= 7;
    }
    buf[pos] = val;
}

/**
 * Constructs a new varint writer operation instance.
 * @classdesc Scheduled varint writer operation.
 * @extends Op
 * @constructor
 * @param {number} len Value byte length
 * @param {number} val Value to write
 * @ignore
 */
function VarintOp(len, val) {
    this.len = len;
    this.next = undefined;
    this.val = val;
}

VarintOp.prototype = Object.create(Op.prototype);
VarintOp.prototype.fn = writeVarint32;

/**
 * Writes an unsigned 32 bit value as a varint.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.uint32 = function write_uint32(value) {
    // here, the call to this.push has been inlined and a varint specific Op subclass is used.
    // uint32 is by far the most frequently used operation and benefits significantly from this.
    this.len += (this.tail = this.tail.next = new VarintOp(
        (value = value >>> 0)
                < 128       ? 1
        : value < 16384     ? 2
        : value < 2097152   ? 3
        : value < 268435456 ? 4
        :                     5,
    value)).len;
    return this;
};

/**
 * Writes a signed 32 bit value as a varint.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.int32 = function write_int32(value) {
    return value < 0
        ? this._push(writeVarint64, 10, LongBits$1.fromNumber(value)) // 10 bytes per spec
        : this.uint32(value);
};

/**
 * Writes a 32 bit value as a varint, zig-zag encoded.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.sint32 = function write_sint32(value) {
    return this.uint32((value << 1 ^ value >> 31) >>> 0);
};

function writeVarint64(val, buf, pos) {
    while (val.hi) {
        buf[pos++] = val.lo & 127 | 128;
        val.lo = (val.lo >>> 7 | val.hi << 25) >>> 0;
        val.hi >>>= 7;
    }
    while (val.lo > 127) {
        buf[pos++] = val.lo & 127 | 128;
        val.lo = val.lo >>> 7;
    }
    buf[pos++] = val.lo;
}

/**
 * Writes an unsigned 64 bit value as a varint.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.uint64 = function write_uint64(value) {
    var bits = LongBits$1.from(value);
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a signed 64 bit value as a varint.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.int64 = Writer$1.prototype.uint64;

/**
 * Writes a signed 64 bit value as a varint, zig-zag encoded.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.sint64 = function write_sint64(value) {
    var bits = LongBits$1.from(value).zzEncode();
    return this._push(writeVarint64, bits.length(), bits);
};

/**
 * Writes a boolish value as a varint.
 * @param {boolean} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.bool = function write_bool(value) {
    return this._push(writeByte, 1, value ? 1 : 0);
};

function writeFixed32(val, buf, pos) {
    buf[pos    ] =  val         & 255;
    buf[pos + 1] =  val >>> 8   & 255;
    buf[pos + 2] =  val >>> 16  & 255;
    buf[pos + 3] =  val >>> 24;
}

/**
 * Writes an unsigned 32 bit value as fixed 32 bits.
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.fixed32 = function write_fixed32(value) {
    return this._push(writeFixed32, 4, value >>> 0);
};

/**
 * Writes a signed 32 bit value as fixed 32 bits.
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.sfixed32 = Writer$1.prototype.fixed32;

/**
 * Writes an unsigned 64 bit value as fixed 64 bits.
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.fixed64 = function write_fixed64(value) {
    var bits = LongBits$1.from(value);
    return this._push(writeFixed32, 4, bits.lo)._push(writeFixed32, 4, bits.hi);
};

/**
 * Writes a signed 64 bit value as fixed 64 bits.
 * @function
 * @param {Long|number|string} value Value to write
 * @returns {Writer} `this`
 * @throws {TypeError} If `value` is a string and no long library is present.
 */
Writer$1.prototype.sfixed64 = Writer$1.prototype.fixed64;

/**
 * Writes a float (32 bit).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.float = function write_float(value) {
    return this._push(util$8.float.writeFloatLE, 4, value);
};

/**
 * Writes a double (64 bit float).
 * @function
 * @param {number} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.double = function write_double(value) {
    return this._push(util$8.float.writeDoubleLE, 8, value);
};

var writeBytes = util$8.Array.prototype.set
    ? function writeBytes_set(val, buf, pos) {
        buf.set(val, pos); // also works for plain array values
    }
    /* istanbul ignore next */
    : function writeBytes_for(val, buf, pos) {
        for (var i = 0; i < val.length; ++i)
            buf[pos + i] = val[i];
    };

/**
 * Writes a sequence of bytes.
 * @param {Uint8Array|string} value Buffer or base64 encoded string to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.bytes = function write_bytes(value) {
    var len = value.length >>> 0;
    if (!len)
        return this._push(writeByte, 1, 0);
    if (util$8.isString(value)) {
        var buf = Writer$1.alloc(len = base64.length(value));
        base64.decode(value, buf, 0);
        value = buf;
    }
    return this.uint32(len)._push(writeBytes, len, value);
};

/**
 * Writes a string.
 * @param {string} value Value to write
 * @returns {Writer} `this`
 */
Writer$1.prototype.string = function write_string(value) {
    var len = utf8$1.length(value);
    return len
        ? this.uint32(len)._push(utf8$1.write, len, value)
        : this._push(writeByte, 1, 0);
};

/**
 * Forks this writer's state by pushing it to a stack.
 * Calling {@link Writer#reset|reset} or {@link Writer#ldelim|ldelim} resets the writer to the previous state.
 * @returns {Writer} `this`
 */
Writer$1.prototype.fork = function fork() {
    this.states = new State(this);
    this.head = this.tail = new Op(noop, 0, 0);
    this.len = 0;
    return this;
};

/**
 * Resets this instance to the last state.
 * @returns {Writer} `this`
 */
Writer$1.prototype.reset = function reset() {
    if (this.states) {
        this.head   = this.states.head;
        this.tail   = this.states.tail;
        this.len    = this.states.len;
        this.states = this.states.next;
    } else {
        this.head = this.tail = new Op(noop, 0, 0);
        this.len  = 0;
    }
    return this;
};

/**
 * Resets to the last state and appends the fork state's current write length as a varint followed by its operations.
 * @returns {Writer} `this`
 */
Writer$1.prototype.ldelim = function ldelim() {
    var head = this.head,
        tail = this.tail,
        len  = this.len;
    this.reset().uint32(len);
    if (len) {
        this.tail.next = head.next; // skip noop
        this.tail = tail;
        this.len += len;
    }
    return this;
};

/**
 * Finishes the write operation.
 * @returns {Uint8Array} Finished buffer
 */
Writer$1.prototype.finish = function finish() {
    var head = this.head.next, // skip noop
        buf  = this.constructor.alloc(this.len),
        pos  = 0;
    while (head) {
        head.fn(head.val, buf, pos);
        pos += head.len;
        head = head.next;
    }
    // this.head = this.tail = null;
    return buf;
};

Writer$1._configure = function(BufferWriter_) {
    BufferWriter$1 = BufferWriter_;
    Writer$1.create = create$1();
    BufferWriter$1._configure();
};

var writer_buffer = BufferWriter;

// extends Writer
var Writer = writer;
(BufferWriter.prototype = Object.create(Writer.prototype)).constructor = BufferWriter;

var util$7 = requireMinimal();

/**
 * Constructs a new buffer writer instance.
 * @classdesc Wire format writer using node buffers.
 * @extends Writer
 * @constructor
 */
function BufferWriter() {
    Writer.call(this);
}

BufferWriter._configure = function () {
    /**
     * Allocates a buffer of the specified size.
     * @function
     * @param {number} size Buffer size
     * @returns {Buffer} Buffer
     */
    BufferWriter.alloc = util$7._Buffer_allocUnsafe;

    BufferWriter.writeBytesBuffer = util$7.Buffer && util$7.Buffer.prototype instanceof Uint8Array && util$7.Buffer.prototype.set.name === "set"
        ? function writeBytesBuffer_set(val, buf, pos) {
          buf.set(val, pos); // faster than copy (requires node >= 4 where Buffers extend Uint8Array and set is properly inherited)
          // also works for plain array values
        }
        /* istanbul ignore next */
        : function writeBytesBuffer_copy(val, buf, pos) {
          if (val.copy) // Buffer values
            val.copy(buf, pos, 0, val.length);
          else for (var i = 0; i < val.length;) // plain array values
            buf[pos++] = val[i++];
        };
};


/**
 * @override
 */
BufferWriter.prototype.bytes = function write_bytes_buffer(value) {
    if (util$7.isString(value))
        value = util$7._Buffer_from(value, "base64");
    var len = value.length >>> 0;
    this.uint32(len);
    if (len)
        this._push(BufferWriter.writeBytesBuffer, len, value);
    return this;
};

function writeStringBuffer(val, buf, pos) {
    if (val.length < 40) // plain js is faster for short strings (probably due to redundant assertions)
        util$7.utf8.write(val, buf, pos);
    else if (buf.utf8Write)
        buf.utf8Write(val, pos);
    else
        buf.write(val, pos);
}

/**
 * @override
 */
BufferWriter.prototype.string = function write_string_buffer(value) {
    var len = util$7.Buffer.byteLength(value);
    this.uint32(len);
    if (len)
        this._push(writeStringBuffer, len, value);
    return this;
};


/**
 * Finishes the write operation.
 * @name BufferWriter#finish
 * @function
 * @returns {Buffer} Finished buffer
 */

BufferWriter._configure();

var reader = Reader$1;

var util$6      = requireMinimal();

var BufferReader$1; // cyclic

var LongBits  = util$6.LongBits,
    utf8      = util$6.utf8;

/* istanbul ignore next */
function indexOutOfRange(reader, writeLength) {
    return RangeError("index out of range: " + reader.pos + " + " + (writeLength || 1) + " > " + reader.len);
}

/**
 * Constructs a new reader instance using the specified buffer.
 * @classdesc Wire format reader using `Uint8Array` if available, otherwise `Array`.
 * @constructor
 * @param {Uint8Array} buffer Buffer to read from
 */
function Reader$1(buffer) {

    /**
     * Read buffer.
     * @type {Uint8Array}
     */
    this.buf = buffer;

    /**
     * Read buffer position.
     * @type {number}
     */
    this.pos = 0;

    /**
     * Read buffer length.
     * @type {number}
     */
    this.len = buffer.length;
}

var create_array = typeof Uint8Array !== "undefined"
    ? function create_typed_array(buffer) {
        if (buffer instanceof Uint8Array || Array.isArray(buffer))
            return new Reader$1(buffer);
        throw Error("illegal buffer");
    }
    /* istanbul ignore next */
    : function create_array(buffer) {
        if (Array.isArray(buffer))
            return new Reader$1(buffer);
        throw Error("illegal buffer");
    };

var create = function create() {
    return util$6.Buffer
        ? function create_buffer_setup(buffer) {
            return (Reader$1.create = function create_buffer(buffer) {
                return util$6.Buffer.isBuffer(buffer)
                    ? new BufferReader$1(buffer)
                    /* istanbul ignore next */
                    : create_array(buffer);
            })(buffer);
        }
        /* istanbul ignore next */
        : create_array;
};

/**
 * Creates a new reader using the specified buffer.
 * @function
 * @param {Uint8Array|Buffer} buffer Buffer to read from
 * @returns {Reader|BufferReader} A {@link BufferReader} if `buffer` is a Buffer, otherwise a {@link Reader}
 * @throws {Error} If `buffer` is not a valid buffer
 */
Reader$1.create = create();

Reader$1.prototype._slice = util$6.Array.prototype.subarray || /* istanbul ignore next */ util$6.Array.prototype.slice;

/**
 * Reads a varint as an unsigned 32 bit value.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.uint32 = (function read_uint32_setup() {
    var value = 4294967295; // optimizer type-hint, tends to deopt otherwise (?!)
    return function read_uint32() {
        value = (         this.buf[this.pos] & 127       ) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) <<  7) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 14) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] & 127) << 21) >>> 0; if (this.buf[this.pos++] < 128) return value;
        value = (value | (this.buf[this.pos] &  15) << 28) >>> 0; if (this.buf[this.pos++] < 128) return value;

        /* istanbul ignore if */
        if ((this.pos += 5) > this.len) {
            this.pos = this.len;
            throw indexOutOfRange(this, 10);
        }
        return value;
    };
})();

/**
 * Reads a varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader$1.prototype.int32 = function read_int32() {
    return this.uint32() | 0;
};

/**
 * Reads a zig-zag encoded varint as a signed 32 bit value.
 * @returns {number} Value read
 */
Reader$1.prototype.sint32 = function read_sint32() {
    var value = this.uint32();
    return value >>> 1 ^ -(value & 1) | 0;
};

/* eslint-disable no-invalid-this */

function readLongVarint() {
    // tends to deopt with local vars for octet etc.
    var bits = new LongBits(0, 0);
    var i = 0;
    if (this.len - this.pos > 4) { // fast route (lo)
        for (; i < 4; ++i) {
            // 1st..4th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        // 5th
        bits.lo = (bits.lo | (this.buf[this.pos] & 127) << 28) >>> 0;
        bits.hi = (bits.hi | (this.buf[this.pos] & 127) >>  4) >>> 0;
        if (this.buf[this.pos++] < 128)
            return bits;
        i = 0;
    } else {
        for (; i < 3; ++i) {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 1st..3th
            bits.lo = (bits.lo | (this.buf[this.pos] & 127) << i * 7) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
        // 4th
        bits.lo = (bits.lo | (this.buf[this.pos++] & 127) << i * 7) >>> 0;
        return bits;
    }
    if (this.len - this.pos > 4) { // fast route (hi)
        for (; i < 5; ++i) {
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    } else {
        for (; i < 5; ++i) {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
            // 6th..10th
            bits.hi = (bits.hi | (this.buf[this.pos] & 127) << i * 7 + 3) >>> 0;
            if (this.buf[this.pos++] < 128)
                return bits;
        }
    }
    /* istanbul ignore next */
    throw Error("invalid varint encoding");
}

/* eslint-enable no-invalid-this */

/**
 * Reads a varint as a signed 64 bit value.
 * @name Reader#int64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as an unsigned 64 bit value.
 * @name Reader#uint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a zig-zag encoded varint as a signed 64 bit value.
 * @name Reader#sint64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a varint as a boolean.
 * @returns {boolean} Value read
 */
Reader$1.prototype.bool = function read_bool() {
    return this.uint32() !== 0;
};

function readFixed32_end(buf, end) { // note that this uses `end`, not `pos`
    return (buf[end - 4]
          | buf[end - 3] << 8
          | buf[end - 2] << 16
          | buf[end - 1] << 24) >>> 0;
}

/**
 * Reads fixed 32 bits as an unsigned 32 bit integer.
 * @returns {number} Value read
 */
Reader$1.prototype.fixed32 = function read_fixed32() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32_end(this.buf, this.pos += 4);
};

/**
 * Reads fixed 32 bits as a signed 32 bit integer.
 * @returns {number} Value read
 */
Reader$1.prototype.sfixed32 = function read_sfixed32() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    return readFixed32_end(this.buf, this.pos += 4) | 0;
};

/* eslint-disable no-invalid-this */

function readFixed64(/* this: Reader */) {

    /* istanbul ignore if */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 8);

    return new LongBits(readFixed32_end(this.buf, this.pos += 4), readFixed32_end(this.buf, this.pos += 4));
}

/* eslint-enable no-invalid-this */

/**
 * Reads fixed 64 bits.
 * @name Reader#fixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads zig-zag encoded fixed 64 bits.
 * @name Reader#sfixed64
 * @function
 * @returns {Long} Value read
 */

/**
 * Reads a float (32 bit) as a number.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.float = function read_float() {

    /* istanbul ignore if */
    if (this.pos + 4 > this.len)
        throw indexOutOfRange(this, 4);

    var value = util$6.float.readFloatLE(this.buf, this.pos);
    this.pos += 4;
    return value;
};

/**
 * Reads a double (64 bit float) as a number.
 * @function
 * @returns {number} Value read
 */
Reader$1.prototype.double = function read_double() {

    /* istanbul ignore if */
    if (this.pos + 8 > this.len)
        throw indexOutOfRange(this, 4);

    var value = util$6.float.readDoubleLE(this.buf, this.pos);
    this.pos += 8;
    return value;
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @returns {Uint8Array} Value read
 */
Reader$1.prototype.bytes = function read_bytes() {
    var length = this.uint32(),
        start  = this.pos,
        end    = this.pos + length;

    /* istanbul ignore if */
    if (end > this.len)
        throw indexOutOfRange(this, length);

    this.pos += length;
    if (Array.isArray(this.buf)) // plain array
        return this.buf.slice(start, end);
    return start === end // fix for IE 10/Win8 and others' subarray returning array of size 1
        ? new this.buf.constructor(0)
        : this._slice.call(this.buf, start, end);
};

/**
 * Reads a string preceeded by its byte length as a varint.
 * @returns {string} Value read
 */
Reader$1.prototype.string = function read_string() {
    var bytes = this.bytes();
    return utf8.read(bytes, 0, bytes.length);
};

/**
 * Skips the specified number of bytes if specified, otherwise skips a varint.
 * @param {number} [length] Length if known, otherwise a varint is assumed
 * @returns {Reader} `this`
 */
Reader$1.prototype.skip = function skip(length) {
    if (typeof length === "number") {
        /* istanbul ignore if */
        if (this.pos + length > this.len)
            throw indexOutOfRange(this, length);
        this.pos += length;
    } else {
        do {
            /* istanbul ignore if */
            if (this.pos >= this.len)
                throw indexOutOfRange(this);
        } while (this.buf[this.pos++] & 128);
    }
    return this;
};

/**
 * Skips the next element of the specified wire type.
 * @param {number} wireType Wire type received
 * @returns {Reader} `this`
 */
Reader$1.prototype.skipType = function(wireType) {
    switch (wireType) {
        case 0:
            this.skip();
            break;
        case 1:
            this.skip(8);
            break;
        case 2:
            this.skip(this.uint32());
            break;
        case 3:
            while ((wireType = this.uint32() & 7) !== 4) {
                this.skipType(wireType);
            }
            break;
        case 5:
            this.skip(4);
            break;

        /* istanbul ignore next */
        default:
            throw Error("invalid wire type " + wireType + " at offset " + this.pos);
    }
    return this;
};

Reader$1._configure = function(BufferReader_) {
    BufferReader$1 = BufferReader_;
    Reader$1.create = create();
    BufferReader$1._configure();

    var fn = util$6.Long ? "toLong" : /* istanbul ignore next */ "toNumber";
    util$6.merge(Reader$1.prototype, {

        int64: function read_int64() {
            return readLongVarint.call(this)[fn](false);
        },

        uint64: function read_uint64() {
            return readLongVarint.call(this)[fn](true);
        },

        sint64: function read_sint64() {
            return readLongVarint.call(this).zzDecode()[fn](false);
        },

        fixed64: function read_fixed64() {
            return readFixed64.call(this)[fn](true);
        },

        sfixed64: function read_sfixed64() {
            return readFixed64.call(this)[fn](false);
        }

    });
};

var reader_buffer = BufferReader;

// extends Reader
var Reader = reader;
(BufferReader.prototype = Object.create(Reader.prototype)).constructor = BufferReader;

var util$5 = requireMinimal();

/**
 * Constructs a new buffer reader instance.
 * @classdesc Wire format reader using node buffers.
 * @extends Reader
 * @constructor
 * @param {Buffer} buffer Buffer to read from
 */
function BufferReader(buffer) {
    Reader.call(this, buffer);

    /**
     * Read buffer.
     * @name BufferReader#buf
     * @type {Buffer}
     */
}

BufferReader._configure = function () {
    /* istanbul ignore else */
    if (util$5.Buffer)
        BufferReader.prototype._slice = util$5.Buffer.prototype.slice;
};


/**
 * @override
 */
BufferReader.prototype.string = function read_string_buffer() {
    var len = this.uint32(); // modifies pos
    return this.buf.utf8Slice
        ? this.buf.utf8Slice(this.pos, this.pos = Math.min(this.pos + len, this.len))
        : this.buf.toString("utf-8", this.pos, this.pos = Math.min(this.pos + len, this.len));
};

/**
 * Reads a sequence of bytes preceeded by its length as a varint.
 * @name BufferReader#bytes
 * @function
 * @returns {Buffer} Value read
 */

BufferReader._configure();

var rpc = {};

var service$1 = Service$1;

var util$4 = requireMinimal();

// Extends EventEmitter
(Service$1.prototype = Object.create(util$4.EventEmitter.prototype)).constructor = Service$1;

/**
 * A service method callback as used by {@link rpc.ServiceMethod|ServiceMethod}.
 *
 * Differs from {@link RPCImplCallback} in that it is an actual callback of a service method which may not return `response = null`.
 * @typedef rpc.ServiceMethodCallback
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {Error|null} error Error, if any
 * @param {TRes} [response] Response message
 * @returns {undefined}
 */

/**
 * A service method part of a {@link rpc.Service} as created by {@link Service.create}.
 * @typedef rpc.ServiceMethod
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 * @type {function}
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} [callback] Node-style callback called with the error, if any, and the response message
 * @returns {Promise<Message<TRes>>} Promise if `callback` has been omitted, otherwise `undefined`
 */

/**
 * Constructs a new RPC service instance.
 * @classdesc An RPC service as returned by {@link Service#create}.
 * @exports rpc.Service
 * @extends util.EventEmitter
 * @constructor
 * @param {RPCImpl} rpcImpl RPC implementation
 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
 */
function Service$1(rpcImpl, requestDelimited, responseDelimited) {

    if (typeof rpcImpl !== "function")
        throw TypeError("rpcImpl must be a function");

    util$4.EventEmitter.call(this);

    /**
     * RPC implementation. Becomes `null` once the service is ended.
     * @type {RPCImpl|null}
     */
    this.rpcImpl = rpcImpl;

    /**
     * Whether requests are length-delimited.
     * @type {boolean}
     */
    this.requestDelimited = Boolean(requestDelimited);

    /**
     * Whether responses are length-delimited.
     * @type {boolean}
     */
    this.responseDelimited = Boolean(responseDelimited);
}

/**
 * Calls a service method through {@link rpc.Service#rpcImpl|rpcImpl}.
 * @param {Method|rpc.ServiceMethod<TReq,TRes>} method Reflected or static method
 * @param {Constructor<TReq>} requestCtor Request constructor
 * @param {Constructor<TRes>} responseCtor Response constructor
 * @param {TReq|Properties<TReq>} request Request message or plain object
 * @param {rpc.ServiceMethodCallback<TRes>} callback Service callback
 * @returns {undefined}
 * @template TReq extends Message<TReq>
 * @template TRes extends Message<TRes>
 */
Service$1.prototype.rpcCall = function rpcCall(method, requestCtor, responseCtor, request, callback) {

    if (!request)
        throw TypeError("request must be specified");

    var self = this;
    if (!callback)
        return util$4.asPromise(rpcCall, self, method, requestCtor, responseCtor, request);

    if (!self.rpcImpl) {
        setTimeout(function() { callback(Error("already ended")); }, 0);
        return undefined;
    }

    try {
        return self.rpcImpl(
            method,
            requestCtor[self.requestDelimited ? "encodeDelimited" : "encode"](request).finish(),
            function rpcCallback(err, response) {

                if (err) {
                    self.emit("error", err, method);
                    return callback(err);
                }

                if (response === null) {
                    self.end(/* endedByRPC */ true);
                    return undefined;
                }

                if (!(response instanceof responseCtor)) {
                    try {
                        response = responseCtor[self.responseDelimited ? "decodeDelimited" : "decode"](response);
                    } catch (err) {
                        self.emit("error", err, method);
                        return callback(err);
                    }
                }

                self.emit("data", response, method);
                return callback(null, response);
            }
        );
    } catch (err) {
        self.emit("error", err, method);
        setTimeout(function() { callback(err); }, 0);
        return undefined;
    }
};

/**
 * Ends this service and emits the `end` event.
 * @param {boolean} [endedByRPC=false] Whether the service has been ended by the RPC implementation.
 * @returns {rpc.Service} `this`
 */
Service$1.prototype.end = function end(endedByRPC) {
    if (this.rpcImpl) {
        if (!endedByRPC) // signal end to rpcImpl
            this.rpcImpl(null, null, null);
        this.rpcImpl = null;
        this.emit("end").off();
    }
    return this;
};

(function (exports) {

	/**
	 * Streaming RPC helpers.
	 * @namespace
	 */
	var rpc = exports;

	/**
	 * RPC implementation passed to {@link Service#create} performing a service request on network level, i.e. by utilizing http requests or websockets.
	 * @typedef RPCImpl
	 * @type {function}
	 * @param {Method|rpc.ServiceMethod<Message<{}>,Message<{}>>} method Reflected or static method being called
	 * @param {Uint8Array} requestData Request data
	 * @param {RPCImplCallback} callback Callback function
	 * @returns {undefined}
	 * @example
	 * function rpcImpl(method, requestData, callback) {
	 *     if (protobuf.util.lcFirst(method.name) !== "myMethod") // compatible with static code
	 *         throw Error("no such method");
	 *     asynchronouslyObtainAResponse(requestData, function(err, responseData) {
	 *         callback(err, responseData);
	 *     });
	 * }
	 */

	/**
	 * Node-style callback as used by {@link RPCImpl}.
	 * @typedef RPCImplCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any, otherwise `null`
	 * @param {Uint8Array|null} [response] Response data or `null` to signal end of stream, if there hasn't been an error
	 * @returns {undefined}
	 */

	rpc.Service = service$1;
} (rpc));

var roots = {};

(function (exports) {
	var protobuf = exports;

	/**
	 * Build type, one of `"full"`, `"light"` or `"minimal"`.
	 * @name build
	 * @type {string}
	 * @const
	 */
	protobuf.build = "minimal";

	// Serialization
	protobuf.Writer       = writer;
	protobuf.BufferWriter = writer_buffer;
	protobuf.Reader       = reader;
	protobuf.BufferReader = reader_buffer;

	// Utility
	protobuf.util         = requireMinimal();
	protobuf.rpc          = rpc;
	protobuf.roots        = roots;
	protobuf.configure    = configure;

	/* istanbul ignore next */
	/**
	 * Reconfigures the library according to the environment.
	 * @returns {undefined}
	 */
	function configure() {
	    protobuf.util._configure();
	    protobuf.Writer._configure(protobuf.BufferWriter);
	    protobuf.Reader._configure(protobuf.BufferReader);
	}

	// Set up buffer utility according to the environment
	configure();
} (indexMinimal));

var util$3 = {exports: {}};

var codegen_1;
var hasRequiredCodegen;

function requireCodegen () {
	if (hasRequiredCodegen) return codegen_1;
	hasRequiredCodegen = 1;
	codegen_1 = codegen;

	/**
	 * Begins generating a function.
	 * @memberof util
	 * @param {string[]} functionParams Function parameter names
	 * @param {string} [functionName] Function name if not anonymous
	 * @returns {Codegen} Appender that appends code to the function's body
	 */
	function codegen(functionParams, functionName) {

	    /* istanbul ignore if */
	    if (typeof functionParams === "string") {
	        functionName = functionParams;
	        functionParams = undefined;
	    }

	    var body = [];

	    /**
	     * Appends code to the function's body or finishes generation.
	     * @typedef Codegen
	     * @type {function}
	     * @param {string|Object.<string,*>} [formatStringOrScope] Format string or, to finish the function, an object of additional scope variables, if any
	     * @param {...*} [formatParams] Format parameters
	     * @returns {Codegen|Function} Itself or the generated function if finished
	     * @throws {Error} If format parameter counts do not match
	     */

	    function Codegen(formatStringOrScope) {
	        // note that explicit array handling below makes this ~50% faster

	        // finish the function
	        if (typeof formatStringOrScope !== "string") {
	            var source = toString();
	            if (codegen.verbose)
	                console.log("codegen: " + source); // eslint-disable-line no-console
	            source = "return " + source;
	            if (formatStringOrScope) {
	                var scopeKeys   = Object.keys(formatStringOrScope),
	                    scopeParams = new Array(scopeKeys.length + 1),
	                    scopeValues = new Array(scopeKeys.length),
	                    scopeOffset = 0;
	                while (scopeOffset < scopeKeys.length) {
	                    scopeParams[scopeOffset] = scopeKeys[scopeOffset];
	                    scopeValues[scopeOffset] = formatStringOrScope[scopeKeys[scopeOffset++]];
	                }
	                scopeParams[scopeOffset] = source;
	                return Function.apply(null, scopeParams).apply(null, scopeValues); // eslint-disable-line no-new-func
	            }
	            return Function(source)(); // eslint-disable-line no-new-func
	        }

	        // otherwise append to body
	        var formatParams = new Array(arguments.length - 1),
	            formatOffset = 0;
	        while (formatOffset < formatParams.length)
	            formatParams[formatOffset] = arguments[++formatOffset];
	        formatOffset = 0;
	        formatStringOrScope = formatStringOrScope.replace(/%([%dfijs])/g, function replace($0, $1) {
	            var value = formatParams[formatOffset++];
	            switch ($1) {
	                case "d": case "f": return String(Number(value));
	                case "i": return String(Math.floor(value));
	                case "j": return JSON.stringify(value);
	                case "s": return String(value);
	            }
	            return "%";
	        });
	        if (formatOffset !== formatParams.length)
	            throw Error("parameter count mismatch");
	        body.push(formatStringOrScope);
	        return Codegen;
	    }

	    function toString(functionNameOverride) {
	        return "function " + (functionNameOverride || functionName || "") + "(" + (functionParams && functionParams.join(",") || "") + "){\n  " + body.join("\n  ") + "\n}";
	    }

	    Codegen.toString = toString;
	    return Codegen;
	}

	/**
	 * Begins generating a function.
	 * @memberof util
	 * @function codegen
	 * @param {string} [functionName] Function name if not anonymous
	 * @returns {Codegen} Appender that appends code to the function's body
	 * @variation 2
	 */

	/**
	 * When set to `true`, codegen will log generated code to console. Useful for debugging.
	 * @name util.codegen.verbose
	 * @type {boolean}
	 */
	codegen.verbose = false;
	return codegen_1;
}

var fetch_1;
var hasRequiredFetch;

function requireFetch () {
	if (hasRequiredFetch) return fetch_1;
	hasRequiredFetch = 1;
	fetch_1 = fetch;

	var asPromise = aspromise,
	    inquire   = inquire_1;

	var fs = inquire("fs");

	/**
	 * Node-style callback as used by {@link util.fetch}.
	 * @typedef FetchCallback
	 * @type {function}
	 * @param {?Error} error Error, if any, otherwise `null`
	 * @param {string} [contents] File contents, if there hasn't been an error
	 * @returns {undefined}
	 */

	/**
	 * Options as used by {@link util.fetch}.
	 * @typedef FetchOptions
	 * @type {Object}
	 * @property {boolean} [binary=false] Whether expecting a binary response
	 * @property {boolean} [xhr=false] If `true`, forces the use of XMLHttpRequest
	 */

	/**
	 * Fetches the contents of a file.
	 * @memberof util
	 * @param {string} filename File path or url
	 * @param {FetchOptions} options Fetch options
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 */
	function fetch(filename, options, callback) {
	    if (typeof options === "function") {
	        callback = options;
	        options = {};
	    } else if (!options)
	        options = {};

	    if (!callback)
	        return asPromise(fetch, this, filename, options); // eslint-disable-line no-invalid-this

	    // if a node-like filesystem is present, try it first but fall back to XHR if nothing is found.
	    if (!options.xhr && fs && fs.readFile)
	        return fs.readFile(filename, function fetchReadFileCallback(err, contents) {
	            return err && typeof XMLHttpRequest !== "undefined"
	                ? fetch.xhr(filename, options, callback)
	                : err
	                ? callback(err)
	                : callback(null, options.binary ? contents : contents.toString("utf8"));
	        });

	    // use the XHR version otherwise.
	    return fetch.xhr(filename, options, callback);
	}

	/**
	 * Fetches the contents of a file.
	 * @name util.fetch
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 * @variation 2
	 */

	/**
	 * Fetches the contents of a file.
	 * @name util.fetch
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchOptions} [options] Fetch options
	 * @returns {Promise<string|Uint8Array>} Promise
	 * @variation 3
	 */

	/**/
	fetch.xhr = function fetch_xhr(filename, options, callback) {
	    var xhr = new XMLHttpRequest();
	    xhr.onreadystatechange /* works everywhere */ = function fetchOnReadyStateChange() {

	        if (xhr.readyState !== 4)
	            return undefined;

	        // local cors security errors return status 0 / empty string, too. afaik this cannot be
	        // reliably distinguished from an actually empty file for security reasons. feel free
	        // to send a pull request if you are aware of a solution.
	        if (xhr.status !== 0 && xhr.status !== 200)
	            return callback(Error("status " + xhr.status));

	        // if binary data is expected, make sure that some sort of array is returned, even if
	        // ArrayBuffers are not supported. the binary string fallback, however, is unsafe.
	        if (options.binary) {
	            var buffer = xhr.response;
	            if (!buffer) {
	                buffer = [];
	                for (var i = 0; i < xhr.responseText.length; ++i)
	                    buffer.push(xhr.responseText.charCodeAt(i) & 255);
	            }
	            return callback(null, typeof Uint8Array !== "undefined" ? new Uint8Array(buffer) : buffer);
	        }
	        return callback(null, xhr.responseText);
	    };

	    if (options.binary) {
	        // ref: https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Sending_and_Receiving_Binary_Data#Receiving_binary_data_in_older_browsers
	        if ("overrideMimeType" in xhr)
	            xhr.overrideMimeType("text/plain; charset=x-user-defined");
	        xhr.responseType = "arraybuffer";
	    }

	    xhr.open("GET", filename);
	    xhr.send();
	};
	return fetch_1;
}

var path = {};

var hasRequiredPath;

function requirePath () {
	if (hasRequiredPath) return path;
	hasRequiredPath = 1;
	(function (exports) {

		/**
		 * A minimal path module to resolve Unix, Windows and URL paths alike.
		 * @memberof util
		 * @namespace
		 */
		var path = exports;

		var isAbsolute =
		/**
		 * Tests if the specified path is absolute.
		 * @param {string} path Path to test
		 * @returns {boolean} `true` if path is absolute
		 */
		path.isAbsolute = function isAbsolute(path) {
		    return /^(?:\/|\w+:)/.test(path);
		};

		var normalize =
		/**
		 * Normalizes the specified path.
		 * @param {string} path Path to normalize
		 * @returns {string} Normalized path
		 */
		path.normalize = function normalize(path) {
		    path = path.replace(/\\/g, "/")
		               .replace(/\/{2,}/g, "/");
		    var parts    = path.split("/"),
		        absolute = isAbsolute(path),
		        prefix   = "";
		    if (absolute)
		        prefix = parts.shift() + "/";
		    for (var i = 0; i < parts.length;) {
		        if (parts[i] === "..") {
		            if (i > 0 && parts[i - 1] !== "..")
		                parts.splice(--i, 2);
		            else if (absolute)
		                parts.splice(i, 1);
		            else
		                ++i;
		        } else if (parts[i] === ".")
		            parts.splice(i, 1);
		        else
		            ++i;
		    }
		    return prefix + parts.join("/");
		};

		/**
		 * Resolves the specified include path against the specified origin path.
		 * @param {string} originPath Path to the origin file
		 * @param {string} includePath Include path relative to origin path
		 * @param {boolean} [alreadyNormalized=false] `true` if both paths are already known to be normalized
		 * @returns {string} Path to the include file
		 */
		path.resolve = function resolve(originPath, includePath, alreadyNormalized) {
		    if (!alreadyNormalized)
		        includePath = normalize(includePath);
		    if (isAbsolute(includePath))
		        return includePath;
		    if (!alreadyNormalized)
		        originPath = normalize(originPath);
		    return (originPath = originPath.replace(/(?:\/|^)[^/]+$/, "")).length ? normalize(originPath + "/" + includePath) : includePath;
		};
} (path));
	return path;
}

var types$1 = {};

var hasRequiredTypes;

function requireTypes () {
	if (hasRequiredTypes) return types$1;
	hasRequiredTypes = 1;
	(function (exports) {

		/**
		 * Common type constants.
		 * @namespace
		 */
		var types = exports;

		var util = requireUtil();

		var s = [
		    "double",   // 0
		    "float",    // 1
		    "int32",    // 2
		    "uint32",   // 3
		    "sint32",   // 4
		    "fixed32",  // 5
		    "sfixed32", // 6
		    "int64",    // 7
		    "uint64",   // 8
		    "sint64",   // 9
		    "fixed64",  // 10
		    "sfixed64", // 11
		    "bool",     // 12
		    "string",   // 13
		    "bytes"     // 14
		];

		function bake(values, offset) {
		    var i = 0, o = {};
		    offset |= 0;
		    while (i < values.length) o[s[i + offset]] = values[i++];
		    return o;
		}

		/**
		 * Basic type wire types.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} double=1 Fixed64 wire type
		 * @property {number} float=5 Fixed32 wire type
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 * @property {number} string=2 Ldelim wire type
		 * @property {number} bytes=2 Ldelim wire type
		 */
		types.basic = bake([
		    /* double   */ 1,
		    /* float    */ 5,
		    /* int32    */ 0,
		    /* uint32   */ 0,
		    /* sint32   */ 0,
		    /* fixed32  */ 5,
		    /* sfixed32 */ 5,
		    /* int64    */ 0,
		    /* uint64   */ 0,
		    /* sint64   */ 0,
		    /* fixed64  */ 1,
		    /* sfixed64 */ 1,
		    /* bool     */ 0,
		    /* string   */ 2,
		    /* bytes    */ 2
		]);

		/**
		 * Basic type defaults.
		 * @type {Object.<string,*>}
		 * @const
		 * @property {number} double=0 Double default
		 * @property {number} float=0 Float default
		 * @property {number} int32=0 Int32 default
		 * @property {number} uint32=0 Uint32 default
		 * @property {number} sint32=0 Sint32 default
		 * @property {number} fixed32=0 Fixed32 default
		 * @property {number} sfixed32=0 Sfixed32 default
		 * @property {number} int64=0 Int64 default
		 * @property {number} uint64=0 Uint64 default
		 * @property {number} sint64=0 Sint32 default
		 * @property {number} fixed64=0 Fixed64 default
		 * @property {number} sfixed64=0 Sfixed64 default
		 * @property {boolean} bool=false Bool default
		 * @property {string} string="" String default
		 * @property {Array.<number>} bytes=Array(0) Bytes default
		 * @property {null} message=null Message default
		 */
		types.defaults = bake([
		    /* double   */ 0,
		    /* float    */ 0,
		    /* int32    */ 0,
		    /* uint32   */ 0,
		    /* sint32   */ 0,
		    /* fixed32  */ 0,
		    /* sfixed32 */ 0,
		    /* int64    */ 0,
		    /* uint64   */ 0,
		    /* sint64   */ 0,
		    /* fixed64  */ 0,
		    /* sfixed64 */ 0,
		    /* bool     */ false,
		    /* string   */ "",
		    /* bytes    */ util.emptyArray,
		    /* message  */ null
		]);

		/**
		 * Basic long type wire types.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 */
		types.long = bake([
		    /* int64    */ 0,
		    /* uint64   */ 0,
		    /* sint64   */ 0,
		    /* fixed64  */ 1,
		    /* sfixed64 */ 1
		], 7);

		/**
		 * Allowed types for map keys with their associated wire type.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 * @property {number} string=2 Ldelim wire type
		 */
		types.mapKey = bake([
		    /* int32    */ 0,
		    /* uint32   */ 0,
		    /* sint32   */ 0,
		    /* fixed32  */ 5,
		    /* sfixed32 */ 5,
		    /* int64    */ 0,
		    /* uint64   */ 0,
		    /* sint64   */ 0,
		    /* fixed64  */ 1,
		    /* sfixed64 */ 1,
		    /* bool     */ 0,
		    /* string   */ 2
		], 2);

		/**
		 * Allowed types for packed repeated fields with their associated wire type.
		 * @type {Object.<string,number>}
		 * @const
		 * @property {number} double=1 Fixed64 wire type
		 * @property {number} float=5 Fixed32 wire type
		 * @property {number} int32=0 Varint wire type
		 * @property {number} uint32=0 Varint wire type
		 * @property {number} sint32=0 Varint wire type
		 * @property {number} fixed32=5 Fixed32 wire type
		 * @property {number} sfixed32=5 Fixed32 wire type
		 * @property {number} int64=0 Varint wire type
		 * @property {number} uint64=0 Varint wire type
		 * @property {number} sint64=0 Varint wire type
		 * @property {number} fixed64=1 Fixed64 wire type
		 * @property {number} sfixed64=1 Fixed64 wire type
		 * @property {number} bool=0 Varint wire type
		 */
		types.packed = bake([
		    /* double   */ 1,
		    /* float    */ 5,
		    /* int32    */ 0,
		    /* uint32   */ 0,
		    /* sint32   */ 0,
		    /* fixed32  */ 5,
		    /* sfixed32 */ 5,
		    /* int64    */ 0,
		    /* uint64   */ 0,
		    /* sint64   */ 0,
		    /* fixed64  */ 1,
		    /* sfixed64 */ 1,
		    /* bool     */ 0
		]);
} (types$1));
	return types$1;
}

var field;
var hasRequiredField;

function requireField () {
	if (hasRequiredField) return field;
	hasRequiredField = 1;
	field = Field;

	// extends ReflectionObject
	var ReflectionObject = requireObject();
	((Field.prototype = Object.create(ReflectionObject.prototype)).constructor = Field).className = "Field";

	var Enum  = require_enum(),
	    types = requireTypes(),
	    util  = requireUtil();

	var Type; // cyclic

	var ruleRe = /^required|optional|repeated$/;

	/**
	 * Constructs a new message field instance. Note that {@link MapField|map fields} have their own class.
	 * @name Field
	 * @classdesc Reflected message field.
	 * @extends FieldBase
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} type Value type
	 * @param {string|Object.<string,*>} [rule="optional"] Field rule
	 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
	 * @param {Object.<string,*>} [options] Declared options
	 */

	/**
	 * Constructs a field from a field descriptor.
	 * @param {string} name Field name
	 * @param {IField} json Field descriptor
	 * @returns {Field} Created field
	 * @throws {TypeError} If arguments are invalid
	 */
	Field.fromJSON = function fromJSON(name, json) {
	    return new Field(name, json.id, json.type, json.rule, json.extend, json.options, json.comment);
	};

	/**
	 * Not an actual constructor. Use {@link Field} instead.
	 * @classdesc Base class of all reflected message fields. This is not an actual class but here for the sake of having consistent type definitions.
	 * @exports FieldBase
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} type Value type
	 * @param {string|Object.<string,*>} [rule="optional"] Field rule
	 * @param {string|Object.<string,*>} [extend] Extended type if different from parent
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function Field(name, id, type, rule, extend, options, comment) {

	    if (util.isObject(rule)) {
	        comment = extend;
	        options = rule;
	        rule = extend = undefined;
	    } else if (util.isObject(extend)) {
	        comment = options;
	        options = extend;
	        extend = undefined;
	    }

	    ReflectionObject.call(this, name, options);

	    if (!util.isInteger(id) || id < 0)
	        throw TypeError("id must be a non-negative integer");

	    if (!util.isString(type))
	        throw TypeError("type must be a string");

	    if (rule !== undefined && !ruleRe.test(rule = rule.toString().toLowerCase()))
	        throw TypeError("rule must be a string rule");

	    if (extend !== undefined && !util.isString(extend))
	        throw TypeError("extend must be a string");

	    if (rule === "proto3_optional") {
	        rule = "optional";
	    }
	    /**
	     * Field rule, if any.
	     * @type {string|undefined}
	     */
	    this.rule = rule && rule !== "optional" ? rule : undefined; // toJSON

	    /**
	     * Field type.
	     * @type {string}
	     */
	    this.type = type; // toJSON

	    /**
	     * Unique field id.
	     * @type {number}
	     */
	    this.id = id; // toJSON, marker

	    /**
	     * Extended type if different from parent.
	     * @type {string|undefined}
	     */
	    this.extend = extend || undefined; // toJSON

	    /**
	     * Whether this field is required.
	     * @type {boolean}
	     */
	    this.required = rule === "required";

	    /**
	     * Whether this field is optional.
	     * @type {boolean}
	     */
	    this.optional = !this.required;

	    /**
	     * Whether this field is repeated.
	     * @type {boolean}
	     */
	    this.repeated = rule === "repeated";

	    /**
	     * Whether this field is a map or not.
	     * @type {boolean}
	     */
	    this.map = false;

	    /**
	     * Message this field belongs to.
	     * @type {Type|null}
	     */
	    this.message = null;

	    /**
	     * OneOf this field belongs to, if any,
	     * @type {OneOf|null}
	     */
	    this.partOf = null;

	    /**
	     * The field type's default value.
	     * @type {*}
	     */
	    this.typeDefault = null;

	    /**
	     * The field's default value on prototypes.
	     * @type {*}
	     */
	    this.defaultValue = null;

	    /**
	     * Whether this field's value should be treated as a long.
	     * @type {boolean}
	     */
	    this.long = util.Long ? types.long[type] !== undefined : /* istanbul ignore next */ false;

	    /**
	     * Whether this field's value is a buffer.
	     * @type {boolean}
	     */
	    this.bytes = type === "bytes";

	    /**
	     * Resolved type if not a basic type.
	     * @type {Type|Enum|null}
	     */
	    this.resolvedType = null;

	    /**
	     * Sister-field within the extended type if a declaring extension field.
	     * @type {Field|null}
	     */
	    this.extensionField = null;

	    /**
	     * Sister-field within the declaring namespace if an extended field.
	     * @type {Field|null}
	     */
	    this.declaringField = null;

	    /**
	     * Internally remembers whether this field is packed.
	     * @type {boolean|null}
	     * @private
	     */
	    this._packed = null;

	    /**
	     * Comment for this field.
	     * @type {string|null}
	     */
	    this.comment = comment;
	}

	/**
	 * Determines whether this field is packed. Only relevant when repeated and working with proto2.
	 * @name Field#packed
	 * @type {boolean}
	 * @readonly
	 */
	Object.defineProperty(Field.prototype, "packed", {
	    get: function() {
	        // defaults to packed=true if not explicity set to false
	        if (this._packed === null)
	            this._packed = this.getOption("packed") !== false;
	        return this._packed;
	    }
	});

	/**
	 * @override
	 */
	Field.prototype.setOption = function setOption(name, value, ifNotSet) {
	    if (name === "packed") // clear cached before setting
	        this._packed = null;
	    return ReflectionObject.prototype.setOption.call(this, name, value, ifNotSet);
	};

	/**
	 * Field descriptor.
	 * @interface IField
	 * @property {string} [rule="optional"] Field rule
	 * @property {string} type Field type
	 * @property {number} id Field id
	 * @property {Object.<string,*>} [options] Field options
	 */

	/**
	 * Extension field descriptor.
	 * @interface IExtensionField
	 * @extends IField
	 * @property {string} extend Extended type
	 */

	/**
	 * Converts this field to a field descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IField} Field descriptor
	 */
	Field.prototype.toJSON = function toJSON(toJSONOptions) {
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "rule"    , this.rule !== "optional" && this.rule || undefined,
	        "type"    , this.type,
	        "id"      , this.id,
	        "extend"  , this.extend,
	        "options" , this.options,
	        "comment" , keepComments ? this.comment : undefined
	    ]);
	};

	/**
	 * Resolves this field's type references.
	 * @returns {Field} `this`
	 * @throws {Error} If any reference cannot be resolved
	 */
	Field.prototype.resolve = function resolve() {

	    if (this.resolved)
	        return this;

	    if ((this.typeDefault = types.defaults[this.type]) === undefined) { // if not a basic type, resolve it
	        this.resolvedType = (this.declaringField ? this.declaringField.parent : this.parent).lookupTypeOrEnum(this.type);
	        if (this.resolvedType instanceof Type)
	            this.typeDefault = null;
	        else // instanceof Enum
	            this.typeDefault = this.resolvedType.values[Object.keys(this.resolvedType.values)[0]]; // first defined
	    }

	    // use explicitly set default value if present
	    if (this.options && this.options["default"] != null) {
	        this.typeDefault = this.options["default"];
	        if (this.resolvedType instanceof Enum && typeof this.typeDefault === "string")
	            this.typeDefault = this.resolvedType.values[this.typeDefault];
	    }

	    // remove unnecessary options
	    if (this.options) {
	        if (this.options.packed === true || this.options.packed !== undefined && this.resolvedType && !(this.resolvedType instanceof Enum))
	            delete this.options.packed;
	        if (!Object.keys(this.options).length)
	            this.options = undefined;
	    }

	    // convert to internal data type if necesssary
	    if (this.long) {
	        this.typeDefault = util.Long.fromNumber(this.typeDefault, this.type.charAt(0) === "u");

	        /* istanbul ignore else */
	        if (Object.freeze)
	            Object.freeze(this.typeDefault); // long instances are meant to be immutable anyway (i.e. use small int cache that even requires it)

	    } else if (this.bytes && typeof this.typeDefault === "string") {
	        var buf;
	        if (util.base64.test(this.typeDefault))
	            util.base64.decode(this.typeDefault, buf = util.newBuffer(util.base64.length(this.typeDefault)), 0);
	        else
	            util.utf8.write(this.typeDefault, buf = util.newBuffer(util.utf8.length(this.typeDefault)), 0);
	        this.typeDefault = buf;
	    }

	    // take special care of maps and repeated fields
	    if (this.map)
	        this.defaultValue = util.emptyObject;
	    else if (this.repeated)
	        this.defaultValue = util.emptyArray;
	    else
	        this.defaultValue = this.typeDefault;

	    // ensure proper value on prototype
	    if (this.parent instanceof Type)
	        this.parent.ctor.prototype[this.name] = this.defaultValue;

	    return ReflectionObject.prototype.resolve.call(this);
	};

	/**
	 * Decorator function as returned by {@link Field.d} and {@link MapField.d} (TypeScript).
	 * @typedef FieldDecorator
	 * @type {function}
	 * @param {Object} prototype Target prototype
	 * @param {string} fieldName Field name
	 * @returns {undefined}
	 */

	/**
	 * Field decorator (TypeScript).
	 * @name Field.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"string"|"bool"|"bytes"|Object} fieldType Field type
	 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
	 * @param {T} [defaultValue] Default value
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends number | number[] | Long | Long[] | string | string[] | boolean | boolean[] | Uint8Array | Uint8Array[] | Buffer | Buffer[]
	 */
	Field.d = function decorateField(fieldId, fieldType, fieldRule, defaultValue) {

	    // submessage: decorate the submessage and use its name as the type
	    if (typeof fieldType === "function")
	        fieldType = util.decorateType(fieldType).name;

	    // enum reference: create a reflected copy of the enum and keep reuseing it
	    else if (fieldType && typeof fieldType === "object")
	        fieldType = util.decorateEnum(fieldType).name;

	    return function fieldDecorator(prototype, fieldName) {
	        util.decorateType(prototype.constructor)
	            .add(new Field(fieldName, fieldId, fieldType, fieldRule, { "default": defaultValue }));
	    };
	};

	/**
	 * Field decorator (TypeScript).
	 * @name Field.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {Constructor<T>|string} fieldType Field type
	 * @param {"optional"|"required"|"repeated"} [fieldRule="optional"] Field rule
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends Message<T>
	 * @variation 2
	 */
	// like Field.d but without a default value

	// Sets up cyclic dependencies (called in index-light)
	Field._configure = function configure(Type_) {
	    Type = Type_;
	};
	return field;
}

var oneof;
var hasRequiredOneof;

function requireOneof () {
	if (hasRequiredOneof) return oneof;
	hasRequiredOneof = 1;
	oneof = OneOf;

	// extends ReflectionObject
	var ReflectionObject = requireObject();
	((OneOf.prototype = Object.create(ReflectionObject.prototype)).constructor = OneOf).className = "OneOf";

	var Field = requireField(),
	    util  = requireUtil();

	/**
	 * Constructs a new oneof instance.
	 * @classdesc Reflected oneof.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Oneof name
	 * @param {string[]|Object.<string,*>} [fieldNames] Field names
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function OneOf(name, fieldNames, options, comment) {
	    if (!Array.isArray(fieldNames)) {
	        options = fieldNames;
	        fieldNames = undefined;
	    }
	    ReflectionObject.call(this, name, options);

	    /* istanbul ignore if */
	    if (!(fieldNames === undefined || Array.isArray(fieldNames)))
	        throw TypeError("fieldNames must be an Array");

	    /**
	     * Field names that belong to this oneof.
	     * @type {string[]}
	     */
	    this.oneof = fieldNames || []; // toJSON, marker

	    /**
	     * Fields that belong to this oneof as an array for iteration.
	     * @type {Field[]}
	     * @readonly
	     */
	    this.fieldsArray = []; // declared readonly for conformance, possibly not yet added to parent

	    /**
	     * Comment for this field.
	     * @type {string|null}
	     */
	    this.comment = comment;
	}

	/**
	 * Oneof descriptor.
	 * @interface IOneOf
	 * @property {Array.<string>} oneof Oneof field names
	 * @property {Object.<string,*>} [options] Oneof options
	 */

	/**
	 * Constructs a oneof from a oneof descriptor.
	 * @param {string} name Oneof name
	 * @param {IOneOf} json Oneof descriptor
	 * @returns {OneOf} Created oneof
	 * @throws {TypeError} If arguments are invalid
	 */
	OneOf.fromJSON = function fromJSON(name, json) {
	    return new OneOf(name, json.oneof, json.options, json.comment);
	};

	/**
	 * Converts this oneof to a oneof descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IOneOf} Oneof descriptor
	 */
	OneOf.prototype.toJSON = function toJSON(toJSONOptions) {
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "options" , this.options,
	        "oneof"   , this.oneof,
	        "comment" , keepComments ? this.comment : undefined
	    ]);
	};

	/**
	 * Adds the fields of the specified oneof to the parent if not already done so.
	 * @param {OneOf} oneof The oneof
	 * @returns {undefined}
	 * @inner
	 * @ignore
	 */
	function addFieldsToParent(oneof) {
	    if (oneof.parent)
	        for (var i = 0; i < oneof.fieldsArray.length; ++i)
	            if (!oneof.fieldsArray[i].parent)
	                oneof.parent.add(oneof.fieldsArray[i]);
	}

	/**
	 * Adds a field to this oneof and removes it from its current parent, if any.
	 * @param {Field} field Field to add
	 * @returns {OneOf} `this`
	 */
	OneOf.prototype.add = function add(field) {

	    /* istanbul ignore if */
	    if (!(field instanceof Field))
	        throw TypeError("field must be a Field");

	    if (field.parent && field.parent !== this.parent)
	        field.parent.remove(field);
	    this.oneof.push(field.name);
	    this.fieldsArray.push(field);
	    field.partOf = this; // field.parent remains null
	    addFieldsToParent(this);
	    return this;
	};

	/**
	 * Removes a field from this oneof and puts it back to the oneof's parent.
	 * @param {Field} field Field to remove
	 * @returns {OneOf} `this`
	 */
	OneOf.prototype.remove = function remove(field) {

	    /* istanbul ignore if */
	    if (!(field instanceof Field))
	        throw TypeError("field must be a Field");

	    var index = this.fieldsArray.indexOf(field);

	    /* istanbul ignore if */
	    if (index < 0)
	        throw Error(field + " is not a member of " + this);

	    this.fieldsArray.splice(index, 1);
	    index = this.oneof.indexOf(field.name);

	    /* istanbul ignore else */
	    if (index > -1) // theoretical
	        this.oneof.splice(index, 1);

	    field.partOf = null;
	    return this;
	};

	/**
	 * @override
	 */
	OneOf.prototype.onAdd = function onAdd(parent) {
	    ReflectionObject.prototype.onAdd.call(this, parent);
	    var self = this;
	    // Collect present fields
	    for (var i = 0; i < this.oneof.length; ++i) {
	        var field = parent.get(this.oneof[i]);
	        if (field && !field.partOf) {
	            field.partOf = self;
	            self.fieldsArray.push(field);
	        }
	    }
	    // Add not yet present fields
	    addFieldsToParent(this);
	};

	/**
	 * @override
	 */
	OneOf.prototype.onRemove = function onRemove(parent) {
	    for (var i = 0, field; i < this.fieldsArray.length; ++i)
	        if ((field = this.fieldsArray[i]).parent)
	            field.parent.remove(field);
	    ReflectionObject.prototype.onRemove.call(this, parent);
	};

	/**
	 * Decorator function as returned by {@link OneOf.d} (TypeScript).
	 * @typedef OneOfDecorator
	 * @type {function}
	 * @param {Object} prototype Target prototype
	 * @param {string} oneofName OneOf name
	 * @returns {undefined}
	 */

	/**
	 * OneOf decorator (TypeScript).
	 * @function
	 * @param {...string} fieldNames Field names
	 * @returns {OneOfDecorator} Decorator function
	 * @template T extends string
	 */
	OneOf.d = function decorateOneOf() {
	    var fieldNames = new Array(arguments.length),
	        index = 0;
	    while (index < arguments.length)
	        fieldNames[index] = arguments[index++];
	    return function oneOfDecorator(prototype, oneofName) {
	        util.decorateType(prototype.constructor)
	            .add(new OneOf(oneofName, fieldNames));
	        Object.defineProperty(prototype, oneofName, {
	            get: util.oneOfGetter(fieldNames),
	            set: util.oneOfSetter(fieldNames)
	        });
	    };
	};
	return oneof;
}

var namespace;
var hasRequiredNamespace;

function requireNamespace () {
	if (hasRequiredNamespace) return namespace;
	hasRequiredNamespace = 1;
	namespace = Namespace;

	// extends ReflectionObject
	var ReflectionObject = requireObject();
	((Namespace.prototype = Object.create(ReflectionObject.prototype)).constructor = Namespace).className = "Namespace";

	var Field    = requireField(),
	    OneOf    = requireOneof(),
	    util     = requireUtil();

	var Type,    // cyclic
	    Service,
	    Enum;

	/**
	 * Constructs a new namespace instance.
	 * @name Namespace
	 * @classdesc Reflected namespace.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} [options] Declared options
	 */

	/**
	 * Constructs a namespace from JSON.
	 * @memberof Namespace
	 * @function
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} json JSON object
	 * @returns {Namespace} Created namespace
	 * @throws {TypeError} If arguments are invalid
	 */
	Namespace.fromJSON = function fromJSON(name, json) {
	    return new Namespace(name, json.options).addJSON(json.nested);
	};

	/**
	 * Converts an array of reflection objects to JSON.
	 * @memberof Namespace
	 * @param {ReflectionObject[]} array Object array
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {Object.<string,*>|undefined} JSON object or `undefined` when array is empty
	 */
	function arrayToJSON(array, toJSONOptions) {
	    if (!(array && array.length))
	        return undefined;
	    var obj = {};
	    for (var i = 0; i < array.length; ++i)
	        obj[array[i].name] = array[i].toJSON(toJSONOptions);
	    return obj;
	}

	Namespace.arrayToJSON = arrayToJSON;

	/**
	 * Tests if the specified id is reserved.
	 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Namespace.isReservedId = function isReservedId(reserved, id) {
	    if (reserved)
	        for (var i = 0; i < reserved.length; ++i)
	            if (typeof reserved[i] !== "string" && reserved[i][0] <= id && reserved[i][1] > id)
	                return true;
	    return false;
	};

	/**
	 * Tests if the specified name is reserved.
	 * @param {Array.<number[]|string>|undefined} reserved Array of reserved ranges and names
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Namespace.isReservedName = function isReservedName(reserved, name) {
	    if (reserved)
	        for (var i = 0; i < reserved.length; ++i)
	            if (reserved[i] === name)
	                return true;
	    return false;
	};

	/**
	 * Not an actual constructor. Use {@link Namespace} instead.
	 * @classdesc Base class of all reflection objects containing nested objects. This is not an actual class but here for the sake of having consistent type definitions.
	 * @exports NamespaceBase
	 * @extends ReflectionObject
	 * @abstract
	 * @constructor
	 * @param {string} name Namespace name
	 * @param {Object.<string,*>} [options] Declared options
	 * @see {@link Namespace}
	 */
	function Namespace(name, options) {
	    ReflectionObject.call(this, name, options);

	    /**
	     * Nested objects by name.
	     * @type {Object.<string,ReflectionObject>|undefined}
	     */
	    this.nested = undefined; // toJSON

	    /**
	     * Cached nested objects as an array.
	     * @type {ReflectionObject[]|null}
	     * @private
	     */
	    this._nestedArray = null;
	}

	function clearCache(namespace) {
	    namespace._nestedArray = null;
	    return namespace;
	}

	/**
	 * Nested objects of this namespace as an array for iteration.
	 * @name NamespaceBase#nestedArray
	 * @type {ReflectionObject[]}
	 * @readonly
	 */
	Object.defineProperty(Namespace.prototype, "nestedArray", {
	    get: function() {
	        return this._nestedArray || (this._nestedArray = util.toArray(this.nested));
	    }
	});

	/**
	 * Namespace descriptor.
	 * @interface INamespace
	 * @property {Object.<string,*>} [options] Namespace options
	 * @property {Object.<string,AnyNestedObject>} [nested] Nested object descriptors
	 */

	/**
	 * Any extension field descriptor.
	 * @typedef AnyExtensionField
	 * @type {IExtensionField|IExtensionMapField}
	 */

	/**
	 * Any nested object descriptor.
	 * @typedef AnyNestedObject
	 * @type {IEnum|IType|IService|AnyExtensionField|INamespace}
	 */
	// ^ BEWARE: VSCode hangs forever when using more than 5 types (that's why AnyExtensionField exists in the first place)

	/**
	 * Converts this namespace to a namespace descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {INamespace} Namespace descriptor
	 */
	Namespace.prototype.toJSON = function toJSON(toJSONOptions) {
	    return util.toObject([
	        "options" , this.options,
	        "nested"  , arrayToJSON(this.nestedArray, toJSONOptions)
	    ]);
	};

	/**
	 * Adds nested objects to this namespace from nested object descriptors.
	 * @param {Object.<string,AnyNestedObject>} nestedJson Any nested object descriptors
	 * @returns {Namespace} `this`
	 */
	Namespace.prototype.addJSON = function addJSON(nestedJson) {
	    var ns = this;
	    /* istanbul ignore else */
	    if (nestedJson) {
	        for (var names = Object.keys(nestedJson), i = 0, nested; i < names.length; ++i) {
	            nested = nestedJson[names[i]];
	            ns.add( // most to least likely
	                ( nested.fields !== undefined
	                ? Type.fromJSON
	                : nested.values !== undefined
	                ? Enum.fromJSON
	                : nested.methods !== undefined
	                ? Service.fromJSON
	                : nested.id !== undefined
	                ? Field.fromJSON
	                : Namespace.fromJSON )(names[i], nested)
	            );
	        }
	    }
	    return this;
	};

	/**
	 * Gets the nested object of the specified name.
	 * @param {string} name Nested object name
	 * @returns {ReflectionObject|null} The reflection object or `null` if it doesn't exist
	 */
	Namespace.prototype.get = function get(name) {
	    return this.nested && this.nested[name]
	        || null;
	};

	/**
	 * Gets the values of the nested {@link Enum|enum} of the specified name.
	 * This methods differs from {@link Namespace#get|get} in that it returns an enum's values directly and throws instead of returning `null`.
	 * @param {string} name Nested enum name
	 * @returns {Object.<string,number>} Enum values
	 * @throws {Error} If there is no such enum
	 */
	Namespace.prototype.getEnum = function getEnum(name) {
	    if (this.nested && this.nested[name] instanceof Enum)
	        return this.nested[name].values;
	    throw Error("no such enum: " + name);
	};

	/**
	 * Adds a nested object to this namespace.
	 * @param {ReflectionObject} object Nested object to add
	 * @returns {Namespace} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a nested object with this name
	 */
	Namespace.prototype.add = function add(object) {

	    if (!(object instanceof Field && object.extend !== undefined || object instanceof Type || object instanceof Enum || object instanceof Service || object instanceof Namespace || object instanceof OneOf))
	        throw TypeError("object must be a valid nested object");

	    if (!this.nested)
	        this.nested = {};
	    else {
	        var prev = this.get(object.name);
	        if (prev) {
	            if (prev instanceof Namespace && object instanceof Namespace && !(prev instanceof Type || prev instanceof Service)) {
	                // replace plain namespace but keep existing nested elements and options
	                var nested = prev.nestedArray;
	                for (var i = 0; i < nested.length; ++i)
	                    object.add(nested[i]);
	                this.remove(prev);
	                if (!this.nested)
	                    this.nested = {};
	                object.setOptions(prev.options, true);

	            } else
	                throw Error("duplicate name '" + object.name + "' in " + this);
	        }
	    }
	    this.nested[object.name] = object;
	    object.onAdd(this);
	    return clearCache(this);
	};

	/**
	 * Removes a nested object from this namespace.
	 * @param {ReflectionObject} object Nested object to remove
	 * @returns {Namespace} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `object` is not a member of this namespace
	 */
	Namespace.prototype.remove = function remove(object) {

	    if (!(object instanceof ReflectionObject))
	        throw TypeError("object must be a ReflectionObject");
	    if (object.parent !== this)
	        throw Error(object + " is not a member of " + this);

	    delete this.nested[object.name];
	    if (!Object.keys(this.nested).length)
	        this.nested = undefined;

	    object.onRemove(this);
	    return clearCache(this);
	};

	/**
	 * Defines additial namespaces within this one if not yet existing.
	 * @param {string|string[]} path Path to create
	 * @param {*} [json] Nested types to create from JSON
	 * @returns {Namespace} Pointer to the last namespace created or `this` if path is empty
	 */
	Namespace.prototype.define = function define(path, json) {

	    if (util.isString(path))
	        path = path.split(".");
	    else if (!Array.isArray(path))
	        throw TypeError("illegal path");
	    if (path && path.length && path[0] === "")
	        throw Error("path must be relative");

	    var ptr = this;
	    while (path.length > 0) {
	        var part = path.shift();
	        if (ptr.nested && ptr.nested[part]) {
	            ptr = ptr.nested[part];
	            if (!(ptr instanceof Namespace))
	                throw Error("path conflicts with non-namespace objects");
	        } else
	            ptr.add(ptr = new Namespace(part));
	    }
	    if (json)
	        ptr.addJSON(json);
	    return ptr;
	};

	/**
	 * Resolves this namespace's and all its nested objects' type references. Useful to validate a reflection tree, but comes at a cost.
	 * @returns {Namespace} `this`
	 */
	Namespace.prototype.resolveAll = function resolveAll() {
	    var nested = this.nestedArray, i = 0;
	    while (i < nested.length)
	        if (nested[i] instanceof Namespace)
	            nested[i++].resolveAll();
	        else
	            nested[i++].resolve();
	    return this.resolve();
	};

	/**
	 * Recursively looks up the reflection object matching the specified path in the scope of this namespace.
	 * @param {string|string[]} path Path to look up
	 * @param {*|Array.<*>} filterTypes Filter types, any combination of the constructors of `protobuf.Type`, `protobuf.Enum`, `protobuf.Service` etc.
	 * @param {boolean} [parentAlreadyChecked=false] If known, whether the parent has already been checked
	 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
	 */
	Namespace.prototype.lookup = function lookup(path, filterTypes, parentAlreadyChecked) {

	    /* istanbul ignore next */
	    if (typeof filterTypes === "boolean") {
	        parentAlreadyChecked = filterTypes;
	        filterTypes = undefined;
	    } else if (filterTypes && !Array.isArray(filterTypes))
	        filterTypes = [ filterTypes ];

	    if (util.isString(path) && path.length) {
	        if (path === ".")
	            return this.root;
	        path = path.split(".");
	    } else if (!path.length)
	        return this;

	    // Start at root if path is absolute
	    if (path[0] === "")
	        return this.root.lookup(path.slice(1), filterTypes);

	    // Test if the first part matches any nested object, and if so, traverse if path contains more
	    var found = this.get(path[0]);
	    if (found) {
	        if (path.length === 1) {
	            if (!filterTypes || filterTypes.indexOf(found.constructor) > -1)
	                return found;
	        } else if (found instanceof Namespace && (found = found.lookup(path.slice(1), filterTypes, true)))
	            return found;

	    // Otherwise try each nested namespace
	    } else
	        for (var i = 0; i < this.nestedArray.length; ++i)
	            if (this._nestedArray[i] instanceof Namespace && (found = this._nestedArray[i].lookup(path, filterTypes, true)))
	                return found;

	    // If there hasn't been a match, try again at the parent
	    if (this.parent === null || parentAlreadyChecked)
	        return null;
	    return this.parent.lookup(path, filterTypes);
	};

	/**
	 * Looks up the reflection object at the specified path, relative to this namespace.
	 * @name NamespaceBase#lookup
	 * @function
	 * @param {string|string[]} path Path to look up
	 * @param {boolean} [parentAlreadyChecked=false] Whether the parent has already been checked
	 * @returns {ReflectionObject|null} Looked up object or `null` if none could be found
	 * @variation 2
	 */
	// lookup(path: string, [parentAlreadyChecked: boolean])

	/**
	 * Looks up the {@link Type|type} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Type} Looked up type
	 * @throws {Error} If `path` does not point to a type
	 */
	Namespace.prototype.lookupType = function lookupType(path) {
	    var found = this.lookup(path, [ Type ]);
	    if (!found)
	        throw Error("no such type: " + path);
	    return found;
	};

	/**
	 * Looks up the values of the {@link Enum|enum} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Enum} Looked up enum
	 * @throws {Error} If `path` does not point to an enum
	 */
	Namespace.prototype.lookupEnum = function lookupEnum(path) {
	    var found = this.lookup(path, [ Enum ]);
	    if (!found)
	        throw Error("no such Enum '" + path + "' in " + this);
	    return found;
	};

	/**
	 * Looks up the {@link Type|type} or {@link Enum|enum} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Type} Looked up type or enum
	 * @throws {Error} If `path` does not point to a type or enum
	 */
	Namespace.prototype.lookupTypeOrEnum = function lookupTypeOrEnum(path) {
	    var found = this.lookup(path, [ Type, Enum ]);
	    if (!found)
	        throw Error("no such Type or Enum '" + path + "' in " + this);
	    return found;
	};

	/**
	 * Looks up the {@link Service|service} at the specified path, relative to this namespace.
	 * Besides its signature, this methods differs from {@link Namespace#lookup|lookup} in that it throws instead of returning `null`.
	 * @param {string|string[]} path Path to look up
	 * @returns {Service} Looked up service
	 * @throws {Error} If `path` does not point to a service
	 */
	Namespace.prototype.lookupService = function lookupService(path) {
	    var found = this.lookup(path, [ Service ]);
	    if (!found)
	        throw Error("no such Service '" + path + "' in " + this);
	    return found;
	};

	// Sets up cyclic dependencies (called in index-light)
	Namespace._configure = function(Type_, Service_, Enum_) {
	    Type    = Type_;
	    Service = Service_;
	    Enum    = Enum_;
	};
	return namespace;
}

var mapfield;
var hasRequiredMapfield;

function requireMapfield () {
	if (hasRequiredMapfield) return mapfield;
	hasRequiredMapfield = 1;
	mapfield = MapField;

	// extends Field
	var Field = requireField();
	((MapField.prototype = Object.create(Field.prototype)).constructor = MapField).className = "MapField";

	var types   = requireTypes(),
	    util    = requireUtil();

	/**
	 * Constructs a new map field instance.
	 * @classdesc Reflected map field.
	 * @extends FieldBase
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {number} id Unique id within its namespace
	 * @param {string} keyType Key type
	 * @param {string} type Value type
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] Comment associated with this field
	 */
	function MapField(name, id, keyType, type, options, comment) {
	    Field.call(this, name, id, type, undefined, undefined, options, comment);

	    /* istanbul ignore if */
	    if (!util.isString(keyType))
	        throw TypeError("keyType must be a string");

	    /**
	     * Key type.
	     * @type {string}
	     */
	    this.keyType = keyType; // toJSON, marker

	    /**
	     * Resolved key type if not a basic type.
	     * @type {ReflectionObject|null}
	     */
	    this.resolvedKeyType = null;

	    // Overrides Field#map
	    this.map = true;
	}

	/**
	 * Map field descriptor.
	 * @interface IMapField
	 * @extends {IField}
	 * @property {string} keyType Key type
	 */

	/**
	 * Extension map field descriptor.
	 * @interface IExtensionMapField
	 * @extends IMapField
	 * @property {string} extend Extended type
	 */

	/**
	 * Constructs a map field from a map field descriptor.
	 * @param {string} name Field name
	 * @param {IMapField} json Map field descriptor
	 * @returns {MapField} Created map field
	 * @throws {TypeError} If arguments are invalid
	 */
	MapField.fromJSON = function fromJSON(name, json) {
	    return new MapField(name, json.id, json.keyType, json.type, json.options, json.comment);
	};

	/**
	 * Converts this map field to a map field descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IMapField} Map field descriptor
	 */
	MapField.prototype.toJSON = function toJSON(toJSONOptions) {
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "keyType" , this.keyType,
	        "type"    , this.type,
	        "id"      , this.id,
	        "extend"  , this.extend,
	        "options" , this.options,
	        "comment" , keepComments ? this.comment : undefined
	    ]);
	};

	/**
	 * @override
	 */
	MapField.prototype.resolve = function resolve() {
	    if (this.resolved)
	        return this;

	    // Besides a value type, map fields have a key type that may be "any scalar type except for floating point types and bytes"
	    if (types.mapKey[this.keyType] === undefined)
	        throw Error("invalid key type: " + this.keyType);

	    return Field.prototype.resolve.call(this);
	};

	/**
	 * Map field decorator (TypeScript).
	 * @name MapField.d
	 * @function
	 * @param {number} fieldId Field id
	 * @param {"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"} fieldKeyType Field key type
	 * @param {"double"|"float"|"int32"|"uint32"|"sint32"|"fixed32"|"sfixed32"|"int64"|"uint64"|"sint64"|"fixed64"|"sfixed64"|"bool"|"string"|"bytes"|Object|Constructor<{}>} fieldValueType Field value type
	 * @returns {FieldDecorator} Decorator function
	 * @template T extends { [key: string]: number | Long | string | boolean | Uint8Array | Buffer | number[] | Message<{}> }
	 */
	MapField.d = function decorateMapField(fieldId, fieldKeyType, fieldValueType) {

	    // submessage value: decorate the submessage and use its name as the type
	    if (typeof fieldValueType === "function")
	        fieldValueType = util.decorateType(fieldValueType).name;

	    // enum reference value: create a reflected copy of the enum and keep reuseing it
	    else if (fieldValueType && typeof fieldValueType === "object")
	        fieldValueType = util.decorateEnum(fieldValueType).name;

	    return function mapFieldDecorator(prototype, fieldName) {
	        util.decorateType(prototype.constructor)
	            .add(new MapField(fieldName, fieldId, fieldKeyType, fieldValueType));
	    };
	};
	return mapfield;
}

var method;
var hasRequiredMethod;

function requireMethod () {
	if (hasRequiredMethod) return method;
	hasRequiredMethod = 1;
	method = Method;

	// extends ReflectionObject
	var ReflectionObject = requireObject();
	((Method.prototype = Object.create(ReflectionObject.prototype)).constructor = Method).className = "Method";

	var util = requireUtil();

	/**
	 * Constructs a new service method instance.
	 * @classdesc Reflected service method.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Method name
	 * @param {string|undefined} type Method type, usually `"rpc"`
	 * @param {string} requestType Request message type
	 * @param {string} responseType Response message type
	 * @param {boolean|Object.<string,*>} [requestStream] Whether the request is streamed
	 * @param {boolean|Object.<string,*>} [responseStream] Whether the response is streamed
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] The comment for this method
	 * @param {Object.<string,*>} [parsedOptions] Declared options, properly parsed into an object
	 */
	function Method(name, type, requestType, responseType, requestStream, responseStream, options, comment, parsedOptions) {

	    /* istanbul ignore next */
	    if (util.isObject(requestStream)) {
	        options = requestStream;
	        requestStream = responseStream = undefined;
	    } else if (util.isObject(responseStream)) {
	        options = responseStream;
	        responseStream = undefined;
	    }

	    /* istanbul ignore if */
	    if (!(type === undefined || util.isString(type)))
	        throw TypeError("type must be a string");

	    /* istanbul ignore if */
	    if (!util.isString(requestType))
	        throw TypeError("requestType must be a string");

	    /* istanbul ignore if */
	    if (!util.isString(responseType))
	        throw TypeError("responseType must be a string");

	    ReflectionObject.call(this, name, options);

	    /**
	     * Method type.
	     * @type {string}
	     */
	    this.type = type || "rpc"; // toJSON

	    /**
	     * Request type.
	     * @type {string}
	     */
	    this.requestType = requestType; // toJSON, marker

	    /**
	     * Whether requests are streamed or not.
	     * @type {boolean|undefined}
	     */
	    this.requestStream = requestStream ? true : undefined; // toJSON

	    /**
	     * Response type.
	     * @type {string}
	     */
	    this.responseType = responseType; // toJSON

	    /**
	     * Whether responses are streamed or not.
	     * @type {boolean|undefined}
	     */
	    this.responseStream = responseStream ? true : undefined; // toJSON

	    /**
	     * Resolved request type.
	     * @type {Type|null}
	     */
	    this.resolvedRequestType = null;

	    /**
	     * Resolved response type.
	     * @type {Type|null}
	     */
	    this.resolvedResponseType = null;

	    /**
	     * Comment for this method
	     * @type {string|null}
	     */
	    this.comment = comment;

	    /**
	     * Options properly parsed into an object
	     */
	    this.parsedOptions = parsedOptions;
	}

	/**
	 * Method descriptor.
	 * @interface IMethod
	 * @property {string} [type="rpc"] Method type
	 * @property {string} requestType Request type
	 * @property {string} responseType Response type
	 * @property {boolean} [requestStream=false] Whether requests are streamed
	 * @property {boolean} [responseStream=false] Whether responses are streamed
	 * @property {Object.<string,*>} [options] Method options
	 * @property {string} comment Method comments
	 * @property {Object.<string,*>} [parsedOptions] Method options properly parsed into an object
	 */

	/**
	 * Constructs a method from a method descriptor.
	 * @param {string} name Method name
	 * @param {IMethod} json Method descriptor
	 * @returns {Method} Created method
	 * @throws {TypeError} If arguments are invalid
	 */
	Method.fromJSON = function fromJSON(name, json) {
	    return new Method(name, json.type, json.requestType, json.responseType, json.requestStream, json.responseStream, json.options, json.comment, json.parsedOptions);
	};

	/**
	 * Converts this method to a method descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IMethod} Method descriptor
	 */
	Method.prototype.toJSON = function toJSON(toJSONOptions) {
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "type"           , this.type !== "rpc" && /* istanbul ignore next */ this.type || undefined,
	        "requestType"    , this.requestType,
	        "requestStream"  , this.requestStream,
	        "responseType"   , this.responseType,
	        "responseStream" , this.responseStream,
	        "options"        , this.options,
	        "comment"        , keepComments ? this.comment : undefined,
	        "parsedOptions"  , this.parsedOptions,
	    ]);
	};

	/**
	 * @override
	 */
	Method.prototype.resolve = function resolve() {

	    /* istanbul ignore if */
	    if (this.resolved)
	        return this;

	    this.resolvedRequestType = this.parent.lookupType(this.requestType);
	    this.resolvedResponseType = this.parent.lookupType(this.responseType);

	    return ReflectionObject.prototype.resolve.call(this);
	};
	return method;
}

var service;
var hasRequiredService;

function requireService () {
	if (hasRequiredService) return service;
	hasRequiredService = 1;
	service = Service;

	// extends Namespace
	var Namespace = requireNamespace();
	((Service.prototype = Object.create(Namespace.prototype)).constructor = Service).className = "Service";

	var Method = requireMethod(),
	    util   = requireUtil(),
	    rpc$1    = rpc;

	/**
	 * Constructs a new service instance.
	 * @classdesc Reflected service.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Service name
	 * @param {Object.<string,*>} [options] Service options
	 * @throws {TypeError} If arguments are invalid
	 */
	function Service(name, options) {
	    Namespace.call(this, name, options);

	    /**
	     * Service methods.
	     * @type {Object.<string,Method>}
	     */
	    this.methods = {}; // toJSON, marker

	    /**
	     * Cached methods as an array.
	     * @type {Method[]|null}
	     * @private
	     */
	    this._methodsArray = null;
	}

	/**
	 * Service descriptor.
	 * @interface IService
	 * @extends INamespace
	 * @property {Object.<string,IMethod>} methods Method descriptors
	 */

	/**
	 * Constructs a service from a service descriptor.
	 * @param {string} name Service name
	 * @param {IService} json Service descriptor
	 * @returns {Service} Created service
	 * @throws {TypeError} If arguments are invalid
	 */
	Service.fromJSON = function fromJSON(name, json) {
	    var service = new Service(name, json.options);
	    /* istanbul ignore else */
	    if (json.methods)
	        for (var names = Object.keys(json.methods), i = 0; i < names.length; ++i)
	            service.add(Method.fromJSON(names[i], json.methods[names[i]]));
	    if (json.nested)
	        service.addJSON(json.nested);
	    service.comment = json.comment;
	    return service;
	};

	/**
	 * Converts this service to a service descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IService} Service descriptor
	 */
	Service.prototype.toJSON = function toJSON(toJSONOptions) {
	    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "options" , inherited && inherited.options || undefined,
	        "methods" , Namespace.arrayToJSON(this.methodsArray, toJSONOptions) || /* istanbul ignore next */ {},
	        "nested"  , inherited && inherited.nested || undefined,
	        "comment" , keepComments ? this.comment : undefined
	    ]);
	};

	/**
	 * Methods of this service as an array for iteration.
	 * @name Service#methodsArray
	 * @type {Method[]}
	 * @readonly
	 */
	Object.defineProperty(Service.prototype, "methodsArray", {
	    get: function() {
	        return this._methodsArray || (this._methodsArray = util.toArray(this.methods));
	    }
	});

	function clearCache(service) {
	    service._methodsArray = null;
	    return service;
	}

	/**
	 * @override
	 */
	Service.prototype.get = function get(name) {
	    return this.methods[name]
	        || Namespace.prototype.get.call(this, name);
	};

	/**
	 * @override
	 */
	Service.prototype.resolveAll = function resolveAll() {
	    var methods = this.methodsArray;
	    for (var i = 0; i < methods.length; ++i)
	        methods[i].resolve();
	    return Namespace.prototype.resolve.call(this);
	};

	/**
	 * @override
	 */
	Service.prototype.add = function add(object) {

	    /* istanbul ignore if */
	    if (this.get(object.name))
	        throw Error("duplicate name '" + object.name + "' in " + this);

	    if (object instanceof Method) {
	        this.methods[object.name] = object;
	        object.parent = this;
	        return clearCache(this);
	    }
	    return Namespace.prototype.add.call(this, object);
	};

	/**
	 * @override
	 */
	Service.prototype.remove = function remove(object) {
	    if (object instanceof Method) {

	        /* istanbul ignore if */
	        if (this.methods[object.name] !== object)
	            throw Error(object + " is not a member of " + this);

	        delete this.methods[object.name];
	        object.parent = null;
	        return clearCache(this);
	    }
	    return Namespace.prototype.remove.call(this, object);
	};

	/**
	 * Creates a runtime service using the specified rpc implementation.
	 * @param {RPCImpl} rpcImpl RPC implementation
	 * @param {boolean} [requestDelimited=false] Whether requests are length-delimited
	 * @param {boolean} [responseDelimited=false] Whether responses are length-delimited
	 * @returns {rpc.Service} RPC service. Useful where requests and/or responses are streamed.
	 */
	Service.prototype.create = function create(rpcImpl, requestDelimited, responseDelimited) {
	    var rpcService = new rpc$1.Service(rpcImpl, requestDelimited, responseDelimited);
	    for (var i = 0, method; i < /* initializes */ this.methodsArray.length; ++i) {
	        var methodName = util.lcFirst((method = this._methodsArray[i]).resolve().name).replace(/[^$\w_]/g, "");
	        rpcService[methodName] = util.codegen(["r","c"], util.isReserved(methodName) ? methodName + "_" : methodName)("return this.rpcCall(m,q,s,r,c)")({
	            m: method,
	            q: method.resolvedRequestType.ctor,
	            s: method.resolvedResponseType.ctor
	        });
	    }
	    return rpcService;
	};
	return service;
}

var message = Message;

var util$2 = requireMinimal();

/**
 * Constructs a new message instance.
 * @classdesc Abstract runtime message.
 * @constructor
 * @param {Properties<T>} [properties] Properties to set
 * @template T extends object = object
 */
function Message(properties) {
    // not used internally
    if (properties)
        for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
            this[keys[i]] = properties[keys[i]];
}

/**
 * Reference to the reflected type.
 * @name Message.$type
 * @type {Type}
 * @readonly
 */

/**
 * Reference to the reflected type.
 * @name Message#$type
 * @type {Type}
 * @readonly
 */

/*eslint-disable valid-jsdoc*/

/**
 * Creates a new message of this type using the specified properties.
 * @param {Object.<string,*>} [properties] Properties to set
 * @returns {Message<T>} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.create = function create(properties) {
    return this.$type.create(properties);
};

/**
 * Encodes a message of this type.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.encode = function encode(message, writer) {
    return this.$type.encode(message, writer);
};

/**
 * Encodes a message of this type preceeded by its length as a varint.
 * @param {T|Object.<string,*>} message Message to encode
 * @param {Writer} [writer] Writer to use
 * @returns {Writer} Writer
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.encodeDelimited = function encodeDelimited(message, writer) {
    return this.$type.encodeDelimited(message, writer);
};

/**
 * Decodes a message of this type.
 * @name Message.decode
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.decode = function decode(reader) {
    return this.$type.decode(reader);
};

/**
 * Decodes a message of this type preceeded by its length as a varint.
 * @name Message.decodeDelimited
 * @function
 * @param {Reader|Uint8Array} reader Reader or buffer to decode
 * @returns {T} Decoded message
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.decodeDelimited = function decodeDelimited(reader) {
    return this.$type.decodeDelimited(reader);
};

/**
 * Verifies a message of this type.
 * @name Message.verify
 * @function
 * @param {Object.<string,*>} message Plain object to verify
 * @returns {string|null} `null` if valid, otherwise the reason why it is not
 */
Message.verify = function verify(message) {
    return this.$type.verify(message);
};

/**
 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
 * @param {Object.<string,*>} object Plain object
 * @returns {T} Message instance
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.fromObject = function fromObject(object) {
    return this.$type.fromObject(object);
};

/**
 * Creates a plain object from a message of this type. Also converts values to other types if specified.
 * @param {T} message Message instance
 * @param {IConversionOptions} [options] Conversion options
 * @returns {Object.<string,*>} Plain object
 * @template T extends Message<T>
 * @this Constructor<T>
 */
Message.toObject = function toObject(message, options) {
    return this.$type.toObject(message, options);
};

/**
 * Converts this message to JSON.
 * @returns {Object.<string,*>} JSON object
 */
Message.prototype.toJSON = function toJSON() {
    return this.$type.toObject(this, util$2.toJSONOptions);
};

var decoder_1;
var hasRequiredDecoder;

function requireDecoder () {
	if (hasRequiredDecoder) return decoder_1;
	hasRequiredDecoder = 1;
	decoder_1 = decoder;

	var Enum    = require_enum(),
	    types   = requireTypes(),
	    util    = requireUtil();

	function missing(field) {
	    return "missing required '" + field.name + "'";
	}

	/**
	 * Generates a decoder specific to the specified message type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	function decoder(mtype) {
	    /* eslint-disable no-unexpected-multiline */
	    var gen = util.codegen(["r", "l"], mtype.name + "$decode")
	    ("if(!(r instanceof Reader))")
	        ("r=Reader.create(r)")
	    ("var c=l===undefined?r.len:r.pos+l,m=new this.ctor" + (mtype.fieldsArray.filter(function(field) { return field.map; }).length ? ",k,value" : ""))
	    ("while(r.pos<c){")
	        ("var t=r.uint32()");
	    if (mtype.group) gen
	        ("if((t&7)===4)")
	            ("break");
	    gen
	        ("switch(t>>>3){");

	    var i = 0;
	    for (; i < /* initializes */ mtype.fieldsArray.length; ++i) {
	        var field = mtype._fieldsArray[i].resolve(),
	            type  = field.resolvedType instanceof Enum ? "int32" : field.type,
	            ref   = "m" + util.safeProp(field.name); gen
	            ("case %i:", field.id);

	        // Map fields
	        if (field.map) { gen
	                ("if(%s===util.emptyObject)", ref)
	                    ("%s={}", ref)
	                ("var c2 = r.uint32()+r.pos");

	            if (types.defaults[field.keyType] !== undefined) gen
	                ("k=%j", types.defaults[field.keyType]);
	            else gen
	                ("k=null");

	            if (types.defaults[type] !== undefined) gen
	                ("value=%j", types.defaults[type]);
	            else gen
	                ("value=null");

	            gen
	                ("while(r.pos<c2){")
	                    ("var tag2=r.uint32()")
	                    ("switch(tag2>>>3){")
	                        ("case 1: k=r.%s(); break", field.keyType)
	                        ("case 2:");

	            if (types.basic[type] === undefined) gen
	                            ("value=types[%i].decode(r,r.uint32())", i); // can't be groups
	            else gen
	                            ("value=r.%s()", type);

	            gen
	                            ("break")
	                        ("default:")
	                            ("r.skipType(tag2&7)")
	                            ("break")
	                    ("}")
	                ("}");

	            if (types.long[field.keyType] !== undefined) gen
	                ("%s[typeof k===\"object\"?util.longToHash(k):k]=value", ref);
	            else gen
	                ("%s[k]=value", ref);

	        // Repeated fields
	        } else if (field.repeated) { gen

	                ("if(!(%s&&%s.length))", ref, ref)
	                    ("%s=[]", ref);

	            // Packable (always check for forward and backward compatiblity)
	            if (types.packed[type] !== undefined) gen
	                ("if((t&7)===2){")
	                    ("var c2=r.uint32()+r.pos")
	                    ("while(r.pos<c2)")
	                        ("%s.push(r.%s())", ref, type)
	                ("}else");

	            // Non-packed
	            if (types.basic[type] === undefined) gen(field.resolvedType.group
	                    ? "%s.push(types[%i].decode(r))"
	                    : "%s.push(types[%i].decode(r,r.uint32()))", ref, i);
	            else gen
	                    ("%s.push(r.%s())", ref, type);

	        // Non-repeated
	        } else if (types.basic[type] === undefined) gen(field.resolvedType.group
	                ? "%s=types[%i].decode(r)"
	                : "%s=types[%i].decode(r,r.uint32())", ref, i);
	        else gen
	                ("%s=r.%s()", ref, type);
	        gen
	                ("break");
	    // Unknown fields
	    } gen
	            ("default:")
	                ("r.skipType(t&7)")
	                ("break")

	        ("}")
	    ("}");

	    // Field presence
	    for (i = 0; i < mtype._fieldsArray.length; ++i) {
	        var rfield = mtype._fieldsArray[i];
	        if (rfield.required) gen
	    ("if(!m.hasOwnProperty(%j))", rfield.name)
	        ("throw util.ProtocolError(%j,{instance:m})", missing(rfield));
	    }

	    return gen
	    ("return m");
	    /* eslint-enable no-unexpected-multiline */
	}
	return decoder_1;
}

var verifier_1 = verifier;

var Enum$1      = require_enum(),
    util$1      = requireUtil();

function invalid(field, expected) {
    return field.name + ": " + expected + (field.repeated && expected !== "array" ? "[]" : field.map && expected !== "object" ? "{k:"+field.keyType+"}" : "") + " expected";
}

/**
 * Generates a partial value verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {number} fieldIndex Field index
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genVerifyValue(gen, field, fieldIndex, ref) {
    /* eslint-disable no-unexpected-multiline */
    if (field.resolvedType) {
        if (field.resolvedType instanceof Enum$1) { gen
            ("switch(%s){", ref)
                ("default:")
                    ("return%j", invalid(field, "enum value"));
            for (var keys = Object.keys(field.resolvedType.values), j = 0; j < keys.length; ++j) gen
                ("case %i:", field.resolvedType.values[keys[j]]);
            gen
                    ("break")
            ("}");
        } else {
            gen
            ("{")
                ("var e=types[%i].verify(%s);", fieldIndex, ref)
                ("if(e)")
                    ("return%j+e", field.name + ".")
            ("}");
        }
    } else {
        switch (field.type) {
            case "int32":
            case "uint32":
            case "sint32":
            case "fixed32":
            case "sfixed32": gen
                ("if(!util.isInteger(%s))", ref)
                    ("return%j", invalid(field, "integer"));
                break;
            case "int64":
            case "uint64":
            case "sint64":
            case "fixed64":
            case "sfixed64": gen
                ("if(!util.isInteger(%s)&&!(%s&&util.isInteger(%s.low)&&util.isInteger(%s.high)))", ref, ref, ref, ref)
                    ("return%j", invalid(field, "integer|Long"));
                break;
            case "float":
            case "double": gen
                ("if(typeof %s!==\"number\")", ref)
                    ("return%j", invalid(field, "number"));
                break;
            case "bool": gen
                ("if(typeof %s!==\"boolean\")", ref)
                    ("return%j", invalid(field, "boolean"));
                break;
            case "string": gen
                ("if(!util.isString(%s))", ref)
                    ("return%j", invalid(field, "string"));
                break;
            case "bytes": gen
                ("if(!(%s&&typeof %s.length===\"number\"||util.isString(%s)))", ref, ref, ref)
                    ("return%j", invalid(field, "buffer"));
                break;
        }
    }
    return gen;
    /* eslint-enable no-unexpected-multiline */
}

/**
 * Generates a partial key verifier.
 * @param {Codegen} gen Codegen instance
 * @param {Field} field Reflected field
 * @param {string} ref Variable reference
 * @returns {Codegen} Codegen instance
 * @ignore
 */
function genVerifyKey(gen, field, ref) {
    /* eslint-disable no-unexpected-multiline */
    switch (field.keyType) {
        case "int32":
        case "uint32":
        case "sint32":
        case "fixed32":
        case "sfixed32": gen
            ("if(!util.key32Re.test(%s))", ref)
                ("return%j", invalid(field, "integer key"));
            break;
        case "int64":
        case "uint64":
        case "sint64":
        case "fixed64":
        case "sfixed64": gen
            ("if(!util.key64Re.test(%s))", ref) // see comment above: x is ok, d is not
                ("return%j", invalid(field, "integer|Long key"));
            break;
        case "bool": gen
            ("if(!util.key2Re.test(%s))", ref)
                ("return%j", invalid(field, "boolean key"));
            break;
    }
    return gen;
    /* eslint-enable no-unexpected-multiline */
}

/**
 * Generates a verifier specific to the specified message type.
 * @param {Type} mtype Message type
 * @returns {Codegen} Codegen instance
 */
function verifier(mtype) {
    /* eslint-disable no-unexpected-multiline */

    var gen = util$1.codegen(["m"], mtype.name + "$verify")
    ("if(typeof m!==\"object\"||m===null)")
        ("return%j", "object expected");
    var oneofs = mtype.oneofsArray,
        seenFirstField = {};
    if (oneofs.length) gen
    ("var p={}");

    for (var i = 0; i < /* initializes */ mtype.fieldsArray.length; ++i) {
        var field = mtype._fieldsArray[i].resolve(),
            ref   = "m" + util$1.safeProp(field.name);

        if (field.optional) gen
        ("if(%s!=null&&m.hasOwnProperty(%j)){", ref, field.name); // !== undefined && !== null

        // map fields
        if (field.map) { gen
            ("if(!util.isObject(%s))", ref)
                ("return%j", invalid(field, "object"))
            ("var k=Object.keys(%s)", ref)
            ("for(var i=0;i<k.length;++i){");
                genVerifyKey(gen, field, "k[i]");
                genVerifyValue(gen, field, i, ref + "[k[i]]")
            ("}");

        // repeated fields
        } else if (field.repeated) { gen
            ("if(!Array.isArray(%s))", ref)
                ("return%j", invalid(field, "array"))
            ("for(var i=0;i<%s.length;++i){", ref);
                genVerifyValue(gen, field, i, ref + "[i]")
            ("}");

        // required or present fields
        } else {
            if (field.partOf) {
                var oneofProp = util$1.safeProp(field.partOf.name);
                if (seenFirstField[field.partOf.name] === 1) gen
            ("if(p%s===1)", oneofProp)
                ("return%j", field.partOf.name + ": multiple values");
                seenFirstField[field.partOf.name] = 1;
                gen
            ("p%s=1", oneofProp);
            }
            genVerifyValue(gen, field, i, ref);
        }
        if (field.optional) gen
        ("}");
    }
    return gen
    ("return null");
    /* eslint-enable no-unexpected-multiline */
}

var converter = {};

var hasRequiredConverter;

function requireConverter () {
	if (hasRequiredConverter) return converter;
	hasRequiredConverter = 1;
	(function (exports) {
		/**
		 * Runtime message from/to plain object converters.
		 * @namespace
		 */
		var converter = exports;

		var Enum = require_enum(),
		    util = requireUtil();

		/**
		 * Generates a partial value fromObject conveter.
		 * @param {Codegen} gen Codegen instance
		 * @param {Field} field Reflected field
		 * @param {number} fieldIndex Field index
		 * @param {string} prop Property reference
		 * @returns {Codegen} Codegen instance
		 * @ignore
		 */
		function genValuePartial_fromObject(gen, field, fieldIndex, prop) {
		    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
		    if (field.resolvedType) {
		        if (field.resolvedType instanceof Enum) { gen
		            ("switch(d%s){", prop);
		            for (var values = field.resolvedType.values, keys = Object.keys(values), i = 0; i < keys.length; ++i) {
		                if (field.repeated && values[keys[i]] === field.typeDefault) gen
		                ("default:");
		                gen
		                ("case%j:", keys[i])
		                ("case %i:", values[keys[i]])
		                    ("m%s=%j", prop, values[keys[i]])
		                    ("break");
		            } gen
		            ("}");
		        } else gen
		            ("if(typeof d%s!==\"object\")", prop)
		                ("throw TypeError(%j)", field.fullName + ": object expected")
		            ("m%s=types[%i].fromObject(d%s)", prop, fieldIndex, prop);
		    } else {
		        var isUnsigned = false;
		        switch (field.type) {
		            case "double":
		            case "float": gen
		                ("m%s=Number(d%s)", prop, prop); // also catches "NaN", "Infinity"
		                break;
		            case "uint32":
		            case "fixed32": gen
		                ("m%s=d%s>>>0", prop, prop);
		                break;
		            case "int32":
		            case "sint32":
		            case "sfixed32": gen
		                ("m%s=d%s|0", prop, prop);
		                break;
		            case "uint64":
		                isUnsigned = true;
		                // eslint-disable-line no-fallthrough
		            case "int64":
		            case "sint64":
		            case "fixed64":
		            case "sfixed64": gen
		                ("if(util.Long)")
		                    ("(m%s=util.Long.fromValue(d%s)).unsigned=%j", prop, prop, isUnsigned)
		                ("else if(typeof d%s===\"string\")", prop)
		                    ("m%s=parseInt(d%s,10)", prop, prop)
		                ("else if(typeof d%s===\"number\")", prop)
		                    ("m%s=d%s", prop, prop)
		                ("else if(typeof d%s===\"object\")", prop)
		                    ("m%s=new util.LongBits(d%s.low>>>0,d%s.high>>>0).toNumber(%s)", prop, prop, prop, isUnsigned ? "true" : "");
		                break;
		            case "bytes": gen
		                ("if(typeof d%s===\"string\")", prop)
		                    ("util.base64.decode(d%s,m%s=util.newBuffer(util.base64.length(d%s)),0)", prop, prop, prop)
		                ("else if(d%s.length)", prop)
		                    ("m%s=d%s", prop, prop);
		                break;
		            case "string": gen
		                ("m%s=String(d%s)", prop, prop);
		                break;
		            case "bool": gen
		                ("m%s=Boolean(d%s)", prop, prop);
		                break;
		            /* default: gen
		                ("m%s=d%s", prop, prop);
		                break; */
		        }
		    }
		    return gen;
		    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}

		/**
		 * Generates a plain object to runtime message converter specific to the specified message type.
		 * @param {Type} mtype Message type
		 * @returns {Codegen} Codegen instance
		 */
		converter.fromObject = function fromObject(mtype) {
		    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
		    var fields = mtype.fieldsArray;
		    var gen = util.codegen(["d"], mtype.name + "$fromObject")
		    ("if(d instanceof this.ctor)")
		        ("return d");
		    if (!fields.length) return gen
		    ("return new this.ctor");
		    gen
		    ("var m=new this.ctor");
		    for (var i = 0; i < fields.length; ++i) {
		        var field  = fields[i].resolve(),
		            prop   = util.safeProp(field.name);

		        // Map fields
		        if (field.map) { gen
		    ("if(d%s){", prop)
		        ("if(typeof d%s!==\"object\")", prop)
		            ("throw TypeError(%j)", field.fullName + ": object expected")
		        ("m%s={}", prop)
		        ("for(var ks=Object.keys(d%s),i=0;i<ks.length;++i){", prop);
		            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[ks[i]]")
		        ("}")
		    ("}");

		        // Repeated fields
		        } else if (field.repeated) { gen
		    ("if(d%s){", prop)
		        ("if(!Array.isArray(d%s))", prop)
		            ("throw TypeError(%j)", field.fullName + ": array expected")
		        ("m%s=[]", prop)
		        ("for(var i=0;i<d%s.length;++i){", prop);
		            genValuePartial_fromObject(gen, field, /* not sorted */ i, prop + "[i]")
		        ("}")
		    ("}");

		        // Non-repeated fields
		        } else {
		            if (!(field.resolvedType instanceof Enum)) gen // no need to test for null/undefined if an enum (uses switch)
		    ("if(d%s!=null){", prop); // !== undefined && !== null
		        genValuePartial_fromObject(gen, field, /* not sorted */ i, prop);
		            if (!(field.resolvedType instanceof Enum)) gen
		    ("}");
		        }
		    } return gen
		    ("return m");
		    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		};

		/**
		 * Generates a partial value toObject converter.
		 * @param {Codegen} gen Codegen instance
		 * @param {Field} field Reflected field
		 * @param {number} fieldIndex Field index
		 * @param {string} prop Property reference
		 * @returns {Codegen} Codegen instance
		 * @ignore
		 */
		function genValuePartial_toObject(gen, field, fieldIndex, prop) {
		    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
		    if (field.resolvedType) {
		        if (field.resolvedType instanceof Enum) gen
		            ("d%s=o.enums===String?types[%i].values[m%s]:m%s", prop, fieldIndex, prop, prop);
		        else gen
		            ("d%s=types[%i].toObject(m%s,o)", prop, fieldIndex, prop);
		    } else {
		        var isUnsigned = false;
		        switch (field.type) {
		            case "double":
		            case "float": gen
		            ("d%s=o.json&&!isFinite(m%s)?String(m%s):m%s", prop, prop, prop, prop);
		                break;
		            case "uint64":
		                isUnsigned = true;
		                // eslint-disable-line no-fallthrough
		            case "int64":
		            case "sint64":
		            case "fixed64":
		            case "sfixed64": gen
		            ("if(typeof m%s===\"number\")", prop)
		                ("d%s=o.longs===String?String(m%s):m%s", prop, prop, prop)
		            ("else") // Long-like
		                ("d%s=o.longs===String?util.Long.prototype.toString.call(m%s):o.longs===Number?new util.LongBits(m%s.low>>>0,m%s.high>>>0).toNumber(%s):m%s", prop, prop, prop, prop, isUnsigned ? "true": "", prop);
		                break;
		            case "bytes": gen
		            ("d%s=o.bytes===String?util.base64.encode(m%s,0,m%s.length):o.bytes===Array?Array.prototype.slice.call(m%s):m%s", prop, prop, prop, prop, prop);
		                break;
		            default: gen
		            ("d%s=m%s", prop, prop);
		                break;
		        }
		    }
		    return gen;
		    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		}

		/**
		 * Generates a runtime message to plain object converter specific to the specified message type.
		 * @param {Type} mtype Message type
		 * @returns {Codegen} Codegen instance
		 */
		converter.toObject = function toObject(mtype) {
		    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
		    var fields = mtype.fieldsArray.slice().sort(util.compareFieldsById);
		    if (!fields.length)
		        return util.codegen()("return {}");
		    var gen = util.codegen(["m", "o"], mtype.name + "$toObject")
		    ("if(!o)")
		        ("o={}")
		    ("var d={}");

		    var repeatedFields = [],
		        mapFields = [],
		        normalFields = [],
		        i = 0;
		    for (; i < fields.length; ++i)
		        if (!fields[i].partOf)
		            ( fields[i].resolve().repeated ? repeatedFields
		            : fields[i].map ? mapFields
		            : normalFields).push(fields[i]);

		    if (repeatedFields.length) { gen
		    ("if(o.arrays||o.defaults){");
		        for (i = 0; i < repeatedFields.length; ++i) gen
		        ("d%s=[]", util.safeProp(repeatedFields[i].name));
		        gen
		    ("}");
		    }

		    if (mapFields.length) { gen
		    ("if(o.objects||o.defaults){");
		        for (i = 0; i < mapFields.length; ++i) gen
		        ("d%s={}", util.safeProp(mapFields[i].name));
		        gen
		    ("}");
		    }

		    if (normalFields.length) { gen
		    ("if(o.defaults){");
		        for (i = 0; i < normalFields.length; ++i) {
		            var field = normalFields[i],
		                prop  = util.safeProp(field.name);
		            if (field.resolvedType instanceof Enum) gen
		        ("d%s=o.enums===String?%j:%j", prop, field.resolvedType.valuesById[field.typeDefault], field.typeDefault);
		            else if (field.long) gen
		        ("if(util.Long){")
		            ("var n=new util.Long(%i,%i,%j)", field.typeDefault.low, field.typeDefault.high, field.typeDefault.unsigned)
		            ("d%s=o.longs===String?n.toString():o.longs===Number?n.toNumber():n", prop)
		        ("}else")
		            ("d%s=o.longs===String?%j:%i", prop, field.typeDefault.toString(), field.typeDefault.toNumber());
		            else if (field.bytes) {
		                var arrayDefault = "[" + Array.prototype.slice.call(field.typeDefault).join(",") + "]";
		                gen
		        ("if(o.bytes===String)d%s=%j", prop, String.fromCharCode.apply(String, field.typeDefault))
		        ("else{")
		            ("d%s=%s", prop, arrayDefault)
		            ("if(o.bytes!==Array)d%s=util.newBuffer(d%s)", prop, prop)
		        ("}");
		            } else gen
		        ("d%s=%j", prop, field.typeDefault); // also messages (=null)
		        } gen
		    ("}");
		    }
		    var hasKs2 = false;
		    for (i = 0; i < fields.length; ++i) {
		        var field = fields[i],
		            index = mtype._fieldsArray.indexOf(field),
		            prop  = util.safeProp(field.name);
		        if (field.map) {
		            if (!hasKs2) { hasKs2 = true; gen
		    ("var ks2");
		            } gen
		    ("if(m%s&&(ks2=Object.keys(m%s)).length){", prop, prop)
		        ("d%s={}", prop)
		        ("for(var j=0;j<ks2.length;++j){");
		            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[ks2[j]]")
		        ("}");
		        } else if (field.repeated) { gen
		    ("if(m%s&&m%s.length){", prop, prop)
		        ("d%s=[]", prop)
		        ("for(var j=0;j<m%s.length;++j){", prop);
		            genValuePartial_toObject(gen, field, /* sorted */ index, prop + "[j]")
		        ("}");
		        } else { gen
		    ("if(m%s!=null&&m.hasOwnProperty(%j)){", prop, field.name); // !== undefined && !== null
		        genValuePartial_toObject(gen, field, /* sorted */ index, prop);
		        if (field.partOf) gen
		        ("if(o.oneofs)")
		            ("d%s=%j", util.safeProp(field.partOf.name), field.name);
		        }
		        gen
		    ("}");
		    }
		    return gen
		    ("return d");
		    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
		};
} (converter));
	return converter;
}

var wrappers = {};

(function (exports) {

	/**
	 * Wrappers for common types.
	 * @type {Object.<string,IWrapper>}
	 * @const
	 */
	var wrappers = exports;

	var Message = message;

	/**
	 * From object converter part of an {@link IWrapper}.
	 * @typedef WrapperFromObjectConverter
	 * @type {function}
	 * @param {Object.<string,*>} object Plain object
	 * @returns {Message<{}>} Message instance
	 * @this Type
	 */

	/**
	 * To object converter part of an {@link IWrapper}.
	 * @typedef WrapperToObjectConverter
	 * @type {function}
	 * @param {Message<{}>} message Message instance
	 * @param {IConversionOptions} [options] Conversion options
	 * @returns {Object.<string,*>} Plain object
	 * @this Type
	 */

	/**
	 * Common type wrapper part of {@link wrappers}.
	 * @interface IWrapper
	 * @property {WrapperFromObjectConverter} [fromObject] From object converter
	 * @property {WrapperToObjectConverter} [toObject] To object converter
	 */

	// Custom wrapper for Any
	wrappers[".google.protobuf.Any"] = {

	    fromObject: function(object) {

	        // unwrap value type if mapped
	        if (object && object["@type"]) {
	             // Only use fully qualified type name after the last '/'
	            var name = object["@type"].substring(object["@type"].lastIndexOf("/") + 1);
	            var type = this.lookup(name);
	            /* istanbul ignore else */
	            if (type) {
	                // type_url does not accept leading "."
	                var type_url = object["@type"].charAt(0) === "." ?
	                    object["@type"].substr(1) : object["@type"];
	                // type_url prefix is optional, but path seperator is required
	                if (type_url.indexOf("/") === -1) {
	                    type_url = "/" + type_url;
	                }
	                return this.create({
	                    type_url: type_url,
	                    value: type.encode(type.fromObject(object)).finish()
	                });
	            }
	        }

	        return this.fromObject(object);
	    },

	    toObject: function(message, options) {

	        // Default prefix
	        var googleApi = "type.googleapis.com/";
	        var prefix = "";
	        var name = "";

	        // decode value if requested and unmapped
	        if (options && options.json && message.type_url && message.value) {
	            // Only use fully qualified type name after the last '/'
	            name = message.type_url.substring(message.type_url.lastIndexOf("/") + 1);
	            // Separate the prefix used
	            prefix = message.type_url.substring(0, message.type_url.lastIndexOf("/") + 1);
	            var type = this.lookup(name);
	            /* istanbul ignore else */
	            if (type)
	                message = type.decode(message.value);
	        }

	        // wrap value if unmapped
	        if (!(message instanceof this.ctor) && message instanceof Message) {
	            var object = message.$type.toObject(message, options);
	            var messageName = message.$type.fullName[0] === "." ?
	                message.$type.fullName.substr(1) : message.$type.fullName;
	            // Default to type.googleapis.com prefix if no prefix is used
	            if (prefix === "") {
	                prefix = googleApi;
	            }
	            name = prefix + messageName;
	            object["@type"] = name;
	            return object;
	        }

	        return this.toObject(message, options);
	    }
	};
} (wrappers));

var type;
var hasRequiredType;

function requireType () {
	if (hasRequiredType) return type;
	hasRequiredType = 1;
	type = Type;

	// extends Namespace
	var Namespace = requireNamespace();
	((Type.prototype = Object.create(Namespace.prototype)).constructor = Type).className = "Type";

	var Enum      = require_enum(),
	    OneOf     = requireOneof(),
	    Field     = requireField(),
	    MapField  = requireMapfield(),
	    Service   = requireService(),
	    Message   = message,
	    Reader    = reader,
	    Writer    = writer,
	    util      = requireUtil(),
	    encoder   = requireEncoder(),
	    decoder   = requireDecoder(),
	    verifier  = verifier_1,
	    converter = requireConverter(),
	    wrappers$1  = wrappers;

	/**
	 * Constructs a new reflected message type instance.
	 * @classdesc Reflected message type.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {string} name Message name
	 * @param {Object.<string,*>} [options] Declared options
	 */
	function Type(name, options) {
	    Namespace.call(this, name, options);

	    /**
	     * Message fields.
	     * @type {Object.<string,Field>}
	     */
	    this.fields = {};  // toJSON, marker

	    /**
	     * Oneofs declared within this namespace, if any.
	     * @type {Object.<string,OneOf>}
	     */
	    this.oneofs = undefined; // toJSON

	    /**
	     * Extension ranges, if any.
	     * @type {number[][]}
	     */
	    this.extensions = undefined; // toJSON

	    /**
	     * Reserved ranges, if any.
	     * @type {Array.<number[]|string>}
	     */
	    this.reserved = undefined; // toJSON

	    /*?
	     * Whether this type is a legacy group.
	     * @type {boolean|undefined}
	     */
	    this.group = undefined; // toJSON

	    /**
	     * Cached fields by id.
	     * @type {Object.<number,Field>|null}
	     * @private
	     */
	    this._fieldsById = null;

	    /**
	     * Cached fields as an array.
	     * @type {Field[]|null}
	     * @private
	     */
	    this._fieldsArray = null;

	    /**
	     * Cached oneofs as an array.
	     * @type {OneOf[]|null}
	     * @private
	     */
	    this._oneofsArray = null;

	    /**
	     * Cached constructor.
	     * @type {Constructor<{}>}
	     * @private
	     */
	    this._ctor = null;
	}

	Object.defineProperties(Type.prototype, {

	    /**
	     * Message fields by id.
	     * @name Type#fieldsById
	     * @type {Object.<number,Field>}
	     * @readonly
	     */
	    fieldsById: {
	        get: function() {

	            /* istanbul ignore if */
	            if (this._fieldsById)
	                return this._fieldsById;

	            this._fieldsById = {};
	            for (var names = Object.keys(this.fields), i = 0; i < names.length; ++i) {
	                var field = this.fields[names[i]],
	                    id = field.id;

	                /* istanbul ignore if */
	                if (this._fieldsById[id])
	                    throw Error("duplicate id " + id + " in " + this);

	                this._fieldsById[id] = field;
	            }
	            return this._fieldsById;
	        }
	    },

	    /**
	     * Fields of this message as an array for iteration.
	     * @name Type#fieldsArray
	     * @type {Field[]}
	     * @readonly
	     */
	    fieldsArray: {
	        get: function() {
	            return this._fieldsArray || (this._fieldsArray = util.toArray(this.fields));
	        }
	    },

	    /**
	     * Oneofs of this message as an array for iteration.
	     * @name Type#oneofsArray
	     * @type {OneOf[]}
	     * @readonly
	     */
	    oneofsArray: {
	        get: function() {
	            return this._oneofsArray || (this._oneofsArray = util.toArray(this.oneofs));
	        }
	    },

	    /**
	     * The registered constructor, if any registered, otherwise a generic constructor.
	     * Assigning a function replaces the internal constructor. If the function does not extend {@link Message} yet, its prototype will be setup accordingly and static methods will be populated. If it already extends {@link Message}, it will just replace the internal constructor.
	     * @name Type#ctor
	     * @type {Constructor<{}>}
	     */
	    ctor: {
	        get: function() {
	            return this._ctor || (this.ctor = Type.generateConstructor(this)());
	        },
	        set: function(ctor) {

	            // Ensure proper prototype
	            var prototype = ctor.prototype;
	            if (!(prototype instanceof Message)) {
	                (ctor.prototype = new Message()).constructor = ctor;
	                util.merge(ctor.prototype, prototype);
	            }

	            // Classes and messages reference their reflected type
	            ctor.$type = ctor.prototype.$type = this;

	            // Mix in static methods
	            util.merge(ctor, Message, true);

	            this._ctor = ctor;

	            // Messages have non-enumerable default values on their prototype
	            var i = 0;
	            for (; i < /* initializes */ this.fieldsArray.length; ++i)
	                this._fieldsArray[i].resolve(); // ensures a proper value

	            // Messages have non-enumerable getters and setters for each virtual oneof field
	            var ctorProperties = {};
	            for (i = 0; i < /* initializes */ this.oneofsArray.length; ++i)
	                ctorProperties[this._oneofsArray[i].resolve().name] = {
	                    get: util.oneOfGetter(this._oneofsArray[i].oneof),
	                    set: util.oneOfSetter(this._oneofsArray[i].oneof)
	                };
	            if (i)
	                Object.defineProperties(ctor.prototype, ctorProperties);
	        }
	    }
	});

	/**
	 * Generates a constructor function for the specified type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	Type.generateConstructor = function generateConstructor(mtype) {
	    /* eslint-disable no-unexpected-multiline */
	    var gen = util.codegen(["p"], mtype.name);
	    // explicitly initialize mutable object/array fields so that these aren't just inherited from the prototype
	    for (var i = 0, field; i < mtype.fieldsArray.length; ++i)
	        if ((field = mtype._fieldsArray[i]).map) gen
	            ("this%s={}", util.safeProp(field.name));
	        else if (field.repeated) gen
	            ("this%s=[]", util.safeProp(field.name));
	    return gen
	    ("if(p)for(var ks=Object.keys(p),i=0;i<ks.length;++i)if(p[ks[i]]!=null)") // omit undefined or null
	        ("this[ks[i]]=p[ks[i]]");
	    /* eslint-enable no-unexpected-multiline */
	};

	function clearCache(type) {
	    type._fieldsById = type._fieldsArray = type._oneofsArray = null;
	    delete type.encode;
	    delete type.decode;
	    delete type.verify;
	    return type;
	}

	/**
	 * Message type descriptor.
	 * @interface IType
	 * @extends INamespace
	 * @property {Object.<string,IOneOf>} [oneofs] Oneof descriptors
	 * @property {Object.<string,IField>} fields Field descriptors
	 * @property {number[][]} [extensions] Extension ranges
	 * @property {number[][]} [reserved] Reserved ranges
	 * @property {boolean} [group=false] Whether a legacy group or not
	 */

	/**
	 * Creates a message type from a message type descriptor.
	 * @param {string} name Message name
	 * @param {IType} json Message type descriptor
	 * @returns {Type} Created message type
	 */
	Type.fromJSON = function fromJSON(name, json) {
	    var type = new Type(name, json.options);
	    type.extensions = json.extensions;
	    type.reserved = json.reserved;
	    var names = Object.keys(json.fields),
	        i = 0;
	    for (; i < names.length; ++i)
	        type.add(
	            ( typeof json.fields[names[i]].keyType !== "undefined"
	            ? MapField.fromJSON
	            : Field.fromJSON )(names[i], json.fields[names[i]])
	        );
	    if (json.oneofs)
	        for (names = Object.keys(json.oneofs), i = 0; i < names.length; ++i)
	            type.add(OneOf.fromJSON(names[i], json.oneofs[names[i]]));
	    if (json.nested)
	        for (names = Object.keys(json.nested), i = 0; i < names.length; ++i) {
	            var nested = json.nested[names[i]];
	            type.add( // most to least likely
	                ( nested.id !== undefined
	                ? Field.fromJSON
	                : nested.fields !== undefined
	                ? Type.fromJSON
	                : nested.values !== undefined
	                ? Enum.fromJSON
	                : nested.methods !== undefined
	                ? Service.fromJSON
	                : Namespace.fromJSON )(names[i], nested)
	            );
	        }
	    if (json.extensions && json.extensions.length)
	        type.extensions = json.extensions;
	    if (json.reserved && json.reserved.length)
	        type.reserved = json.reserved;
	    if (json.group)
	        type.group = true;
	    if (json.comment)
	        type.comment = json.comment;
	    return type;
	};

	/**
	 * Converts this message type to a message type descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IType} Message type descriptor
	 */
	Type.prototype.toJSON = function toJSON(toJSONOptions) {
	    var inherited = Namespace.prototype.toJSON.call(this, toJSONOptions);
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "options"    , inherited && inherited.options || undefined,
	        "oneofs"     , Namespace.arrayToJSON(this.oneofsArray, toJSONOptions),
	        "fields"     , Namespace.arrayToJSON(this.fieldsArray.filter(function(obj) { return !obj.declaringField; }), toJSONOptions) || {},
	        "extensions" , this.extensions && this.extensions.length ? this.extensions : undefined,
	        "reserved"   , this.reserved && this.reserved.length ? this.reserved : undefined,
	        "group"      , this.group || undefined,
	        "nested"     , inherited && inherited.nested || undefined,
	        "comment"    , keepComments ? this.comment : undefined
	    ]);
	};

	/**
	 * @override
	 */
	Type.prototype.resolveAll = function resolveAll() {
	    var fields = this.fieldsArray, i = 0;
	    while (i < fields.length)
	        fields[i++].resolve();
	    var oneofs = this.oneofsArray; i = 0;
	    while (i < oneofs.length)
	        oneofs[i++].resolve();
	    return Namespace.prototype.resolveAll.call(this);
	};

	/**
	 * @override
	 */
	Type.prototype.get = function get(name) {
	    return this.fields[name]
	        || this.oneofs && this.oneofs[name]
	        || this.nested && this.nested[name]
	        || null;
	};

	/**
	 * Adds a nested object to this type.
	 * @param {ReflectionObject} object Nested object to add
	 * @returns {Type} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a nested object with this name or, if a field, when there is already a field with this id
	 */
	Type.prototype.add = function add(object) {

	    if (this.get(object.name))
	        throw Error("duplicate name '" + object.name + "' in " + this);

	    if (object instanceof Field && object.extend === undefined) {
	        // NOTE: Extension fields aren't actual fields on the declaring type, but nested objects.
	        // The root object takes care of adding distinct sister-fields to the respective extended
	        // type instead.

	        // avoids calling the getter if not absolutely necessary because it's called quite frequently
	        if (this._fieldsById ? /* istanbul ignore next */ this._fieldsById[object.id] : this.fieldsById[object.id])
	            throw Error("duplicate id " + object.id + " in " + this);
	        if (this.isReservedId(object.id))
	            throw Error("id " + object.id + " is reserved in " + this);
	        if (this.isReservedName(object.name))
	            throw Error("name '" + object.name + "' is reserved in " + this);

	        if (object.parent)
	            object.parent.remove(object);
	        this.fields[object.name] = object;
	        object.message = this;
	        object.onAdd(this);
	        return clearCache(this);
	    }
	    if (object instanceof OneOf) {
	        if (!this.oneofs)
	            this.oneofs = {};
	        this.oneofs[object.name] = object;
	        object.onAdd(this);
	        return clearCache(this);
	    }
	    return Namespace.prototype.add.call(this, object);
	};

	/**
	 * Removes a nested object from this type.
	 * @param {ReflectionObject} object Nested object to remove
	 * @returns {Type} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `object` is not a member of this type
	 */
	Type.prototype.remove = function remove(object) {
	    if (object instanceof Field && object.extend === undefined) {
	        // See Type#add for the reason why extension fields are excluded here.

	        /* istanbul ignore if */
	        if (!this.fields || this.fields[object.name] !== object)
	            throw Error(object + " is not a member of " + this);

	        delete this.fields[object.name];
	        object.parent = null;
	        object.onRemove(this);
	        return clearCache(this);
	    }
	    if (object instanceof OneOf) {

	        /* istanbul ignore if */
	        if (!this.oneofs || this.oneofs[object.name] !== object)
	            throw Error(object + " is not a member of " + this);

	        delete this.oneofs[object.name];
	        object.parent = null;
	        object.onRemove(this);
	        return clearCache(this);
	    }
	    return Namespace.prototype.remove.call(this, object);
	};

	/**
	 * Tests if the specified id is reserved.
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Type.prototype.isReservedId = function isReservedId(id) {
	    return Namespace.isReservedId(this.reserved, id);
	};

	/**
	 * Tests if the specified name is reserved.
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Type.prototype.isReservedName = function isReservedName(name) {
	    return Namespace.isReservedName(this.reserved, name);
	};

	/**
	 * Creates a new message of this type using the specified properties.
	 * @param {Object.<string,*>} [properties] Properties to set
	 * @returns {Message<{}>} Message instance
	 */
	Type.prototype.create = function create(properties) {
	    return new this.ctor(properties);
	};

	/**
	 * Sets up {@link Type#encode|encode}, {@link Type#decode|decode} and {@link Type#verify|verify}.
	 * @returns {Type} `this`
	 */
	Type.prototype.setup = function setup() {
	    // Sets up everything at once so that the prototype chain does not have to be re-evaluated
	    // multiple times (V8, soft-deopt prototype-check).

	    var fullName = this.fullName,
	        types    = [];
	    for (var i = 0; i < /* initializes */ this.fieldsArray.length; ++i)
	        types.push(this._fieldsArray[i].resolve().resolvedType);

	    // Replace setup methods with type-specific generated functions
	    this.encode = encoder(this)({
	        Writer : Writer,
	        types  : types,
	        util   : util
	    });
	    this.decode = decoder(this)({
	        Reader : Reader,
	        types  : types,
	        util   : util
	    });
	    this.verify = verifier(this)({
	        types : types,
	        util  : util
	    });
	    this.fromObject = converter.fromObject(this)({
	        types : types,
	        util  : util
	    });
	    this.toObject = converter.toObject(this)({
	        types : types,
	        util  : util
	    });

	    // Inject custom wrappers for common types
	    var wrapper = wrappers$1[fullName];
	    if (wrapper) {
	        var originalThis = Object.create(this);
	        // if (wrapper.fromObject) {
	            originalThis.fromObject = this.fromObject;
	            this.fromObject = wrapper.fromObject.bind(originalThis);
	        // }
	        // if (wrapper.toObject) {
	            originalThis.toObject = this.toObject;
	            this.toObject = wrapper.toObject.bind(originalThis);
	        // }
	    }

	    return this;
	};

	/**
	 * Encodes a message of this type. Does not implicitly {@link Type#verify|verify} messages.
	 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
	 * @param {Writer} [writer] Writer to encode to
	 * @returns {Writer} writer
	 */
	Type.prototype.encode = function encode_setup(message, writer) {
	    return this.setup().encode(message, writer); // overrides this method
	};

	/**
	 * Encodes a message of this type preceeded by its byte length as a varint. Does not implicitly {@link Type#verify|verify} messages.
	 * @param {Message<{}>|Object.<string,*>} message Message instance or plain object
	 * @param {Writer} [writer] Writer to encode to
	 * @returns {Writer} writer
	 */
	Type.prototype.encodeDelimited = function encodeDelimited(message, writer) {
	    return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
	};

	/**
	 * Decodes a message of this type.
	 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
	 * @param {number} [length] Length of the message, if known beforehand
	 * @returns {Message<{}>} Decoded message
	 * @throws {Error} If the payload is not a reader or valid buffer
	 * @throws {util.ProtocolError<{}>} If required fields are missing
	 */
	Type.prototype.decode = function decode_setup(reader, length) {
	    return this.setup().decode(reader, length); // overrides this method
	};

	/**
	 * Decodes a message of this type preceeded by its byte length as a varint.
	 * @param {Reader|Uint8Array} reader Reader or buffer to decode from
	 * @returns {Message<{}>} Decoded message
	 * @throws {Error} If the payload is not a reader or valid buffer
	 * @throws {util.ProtocolError} If required fields are missing
	 */
	Type.prototype.decodeDelimited = function decodeDelimited(reader) {
	    if (!(reader instanceof Reader))
	        reader = Reader.create(reader);
	    return this.decode(reader, reader.uint32());
	};

	/**
	 * Verifies that field values are valid and that required fields are present.
	 * @param {Object.<string,*>} message Plain object to verify
	 * @returns {null|string} `null` if valid, otherwise the reason why it is not
	 */
	Type.prototype.verify = function verify_setup(message) {
	    return this.setup().verify(message); // overrides this method
	};

	/**
	 * Creates a new message of this type from a plain object. Also converts values to their respective internal types.
	 * @param {Object.<string,*>} object Plain object to convert
	 * @returns {Message<{}>} Message instance
	 */
	Type.prototype.fromObject = function fromObject(object) {
	    return this.setup().fromObject(object);
	};

	/**
	 * Conversion options as used by {@link Type#toObject} and {@link Message.toObject}.
	 * @interface IConversionOptions
	 * @property {Function} [longs] Long conversion type.
	 * Valid values are `String` and `Number` (the global types).
	 * Defaults to copy the present value, which is a possibly unsafe number without and a {@link Long} with a long library.
	 * @property {Function} [enums] Enum value conversion type.
	 * Only valid value is `String` (the global type).
	 * Defaults to copy the present value, which is the numeric id.
	 * @property {Function} [bytes] Bytes value conversion type.
	 * Valid values are `Array` and (a base64 encoded) `String` (the global types).
	 * Defaults to copy the present value, which usually is a Buffer under node and an Uint8Array in the browser.
	 * @property {boolean} [defaults=false] Also sets default values on the resulting object
	 * @property {boolean} [arrays=false] Sets empty arrays for missing repeated fields even if `defaults=false`
	 * @property {boolean} [objects=false] Sets empty objects for missing map fields even if `defaults=false`
	 * @property {boolean} [oneofs=false] Includes virtual oneof properties set to the present field's name, if any
	 * @property {boolean} [json=false] Performs additional JSON compatibility conversions, i.e. NaN and Infinity to strings
	 */

	/**
	 * Creates a plain object from a message of this type. Also converts values to other types if specified.
	 * @param {Message<{}>} message Message instance
	 * @param {IConversionOptions} [options] Conversion options
	 * @returns {Object.<string,*>} Plain object
	 */
	Type.prototype.toObject = function toObject(message, options) {
	    return this.setup().toObject(message, options);
	};

	/**
	 * Decorator function as returned by {@link Type.d} (TypeScript).
	 * @typedef TypeDecorator
	 * @type {function}
	 * @param {Constructor<T>} target Target constructor
	 * @returns {undefined}
	 * @template T extends Message<T>
	 */

	/**
	 * Type decorator (TypeScript).
	 * @param {string} [typeName] Type name, defaults to the constructor's name
	 * @returns {TypeDecorator<T>} Decorator function
	 * @template T extends Message<T>
	 */
	Type.d = function decorateType(typeName) {
	    return function typeDecorator(target) {
	        util.decorateType(target, typeName);
	    };
	};
	return type;
}

var root;
var hasRequiredRoot;

function requireRoot () {
	if (hasRequiredRoot) return root;
	hasRequiredRoot = 1;
	root = Root;

	// extends Namespace
	var Namespace = requireNamespace();
	((Root.prototype = Object.create(Namespace.prototype)).constructor = Root).className = "Root";

	var Field   = requireField(),
	    Enum    = require_enum(),
	    OneOf   = requireOneof(),
	    util    = requireUtil();

	var Type,   // cyclic
	    parse,  // might be excluded
	    common; // "

	/**
	 * Constructs a new root namespace instance.
	 * @classdesc Root namespace wrapping all types, enums, services, sub-namespaces etc. that belong together.
	 * @extends NamespaceBase
	 * @constructor
	 * @param {Object.<string,*>} [options] Top level options
	 */
	function Root(options) {
	    Namespace.call(this, "", options);

	    /**
	     * Deferred extension fields.
	     * @type {Field[]}
	     */
	    this.deferred = [];

	    /**
	     * Resolved file names of loaded files.
	     * @type {string[]}
	     */
	    this.files = [];
	}

	/**
	 * Loads a namespace descriptor into a root namespace.
	 * @param {INamespace} json Nameespace descriptor
	 * @param {Root} [root] Root namespace, defaults to create a new one if omitted
	 * @returns {Root} Root namespace
	 */
	Root.fromJSON = function fromJSON(json, root) {
	    if (!root)
	        root = new Root();
	    if (json.options)
	        root.setOptions(json.options);
	    return root.addJSON(json.nested);
	};

	/**
	 * Resolves the path of an imported file, relative to the importing origin.
	 * This method exists so you can override it with your own logic in case your imports are scattered over multiple directories.
	 * @function
	 * @param {string} origin The file name of the importing file
	 * @param {string} target The file name being imported
	 * @returns {string|null} Resolved path to `target` or `null` to skip the file
	 */
	Root.prototype.resolvePath = util.path.resolve;

	/**
	 * Fetch content from file path or url
	 * This method exists so you can override it with your own logic.
	 * @function
	 * @param {string} path File path or url
	 * @param {FetchCallback} callback Callback function
	 * @returns {undefined}
	 */
	Root.prototype.fetch = util.fetch;

	// A symbol-like function to safely signal synchronous loading
	/* istanbul ignore next */
	function SYNC() {} // eslint-disable-line no-empty-function

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} options Parse options
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 */
	Root.prototype.load = function load(filename, options, callback) {
	    if (typeof options === "function") {
	        callback = options;
	        options = undefined;
	    }
	    var self = this;
	    if (!callback)
	        return util.asPromise(load, self, filename, options);

	    var sync = callback === SYNC; // undocumented

	    // Finishes loading by calling the callback (exactly once)
	    function finish(err, root) {
	        /* istanbul ignore if */
	        if (!callback)
	            return;
	        var cb = callback;
	        callback = null;
	        if (sync)
	            throw err;
	        cb(err, root);
	    }

	    // Bundled definition existence checking
	    function getBundledFileName(filename) {
	        var idx = filename.lastIndexOf("google/protobuf/");
	        if (idx > -1) {
	            var altname = filename.substring(idx);
	            if (altname in common) return altname;
	        }
	        return null;
	    }

	    // Processes a single file
	    function process(filename, source) {
	        try {
	            if (util.isString(source) && source.charAt(0) === "{")
	                source = JSON.parse(source);
	            if (!util.isString(source))
	                self.setOptions(source.options).addJSON(source.nested);
	            else {
	                parse.filename = filename;
	                var parsed = parse(source, self, options),
	                    resolved,
	                    i = 0;
	                if (parsed.imports)
	                    for (; i < parsed.imports.length; ++i)
	                        if (resolved = getBundledFileName(parsed.imports[i]) || self.resolvePath(filename, parsed.imports[i]))
	                            fetch(resolved);
	                if (parsed.weakImports)
	                    for (i = 0; i < parsed.weakImports.length; ++i)
	                        if (resolved = getBundledFileName(parsed.weakImports[i]) || self.resolvePath(filename, parsed.weakImports[i]))
	                            fetch(resolved, true);
	            }
	        } catch (err) {
	            finish(err);
	        }
	        if (!sync && !queued)
	            finish(null, self); // only once anyway
	    }

	    // Fetches a single file
	    function fetch(filename, weak) {

	        // Skip if already loaded / attempted
	        if (self.files.indexOf(filename) > -1)
	            return;
	        self.files.push(filename);

	        // Shortcut bundled definitions
	        if (filename in common) {
	            if (sync)
	                process(filename, common[filename]);
	            else {
	                ++queued;
	                setTimeout(function() {
	                    --queued;
	                    process(filename, common[filename]);
	                });
	            }
	            return;
	        }

	        // Otherwise fetch from disk or network
	        if (sync) {
	            var source;
	            try {
	                source = util.fs.readFileSync(filename).toString("utf8");
	            } catch (err) {
	                if (!weak)
	                    finish(err);
	                return;
	            }
	            process(filename, source);
	        } else {
	            ++queued;
	            self.fetch(filename, function(err, source) {
	                --queued;
	                /* istanbul ignore if */
	                if (!callback)
	                    return; // terminated meanwhile
	                if (err) {
	                    /* istanbul ignore else */
	                    if (!weak)
	                        finish(err);
	                    else if (!queued) // can't be covered reliably
	                        finish(null, self);
	                    return;
	                }
	                process(filename, source);
	            });
	        }
	    }
	    var queued = 0;

	    // Assembling the root namespace doesn't require working type
	    // references anymore, so we can load everything in parallel
	    if (util.isString(filename))
	        filename = [ filename ];
	    for (var i = 0, resolved; i < filename.length; ++i)
	        if (resolved = self.resolvePath("", filename[i]))
	            fetch(resolved);

	    if (sync)
	        return self;
	    if (!queued)
	        finish(null, self);
	    return undefined;
	};
	// function load(filename:string, options:IParseOptions, callback:LoadCallback):undefined

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and calls the callback.
	 * @function Root#load
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 * @variation 2
	 */
	// function load(filename:string, callback:LoadCallback):undefined

	/**
	 * Loads one or multiple .proto or preprocessed .json files into this root namespace and returns a promise.
	 * @function Root#load
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
	 * @returns {Promise<Root>} Promise
	 * @variation 3
	 */
	// function load(filename:string, [options:IParseOptions]):Promise<Root>

	/**
	 * Synchronously loads one or multiple .proto or preprocessed .json files into this root namespace (node only).
	 * @function Root#loadSync
	 * @param {string|string[]} filename Names of one or multiple files to load
	 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
	 * @returns {Root} Root namespace
	 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
	 */
	Root.prototype.loadSync = function loadSync(filename, options) {
	    if (!util.isNode)
	        throw Error("not supported");
	    return this.load(filename, options, SYNC);
	};

	/**
	 * @override
	 */
	Root.prototype.resolveAll = function resolveAll() {
	    if (this.deferred.length)
	        throw Error("unresolvable extensions: " + this.deferred.map(function(field) {
	            return "'extend " + field.extend + "' in " + field.parent.fullName;
	        }).join(", "));
	    return Namespace.prototype.resolveAll.call(this);
	};

	// only uppercased (and thus conflict-free) children are exposed, see below
	var exposeRe = /^[A-Z]/;

	/**
	 * Handles a deferred declaring extension field by creating a sister field to represent it within its extended type.
	 * @param {Root} root Root instance
	 * @param {Field} field Declaring extension field witin the declaring type
	 * @returns {boolean} `true` if successfully added to the extended type, `false` otherwise
	 * @inner
	 * @ignore
	 */
	function tryHandleExtension(root, field) {
	    var extendedType = field.parent.lookup(field.extend);
	    if (extendedType) {
	        var sisterField = new Field(field.fullName, field.id, field.type, field.rule, undefined, field.options);
	        sisterField.declaringField = field;
	        field.extensionField = sisterField;
	        extendedType.add(sisterField);
	        return true;
	    }
	    return false;
	}

	/**
	 * Called when any object is added to this root or its sub-namespaces.
	 * @param {ReflectionObject} object Object added
	 * @returns {undefined}
	 * @private
	 */
	Root.prototype._handleAdd = function _handleAdd(object) {
	    if (object instanceof Field) {

	        if (/* an extension field (implies not part of a oneof) */ object.extend !== undefined && /* not already handled */ !object.extensionField)
	            if (!tryHandleExtension(this, object))
	                this.deferred.push(object);

	    } else if (object instanceof Enum) {

	        if (exposeRe.test(object.name))
	            object.parent[object.name] = object.values; // expose enum values as property of its parent

	    } else if (!(object instanceof OneOf)) /* everything else is a namespace */ {

	        if (object instanceof Type) // Try to handle any deferred extensions
	            for (var i = 0; i < this.deferred.length;)
	                if (tryHandleExtension(this, this.deferred[i]))
	                    this.deferred.splice(i, 1);
	                else
	                    ++i;
	        for (var j = 0; j < /* initializes */ object.nestedArray.length; ++j) // recurse into the namespace
	            this._handleAdd(object._nestedArray[j]);
	        if (exposeRe.test(object.name))
	            object.parent[object.name] = object; // expose namespace as property of its parent
	    }

	    // The above also adds uppercased (and thus conflict-free) nested types, services and enums as
	    // properties of namespaces just like static code does. This allows using a .d.ts generated for
	    // a static module with reflection-based solutions where the condition is met.
	};

	/**
	 * Called when any object is removed from this root or its sub-namespaces.
	 * @param {ReflectionObject} object Object removed
	 * @returns {undefined}
	 * @private
	 */
	Root.prototype._handleRemove = function _handleRemove(object) {
	    if (object instanceof Field) {

	        if (/* an extension field */ object.extend !== undefined) {
	            if (/* already handled */ object.extensionField) { // remove its sister field
	                object.extensionField.parent.remove(object.extensionField);
	                object.extensionField = null;
	            } else { // cancel the extension
	                var index = this.deferred.indexOf(object);
	                /* istanbul ignore else */
	                if (index > -1)
	                    this.deferred.splice(index, 1);
	            }
	        }

	    } else if (object instanceof Enum) {

	        if (exposeRe.test(object.name))
	            delete object.parent[object.name]; // unexpose enum values

	    } else if (object instanceof Namespace) {

	        for (var i = 0; i < /* initializes */ object.nestedArray.length; ++i) // recurse into the namespace
	            this._handleRemove(object._nestedArray[i]);

	        if (exposeRe.test(object.name))
	            delete object.parent[object.name]; // unexpose namespaces

	    }
	};

	// Sets up cyclic dependencies (called in index-light)
	Root._configure = function(Type_, parse_, common_) {
	    Type   = Type_;
	    parse  = parse_;
	    common = common_;
	};
	return root;
}

var hasRequiredUtil;

function requireUtil () {
	if (hasRequiredUtil) return util$3.exports;
	hasRequiredUtil = 1;
	(function (module) {

		/**
		 * Various utility functions.
		 * @namespace
		 */
		var util = module.exports = requireMinimal();

		var roots$1 = roots;

		var Type, // cyclic
		    Enum;

		util.codegen = requireCodegen();
		util.fetch   = requireFetch();
		util.path    = requirePath();

		/**
		 * Node's fs module if available.
		 * @type {Object.<string,*>}
		 */
		util.fs = util.inquire("fs");

		/**
		 * Converts an object's values to an array.
		 * @param {Object.<string,*>} object Object to convert
		 * @returns {Array.<*>} Converted array
		 */
		util.toArray = function toArray(object) {
		    if (object) {
		        var keys  = Object.keys(object),
		            array = new Array(keys.length),
		            index = 0;
		        while (index < keys.length)
		            array[index] = object[keys[index++]];
		        return array;
		    }
		    return [];
		};

		/**
		 * Converts an array of keys immediately followed by their respective value to an object, omitting undefined values.
		 * @param {Array.<*>} array Array to convert
		 * @returns {Object.<string,*>} Converted object
		 */
		util.toObject = function toObject(array) {
		    var object = {},
		        index  = 0;
		    while (index < array.length) {
		        var key = array[index++],
		            val = array[index++];
		        if (val !== undefined)
		            object[key] = val;
		    }
		    return object;
		};

		var safePropBackslashRe = /\\/g,
		    safePropQuoteRe     = /"/g;

		/**
		 * Tests whether the specified name is a reserved word in JS.
		 * @param {string} name Name to test
		 * @returns {boolean} `true` if reserved, otherwise `false`
		 */
		util.isReserved = function isReserved(name) {
		    return /^(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$/.test(name);
		};

		/**
		 * Returns a safe property accessor for the specified property name.
		 * @param {string} prop Property name
		 * @returns {string} Safe accessor
		 */
		util.safeProp = function safeProp(prop) {
		    if (!/^[$\w_]+$/.test(prop) || util.isReserved(prop))
		        return "[\"" + prop.replace(safePropBackslashRe, "\\\\").replace(safePropQuoteRe, "\\\"") + "\"]";
		    return "." + prop;
		};

		/**
		 * Converts the first character of a string to upper case.
		 * @param {string} str String to convert
		 * @returns {string} Converted string
		 */
		util.ucFirst = function ucFirst(str) {
		    return str.charAt(0).toUpperCase() + str.substring(1);
		};

		var camelCaseRe = /_([a-z])/g;

		/**
		 * Converts a string to camel case.
		 * @param {string} str String to convert
		 * @returns {string} Converted string
		 */
		util.camelCase = function camelCase(str) {
		    return str.substring(0, 1)
		         + str.substring(1)
		               .replace(camelCaseRe, function($0, $1) { return $1.toUpperCase(); });
		};

		/**
		 * Compares reflected fields by id.
		 * @param {Field} a First field
		 * @param {Field} b Second field
		 * @returns {number} Comparison value
		 */
		util.compareFieldsById = function compareFieldsById(a, b) {
		    return a.id - b.id;
		};

		/**
		 * Decorator helper for types (TypeScript).
		 * @param {Constructor<T>} ctor Constructor function
		 * @param {string} [typeName] Type name, defaults to the constructor's name
		 * @returns {Type} Reflected type
		 * @template T extends Message<T>
		 * @property {Root} root Decorators root
		 */
		util.decorateType = function decorateType(ctor, typeName) {

		    /* istanbul ignore if */
		    if (ctor.$type) {
		        if (typeName && ctor.$type.name !== typeName) {
		            util.decorateRoot.remove(ctor.$type);
		            ctor.$type.name = typeName;
		            util.decorateRoot.add(ctor.$type);
		        }
		        return ctor.$type;
		    }

		    /* istanbul ignore next */
		    if (!Type)
		        Type = requireType();

		    var type = new Type(typeName || ctor.name);
		    util.decorateRoot.add(type);
		    type.ctor = ctor; // sets up .encode, .decode etc.
		    Object.defineProperty(ctor, "$type", { value: type, enumerable: false });
		    Object.defineProperty(ctor.prototype, "$type", { value: type, enumerable: false });
		    return type;
		};

		var decorateEnumIndex = 0;

		/**
		 * Decorator helper for enums (TypeScript).
		 * @param {Object} object Enum object
		 * @returns {Enum} Reflected enum
		 */
		util.decorateEnum = function decorateEnum(object) {

		    /* istanbul ignore if */
		    if (object.$type)
		        return object.$type;

		    /* istanbul ignore next */
		    if (!Enum)
		        Enum = require_enum();

		    var enm = new Enum("Enum" + decorateEnumIndex++, object);
		    util.decorateRoot.add(enm);
		    Object.defineProperty(object, "$type", { value: enm, enumerable: false });
		    return enm;
		};


		/**
		 * Sets the value of a property by property path. If a value already exists, it is turned to an array
		 * @param {Object.<string,*>} dst Destination object
		 * @param {string} path dot '.' delimited path of the property to set
		 * @param {Object} value the value to set
		 * @returns {Object.<string,*>} Destination object
		 */
		util.setProperty = function setProperty(dst, path, value) {
		    function setProp(dst, path, value) {
		        var part = path.shift();
		        if (part === "__proto__") {
		          return dst;
		        }
		        if (path.length > 0) {
		            dst[part] = setProp(dst[part] || {}, path, value);
		        } else {
		            var prevValue = dst[part];
		            if (prevValue)
		                value = [].concat(prevValue).concat(value);
		            dst[part] = value;
		        }
		        return dst;
		    }

		    if (typeof dst !== "object")
		        throw TypeError("dst must be an object");
		    if (!path)
		        throw TypeError("path must be specified");

		    path = path.split(".");
		    return setProp(dst, path, value);
		};

		/**
		 * Decorator root (TypeScript).
		 * @name util.decorateRoot
		 * @type {Root}
		 * @readonly
		 */
		Object.defineProperty(util, "decorateRoot", {
		    get: function() {
		        return roots$1["decorated"] || (roots$1["decorated"] = new (requireRoot())());
		    }
		});
} (util$3));
	return util$3.exports;
}

var object;
var hasRequiredObject;

function requireObject () {
	if (hasRequiredObject) return object;
	hasRequiredObject = 1;
	object = ReflectionObject;

	ReflectionObject.className = "ReflectionObject";

	var util = requireUtil();

	var Root; // cyclic

	/**
	 * Constructs a new reflection object instance.
	 * @classdesc Base class of all reflection objects.
	 * @constructor
	 * @param {string} name Object name
	 * @param {Object.<string,*>} [options] Declared options
	 * @abstract
	 */
	function ReflectionObject(name, options) {

	    if (!util.isString(name))
	        throw TypeError("name must be a string");

	    if (options && !util.isObject(options))
	        throw TypeError("options must be an object");

	    /**
	     * Options.
	     * @type {Object.<string,*>|undefined}
	     */
	    this.options = options; // toJSON

	    /**
	     * Parsed Options.
	     * @type {Array.<Object.<string,*>>|undefined}
	     */
	    this.parsedOptions = null;

	    /**
	     * Unique name within its namespace.
	     * @type {string}
	     */
	    this.name = name;

	    /**
	     * Parent namespace.
	     * @type {Namespace|null}
	     */
	    this.parent = null;

	    /**
	     * Whether already resolved or not.
	     * @type {boolean}
	     */
	    this.resolved = false;

	    /**
	     * Comment text, if any.
	     * @type {string|null}
	     */
	    this.comment = null;

	    /**
	     * Defining file name.
	     * @type {string|null}
	     */
	    this.filename = null;
	}

	Object.defineProperties(ReflectionObject.prototype, {

	    /**
	     * Reference to the root namespace.
	     * @name ReflectionObject#root
	     * @type {Root}
	     * @readonly
	     */
	    root: {
	        get: function() {
	            var ptr = this;
	            while (ptr.parent !== null)
	                ptr = ptr.parent;
	            return ptr;
	        }
	    },

	    /**
	     * Full name including leading dot.
	     * @name ReflectionObject#fullName
	     * @type {string}
	     * @readonly
	     */
	    fullName: {
	        get: function() {
	            var path = [ this.name ],
	                ptr = this.parent;
	            while (ptr) {
	                path.unshift(ptr.name);
	                ptr = ptr.parent;
	            }
	            return path.join(".");
	        }
	    }
	});

	/**
	 * Converts this reflection object to its descriptor representation.
	 * @returns {Object.<string,*>} Descriptor
	 * @abstract
	 */
	ReflectionObject.prototype.toJSON = /* istanbul ignore next */ function toJSON() {
	    throw Error(); // not implemented, shouldn't happen
	};

	/**
	 * Called when this object is added to a parent.
	 * @param {ReflectionObject} parent Parent added to
	 * @returns {undefined}
	 */
	ReflectionObject.prototype.onAdd = function onAdd(parent) {
	    if (this.parent && this.parent !== parent)
	        this.parent.remove(this);
	    this.parent = parent;
	    this.resolved = false;
	    var root = parent.root;
	    if (root instanceof Root)
	        root._handleAdd(this);
	};

	/**
	 * Called when this object is removed from a parent.
	 * @param {ReflectionObject} parent Parent removed from
	 * @returns {undefined}
	 */
	ReflectionObject.prototype.onRemove = function onRemove(parent) {
	    var root = parent.root;
	    if (root instanceof Root)
	        root._handleRemove(this);
	    this.parent = null;
	    this.resolved = false;
	};

	/**
	 * Resolves this objects type references.
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.resolve = function resolve() {
	    if (this.resolved)
	        return this;
	    if (this.root instanceof Root)
	        this.resolved = true; // only if part of a root
	    return this;
	};

	/**
	 * Gets an option value.
	 * @param {string} name Option name
	 * @returns {*} Option value or `undefined` if not set
	 */
	ReflectionObject.prototype.getOption = function getOption(name) {
	    if (this.options)
	        return this.options[name];
	    return undefined;
	};

	/**
	 * Sets an option.
	 * @param {string} name Option name
	 * @param {*} value Option value
	 * @param {boolean} [ifNotSet] Sets the option only if it isn't currently set
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setOption = function setOption(name, value, ifNotSet) {
	    if (!ifNotSet || !this.options || this.options[name] === undefined)
	        (this.options || (this.options = {}))[name] = value;
	    return this;
	};

	/**
	 * Sets a parsed option.
	 * @param {string} name parsed Option name
	 * @param {*} value Option value
	 * @param {string} propName dot '.' delimited full path of property within the option to set. if undefined\empty, will add a new option with that value
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setParsedOption = function setParsedOption(name, value, propName) {
	    if (!this.parsedOptions) {
	        this.parsedOptions = [];
	    }
	    var parsedOptions = this.parsedOptions;
	    if (propName) {
	        // If setting a sub property of an option then try to merge it
	        // with an existing option
	        var opt = parsedOptions.find(function (opt) {
	            return Object.prototype.hasOwnProperty.call(opt, name);
	        });
	        if (opt) {
	            // If we found an existing option - just merge the property value
	            var newValue = opt[name];
	            util.setProperty(newValue, propName, value);
	        } else {
	            // otherwise, create a new option, set it's property and add it to the list
	            opt = {};
	            opt[name] = util.setProperty({}, propName, value);
	            parsedOptions.push(opt);
	        }
	    } else {
	        // Always create a new option when setting the value of the option itself
	        var newOpt = {};
	        newOpt[name] = value;
	        parsedOptions.push(newOpt);
	    }
	    return this;
	};

	/**
	 * Sets multiple options.
	 * @param {Object.<string,*>} options Options to set
	 * @param {boolean} [ifNotSet] Sets an option only if it isn't currently set
	 * @returns {ReflectionObject} `this`
	 */
	ReflectionObject.prototype.setOptions = function setOptions(options, ifNotSet) {
	    if (options)
	        for (var keys = Object.keys(options), i = 0; i < keys.length; ++i)
	            this.setOption(keys[i], options[keys[i]], ifNotSet);
	    return this;
	};

	/**
	 * Converts this instance to its string representation.
	 * @returns {string} Class name[, space, full name]
	 */
	ReflectionObject.prototype.toString = function toString() {
	    var className = this.constructor.className,
	        fullName  = this.fullName;
	    if (fullName.length)
	        return className + " " + fullName;
	    return className;
	};

	// Sets up cyclic dependencies (called in index-light)
	ReflectionObject._configure = function(Root_) {
	    Root = Root_;
	};
	return object;
}

var _enum;
var hasRequired_enum;

function require_enum () {
	if (hasRequired_enum) return _enum;
	hasRequired_enum = 1;
	_enum = Enum;

	// extends ReflectionObject
	var ReflectionObject = requireObject();
	((Enum.prototype = Object.create(ReflectionObject.prototype)).constructor = Enum).className = "Enum";

	var Namespace = requireNamespace(),
	    util = requireUtil();

	/**
	 * Constructs a new enum instance.
	 * @classdesc Reflected enum.
	 * @extends ReflectionObject
	 * @constructor
	 * @param {string} name Unique name within its namespace
	 * @param {Object.<string,number>} [values] Enum values as an object, by name
	 * @param {Object.<string,*>} [options] Declared options
	 * @param {string} [comment] The comment for this enum
	 * @param {Object.<string,string>} [comments] The value comments for this enum
	 */
	function Enum(name, values, options, comment, comments) {
	    ReflectionObject.call(this, name, options);

	    if (values && typeof values !== "object")
	        throw TypeError("values must be an object");

	    /**
	     * Enum values by id.
	     * @type {Object.<number,string>}
	     */
	    this.valuesById = {};

	    /**
	     * Enum values by name.
	     * @type {Object.<string,number>}
	     */
	    this.values = Object.create(this.valuesById); // toJSON, marker

	    /**
	     * Enum comment text.
	     * @type {string|null}
	     */
	    this.comment = comment;

	    /**
	     * Value comment texts, if any.
	     * @type {Object.<string,string>}
	     */
	    this.comments = comments || {};

	    /**
	     * Reserved ranges, if any.
	     * @type {Array.<number[]|string>}
	     */
	    this.reserved = undefined; // toJSON

	    // Note that values inherit valuesById on their prototype which makes them a TypeScript-
	    // compatible enum. This is used by pbts to write actual enum definitions that work for
	    // static and reflection code alike instead of emitting generic object definitions.

	    if (values)
	        for (var keys = Object.keys(values), i = 0; i < keys.length; ++i)
	            if (typeof values[keys[i]] === "number") // use forward entries only
	                this.valuesById[ this.values[keys[i]] = values[keys[i]] ] = keys[i];
	}

	/**
	 * Enum descriptor.
	 * @interface IEnum
	 * @property {Object.<string,number>} values Enum values
	 * @property {Object.<string,*>} [options] Enum options
	 */

	/**
	 * Constructs an enum from an enum descriptor.
	 * @param {string} name Enum name
	 * @param {IEnum} json Enum descriptor
	 * @returns {Enum} Created enum
	 * @throws {TypeError} If arguments are invalid
	 */
	Enum.fromJSON = function fromJSON(name, json) {
	    var enm = new Enum(name, json.values, json.options, json.comment, json.comments);
	    enm.reserved = json.reserved;
	    return enm;
	};

	/**
	 * Converts this enum to an enum descriptor.
	 * @param {IToJSONOptions} [toJSONOptions] JSON conversion options
	 * @returns {IEnum} Enum descriptor
	 */
	Enum.prototype.toJSON = function toJSON(toJSONOptions) {
	    var keepComments = toJSONOptions ? Boolean(toJSONOptions.keepComments) : false;
	    return util.toObject([
	        "options"  , this.options,
	        "values"   , this.values,
	        "reserved" , this.reserved && this.reserved.length ? this.reserved : undefined,
	        "comment"  , keepComments ? this.comment : undefined,
	        "comments" , keepComments ? this.comments : undefined
	    ]);
	};

	/**
	 * Adds a value to this enum.
	 * @param {string} name Value name
	 * @param {number} id Value id
	 * @param {string} [comment] Comment, if any
	 * @returns {Enum} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If there is already a value with this name or id
	 */
	Enum.prototype.add = function add(name, id, comment) {
	    // utilized by the parser but not by .fromJSON

	    if (!util.isString(name))
	        throw TypeError("name must be a string");

	    if (!util.isInteger(id))
	        throw TypeError("id must be an integer");

	    if (this.values[name] !== undefined)
	        throw Error("duplicate name '" + name + "' in " + this);

	    if (this.isReservedId(id))
	        throw Error("id " + id + " is reserved in " + this);

	    if (this.isReservedName(name))
	        throw Error("name '" + name + "' is reserved in " + this);

	    if (this.valuesById[id] !== undefined) {
	        if (!(this.options && this.options.allow_alias))
	            throw Error("duplicate id " + id + " in " + this);
	        this.values[name] = id;
	    } else
	        this.valuesById[this.values[name] = id] = name;

	    this.comments[name] = comment || null;
	    return this;
	};

	/**
	 * Removes a value from this enum
	 * @param {string} name Value name
	 * @returns {Enum} `this`
	 * @throws {TypeError} If arguments are invalid
	 * @throws {Error} If `name` is not a name of this enum
	 */
	Enum.prototype.remove = function remove(name) {

	    if (!util.isString(name))
	        throw TypeError("name must be a string");

	    var val = this.values[name];
	    if (val == null)
	        throw Error("name '" + name + "' does not exist in " + this);

	    delete this.valuesById[val];
	    delete this.values[name];
	    delete this.comments[name];

	    return this;
	};

	/**
	 * Tests if the specified id is reserved.
	 * @param {number} id Id to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Enum.prototype.isReservedId = function isReservedId(id) {
	    return Namespace.isReservedId(this.reserved, id);
	};

	/**
	 * Tests if the specified name is reserved.
	 * @param {string} name Name to test
	 * @returns {boolean} `true` if reserved, otherwise `false`
	 */
	Enum.prototype.isReservedName = function isReservedName(name) {
	    return Namespace.isReservedName(this.reserved, name);
	};
	return _enum;
}

var encoder_1;
var hasRequiredEncoder;

function requireEncoder () {
	if (hasRequiredEncoder) return encoder_1;
	hasRequiredEncoder = 1;
	encoder_1 = encoder;

	var Enum     = require_enum(),
	    types    = requireTypes(),
	    util     = requireUtil();

	/**
	 * Generates a partial message type encoder.
	 * @param {Codegen} gen Codegen instance
	 * @param {Field} field Reflected field
	 * @param {number} fieldIndex Field index
	 * @param {string} ref Variable reference
	 * @returns {Codegen} Codegen instance
	 * @ignore
	 */
	function genTypePartial(gen, field, fieldIndex, ref) {
	    return field.resolvedType.group
	        ? gen("types[%i].encode(%s,w.uint32(%i)).uint32(%i)", fieldIndex, ref, (field.id << 3 | 3) >>> 0, (field.id << 3 | 4) >>> 0)
	        : gen("types[%i].encode(%s,w.uint32(%i).fork()).ldelim()", fieldIndex, ref, (field.id << 3 | 2) >>> 0);
	}

	/**
	 * Generates an encoder specific to the specified message type.
	 * @param {Type} mtype Message type
	 * @returns {Codegen} Codegen instance
	 */
	function encoder(mtype) {
	    /* eslint-disable no-unexpected-multiline, block-scoped-var, no-redeclare */
	    var gen = util.codegen(["m", "w"], mtype.name + "$encode")
	    ("if(!w)")
	        ("w=Writer.create()");

	    var i, ref;

	    // "when a message is serialized its known fields should be written sequentially by field number"
	    var fields = /* initializes */ mtype.fieldsArray.slice().sort(util.compareFieldsById);

	    for (var i = 0; i < fields.length; ++i) {
	        var field    = fields[i].resolve(),
	            index    = mtype._fieldsArray.indexOf(field),
	            type     = field.resolvedType instanceof Enum ? "int32" : field.type,
	            wireType = types.basic[type];
	            ref      = "m" + util.safeProp(field.name);

	        // Map fields
	        if (field.map) {
	            gen
	    ("if(%s!=null&&Object.hasOwnProperty.call(m,%j)){", ref, field.name) // !== undefined && !== null
	        ("for(var ks=Object.keys(%s),i=0;i<ks.length;++i){", ref)
	            ("w.uint32(%i).fork().uint32(%i).%s(ks[i])", (field.id << 3 | 2) >>> 0, 8 | types.mapKey[field.keyType], field.keyType);
	            if (wireType === undefined) gen
	            ("types[%i].encode(%s[ks[i]],w.uint32(18).fork()).ldelim().ldelim()", index, ref); // can't be groups
	            else gen
	            (".uint32(%i).%s(%s[ks[i]]).ldelim()", 16 | wireType, type, ref);
	            gen
	        ("}")
	    ("}");

	            // Repeated fields
	        } else if (field.repeated) { gen
	    ("if(%s!=null&&%s.length){", ref, ref); // !== undefined && !== null

	            // Packed repeated
	            if (field.packed && types.packed[type] !== undefined) { gen

	        ("w.uint32(%i).fork()", (field.id << 3 | 2) >>> 0)
	        ("for(var i=0;i<%s.length;++i)", ref)
	            ("w.%s(%s[i])", type, ref)
	        ("w.ldelim()");

	            // Non-packed
	            } else { gen

	        ("for(var i=0;i<%s.length;++i)", ref);
	                if (wireType === undefined)
	            genTypePartial(gen, field, index, ref + "[i]");
	                else gen
	            ("w.uint32(%i).%s(%s[i])", (field.id << 3 | wireType) >>> 0, type, ref);

	            } gen
	    ("}");

	        // Non-repeated
	        } else {
	            if (field.optional) gen
	    ("if(%s!=null&&Object.hasOwnProperty.call(m,%j))", ref, field.name); // !== undefined && !== null

	            if (wireType === undefined)
	        genTypePartial(gen, field, index, ref);
	            else gen
	        ("w.uint32(%i).%s(%s)", (field.id << 3 | wireType) >>> 0, type, ref);

	        }
	    }

	    return gen
	    ("return w");
	    /* eslint-enable no-unexpected-multiline, block-scoped-var, no-redeclare */
	}
	return encoder_1;
}

(function (module) {
	var protobuf = module.exports = indexMinimal;

	protobuf.build = "light";

	/**
	 * A node-style callback as used by {@link load} and {@link Root#load}.
	 * @typedef LoadCallback
	 * @type {function}
	 * @param {Error|null} error Error, if any, otherwise `null`
	 * @param {Root} [root] Root, if there hasn't been an error
	 * @returns {undefined}
	 */

	/**
	 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
	 * @param {string|string[]} filename One or multiple files to load
	 * @param {Root} root Root namespace, defaults to create a new one if omitted.
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 * @see {@link Root#load}
	 */
	function load(filename, root, callback) {
	    if (typeof root === "function") {
	        callback = root;
	        root = new protobuf.Root();
	    } else if (!root)
	        root = new protobuf.Root();
	    return root.load(filename, callback);
	}

	/**
	 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and calls the callback.
	 * @name load
	 * @function
	 * @param {string|string[]} filename One or multiple files to load
	 * @param {LoadCallback} callback Callback function
	 * @returns {undefined}
	 * @see {@link Root#load}
	 * @variation 2
	 */
	// function load(filename:string, callback:LoadCallback):undefined

	/**
	 * Loads one or multiple .proto or preprocessed .json files into a common root namespace and returns a promise.
	 * @name load
	 * @function
	 * @param {string|string[]} filename One or multiple files to load
	 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
	 * @returns {Promise<Root>} Promise
	 * @see {@link Root#load}
	 * @variation 3
	 */
	// function load(filename:string, [root:Root]):Promise<Root>

	protobuf.load = load;

	/**
	 * Synchronously loads one or multiple .proto or preprocessed .json files into a common root namespace (node only).
	 * @param {string|string[]} filename One or multiple files to load
	 * @param {Root} [root] Root namespace, defaults to create a new one if omitted.
	 * @returns {Root} Root namespace
	 * @throws {Error} If synchronous fetching is not supported (i.e. in browsers) or if a file's syntax is invalid
	 * @see {@link Root#loadSync}
	 */
	function loadSync(filename, root) {
	    if (!root)
	        root = new protobuf.Root();
	    return root.loadSync(filename);
	}

	protobuf.loadSync = loadSync;

	// Serialization
	protobuf.encoder          = requireEncoder();
	protobuf.decoder          = requireDecoder();
	protobuf.verifier         = verifier_1;
	protobuf.converter        = requireConverter();

	// Reflection
	protobuf.ReflectionObject = requireObject();
	protobuf.Namespace        = requireNamespace();
	protobuf.Root             = requireRoot();
	protobuf.Enum             = require_enum();
	protobuf.Type             = requireType();
	protobuf.Field            = requireField();
	protobuf.OneOf            = requireOneof();
	protobuf.MapField         = requireMapfield();
	protobuf.Service          = requireService();
	protobuf.Method           = requireMethod();

	// Runtime
	protobuf.Message          = message;
	protobuf.wrappers         = wrappers;

	// Utility
	protobuf.types            = requireTypes();
	protobuf.util             = requireUtil();

	// Set up possibly cyclic reflection dependencies
	protobuf.ReflectionObject._configure(protobuf.Root);
	protobuf.Namespace._configure(protobuf.Type, protobuf.Service, protobuf.Enum);
	protobuf.Root._configure(protobuf.Type);
	protobuf.Field._configure(protobuf.Type);
} (indexLight));

var tokenize_1 = tokenize$1;

var delimRe        = /[\s{}=;:[\],'"()<>]/g,
    stringDoubleRe = /(?:"([^"\\]*(?:\\.[^"\\]*)*)")/g,
    stringSingleRe = /(?:'([^'\\]*(?:\\.[^'\\]*)*)')/g;

var setCommentRe = /^ *[*/]+ */,
    setCommentAltRe = /^\s*\*?\/*/,
    setCommentSplitRe = /\n/g,
    whitespaceRe = /\s/,
    unescapeRe = /\\(.?)/g;

var unescapeMap = {
    "0": "\0",
    "r": "\r",
    "n": "\n",
    "t": "\t"
};

/**
 * Unescapes a string.
 * @param {string} str String to unescape
 * @returns {string} Unescaped string
 * @property {Object.<string,string>} map Special characters map
 * @memberof tokenize
 */
function unescape$1(str) {
    return str.replace(unescapeRe, function($0, $1) {
        switch ($1) {
            case "\\":
            case "":
                return $1;
            default:
                return unescapeMap[$1] || "";
        }
    });
}

tokenize$1.unescape = unescape$1;

/**
 * Gets the next token and advances.
 * @typedef TokenizerHandleNext
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */

/**
 * Peeks for the next token.
 * @typedef TokenizerHandlePeek
 * @type {function}
 * @returns {string|null} Next token or `null` on eof
 */

/**
 * Pushes a token back to the stack.
 * @typedef TokenizerHandlePush
 * @type {function}
 * @param {string} token Token
 * @returns {undefined}
 */

/**
 * Skips the next token.
 * @typedef TokenizerHandleSkip
 * @type {function}
 * @param {string} expected Expected token
 * @param {boolean} [optional=false] If optional
 * @returns {boolean} Whether the token matched
 * @throws {Error} If the token didn't match and is not optional
 */

/**
 * Gets the comment on the previous line or, alternatively, the line comment on the specified line.
 * @typedef TokenizerHandleCmnt
 * @type {function}
 * @param {number} [line] Line number
 * @returns {string|null} Comment text or `null` if none
 */

/**
 * Handle object returned from {@link tokenize}.
 * @interface ITokenizerHandle
 * @property {TokenizerHandleNext} next Gets the next token and advances (`null` on eof)
 * @property {TokenizerHandlePeek} peek Peeks for the next token (`null` on eof)
 * @property {TokenizerHandlePush} push Pushes a token back to the stack
 * @property {TokenizerHandleSkip} skip Skips a token, returns its presence and advances or, if non-optional and not present, throws
 * @property {TokenizerHandleCmnt} cmnt Gets the comment on the previous line or the line comment on the specified line, if any
 * @property {number} line Current line number
 */

/**
 * Tokenizes the given .proto source and returns an object with useful utility functions.
 * @param {string} source Source contents
 * @param {boolean} alternateCommentMode Whether we should activate alternate comment parsing mode.
 * @returns {ITokenizerHandle} Tokenizer handle
 */
function tokenize$1(source, alternateCommentMode) {
    /* eslint-disable callback-return */
    source = source.toString();

    var offset = 0,
        length = source.length,
        line = 1,
        commentType = null,
        commentText = null,
        commentLine = 0,
        commentLineEmpty = false,
        commentIsLeading = false;

    var stack = [];

    var stringDelim = null;

    /* istanbul ignore next */
    /**
     * Creates an error for illegal syntax.
     * @param {string} subject Subject
     * @returns {Error} Error created
     * @inner
     */
    function illegal(subject) {
        return Error("illegal " + subject + " (line " + line + ")");
    }

    /**
     * Reads a string till its end.
     * @returns {string} String read
     * @inner
     */
    function readString() {
        var re = stringDelim === "'" ? stringSingleRe : stringDoubleRe;
        re.lastIndex = offset - 1;
        var match = re.exec(source);
        if (!match)
            throw illegal("string");
        offset = re.lastIndex;
        push(stringDelim);
        stringDelim = null;
        return unescape$1(match[1]);
    }

    /**
     * Gets the character at `pos` within the source.
     * @param {number} pos Position
     * @returns {string} Character
     * @inner
     */
    function charAt(pos) {
        return source.charAt(pos);
    }

    /**
     * Sets the current comment text.
     * @param {number} start Start offset
     * @param {number} end End offset
     * @param {boolean} isLeading set if a leading comment
     * @returns {undefined}
     * @inner
     */
    function setComment(start, end, isLeading) {
        commentType = source.charAt(start++);
        commentLine = line;
        commentLineEmpty = false;
        commentIsLeading = isLeading;
        var lookback;
        if (alternateCommentMode) {
            lookback = 2;  // alternate comment parsing: "//" or "/*"
        } else {
            lookback = 3;  // "///" or "/**"
        }
        var commentOffset = start - lookback,
            c;
        do {
            if (--commentOffset < 0 ||
                    (c = source.charAt(commentOffset)) === "\n") {
                commentLineEmpty = true;
                break;
            }
        } while (c === " " || c === "\t");
        var lines = source
            .substring(start, end)
            .split(setCommentSplitRe);
        for (var i = 0; i < lines.length; ++i)
            lines[i] = lines[i]
                .replace(alternateCommentMode ? setCommentAltRe : setCommentRe, "")
                .trim();
        commentText = lines
            .join("\n")
            .trim();
    }

    function isDoubleSlashCommentLine(startOffset) {
        var endOffset = findEndOfLine(startOffset);

        // see if remaining line matches comment pattern
        var lineText = source.substring(startOffset, endOffset);
        // look for 1 or 2 slashes since startOffset would already point past
        // the first slash that started the comment.
        var isComment = /^\s*\/{1,2}/.test(lineText);
        return isComment;
    }

    function findEndOfLine(cursor) {
        // find end of cursor's line
        var endOffset = cursor;
        while (endOffset < length && charAt(endOffset) !== "\n") {
            endOffset++;
        }
        return endOffset;
    }

    /**
     * Obtains the next token.
     * @returns {string|null} Next token or `null` on eof
     * @inner
     */
    function next() {
        if (stack.length > 0)
            return stack.shift();
        if (stringDelim)
            return readString();
        var repeat,
            prev,
            curr,
            start,
            isDoc,
            isLeadingComment = offset === 0;
        do {
            if (offset === length)
                return null;
            repeat = false;
            while (whitespaceRe.test(curr = charAt(offset))) {
                if (curr === "\n") {
                    isLeadingComment = true;
                    ++line;
                }
                if (++offset === length)
                    return null;
            }

            if (charAt(offset) === "/") {
                if (++offset === length) {
                    throw illegal("comment");
                }
                if (charAt(offset) === "/") { // Line
                    if (!alternateCommentMode) {
                        // check for triple-slash comment
                        isDoc = charAt(start = offset + 1) === "/";

                        while (charAt(++offset) !== "\n") {
                            if (offset === length) {
                                return null;
                            }
                        }
                        ++offset;
                        if (isDoc) {
                            setComment(start, offset - 1, isLeadingComment);
                        }
                        ++line;
                        repeat = true;
                    } else {
                        // check for double-slash comments, consolidating consecutive lines
                        start = offset;
                        isDoc = false;
                        if (isDoubleSlashCommentLine(offset)) {
                            isDoc = true;
                            do {
                                offset = findEndOfLine(offset);
                                if (offset === length) {
                                    break;
                                }
                                offset++;
                            } while (isDoubleSlashCommentLine(offset));
                        } else {
                            offset = Math.min(length, findEndOfLine(offset) + 1);
                        }
                        if (isDoc) {
                            setComment(start, offset, isLeadingComment);
                        }
                        line++;
                        repeat = true;
                    }
                } else if ((curr = charAt(offset)) === "*") { /* Block */
                    // check for /** (regular comment mode) or /* (alternate comment mode)
                    start = offset + 1;
                    isDoc = alternateCommentMode || charAt(start) === "*";
                    do {
                        if (curr === "\n") {
                            ++line;
                        }
                        if (++offset === length) {
                            throw illegal("comment");
                        }
                        prev = curr;
                        curr = charAt(offset);
                    } while (prev !== "*" || curr !== "/");
                    ++offset;
                    if (isDoc) {
                        setComment(start, offset - 2, isLeadingComment);
                    }
                    repeat = true;
                } else {
                    return "/";
                }
            }
        } while (repeat);

        // offset !== length if we got here

        var end = offset;
        delimRe.lastIndex = 0;
        var delim = delimRe.test(charAt(end++));
        if (!delim)
            while (end < length && !delimRe.test(charAt(end)))
                ++end;
        var token = source.substring(offset, offset = end);
        if (token === "\"" || token === "'")
            stringDelim = token;
        return token;
    }

    /**
     * Pushes a token back to the stack.
     * @param {string} token Token
     * @returns {undefined}
     * @inner
     */
    function push(token) {
        stack.push(token);
    }

    /**
     * Peeks for the next token.
     * @returns {string|null} Token or `null` on eof
     * @inner
     */
    function peek() {
        if (!stack.length) {
            var token = next();
            if (token === null)
                return null;
            push(token);
        }
        return stack[0];
    }

    /**
     * Skips a token.
     * @param {string} expected Expected token
     * @param {boolean} [optional=false] Whether the token is optional
     * @returns {boolean} `true` when skipped, `false` if not
     * @throws {Error} When a required token is not present
     * @inner
     */
    function skip(expected, optional) {
        var actual = peek(),
            equals = actual === expected;
        if (equals) {
            next();
            return true;
        }
        if (!optional)
            throw illegal("token '" + actual + "', '" + expected + "' expected");
        return false;
    }

    /**
     * Gets a comment.
     * @param {number} [trailingLine] Line number if looking for a trailing comment
     * @returns {string|null} Comment text
     * @inner
     */
    function cmnt(trailingLine) {
        var ret = null;
        if (trailingLine === undefined) {
            if (commentLine === line - 1 && (alternateCommentMode || commentType === "*" || commentLineEmpty)) {
                ret = commentIsLeading ? commentText : null;
            }
        } else {
            /* istanbul ignore else */
            if (commentLine < trailingLine) {
                peek();
            }
            if (commentLine === trailingLine && !commentLineEmpty && (alternateCommentMode || commentType === "/")) {
                ret = commentIsLeading ? null : commentText;
            }
        }
        return ret;
    }

    return Object.defineProperty({
        next: next,
        peek: peek,
        push: push,
        skip: skip,
        cmnt: cmnt
    }, "line", {
        get: function() { return line; }
    });
    /* eslint-enable callback-return */
}

var parse_1 = parse;

parse.filename = null;
parse.defaults = { keepCase: false };

var tokenize  = tokenize_1,
    Root      = requireRoot(),
    Type      = requireType(),
    Field     = requireField(),
    MapField  = requireMapfield(),
    OneOf     = requireOneof(),
    Enum      = require_enum(),
    Service   = requireService(),
    Method    = requireMethod(),
    types     = requireTypes(),
    util      = requireUtil();

var base10Re    = /^[1-9][0-9]*$/,
    base10NegRe = /^-?[1-9][0-9]*$/,
    base16Re    = /^0[x][0-9a-fA-F]+$/,
    base16NegRe = /^-?0[x][0-9a-fA-F]+$/,
    base8Re     = /^0[0-7]+$/,
    base8NegRe  = /^-?0[0-7]+$/,
    numberRe    = /^(?![eE])[0-9]*(?:\.[0-9]*)?(?:[eE][+-]?[0-9]+)?$/,
    nameRe      = /^[a-zA-Z_][a-zA-Z_0-9]*$/,
    typeRefRe   = /^(?:\.?[a-zA-Z_][a-zA-Z_0-9]*)(?:\.[a-zA-Z_][a-zA-Z_0-9]*)*$/,
    fqTypeRefRe = /^(?:\.[a-zA-Z_][a-zA-Z_0-9]*)+$/;

/**
 * Result object returned from {@link parse}.
 * @interface IParserResult
 * @property {string|undefined} package Package name, if declared
 * @property {string[]|undefined} imports Imports, if any
 * @property {string[]|undefined} weakImports Weak imports, if any
 * @property {string|undefined} syntax Syntax, if specified (either `"proto2"` or `"proto3"`)
 * @property {Root} root Populated root instance
 */

/**
 * Options modifying the behavior of {@link parse}.
 * @interface IParseOptions
 * @property {boolean} [keepCase=false] Keeps field casing instead of converting to camel case
 * @property {boolean} [alternateCommentMode=false] Recognize double-slash comments in addition to doc-block comments.
 * @property {boolean} [preferTrailingComment=false] Use trailing comment when both leading comment and trailing comment exist.
 */

/**
 * Options modifying the behavior of JSON serialization.
 * @interface IToJSONOptions
 * @property {boolean} [keepComments=false] Serializes comments.
 */

/**
 * Parses the given .proto source and returns an object with the parsed contents.
 * @param {string} source Source contents
 * @param {Root} root Root to populate
 * @param {IParseOptions} [options] Parse options. Defaults to {@link parse.defaults} when omitted.
 * @returns {IParserResult} Parser result
 * @property {string} filename=null Currently processing file name for error reporting, if known
 * @property {IParseOptions} defaults Default {@link IParseOptions}
 */
function parse(source, root, options) {
    /* eslint-disable callback-return */
    if (!(root instanceof Root)) {
        options = root;
        root = new Root();
    }
    if (!options)
        options = parse.defaults;

    var preferTrailingComment = options.preferTrailingComment || false;
    var tn = tokenize(source, options.alternateCommentMode || false),
        next = tn.next,
        push = tn.push,
        peek = tn.peek,
        skip = tn.skip,
        cmnt = tn.cmnt;

    var head = true,
        pkg,
        imports,
        weakImports,
        syntax,
        isProto3 = false;

    var ptr = root;

    var applyCase = options.keepCase ? function(name) { return name; } : util.camelCase;

    /* istanbul ignore next */
    function illegal(token, name, insideTryCatch) {
        var filename = parse.filename;
        if (!insideTryCatch)
            parse.filename = null;
        return Error("illegal " + (name || "token") + " '" + token + "' (" + (filename ? filename + ", " : "") + "line " + tn.line + ")");
    }

    function readString() {
        var values = [],
            token;
        do {
            /* istanbul ignore if */
            if ((token = next()) !== "\"" && token !== "'")
                throw illegal(token);

            values.push(next());
            skip(token);
            token = peek();
        } while (token === "\"" || token === "'");
        return values.join("");
    }

    function readValue(acceptTypeRef) {
        var token = next();
        switch (token) {
            case "'":
            case "\"":
                push(token);
                return readString();
            case "true": case "TRUE":
                return true;
            case "false": case "FALSE":
                return false;
        }
        try {
            return parseNumber(token, /* insideTryCatch */ true);
        } catch (e) {

            /* istanbul ignore else */
            if (acceptTypeRef && typeRefRe.test(token))
                return token;

            /* istanbul ignore next */
            throw illegal(token, "value");
        }
    }

    function readRanges(target, acceptStrings) {
        var token, start;
        do {
            if (acceptStrings && ((token = peek()) === "\"" || token === "'"))
                target.push(readString());
            else
                target.push([ start = parseId(next()), skip("to", true) ? parseId(next()) : start ]);
        } while (skip(",", true));
        skip(";");
    }

    function parseNumber(token, insideTryCatch) {
        var sign = 1;
        if (token.charAt(0) === "-") {
            sign = -1;
            token = token.substring(1);
        }
        switch (token) {
            case "inf": case "INF": case "Inf":
                return sign * Infinity;
            case "nan": case "NAN": case "Nan": case "NaN":
                return NaN;
            case "0":
                return 0;
        }
        if (base10Re.test(token))
            return sign * parseInt(token, 10);
        if (base16Re.test(token))
            return sign * parseInt(token, 16);
        if (base8Re.test(token))
            return sign * parseInt(token, 8);

        /* istanbul ignore else */
        if (numberRe.test(token))
            return sign * parseFloat(token);

        /* istanbul ignore next */
        throw illegal(token, "number", insideTryCatch);
    }

    function parseId(token, acceptNegative) {
        switch (token) {
            case "max": case "MAX": case "Max":
                return 536870911;
            case "0":
                return 0;
        }

        /* istanbul ignore if */
        if (!acceptNegative && token.charAt(0) === "-")
            throw illegal(token, "id");

        if (base10NegRe.test(token))
            return parseInt(token, 10);
        if (base16NegRe.test(token))
            return parseInt(token, 16);

        /* istanbul ignore else */
        if (base8NegRe.test(token))
            return parseInt(token, 8);

        /* istanbul ignore next */
        throw illegal(token, "id");
    }

    function parsePackage() {

        /* istanbul ignore if */
        if (pkg !== undefined)
            throw illegal("package");

        pkg = next();

        /* istanbul ignore if */
        if (!typeRefRe.test(pkg))
            throw illegal(pkg, "name");

        ptr = ptr.define(pkg);
        skip(";");
    }

    function parseImport() {
        var token = peek();
        var whichImports;
        switch (token) {
            case "weak":
                whichImports = weakImports || (weakImports = []);
                next();
                break;
            case "public":
                next();
                // eslint-disable-line no-fallthrough
            default:
                whichImports = imports || (imports = []);
                break;
        }
        token = readString();
        skip(";");
        whichImports.push(token);
    }

    function parseSyntax() {
        skip("=");
        syntax = readString();
        isProto3 = syntax === "proto3";

        /* istanbul ignore if */
        if (!isProto3 && syntax !== "proto2")
            throw illegal(syntax, "syntax");

        skip(";");
    }

    function parseCommon(parent, token) {
        switch (token) {

            case "option":
                parseOption(parent, token);
                skip(";");
                return true;

            case "message":
                parseType(parent, token);
                return true;

            case "enum":
                parseEnum(parent, token);
                return true;

            case "service":
                parseService(parent, token);
                return true;

            case "extend":
                parseExtension(parent, token);
                return true;
        }
        return false;
    }

    function ifBlock(obj, fnIf, fnElse) {
        var trailingLine = tn.line;
        if (obj) {
            if(typeof obj.comment !== "string") {
              obj.comment = cmnt(); // try block-type comment
            }
            obj.filename = parse.filename;
        }
        if (skip("{", true)) {
            var token;
            while ((token = next()) !== "}")
                fnIf(token);
            skip(";", true);
        } else {
            if (fnElse)
                fnElse();
            skip(";");
            if (obj && (typeof obj.comment !== "string" || preferTrailingComment))
                obj.comment = cmnt(trailingLine) || obj.comment; // try line-type comment
        }
    }

    function parseType(parent, token) {

        /* istanbul ignore if */
        if (!nameRe.test(token = next()))
            throw illegal(token, "type name");

        var type = new Type(token);
        ifBlock(type, function parseType_block(token) {
            if (parseCommon(type, token))
                return;

            switch (token) {

                case "map":
                    parseMapField(type);
                    break;

                case "required":
                case "repeated":
                    parseField(type, token);
                    break;

                case "optional":
                    /* istanbul ignore if */
                    if (isProto3) {
                        parseField(type, "proto3_optional");
                    } else {
                        parseField(type, "optional");
                    }
                    break;

                case "oneof":
                    parseOneOf(type, token);
                    break;

                case "extensions":
                    readRanges(type.extensions || (type.extensions = []));
                    break;

                case "reserved":
                    readRanges(type.reserved || (type.reserved = []), true);
                    break;

                default:
                    /* istanbul ignore if */
                    if (!isProto3 || !typeRefRe.test(token))
                        throw illegal(token);

                    push(token);
                    parseField(type, "optional");
                    break;
            }
        });
        parent.add(type);
    }

    function parseField(parent, rule, extend) {
        var type = next();
        if (type === "group") {
            parseGroup(parent, rule);
            return;
        }

        /* istanbul ignore if */
        if (!typeRefRe.test(type))
            throw illegal(type, "type");

        var name = next();

        /* istanbul ignore if */
        if (!nameRe.test(name))
            throw illegal(name, "name");

        name = applyCase(name);
        skip("=");

        var field = new Field(name, parseId(next()), type, rule, extend);
        ifBlock(field, function parseField_block(token) {

            /* istanbul ignore else */
            if (token === "option") {
                parseOption(field, token);
                skip(";");
            } else
                throw illegal(token);

        }, function parseField_line() {
            parseInlineOptions(field);
        });

        if (rule === "proto3_optional") {
            // for proto3 optional fields, we create a single-member Oneof to mimic "optional" behavior
            var oneof = new OneOf("_" + name);
            field.setOption("proto3_optional", true);
            oneof.add(field);
            parent.add(oneof);
        } else {
            parent.add(field);
        }

        // JSON defaults to packed=true if not set so we have to set packed=false explicity when
        // parsing proto2 descriptors without the option, where applicable. This must be done for
        // all known packable types and anything that could be an enum (= is not a basic type).
        if (!isProto3 && field.repeated && (types.packed[type] !== undefined || types.basic[type] === undefined))
            field.setOption("packed", false, /* ifNotSet */ true);
    }

    function parseGroup(parent, rule) {
        var name = next();

        /* istanbul ignore if */
        if (!nameRe.test(name))
            throw illegal(name, "name");

        var fieldName = util.lcFirst(name);
        if (name === fieldName)
            name = util.ucFirst(name);
        skip("=");
        var id = parseId(next());
        var type = new Type(name);
        type.group = true;
        var field = new Field(fieldName, id, name, rule);
        field.filename = parse.filename;
        ifBlock(type, function parseGroup_block(token) {
            switch (token) {

                case "option":
                    parseOption(type, token);
                    skip(";");
                    break;

                case "required":
                case "repeated":
                    parseField(type, token);
                    break;

                case "optional":
                    /* istanbul ignore if */
                    if (isProto3) {
                        parseField(type, "proto3_optional");
                    } else {
                        parseField(type, "optional");
                    }
                    break;

                /* istanbul ignore next */
                default:
                    throw illegal(token); // there are no groups with proto3 semantics
            }
        });
        parent.add(type)
              .add(field);
    }

    function parseMapField(parent) {
        skip("<");
        var keyType = next();

        /* istanbul ignore if */
        if (types.mapKey[keyType] === undefined)
            throw illegal(keyType, "type");

        skip(",");
        var valueType = next();

        /* istanbul ignore if */
        if (!typeRefRe.test(valueType))
            throw illegal(valueType, "type");

        skip(">");
        var name = next();

        /* istanbul ignore if */
        if (!nameRe.test(name))
            throw illegal(name, "name");

        skip("=");
        var field = new MapField(applyCase(name), parseId(next()), keyType, valueType);
        ifBlock(field, function parseMapField_block(token) {

            /* istanbul ignore else */
            if (token === "option") {
                parseOption(field, token);
                skip(";");
            } else
                throw illegal(token);

        }, function parseMapField_line() {
            parseInlineOptions(field);
        });
        parent.add(field);
    }

    function parseOneOf(parent, token) {

        /* istanbul ignore if */
        if (!nameRe.test(token = next()))
            throw illegal(token, "name");

        var oneof = new OneOf(applyCase(token));
        ifBlock(oneof, function parseOneOf_block(token) {
            if (token === "option") {
                parseOption(oneof, token);
                skip(";");
            } else {
                push(token);
                parseField(oneof, "optional");
            }
        });
        parent.add(oneof);
    }

    function parseEnum(parent, token) {

        /* istanbul ignore if */
        if (!nameRe.test(token = next()))
            throw illegal(token, "name");

        var enm = new Enum(token);
        ifBlock(enm, function parseEnum_block(token) {
          switch(token) {
            case "option":
              parseOption(enm, token);
              skip(";");
              break;

            case "reserved":
              readRanges(enm.reserved || (enm.reserved = []), true);
              break;

            default:
              parseEnumValue(enm, token);
          }
        });
        parent.add(enm);
    }

    function parseEnumValue(parent, token) {

        /* istanbul ignore if */
        if (!nameRe.test(token))
            throw illegal(token, "name");

        skip("=");
        var value = parseId(next(), true),
            dummy = {};
        ifBlock(dummy, function parseEnumValue_block(token) {

            /* istanbul ignore else */
            if (token === "option") {
                parseOption(dummy, token); // skip
                skip(";");
            } else
                throw illegal(token);

        }, function parseEnumValue_line() {
            parseInlineOptions(dummy); // skip
        });
        parent.add(token, value, dummy.comment);
    }

    function parseOption(parent, token) {
        var isCustom = skip("(", true);

        /* istanbul ignore if */
        if (!typeRefRe.test(token = next()))
            throw illegal(token, "name");

        var name = token;
        var option = name;
        var propName;

        if (isCustom) {
            skip(")");
            name = "(" + name + ")";
            option = name;
            token = peek();
            if (fqTypeRefRe.test(token)) {
                propName = token.substr(1); //remove '.' before property name
                name += token;
                next();
            }
        }
        skip("=");
        var optionValue = parseOptionValue(parent, name);
        setParsedOption(parent, option, optionValue, propName);
    }

    function parseOptionValue(parent, name) {
        if (skip("{", true)) { // { a: "foo" b { c: "bar" } }
            var result = {};
            while (!skip("}", true)) {
                /* istanbul ignore if */
                if (!nameRe.test(token = next()))
                    throw illegal(token, "name");

                var value;
                var propName = token;
                if (peek() === "{")
                    value = parseOptionValue(parent, name + "." + token);
                else {
                    skip(":");
                    if (peek() === "{")
                        value = parseOptionValue(parent, name + "." + token);
                    else {
                        value = readValue(true);
                        setOption(parent, name + "." + token, value);
                    }
                }
                var prevValue = result[propName];
                if (prevValue)
                    value = [].concat(prevValue).concat(value);
                result[propName] = value;
                skip(",", true);
            }
            return result;
        }

        var simpleValue = readValue(true);
        setOption(parent, name, simpleValue);
        return simpleValue;
        // Does not enforce a delimiter to be universal
    }

    function setOption(parent, name, value) {
        if (parent.setOption)
            parent.setOption(name, value);
    }

    function setParsedOption(parent, name, value, propName) {
        if (parent.setParsedOption)
            parent.setParsedOption(name, value, propName);
    }

    function parseInlineOptions(parent) {
        if (skip("[", true)) {
            do {
                parseOption(parent, "option");
            } while (skip(",", true));
            skip("]");
        }
        return parent;
    }

    function parseService(parent, token) {

        /* istanbul ignore if */
        if (!nameRe.test(token = next()))
            throw illegal(token, "service name");

        var service = new Service(token);
        ifBlock(service, function parseService_block(token) {
            if (parseCommon(service, token))
                return;

            /* istanbul ignore else */
            if (token === "rpc")
                parseMethod(service, token);
            else
                throw illegal(token);
        });
        parent.add(service);
    }

    function parseMethod(parent, token) {
        // Get the comment of the preceding line now (if one exists) in case the
        // method is defined across multiple lines.
        var commentText = cmnt();

        var type = token;

        /* istanbul ignore if */
        if (!nameRe.test(token = next()))
            throw illegal(token, "name");

        var name = token,
            requestType, requestStream,
            responseType, responseStream;

        skip("(");
        if (skip("stream", true))
            requestStream = true;

        /* istanbul ignore if */
        if (!typeRefRe.test(token = next()))
            throw illegal(token);

        requestType = token;
        skip(")"); skip("returns"); skip("(");
        if (skip("stream", true))
            responseStream = true;

        /* istanbul ignore if */
        if (!typeRefRe.test(token = next()))
            throw illegal(token);

        responseType = token;
        skip(")");

        var method = new Method(name, type, requestType, responseType, requestStream, responseStream);
        method.comment = commentText;
        ifBlock(method, function parseMethod_block(token) {

            /* istanbul ignore else */
            if (token === "option") {
                parseOption(method, token);
                skip(";");
            } else
                throw illegal(token);

        });
        parent.add(method);
    }

    function parseExtension(parent, token) {

        /* istanbul ignore if */
        if (!typeRefRe.test(token = next()))
            throw illegal(token, "reference");

        var reference = token;
        ifBlock(null, function parseExtension_block(token) {
            switch (token) {

                case "required":
                case "repeated":
                    parseField(parent, token, reference);
                    break;

                case "optional":
                    /* istanbul ignore if */
                    if (isProto3) {
                        parseField(parent, "proto3_optional", reference);
                    } else {
                        parseField(parent, "optional", reference);
                    }
                    break;

                default:
                    /* istanbul ignore if */
                    if (!isProto3 || !typeRefRe.test(token))
                        throw illegal(token);
                    push(token);
                    parseField(parent, "optional", reference);
                    break;
            }
        });
    }

    var token;
    while ((token = next()) !== null) {
        switch (token) {

            case "package":

                /* istanbul ignore if */
                if (!head)
                    throw illegal(token);

                parsePackage();
                break;

            case "import":

                /* istanbul ignore if */
                if (!head)
                    throw illegal(token);

                parseImport();
                break;

            case "syntax":

                /* istanbul ignore if */
                if (!head)
                    throw illegal(token);

                parseSyntax();
                break;

            case "option":

                parseOption(ptr, token);
                skip(";");
                break;

            default:

                /* istanbul ignore else */
                if (parseCommon(ptr, token)) {
                    head = false;
                    continue;
                }

                /* istanbul ignore next */
                throw illegal(token);
        }
    }

    parse.filename = null;
    return {
        "package"     : pkg,
        "imports"     : imports,
         weakImports  : weakImports,
         syntax       : syntax,
         root         : root
    };
}

var common_1 = common;

var commonRe = /\/|\./;

/**
 * Provides common type definitions.
 * Can also be used to provide additional google types or your own custom types.
 * @param {string} name Short name as in `google/protobuf/[name].proto` or full file name
 * @param {Object.<string,*>} json JSON definition within `google.protobuf` if a short name, otherwise the file's root definition
 * @returns {undefined}
 * @property {INamespace} google/protobuf/any.proto Any
 * @property {INamespace} google/protobuf/duration.proto Duration
 * @property {INamespace} google/protobuf/empty.proto Empty
 * @property {INamespace} google/protobuf/field_mask.proto FieldMask
 * @property {INamespace} google/protobuf/struct.proto Struct, Value, NullValue and ListValue
 * @property {INamespace} google/protobuf/timestamp.proto Timestamp
 * @property {INamespace} google/protobuf/wrappers.proto Wrappers
 * @example
 * // manually provides descriptor.proto (assumes google/protobuf/ namespace and .proto extension)
 * protobuf.common("descriptor", descriptorJson);
 *
 * // manually provides a custom definition (uses my.foo namespace)
 * protobuf.common("my/foo/bar.proto", myFooBarJson);
 */
function common(name, json) {
    if (!commonRe.test(name)) {
        name = "google/protobuf/" + name + ".proto";
        json = { nested: { google: { nested: { protobuf: { nested: json } } } } };
    }
    common[name] = json;
}

// Not provided because of limited use (feel free to discuss or to provide yourself):
//
// google/protobuf/descriptor.proto
// google/protobuf/source_context.proto
// google/protobuf/type.proto
//
// Stripped and pre-parsed versions of these non-bundled files are instead available as part of
// the repository or package within the google/protobuf directory.

common("any", {

    /**
     * Properties of a google.protobuf.Any message.
     * @interface IAny
     * @type {Object}
     * @property {string} [typeUrl]
     * @property {Uint8Array} [bytes]
     * @memberof common
     */
    Any: {
        fields: {
            type_url: {
                type: "string",
                id: 1
            },
            value: {
                type: "bytes",
                id: 2
            }
        }
    }
});

var timeType;

common("duration", {

    /**
     * Properties of a google.protobuf.Duration message.
     * @interface IDuration
     * @type {Object}
     * @property {number|Long} [seconds]
     * @property {number} [nanos]
     * @memberof common
     */
    Duration: timeType = {
        fields: {
            seconds: {
                type: "int64",
                id: 1
            },
            nanos: {
                type: "int32",
                id: 2
            }
        }
    }
});

common("timestamp", {

    /**
     * Properties of a google.protobuf.Timestamp message.
     * @interface ITimestamp
     * @type {Object}
     * @property {number|Long} [seconds]
     * @property {number} [nanos]
     * @memberof common
     */
    Timestamp: timeType
});

common("empty", {

    /**
     * Properties of a google.protobuf.Empty message.
     * @interface IEmpty
     * @memberof common
     */
    Empty: {
        fields: {}
    }
});

common("struct", {

    /**
     * Properties of a google.protobuf.Struct message.
     * @interface IStruct
     * @type {Object}
     * @property {Object.<string,IValue>} [fields]
     * @memberof common
     */
    Struct: {
        fields: {
            fields: {
                keyType: "string",
                type: "Value",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.Value message.
     * @interface IValue
     * @type {Object}
     * @property {string} [kind]
     * @property {0} [nullValue]
     * @property {number} [numberValue]
     * @property {string} [stringValue]
     * @property {boolean} [boolValue]
     * @property {IStruct} [structValue]
     * @property {IListValue} [listValue]
     * @memberof common
     */
    Value: {
        oneofs: {
            kind: {
                oneof: [
                    "nullValue",
                    "numberValue",
                    "stringValue",
                    "boolValue",
                    "structValue",
                    "listValue"
                ]
            }
        },
        fields: {
            nullValue: {
                type: "NullValue",
                id: 1
            },
            numberValue: {
                type: "double",
                id: 2
            },
            stringValue: {
                type: "string",
                id: 3
            },
            boolValue: {
                type: "bool",
                id: 4
            },
            structValue: {
                type: "Struct",
                id: 5
            },
            listValue: {
                type: "ListValue",
                id: 6
            }
        }
    },

    NullValue: {
        values: {
            NULL_VALUE: 0
        }
    },

    /**
     * Properties of a google.protobuf.ListValue message.
     * @interface IListValue
     * @type {Object}
     * @property {Array.<IValue>} [values]
     * @memberof common
     */
    ListValue: {
        fields: {
            values: {
                rule: "repeated",
                type: "Value",
                id: 1
            }
        }
    }
});

common("wrappers", {

    /**
     * Properties of a google.protobuf.DoubleValue message.
     * @interface IDoubleValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */
    DoubleValue: {
        fields: {
            value: {
                type: "double",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.FloatValue message.
     * @interface IFloatValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */
    FloatValue: {
        fields: {
            value: {
                type: "float",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.Int64Value message.
     * @interface IInt64Value
     * @type {Object}
     * @property {number|Long} [value]
     * @memberof common
     */
    Int64Value: {
        fields: {
            value: {
                type: "int64",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.UInt64Value message.
     * @interface IUInt64Value
     * @type {Object}
     * @property {number|Long} [value]
     * @memberof common
     */
    UInt64Value: {
        fields: {
            value: {
                type: "uint64",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.Int32Value message.
     * @interface IInt32Value
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */
    Int32Value: {
        fields: {
            value: {
                type: "int32",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.UInt32Value message.
     * @interface IUInt32Value
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */
    UInt32Value: {
        fields: {
            value: {
                type: "uint32",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.BoolValue message.
     * @interface IBoolValue
     * @type {Object}
     * @property {boolean} [value]
     * @memberof common
     */
    BoolValue: {
        fields: {
            value: {
                type: "bool",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.StringValue message.
     * @interface IStringValue
     * @type {Object}
     * @property {string} [value]
     * @memberof common
     */
    StringValue: {
        fields: {
            value: {
                type: "string",
                id: 1
            }
        }
    },

    /**
     * Properties of a google.protobuf.BytesValue message.
     * @interface IBytesValue
     * @type {Object}
     * @property {Uint8Array} [value]
     * @memberof common
     */
    BytesValue: {
        fields: {
            value: {
                type: "bytes",
                id: 1
            }
        }
    }
});

common("field_mask", {

    /**
     * Properties of a google.protobuf.FieldMask message.
     * @interface IDoubleValue
     * @type {Object}
     * @property {number} [value]
     * @memberof common
     */
    FieldMask: {
        fields: {
            paths: {
                rule: "repeated",
                type: "string",
                id: 1
            }
        }
    }
});

/**
 * Gets the root definition of the specified common proto file.
 *
 * Bundled definitions are:
 * - google/protobuf/any.proto
 * - google/protobuf/duration.proto
 * - google/protobuf/empty.proto
 * - google/protobuf/field_mask.proto
 * - google/protobuf/struct.proto
 * - google/protobuf/timestamp.proto
 * - google/protobuf/wrappers.proto
 *
 * @param {string} file Proto file name
 * @returns {INamespace|null} Root definition or `null` if not defined
 */
common.get = function get(file) {
    return common[file] || null;
};

(function (module) {
	var protobuf = module.exports = indexLight.exports;

	protobuf.build = "full";

	// Parser
	protobuf.tokenize         = tokenize_1;
	protobuf.parse            = parse_1;
	protobuf.common           = common_1;

	// Configure parser
	protobuf.Root._configure(protobuf.Type, protobuf.parse, protobuf.common);
} (src));

(function (module) {
	module.exports = src.exports;
} (protobufjs));

class ArrayBufferConverter {
    static async set(value) {
        return new Uint8Array(value);
    }
    static async get(value) {
        return new Uint8Array(value).buffer;
    }
}

function ProtobufElement(params) {
    return (target) => {
        const t = target;
        t.localName = params.name || t.name || t.toString().match(/^function\s*([^\s(]+)/)[1];
        t.items = t.items || {};
        t.target = target;
        t.items = assign({}, t.items);
        const scheme = new protobufjs.exports.Type(t.localName);
        for (const key in t.items) {
            const item = t.items[key];
            let rule = void 0;
            if (item.repeated) {
                rule = "repeated";
            }
            else if (item.required) {
                rule = "required";
            }
            scheme.add(new protobufjs.exports.Field(item.name, item.id, item.type, rule));
        }
        t.protobuf = scheme;
    };
}
function defineProperty(target, key, params) {
    const propertyKey = `_${key}`;
    const opt = {
        set: function (v) {
            if (this[propertyKey] !== v) {
                this.raw = null;
                this[propertyKey] = v;
            }
        },
        get: function () {
            if (this[propertyKey] === void 0) {
                let defaultValue = params.defaultValue;
                if (params.parser && !params.repeated) {
                    defaultValue = new params.parser();
                }
                this[propertyKey] = defaultValue;
            }
            return this[propertyKey];
        },
        enumerable: true,
    };
    Object.defineProperty(target, propertyKey, { writable: true, enumerable: false });
    Object.defineProperty(target, key, opt);
}
function ProtobufProperty(params) {
    return (target, propertyKey) => {
        const t = target.constructor;
        const key = propertyKey;
        t.items = t.items || {};
        if (t.target !== t) {
            t.items = assign({}, t.items);
            t.target = t;
        }
        t.items[key] = {
            id: params.id,
            type: params.type || "bytes",
            defaultValue: params.defaultValue,
            converter: params.converter || null,
            parser: params.parser || null,
        };
        params.name = params.name || key;
        t.items[key].name = params.name;
        t.items[key].required = params.required || false;
        t.items[key].repeated = params.repeated || false;
        defineProperty(target, key, t.items[key]);
    };
}

class ObjectProto {
    static async importProto(data) {
        const res = new this();
        await res.importProto(data);
        return res;
    }
    isEmpty() {
        return this.raw === undefined;
    }
    hasChanged() {
        if (this.raw === null) {
            return true;
        }
        const thisStatic = this.constructor;
        const that = this;
        for (const key in thisStatic.items) {
            const item = thisStatic.items[key];
            if (item.repeated) {
                if (item.parser) {
                    return that[key].some((arrayItem) => arrayItem.hasChanged());
                }
            }
            else {
                if (item.parser && that[key] && that[key].hasChanged()) {
                    return true;
                }
            }
        }
        return false;
    }
    async importProto(data) {
        const thisStatic = this.constructor;
        const that = this;
        let scheme;
        let raw;
        if (data instanceof ObjectProto) {
            raw = await data.exportProto();
        }
        else {
            raw = data;
        }
        try {
            scheme = thisStatic.protobuf.decode(new Uint8Array(raw));
        }
        catch (e) {
            throw new Error(`Error: Cannot decode message for ${thisStatic.localName}.\n$ProtobufError: ${e.message}`);
        }
        for (const key in thisStatic.items) {
            const item = thisStatic.items[key];
            let schemeValues = scheme[item.name];
            if (ArrayBuffer.isView(schemeValues)) {
                schemeValues = new Uint8Array(schemeValues);
            }
            if (!Array.isArray(schemeValues)) {
                if (item.repeated) {
                    that[key] = schemeValues = [];
                }
                else {
                    schemeValues = [schemeValues];
                }
            }
            if (item.repeated && !that[key]) {
                that[key] = [];
            }
            for (const schemeValue of schemeValues) {
                if (item.repeated) {
                    that[key].push(await this.importItem(item, schemeValue));
                }
                else {
                    that[key] = await this.importItem(item, schemeValue);
                }
            }
        }
        this.raw = raw;
    }
    async exportProto() {
        if (!this.hasChanged()) {
            return this.raw;
        }
        const thisStatic = this.constructor;
        const that = this;
        const protobuf = {};
        for (const key in thisStatic.items) {
            const item = thisStatic.items[key];
            let values = that[key];
            if (!Array.isArray(values)) {
                values = values === void 0 ? [] : [values];
            }
            for (const value of values) {
                const protobufValue = await this.exportItem(item, value);
                if (item.repeated) {
                    if (!protobuf[item.name]) {
                        protobuf[item.name] = [];
                    }
                    protobuf[item.name].push(protobufValue);
                }
                else {
                    protobuf[item.name] = protobufValue;
                }
            }
        }
        this.raw = new Uint8Array(thisStatic.protobuf.encode(protobuf).finish()).buffer;
        return this.raw;
    }
    async exportItem(template, value) {
        const thisStatic = this.constructor;
        let result;
        if (template.parser) {
            const obj = value;
            const raw = await obj.exportProto();
            if (template.required && !raw) {
                throw new Error(`Error: Paramter '${template.name}' is required in '${thisStatic.localName}' protobuf message.`);
            }
            if (raw) {
                result = new Uint8Array(raw);
            }
        }
        else {
            if (template.required && value === void 0) {
                throw new Error(`Error: Paramter '${template.name}' is required in '${thisStatic.localName}' protobuf message.`);
            }
            if (template.converter) {
                if (value !== undefined) {
                    result = await template.converter.set(value);
                }
            }
            else {
                if (value instanceof ArrayBuffer) {
                    value = new Uint8Array(value);
                }
                result = value;
            }
        }
        return result;
    }
    async importItem(template, value) {
        const thisStatic = this.constructor;
        let result;
        if (template.parser) {
            const parser = template.parser;
            if (value && value.byteLength) {
                result = await parser.importProto(new Uint8Array(value).buffer);
            }
            else if (template.required) {
                throw new Error(`Error: Parameter '${template.name}' is required in '${thisStatic.localName}' protobuf message.`);
            }
        }
        else if (template.converter) {
            if (value && value.byteLength) {
                result = await template.converter.get(value);
            }
            else if (template.required) {
                throw new Error(`Error: Parameter '${template.name}' is required in '${thisStatic.localName}' protobuf message.`);
            }
        }
        else {
            result = value;
        }
        return result;
    }
}

/**
 * Copyright (c) 2016-2020, Peculiar Ventures, All rights reserved.
 */

const SIGN_ALGORITHM_NAME = "ECDSA";
const DH_ALGORITHM_NAME = "ECDH";
const SECRET_KEY_NAME = "AES-CBC";
const HASH_NAME$1 = "SHA-256";
const HMAC_NAME$1 = "HMAC";
const MAX_RATCHET_STACK_SIZE = 20;
const INFO_TEXT = Convert.FromBinary("InfoText");
const INFO_RATCHET = Convert.FromBinary("InfoRatchet");
const INFO_MESSAGE_KEYS = Convert.FromBinary("InfoMessageKeys");

let engine = null;
if (typeof self !== "undefined") {
    engine = {
        crypto: self.crypto,
        name: "WebCrypto",
    };
}
function setEngine(name, crypto) {
    engine = {
        crypto,
        name,
    };
}
function getEngine() {
    if (!engine) {
        throw new Error("WebCrypto engine is empty. Use setEngine to resolve it.");
    }
    return engine;
}

let Curve = (() => {
    class Curve {
        static async generateKeyPair(type, extractable) {
            const name = type;
            const usage = type === "ECDSA" ? ["sign", "verify"] : ["deriveKey", "deriveBits"];
            const keys = await getEngine().crypto.subtle
                .generateKey({ name, namedCurve: this.NAMED_CURVE }, extractable, usage);
            const publicKey = await ECPublicKey.create(keys.publicKey);
            const res = {
                privateKey: keys.privateKey,
                publicKey,
            };
            return res;
        }
        static deriveBytes(privateKey, publicKey) {
            return getEngine().crypto.subtle.deriveBits({ name: "ECDH", public: publicKey.key }, privateKey, 256);
        }
        static verify(signingKey, message, signature) {
            return getEngine().crypto.subtle
                .verify({ name: "ECDSA", hash: this.DIGEST_ALGORITHM }, signingKey.key, signature, message);
        }
        static async sign(signingKey, message) {
            return getEngine().crypto.subtle.sign({ name: "ECDSA", hash: this.DIGEST_ALGORITHM }, signingKey, message);
        }
        static async ecKeyPairToJson(key) {
            return {
                privateKey: key.privateKey,
                publicKey: key.publicKey.key,
                thumbprint: await key.publicKey.thumbprint(),
            };
        }
        static async ecKeyPairFromJson(keys) {
            return {
                privateKey: keys.privateKey,
                publicKey: await ECPublicKey.create(keys.publicKey),
            };
        }
    }
    Curve.NAMED_CURVE = "P-256";
    Curve.DIGEST_ALGORITHM = "SHA-512";
    return Curve;
})();

const AES_ALGORITHM$1 = { name: "AES-CBC", length: 256 };
class Secret {
    static randomBytes(size) {
        const array = new Uint8Array(size);
        getEngine().crypto.getRandomValues(array);
        return array.buffer;
    }
    static digest(alg, message) {
        return getEngine().crypto.subtle.digest(alg, message);
    }
    static encrypt(key, data, iv) {
        return getEngine().crypto.subtle.encrypt({ name: SECRET_KEY_NAME, iv: new Uint8Array(iv) }, key, data);
    }
    static decrypt(key, data, iv) {
        return getEngine().crypto.subtle.decrypt({ name: SECRET_KEY_NAME, iv: new Uint8Array(iv) }, key, data);
    }
    static importHMAC(raw) {
        return getEngine().crypto.subtle
            .importKey("raw", raw, { name: HMAC_NAME$1, hash: { name: HASH_NAME$1 } }, false, ["sign", "verify"]);
    }
    static importAES(raw) {
        return getEngine().crypto.subtle.importKey("raw", raw, AES_ALGORITHM$1, false, ["encrypt", "decrypt"]);
    }
    static async sign(key, data) {
        return await getEngine().crypto.subtle.sign({ name: HMAC_NAME$1, hash: HASH_NAME$1 }, key, data);
    }
    static async HKDF(IKM, keysCount = 1, salt, info = new ArrayBuffer(0)) {
        if (!salt) {
            salt = await this.importHMAC(new Uint8Array(32).buffer);
        }
        const PRKBytes = await this.sign(salt, IKM);
        new ArrayBuffer(32 + info.byteLength + 1);
        const PRK = await this.importHMAC(PRKBytes);
        const T = [new ArrayBuffer(0)];
        for (let i = 0; i < keysCount; i++) {
            T[i + 1] = await this.sign(PRK, combine(T[i], info, new Uint8Array([i + 1]).buffer));
        }
        return T.slice(1);
    }
}

class ECPublicKey {
    static async create(publicKey) {
        const res = new this();
        const algName = publicKey.algorithm.name.toUpperCase();
        if (!(algName === "ECDH" || algName === "ECDSA")) {
            throw new Error("Error: Unsupported asymmetric key algorithm.");
        }
        if (publicKey.type !== "public") {
            throw new Error("Error: Expected key type to be public but it was not.");
        }
        res.key = publicKey;
        const jwk = await getEngine().crypto.subtle.exportKey("jwk", publicKey);
        if (!(jwk.x && jwk.y)) {
            throw new Error("Wrong JWK data for EC public key. Parameters x and y are required.");
        }
        const x = Convert.FromBase64Url(jwk.x);
        const y = Convert.FromBase64Url(jwk.y);
        const xy = Convert.ToBinary(x) + Convert.ToBinary(y);
        res.serialized = Convert.FromBinary(xy);
        res.id = await res.thumbprint();
        return res;
    }
    static async importKey(bytes, type) {
        const x = Convert.ToBase64Url(bytes.slice(0, 32));
        const y = Convert.ToBase64Url(bytes.slice(32));
        const jwk = {
            crv: Curve.NAMED_CURVE,
            kty: "EC",
            x,
            y,
        };
        const usage = (type === "ECDSA" ? ["verify"] : []);
        const key = await getEngine().crypto.subtle
            .importKey("jwk", jwk, { name: type, namedCurve: Curve.NAMED_CURVE }, true, usage);
        const res = await ECPublicKey.create(key);
        return res;
    }
    serialize() {
        return this.serialized;
    }
    async thumbprint() {
        const bytes = await this.serialize();
        const thumbprint = await Secret.digest("SHA-256", bytes);
        return Convert.ToHex(thumbprint);
    }
    async isEqual(other) {
        if (!(other && other instanceof ECPublicKey)) {
            return false;
        }
        return isEqual(this.serialized, other.serialized);
    }
}

class Identity {
    constructor(id, signingKey, exchangeKey) {
        this.id = id;
        this.signingKey = signingKey;
        this.exchangeKey = exchangeKey;
        this.preKeys = [];
        this.signedPreKeys = [];
    }
    static async fromJSON(obj) {
        const signingKey = await Curve.ecKeyPairFromJson(obj.signingKey);
        const exchangeKey = await Curve.ecKeyPairFromJson(obj.exchangeKey);
        const res = new this(obj.id, signingKey, exchangeKey);
        res.createdAt = new Date(obj.createdAt);
        await res.fromJSON(obj);
        return res;
    }
    static async create(id, signedPreKeyAmount = 0, preKeyAmount = 0, extractable = false) {
        const signingKey = await Curve.generateKeyPair(SIGN_ALGORITHM_NAME, extractable);
        const exchangeKey = await Curve.generateKeyPair(DH_ALGORITHM_NAME, extractable);
        const res = new Identity(id, signingKey, exchangeKey);
        res.createdAt = new Date();
        for (let i = 0; i < preKeyAmount; i++) {
            res.preKeys.push(await Curve.generateKeyPair("ECDH", extractable));
        }
        for (let i = 0; i < signedPreKeyAmount; i++) {
            res.signedPreKeys.push(await Curve.generateKeyPair("ECDH", extractable));
        }
        return res;
    }
    async toJSON() {
        const preKeys = [];
        const signedPreKeys = [];
        for (const key of this.preKeys) {
            preKeys.push(await Curve.ecKeyPairToJson(key));
        }
        for (const key of this.signedPreKeys) {
            signedPreKeys.push(await Curve.ecKeyPairToJson(key));
        }
        return {
            createdAt: this.createdAt.toISOString(),
            exchangeKey: await Curve.ecKeyPairToJson(this.exchangeKey),
            id: this.id,
            preKeys,
            signedPreKeys,
            signingKey: await Curve.ecKeyPairToJson(this.signingKey),
        };
    }
    async fromJSON(obj) {
        this.id = obj.id;
        this.signingKey = await Curve.ecKeyPairFromJson(obj.signingKey);
        this.exchangeKey = await Curve.ecKeyPairFromJson(obj.exchangeKey);
        this.preKeys = [];
        for (const key of obj.preKeys) {
            this.preKeys.push(await Curve.ecKeyPairFromJson(key));
        }
        this.signedPreKeys = [];
        for (const key of obj.signedPreKeys) {
            this.signedPreKeys.push(await Curve.ecKeyPairFromJson(key));
        }
    }
}

class RemoteIdentity {
    static fill(protocol) {
        const res = new RemoteIdentity();
        res.fill(protocol);
        return res;
    }
    static async fromJSON(obj) {
        const res = new this();
        await res.fromJSON(obj);
        return res;
    }
    fill(protocol) {
        this.signingKey = protocol.signingKey;
        this.exchangeKey = protocol.exchangeKey;
        this.signature = protocol.signature;
        this.createdAt = protocol.createdAt;
    }
    verify() {
        return Curve.verify(this.signingKey, this.exchangeKey.serialize(), this.signature);
    }
    async toJSON() {
        return {
            createdAt: this.createdAt.toISOString(),
            exchangeKey: await this.exchangeKey.key,
            id: this.id,
            signature: this.signature,
            signingKey: await this.signingKey.key,
            thumbprint: await this.signingKey.thumbprint(),
        };
    }
    async fromJSON(obj) {
        this.id = obj.id;
        this.signature = obj.signature;
        this.signingKey = await ECPublicKey.create(obj.signingKey);
        this.exchangeKey = await ECPublicKey.create(obj.exchangeKey);
        this.createdAt = new Date(obj.createdAt);
        const ok = await this.verify();
        if (!ok) {
            throw new Error("Error: Wrong signature for RemoteIdentity");
        }
    }
}

let BaseProtocol = (() => {
    let BaseProtocol = class BaseProtocol extends ObjectProto {
    };
    __decorate$2([
        ProtobufProperty({ id: 0, type: "uint32", defaultValue: 1 })
    ], BaseProtocol.prototype, "version", void 0);
    BaseProtocol = __decorate$2([
        ProtobufElement({ name: "Base" })
    ], BaseProtocol);
    return BaseProtocol;
})();

class ECDSAPublicKeyConverter {
    static async set(value) {
        return new Uint8Array(value.serialize());
    }
    static async get(value) {
        return ECPublicKey.importKey(value.buffer, "ECDSA");
    }
}
class ECDHPublicKeyConverter {
    static async set(value) {
        return new Uint8Array(value.serialize());
    }
    static async get(value) {
        return ECPublicKey.importKey(value.buffer, "ECDH");
    }
}
class DateConverter {
    static async set(value) {
        return new Uint8Array(Convert.FromString(value.toISOString()));
    }
    static async get(value) {
        return new Date(Convert.ToString(value));
    }
}

let IdentityProtocol = (() => {
    var IdentityProtocol_1;
    let IdentityProtocol = IdentityProtocol_1 = class IdentityProtocol extends BaseProtocol {
        static async fill(identity) {
            const res = new IdentityProtocol_1();
            await res.fill(identity);
            return res;
        }
        async sign(key) {
            this.signature = await Curve.sign(key, this.exchangeKey.serialize());
        }
        async verify() {
            return await Curve.verify(this.signingKey, this.exchangeKey.serialize(), this.signature);
        }
        async fill(identity) {
            this.signingKey = identity.signingKey.publicKey;
            this.exchangeKey = identity.exchangeKey.publicKey;
            this.createdAt = identity.createdAt;
            await this.sign(identity.signingKey.privateKey);
        }
    };
    __decorate$2([
        ProtobufProperty({ id: 1, converter: ECDSAPublicKeyConverter })
    ], IdentityProtocol.prototype, "signingKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, converter: ECDHPublicKeyConverter })
    ], IdentityProtocol.prototype, "exchangeKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 3 })
    ], IdentityProtocol.prototype, "signature", void 0);
    __decorate$2([
        ProtobufProperty({ id: 4, converter: DateConverter })
    ], IdentityProtocol.prototype, "createdAt", void 0);
    IdentityProtocol = IdentityProtocol_1 = __decorate$2([
        ProtobufElement({ name: "Identity" })
    ], IdentityProtocol);
    return IdentityProtocol;
})();

let MessageProtocol = (() => {
    let MessageProtocol = class MessageProtocol extends BaseProtocol {
    };
    __decorate$2([
        ProtobufProperty({ id: 1, converter: ECDHPublicKeyConverter, required: true })
    ], MessageProtocol.prototype, "senderRatchetKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, type: "uint32", required: true })
    ], MessageProtocol.prototype, "counter", void 0);
    __decorate$2([
        ProtobufProperty({ id: 3, type: "uint32", required: true })
    ], MessageProtocol.prototype, "previousCounter", void 0);
    __decorate$2([
        ProtobufProperty({ id: 4, converter: ArrayBufferConverter, required: true })
    ], MessageProtocol.prototype, "cipherText", void 0);
    MessageProtocol = __decorate$2([
        ProtobufElement({ name: "Message" })
    ], MessageProtocol);
    return MessageProtocol;
})();

let MessageSignedProtocol = (() => {
    let MessageSignedProtocol = class MessageSignedProtocol extends BaseProtocol {
        async sign(hmacKey) {
            this.signature = await this.signHMAC(hmacKey);
        }
        async verify(hmacKey) {
            const signature = await this.signHMAC(hmacKey);
            return isEqual(signature, this.signature);
        }
        async getSignedRaw() {
            const receiverKey = this.receiverKey.serialize();
            const senderKey = this.senderKey.serialize();
            const message = await this.message.exportProto();
            const data = combine(receiverKey, senderKey, message);
            return data;
        }
        async signHMAC(macKey) {
            const data = await this.getSignedRaw();
            const signature = await Secret.sign(macKey, data);
            return signature;
        }
    };
    __decorate$2([
        ProtobufProperty({ id: 1, converter: ECDSAPublicKeyConverter, required: true })
    ], MessageSignedProtocol.prototype, "senderKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, parser: MessageProtocol, required: true })
    ], MessageSignedProtocol.prototype, "message", void 0);
    __decorate$2([
        ProtobufProperty({ id: 3, required: true })
    ], MessageSignedProtocol.prototype, "signature", void 0);
    MessageSignedProtocol = __decorate$2([
        ProtobufElement({ name: "MessageSigned" })
    ], MessageSignedProtocol);
    return MessageSignedProtocol;
})();

let PreKeyMessageProtocol = (() => {
    let PreKeyMessageProtocol = class PreKeyMessageProtocol extends BaseProtocol {
    };
    __decorate$2([
        ProtobufProperty({ id: 1, type: "uint32", required: true })
    ], PreKeyMessageProtocol.prototype, "registrationId", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, type: "uint32" })
    ], PreKeyMessageProtocol.prototype, "preKeyId", void 0);
    __decorate$2([
        ProtobufProperty({ id: 3, type: "uint32", required: true })
    ], PreKeyMessageProtocol.prototype, "preKeySignedId", void 0);
    __decorate$2([
        ProtobufProperty({ id: 4, converter: ECDHPublicKeyConverter, required: true })
    ], PreKeyMessageProtocol.prototype, "baseKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 5, parser: IdentityProtocol, required: true })
    ], PreKeyMessageProtocol.prototype, "identity", void 0);
    __decorate$2([
        ProtobufProperty({ id: 6, parser: MessageSignedProtocol, required: true })
    ], PreKeyMessageProtocol.prototype, "signedMessage", void 0);
    PreKeyMessageProtocol = __decorate$2([
        ProtobufElement({ name: "PreKeyMessage" })
    ], PreKeyMessageProtocol);
    return PreKeyMessageProtocol;
})();

let PreKeyProtocol = (() => {
    let PreKeyProtocol = class PreKeyProtocol extends BaseProtocol {
    };
    __decorate$2([
        ProtobufProperty({ id: 1, type: "uint32", required: true })
    ], PreKeyProtocol.prototype, "id", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, converter: ECDHPublicKeyConverter, required: true })
    ], PreKeyProtocol.prototype, "key", void 0);
    PreKeyProtocol = __decorate$2([
        ProtobufElement({ name: "PreKey" })
    ], PreKeyProtocol);
    return PreKeyProtocol;
})();

let PreKeySignedProtocol = (() => {
    let PreKeySignedProtocol = class PreKeySignedProtocol extends PreKeyProtocol {
        async sign(key) {
            this.signature = await Curve.sign(key, this.key.serialize());
        }
        verify(key) {
            return Curve.verify(key, this.key.serialize(), this.signature);
        }
    };
    __decorate$2([
        ProtobufProperty({ id: 3, converter: ArrayBufferConverter, required: true })
    ], PreKeySignedProtocol.prototype, "signature", void 0);
    PreKeySignedProtocol = __decorate$2([
        ProtobufElement({ name: "PreKeySigned" })
    ], PreKeySignedProtocol);
    return PreKeySignedProtocol;
})();

let PreKeyBundleProtocol = (() => {
    let PreKeyBundleProtocol = class PreKeyBundleProtocol extends BaseProtocol {
    };
    __decorate$2([
        ProtobufProperty({ id: 1, type: "uint32", required: true })
    ], PreKeyBundleProtocol.prototype, "registrationId", void 0);
    __decorate$2([
        ProtobufProperty({ id: 2, parser: IdentityProtocol, required: true })
    ], PreKeyBundleProtocol.prototype, "identity", void 0);
    __decorate$2([
        ProtobufProperty({ id: 3, parser: PreKeyProtocol })
    ], PreKeyBundleProtocol.prototype, "preKey", void 0);
    __decorate$2([
        ProtobufProperty({ id: 4, parser: PreKeySignedProtocol, required: true })
    ], PreKeyBundleProtocol.prototype, "preKeySigned", void 0);
    PreKeyBundleProtocol = __decorate$2([
        ProtobufElement({ name: "PreKeyBundle" })
    ], PreKeyBundleProtocol);
    return PreKeyBundleProtocol;
})();

class Stack {
    constructor(maxSize = 20) {
        this.items = [];
        this.maxSize = maxSize;
    }
    get length() {
        return this.items.length;
    }
    get latest() {
        return this.items[this.length - 1];
    }
    push(item) {
        if (this.length === this.maxSize) {
            this.items = this.items.slice(1);
        }
        this.items.push(item);
    }
    async toJSON() {
        const res = [];
        for (const item of this.items) {
            res.push(await item.toJSON());
        }
        return res;
    }
    async fromJSON(obj) {
        this.items = obj;
    }
}

const CIPHER_KEY_KDF_INPUT = new Uint8Array([1]).buffer;
const ROOT_KEY_KDF_INPUT = new Uint8Array([2]).buffer;
class SymmetricRatchet {
    constructor(rootKey) {
        this.counter = 0;
        this.rootKey = rootKey;
    }
    static async fromJSON(obj) {
        const res = new this(obj.rootKey);
        res.fromJSON(obj);
        return res;
    }
    async toJSON() {
        return {
            counter: this.counter,
            rootKey: this.rootKey,
        };
    }
    async fromJSON(obj) {
        this.counter = obj.counter;
        this.rootKey = obj.rootKey;
    }
    async calculateKey(rootKey) {
        const cipherKeyBytes = await Secret.sign(rootKey, CIPHER_KEY_KDF_INPUT);
        const nextRootKeyBytes = await Secret.sign(rootKey, ROOT_KEY_KDF_INPUT);
        const res = {
            cipher: cipherKeyBytes,
            rootKey: await Secret.importHMAC(nextRootKeyBytes),
        };
        return res;
    }
    async click() {
        const rootKey = this.rootKey;
        const res = await this.calculateKey(rootKey);
        this.rootKey = res.rootKey;
        this.counter++;
        return res.cipher;
    }
}
class SendingRatchet extends SymmetricRatchet {
    async encrypt(message) {
        const cipherKey = await this.click();
        const keys = await Secret.HKDF(cipherKey, 3, void 0, INFO_MESSAGE_KEYS);
        const aesKey = await Secret.importAES(keys[0]);
        const hmacKey = await Secret.importHMAC(keys[1]);
        const iv = keys[2].slice(0, 16);
        const cipherText = await Secret.encrypt(aesKey, message, iv);
        return {
            cipherText,
            hmacKey,
        };
    }
}
class ReceivingRatchet extends SymmetricRatchet {
    constructor() {
        super(...arguments);
        this.keys = [];
    }
    async toJSON() {
        const res = (await super.toJSON());
        res.keys = this.keys;
        return res;
    }
    async fromJSON(obj) {
        await super.fromJSON(obj);
        this.keys = obj.keys;
    }
    async decrypt(message, counter) {
        const cipherKey = await this.getKey(counter);
        const keys = await Secret.HKDF(cipherKey, 3, void 0, INFO_MESSAGE_KEYS);
        const aesKey = await Secret.importAES(keys[0]);
        const hmacKey = await Secret.importHMAC(keys[1]);
        const iv = keys[2].slice(0, 16);
        const cipherText = await Secret.decrypt(aesKey, message, iv);
        return {
            cipherText,
            hmacKey,
        };
    }
    async getKey(counter) {
        while (this.counter <= counter) {
            const cipherKey = await this.click();
            this.keys.push(cipherKey);
        }
        const key = this.keys[counter];
        return key;
    }
}

async function authenticateA(IKa, EKa, IKb, SPKb, OPKb) {
    const DH1 = await Curve.deriveBytes(IKa.exchangeKey.privateKey, SPKb);
    const DH2 = await Curve.deriveBytes(EKa.privateKey, IKb);
    const DH3 = await Curve.deriveBytes(EKa.privateKey, SPKb);
    let DH4 = new ArrayBuffer(0);
    if (OPKb) {
        DH4 = await Curve.deriveBytes(EKa.privateKey, OPKb);
    }
    const _F = new Uint8Array(32);
    for (let i = 0; i < _F.length; i++) {
        _F[i] = 0xff;
    }
    const F = _F.buffer;
    const KM = combine(F, DH1, DH2, DH3, DH4);
    const keys = await Secret.HKDF(KM, 1, void 0, INFO_TEXT);
    return await Secret.importHMAC(keys[0]);
}
async function authenticateB(IKb, SPKb, IKa, EKa, OPKb) {
    const DH1 = await Curve.deriveBytes(SPKb.privateKey, IKa);
    const DH2 = await Curve.deriveBytes(IKb.exchangeKey.privateKey, EKa);
    const DH3 = await Curve.deriveBytes(SPKb.privateKey, EKa);
    let DH4 = new ArrayBuffer(0);
    if (OPKb) {
        DH4 = await Curve.deriveBytes(OPKb, EKa);
    }
    const _F = new Uint8Array(32);
    for (let i = 0; i < _F.length; i++) {
        _F[i] = 0xff;
    }
    const F = _F.buffer;
    const KM = combine(F, DH1, DH2, DH3, DH4);
    const keys = await Secret.HKDF(KM, 1, void 0, INFO_TEXT);
    return await Secret.importHMAC(keys[0]);
}
class AsymmetricRatchet extends events.EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.counter = 0;
        this.currentStep = new DHRatchetStep();
        this.steps = new DHRatchetStepStack(MAX_RATCHET_STACK_SIZE);
        this.promises = {};
    }
    static async create(identity, protocol, options = {}) {
        let rootKey;
        const ratchet = new AsymmetricRatchet(options);
        if (protocol instanceof PreKeyBundleProtocol) {
            if (!await protocol.identity.verify()) {
                throw new Error("Error: Remote client's identity key is invalid.");
            }
            if (!await protocol.preKeySigned.verify(protocol.identity.signingKey)) {
                throw new Error("Error: Remote client's signed prekey is invalid.");
            }
            ratchet.currentRatchetKey = await ratchet.generateRatchetKey();
            ratchet.currentStep.remoteRatchetKey = protocol.preKeySigned.key;
            ratchet.remoteIdentity = RemoteIdentity.fill(protocol.identity);
            ratchet.remoteIdentity.id = protocol.registrationId;
            ratchet.remotePreKeyId = protocol.preKey.id;
            ratchet.remotePreKeySignedId = protocol.preKeySigned.id;
            rootKey = await authenticateA(identity, ratchet.currentRatchetKey, protocol.identity.exchangeKey, protocol.preKeySigned.key, protocol.preKey.key);
        }
        else {
            if (!await protocol.identity.verify()) {
                throw new Error("Error: Remote client's identity key is invalid.");
            }
            const signedPreKey = identity.signedPreKeys[protocol.preKeySignedId];
            if (!signedPreKey) {
                throw new Error(`Error: PreKey with id ${protocol.preKeySignedId} not found`);
            }
            let preKey;
            if (protocol.preKeyId !== void 0) {
                preKey = identity.preKeys[protocol.preKeyId];
            }
            ratchet.remoteIdentity = RemoteIdentity.fill(protocol.identity);
            ratchet.currentRatchetKey = signedPreKey;
            rootKey = await authenticateB(identity, ratchet.currentRatchetKey, protocol.identity.exchangeKey, protocol.signedMessage.message.senderRatchetKey, preKey && preKey.privateKey);
        }
        ratchet.identity = identity;
        ratchet.id = identity.id;
        ratchet.rootKey = rootKey;
        return ratchet;
    }
    static async fromJSON(identity, remote, obj) {
        const res = new AsymmetricRatchet();
        res.identity = identity;
        res.remoteIdentity = remote;
        await res.fromJSON(obj);
        return res;
    }
    on(event, listener) {
        return super.on(event, listener);
    }
    once(event, listener) {
        return super.once(event, listener);
    }
    async decrypt(protocol) {
        return this.queuePromise("encrypt", async () => {
            const remoteRatchetKey = protocol.message.senderRatchetKey;
            const message = protocol.message;
            if (protocol.message.previousCounter < this.counter - MAX_RATCHET_STACK_SIZE) {
                throw new Error("Error: Too old message");
            }
            let step = this.steps.getStep(remoteRatchetKey);
            if (!step) {
                const ratchetStep = new DHRatchetStep();
                ratchetStep.remoteRatchetKey = remoteRatchetKey;
                this.steps.push(ratchetStep);
                this.currentStep = ratchetStep;
                step = ratchetStep;
            }
            if (!step.receivingChain) {
                step.receivingChain = await this.createChain(this.currentRatchetKey.privateKey, remoteRatchetKey, ReceivingRatchet);
            }
            const decryptedMessage = await step.receivingChain.decrypt(message.cipherText, message.counter);
            this.update();
            protocol.senderKey = this.remoteIdentity.signingKey;
            protocol.receiverKey = this.identity.signingKey.publicKey;
            if (!await protocol.verify(decryptedMessage.hmacKey)) {
                throw new Error("Error: The Message did not successfully verify!");
            }
            return decryptedMessage.cipherText;
        });
    }
    async encrypt(message) {
        return this.queuePromise("encrypt", async () => {
            if (this.currentStep.receivingChain && !this.currentStep.sendingChain) {
                this.counter++;
                this.currentRatchetKey = await this.generateRatchetKey();
            }
            if (!this.currentStep.sendingChain) {
                if (!this.currentStep.remoteRatchetKey) {
                    throw new Error("currentStep has empty remoteRatchetKey");
                }
                this.currentStep.sendingChain = await this.createChain(this.currentRatchetKey.privateKey, this.currentStep.remoteRatchetKey, SendingRatchet);
            }
            const encryptedMessage = await this.currentStep.sendingChain.encrypt(message);
            this.update();
            let preKeyMessage;
            if (this.steps.length === 0 &&
                !this.currentStep.receivingChain &&
                this.currentStep.sendingChain.counter === 1) {
                preKeyMessage = new PreKeyMessageProtocol();
                preKeyMessage.registrationId = this.identity.id;
                preKeyMessage.preKeyId = this.remotePreKeyId;
                preKeyMessage.preKeySignedId = this.remotePreKeySignedId;
                preKeyMessage.baseKey = this.currentRatchetKey.publicKey;
                await preKeyMessage.identity.fill(this.identity);
            }
            const signedMessage = new MessageSignedProtocol();
            signedMessage.receiverKey = this.remoteIdentity.signingKey;
            signedMessage.senderKey = this.identity.signingKey.publicKey;
            signedMessage.message.cipherText = encryptedMessage.cipherText;
            signedMessage.message.counter = this.currentStep.sendingChain.counter - 1;
            signedMessage.message.previousCounter = this.counter;
            signedMessage.message.senderRatchetKey = this.currentRatchetKey.publicKey;
            await signedMessage.sign(encryptedMessage.hmacKey);
            if (preKeyMessage) {
                preKeyMessage.signedMessage = signedMessage;
                return preKeyMessage;
            }
            else {
                return signedMessage;
            }
        });
    }
    async hasRatchetKey(key) {
        let ecKey;
        if (!(key instanceof ECPublicKey)) {
            ecKey = await ECPublicKey.create(key);
        }
        else {
            ecKey = key;
        }
        for (const item of this.steps.items) {
            if (await item.remoteRatchetKey.isEqual(ecKey)) {
                return true;
            }
        }
        return false;
    }
    async toJSON() {
        return {
            counter: this.counter,
            ratchetKey: await Curve.ecKeyPairToJson(this.currentRatchetKey),
            remoteIdentity: await this.remoteIdentity.signingKey.thumbprint(),
            rootKey: this.rootKey,
            steps: await this.steps.toJSON(),
        };
    }
    async fromJSON(obj) {
        this.currentRatchetKey = await Curve.ecKeyPairFromJson(obj.ratchetKey);
        this.counter = obj.counter;
        this.rootKey = obj.rootKey;
        for (const step of obj.steps) {
            this.currentStep = await DHRatchetStep.fromJSON(step);
            this.steps.push(this.currentStep);
        }
    }
    update() {
        this.emit("update");
    }
    generateRatchetKey() {
        return Curve.generateKeyPair("ECDH", !!this.options.exportableKeys);
    }
    async createChain(ourRatchetKey, theirRatchetKey, ratchetClass) {
        const derivedBytes = await Curve.deriveBytes(ourRatchetKey, theirRatchetKey);
        const keys = await Secret.HKDF(derivedBytes, 2, this.rootKey, INFO_RATCHET);
        const rootKey = await Secret.importHMAC(keys[0]);
        const chainKey = await Secret.importHMAC(keys[1]);
        const chain = new ratchetClass(chainKey);
        this.rootKey = rootKey;
        return chain;
    }
    queuePromise(key, fn) {
        const prev = this.promises[key] || Promise.resolve();
        const cur = this.promises[key] = prev.then(fn, fn);
        cur.then(() => {
            if (this.promises[key] === cur) {
                delete this.promises[key];
            }
        });
        return cur;
    }
}
class DHRatchetStep {
    static async fromJSON(obj) {
        const res = new this();
        await res.fromJSON(obj);
        return res;
    }
    async toJSON() {
        const res = {};
        if (this.remoteRatchetKey) {
            res.remoteRatchetKey = this.remoteRatchetKey.key;
        }
        if (this.sendingChain) {
            res.sendingChain = await this.sendingChain.toJSON();
        }
        if (this.receivingChain) {
            res.receivingChain = await this.receivingChain.toJSON();
        }
        return res;
    }
    async fromJSON(obj) {
        if (obj.remoteRatchetKey) {
            this.remoteRatchetKey = await ECPublicKey.create(obj.remoteRatchetKey);
        }
        if (obj.sendingChain) {
            this.sendingChain = await SendingRatchet.fromJSON(obj.sendingChain);
        }
        if (obj.receivingChain) {
            this.receivingChain = await ReceivingRatchet.fromJSON(obj.receivingChain);
        }
    }
}
class DHRatchetStepStack extends Stack {
    getStep(remoteRatchetKey) {
        let found;
        this.items.some((step) => {
            if (step.remoteRatchetKey.id === remoteRatchetKey.id) {
                found = step;
            }
            return !!found;
        });
        return found;
    }
}

var DEFAULT_SEPARATOR = '.';
var DEFAULT_TRAVERSAL_OPTS = {
  traversalType: 'depth-first',
  maxNodes: Number.POSITIVE_INFINITY,
  cycleHandling: true,
  maxDepth: Number.POSITIVE_INFINITY,
  haltOnTruthy: false,
  pathSeparator: DEFAULT_SEPARATOR
};

var _Queue = /*#__PURE__*/function () {
  function _Queue() {
    this.head = undefined;
    this.tail = undefined;
  }

  var _proto = _Queue.prototype;

  _proto.enqueue = function enqueue(v) {
    if (this.tail) {
      this.tail = this.tail.next = {
        value: v
      };
    } else {
      this.head = this.tail = {
        value: v
      };
    }
  };

  _proto.dequeue = function dequeue() {
    var previousHeadValue = this.head.value;
    this.head = this.head.next;

    if (!this.head) {
      this.tail = this.head;
    }

    return previousHeadValue;
  };

  _proto.isEmpty = function isEmpty() {
    return !this.head;
  };

  _proto.reset = function reset() {
    this.head = this.tail = undefined;
  };

  return _Queue;
}();
var _QueueToStackAdapter = /*#__PURE__*/function () {
  function _QueueToStackAdapter(queue) {
    this.queue = void 0;
    this.queue = queue;
  }

  var _proto2 = _QueueToStackAdapter.prototype;

  _proto2.push = function push(v) {
    this.queue.enqueue(v);
  };

  _proto2.pop = function pop() {
    return this.queue.dequeue();
  };

  _proto2.isEmpty = function isEmpty() {
    return this.queue.isEmpty();
  };

  _proto2.reset = function reset() {
    return this.queue.reset();
  };

  return _QueueToStackAdapter;
}();

var _Stack = /*#__PURE__*/function () {
  function _Stack() {
    this.tail = undefined;
  }

  var _proto = _Stack.prototype;

  _proto.push = function push(v) {
    this.tail = {
      value: v,
      prev: this.tail
    };
  };

  _proto.pop = function pop() {
    var node = this.tail;
    this.tail = this.tail.prev;
    return node.value;
  };

  _proto.isEmpty = function isEmpty() {
    return !this.tail;
  };

  _proto.reset = function reset() {
    this.tail = undefined;
  };

  return _Stack;
}();

/** Applies a given callback function to all properties of an object and its children */

var traverse = function traverse(root, callback, opts) {
  if (!(root instanceof Object)) {
    throw new Error('First argument must be an object');
  }

  var fullOpts = Object.assign({}, DEFAULT_TRAVERSAL_OPTS, opts);
  fullOpts.disablePathTracking = typeof fullOpts.pathSeparator !== 'string';
  var stackOrQueue;

  if (fullOpts.traversalType === 'depth-first') {
    stackOrQueue = new _Stack();
  } else {
    stackOrQueue = new _QueueToStackAdapter(new _Queue());
  }

  var traversalMeta = {
    visitedNodes: new WeakSet(),
    depth: 0
  };

  if (!fullOpts.disablePathTracking) {
    traversalMeta.nodePath = null;
  }

  stackOrQueue.push({
    parent: null,
    key: null,
    value: root,
    meta: traversalMeta
  });

  _traverse(callback, stackOrQueue, fullOpts);
};

var _traverse = function _traverse(callback, stackOrQueue, opts) {
  /**
   * Using a stack instead of a queue to preserve the natural depth-first traversal order. Using a queue or traversing an array
   *   in order would lead the depth-first to traverse the value.properties in reverse order.
   * Breadth-first traversal uses queues as usual.
   */
  var newNodesToVisit;

  if (opts.traversalType === 'depth-first') {
    newNodesToVisit = new _Stack();
  } else {
    newNodesToVisit = new _QueueToStackAdapter(new _Queue());
  }

  var maxNodes = opts.maxNodes,
      cycleHandling = opts.cycleHandling,
      maxDepth = opts.maxDepth,
      haltOnTruthy = opts.haltOnTruthy,
      pathSeparator = opts.pathSeparator;
  var visitedNodeCount = 0;

  while (!stackOrQueue.isEmpty() && maxNodes > visitedNodeCount) {
    var callbackContext = stackOrQueue.pop();
    var value = callbackContext.value,
        meta = callbackContext.meta;
    var visitedNodes = meta.visitedNodes;
    var nodeIsObject = value instanceof Object;
    var skipNode = cycleHandling && nodeIsObject && visitedNodes.has(value);

    if (skipNode) {
      continue;
    }

    if (callback(callbackContext) && haltOnTruthy) {
      break;
    }

    visitedNodeCount++;

    if (nodeIsObject) {
      visitedNodes.add(value);
      var depth = meta.depth,
          nodePath = meta.nodePath;
      var newDepth = depth + 1;

      if (newDepth > maxDepth) {
        continue;
      }

      newNodesToVisit.reset();
      var keys = Object.keys(value);

      for (var i = 0; i < keys.length; i++) {
        var property = keys[i];
        var traversalMeta = {
          visitedNodes: visitedNodes,
          depth: newDepth
        };
        var newPath = void 0;

        if (!opts.disablePathTracking) {
          if (!nodePath) {
            newPath = property;
          } else {
            newPath = "" + nodePath + pathSeparator + property;
          }

          traversalMeta.nodePath = newPath;
        }

        newNodesToVisit.push({
          value: value[property],
          meta: traversalMeta,
          key: property,
          parent: value
        });
      }

      while (!newNodesToVisit.isEmpty()) {
        stackOrQueue.push(newNodesToVisit.pop());
      }
    }
  }
};

// we override these functions so that we can store cipher keys across restarts

// static importHMAC(raw) {
//     return getEngine().crypto.subtle
//         .importKey("raw", raw, { name: HMAC_NAME, hash: { name: HASH_NAME } }, false, ["sign", "verify"]);
// }
// static importAES(raw) {
//     return getEngine().crypto.subtle.importKey("raw", raw, AES_ALGORITHM, false, ["encrypt", "decrypt"]);
// }

// copy/pasted from definition in 2Key-ratched
const AES_ALGORITHM = { name: "AES-CBC", length: 256 };
const HASH_NAME = "SHA-256";
const HMAC_NAME = "HMAC";

Secret.importHMAC = (raw) => {
  return getEngine().crypto.subtle.importKey(
    "raw",
    raw,
    { name: HMAC_NAME, hash: { name: HASH_NAME } },
    true,
    ["sign", "verify"]
  );
};

Secret.importAES = (raw) => {
  return getEngine().crypto.subtle.importKey("raw", raw, AES_ALGORITHM, true, [
    "encrypt",
    "decrypt",
  ]);
};

let CryptoKey$2;
const getFormatFromAlg = ({ name }) =>
  ["ECDH", "ECDSA"].includes(name) ? "jwk" : "raw";

class Ratchet {
  static useCrypto(Crypto, _CryptoKey) {
    setEngine("@peculiar/webcrypto", new Crypto());
    CryptoKey$2 = _CryptoKey;
  }

  static useSubtle() {
    setEngine("webcrypto", window.crypto);
    CryptoKey$2 = window.CryptoKey;
  }

  static useIsoCrypto(iso, key) {
    setEngine("isomorphic", iso);
    CryptoKey$2 = key;
  }

  constructor(
    Storage,
    {
      id = 1,
      signedPreKeyAmount = 1,
      preKeyAmount = 0,
      exportableKeys = true,
    } = {}
  ) {
    this._identityStore = new Storage(`${id}:identity`);
    this._cipherStore = new Storage(`${id}:cipher`);
    this._identity = null;
    this._ciphers = new Map();
    this._remotes = new Map();
    this._options = {
      id,
      signedPreKeyAmount,
      preKeyAmount,
      exportableKeys,
    };
  }

  get id() {
    return this._identity.id;
  }

  async importBundle(bundle) {
    const decoded = await PreKeyBundleProtocol.importProto(bundle);
    const cipher = await AsymmetricRatchet.create(this._identity, decoded, {
      exportableKeys: true,
    });

    return cipher;
  }

  async importMessage(proto) {
    const decoded = await PreKeyMessageProtocol.importProto(proto);
    const cipher = await AsymmetricRatchet.create(this._identity, decoded, {
      exportableKeys: true,
    });

    return cipher;
  }

  async getIdentity() {
    if (this._identity) return this._identity;

    this._identity = await this._getSelfIdentityFromStorage();
    if (this._identity) return this._identity;

    this._identity = await this._createIdentity();
    await this._storeIdentity();
    return this._identity;
  }

  async persistCipher(id, cipher) {
    cipher.on("update", () => this._saveCipher(id, cipher));
    return this._saveCipher(id, cipher);
  }

  async getCipher(cipherID, message) {
    // console.log("GETCipher", cipherID);
    if (this._ciphers.has(cipherID)) return this._ciphers.get(cipherID);

    let cipher = await this._getStoredCipher(cipherID);
    if (!cipher) {
      // process.exit(1);
      cipher = await this._createCipher(message);
    }
    console.log("got or made cipher?", cipher.currentStep);

    await this.persistCipher(cipherID, cipher);
    this._ciphers.set(cipherID, cipher);

    return cipher;
  }

  async _createCipher(message) {
    // console.log("CREATE", message);
    return AsymmetricRatchet.create(await this.getIdentity(), message, {
      exportableKeys: true,
    });
  }

  async getBundle() {
    if (this._bundle) return this._bundle.exportProto();

    this._bundle = await this._createBundle();
    return this._bundle.exportProto();
  }

  async unpackBuffer(buffer) {
    console.log("unpack buffer", buffer);
    const message = await MessageSignedProtocol.importProto(buffer)
      .catch((error) => PreKeyMessageProtocol.importProto(buffer))
      .catch((error) => PreKeyBundleProtocol.importProto(buffer));

    // console.log("message", message);
    const id = message.identity
      ? message.identity.signingKey.id
      : message.senderKey.id;
    // console.log("message id", id);
    return { message, id };
  }

  async consumeBuffer(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    await this.getCipher(id, message);
    return id;
  }

  async encrypt(recipientID, payload) {
    const cipher = await this.getCipher(recipientID);

    // console.log("GOT CIPHER", recipientID);

    const proto = await cipher.encrypt(payload);

    await new Promise((r) =>
      setTimeout(() => {
        this._cipherStore._service._job.then(() => r());
      }, 0)
    );
    // console.log("ENCRYPTED");

    return proto.exportProto();
  }

  async getIDFromMessage(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    return id;
  }

  async decrypt(buffer) {
    const { message, id } = await this.unpackBuffer(buffer);
    // console.log("unpacked", message, id);
    const cipher = await this.getCipher(id, message);
    // console.log("decrypt got cipher", !!cipher, message.signedMessage);
    const res = cipher.decrypt(message.signedMessage || message);
    await new Promise((r) =>
      setTimeout(() => {
        this._cipherStore._service._job.then(() => r());
      }, 0)
    );
    return res;
  }

  async getCipherFromMessage(signID, message) {
    let cipher;

    cipher = this._ciphers.get(signID);
    if (cipher) return cipher;

    cipher = await this.getCipherFromStorage(signID);

    if (cipher) return cipher;

    cipher = await AsymmetricRatchet.create(await this.getIdentity(), message, {
      exportableKeys: true,
    });

    await this.persistCipher(signID, cipher);

    this._ciphers.set(signID, cipher);

    return cipher;
  }

  async remoteIdentity() {
    if (this._remote) return this._remote;
    const proto = await IdentityProtocol.fill(this._identity);
    await proto.sign(this._identity.signingKey.privateKey);
    const remote = await RemoteIdentity.fill(proto);
    this._remote = remote;
    return remote;
  }

  async _getSelfIdentityFromStorage() {
    const raw = await this._identityStore.getItem("self");
    if (!raw) return null;
    const { b64 } = raw;

    return this._decodeSelfIdentity(b64);
  }

  async _decodeSelfIdentity(b64) {
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const identity = await Identity.fromJSON(json);
    identity.id = json.id;
    return identity;
  }

  async _storeIdentity() {
    const b64 = await this._encodeIdentity();
    await this._identityStore.setItem("self", { b64 });
  }

  async _decodeRemoteIdentity(b64) {
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const identity = await RemoteIdentity.fromJSON(json);
    identity.id = json.id;
    return identity;
  }

  async _encodeIdentity(identity) {
    identity = identity ? identity : this._identity;
    const json = await identity.toJSON();
    json.id = identity.id;
    await this._exportKeys(json);
    const b64 = JSONToB64(json);
    return b64;
  }

  async _createIdentity() {
    return Identity.create(
      this._options.id,
      this._options.signedPreKeyAmount,
      this._options.preKeyAmount,
      this._options.exportableKeys
    );
  }

  async _createBundle() {
    const identity = await this.getIdentity();

    const bundle = new PreKeyBundleProtocol();
    bundle.registrationId = identity.id;
    console.log("ID?", bundle.registrationId, identity.id);
    await bundle.identity.fill(identity);
    const preKey = identity.signedPreKeys[0];
    bundle.preKeySigned.id = 0;
    bundle.preKeySigned.key = preKey.publicKey;
    await bundle.preKeySigned.sign(identity.signingKey.privateKey);
    return bundle;
  }

  async _getStoredCipher(cipherID) {
    // console.log("_getStoredCipher", cipherID);
    const raw = await this._cipherStore.getItem(cipherID);
    if (!raw) return null;

    const { b64 } = raw;
    const identity = await this.getIdentity();
    const remote = await this.getRemote(cipherID);
    // console.log("decoding cipher", !!identity, !!remote, !!b64);
    return this._decodeCipher(identity, remote, b64);
  }

  async _saveCipher(cipherID, cipher, invoke = Date.now()) {
    const b64 = await this._encodeCipher(cipher);
    console.log("saveCipher", invoke, cipher.steps);

    await this._cipherStore.setItem(cipherID, { b64 });
    await this._storeRemote(cipherID, cipher);
  }

  async _storeRemote(id, { remoteIdentity }) {
    // console.log("SET STORED", id);
    const b64 = await this._encodeIdentity(remoteIdentity);
    await this._identityStore.setItem(id, { b64 });
  }

  async getRemote(signID) {
    if (this._remotes.has(signID)) return this._remotes.get(signID);

    const remote = await this._getStoredRemote(signID);
    // console.log("REMOTE?", remote);
    if (!remote) return null;

    this._remotes.set(signID, remote);
    return remote;
  }

  async _getStoredRemote(cipherID) {
    // console.log("GET STORED", cipherID);
    const raw = await this._identityStore.getItem(cipherID);
    if (!raw) return null;
    const { b64 } = raw;

    const json = b64ToJSON(b64);
    await this._importKeys(json);

    const remote = await RemoteIdentity.fromJSON(json);
    remote.id = json.id;
    return remote;
  }
  async _exportKeys(json) {
    console.log("export keys", json);
    const proms = [];
    const inPlace = ({ parent, key, value, meta }) => {
      if (value instanceof CryptoKey$2) {
        proms.push(
          (async function exportKey() {
            const format = getFormatFromAlg(value.algorithm);
            // console.log("key", value.algorithm, format);
            const engine = getEngine();
            // console.log("engine", engine);
            const exported = await engine.crypto.subtle
              .exportKey(format, value)
              .catch((e) => {
                console.log("caught export error", e);
                console.log("key", value.algorithm, format, value, meta);
                process.exit(1);
              });

            const string =
              format === "raw"
                ? Buffer.from(exported).toString("base64")
                : Buffer.from(JSON.stringify(exported)).toString("base64");
            // console.log("exported", parent[key]);
            if (typeof window === "undefined") {
              parent[key] = JSON.parse(JSON.stringify(value));
            }
            parent[key].exported = string;
            // console.log("exported.pos", parent[key]);
          })()
        );
      } else if (key === "serialized" || key === "signature") {
        proms.push(
          (async function reserialize() {
            const str = Buffer.from(value).toString("base64");
            // console.log("stringified buffer", str);
            parent[key] = str;
          })()
        );
      } else if (key === "keys") {
        proms.push(
          (async function reserializeArray() {
            return Promise.all(
              parent[key].map((a) => Buffer.from(a).toString("base64"))
            ).then((newArray) => (parent[key] = newArray));
          })()
        );
      }
    };
    traverse(json, inPlace);
    return Promise.all(proms);
  }

  async _importKeys(json) {
    const proms = [];
    console.log("importKeys", json);
    const inPlace = ({ parent, key, value, meta }) => {
      if (value.exported) {
        proms.push(
          (async function importKey() {
            const format = getFormatFromAlg(value.algorithm);
            // console.log("importing", format);
            const buf = Buffer.from(value.exported, "base64");
            const toImport =
              format === "raw" ? buf : JSON.parse(buf.toString());
            // console.log("key", toImport, format);
            const engine = await getEngine();
            const imported = await engine.crypto.subtle
              .importKey(
                format,
                toImport,
                value.algorithm,
                value.extractable,
                value.usages
              )
              .catch((e) => {
                // console.log("caught import error", e);
                // console.log("key", value.algorithm, format);
                process.exit(1);
              });
            // console.log("parent.key", parent[key]);
            parent[key] = imported;
            // console.log("parent.key.pos", parent[key]);
          })()
        );
      } else if (key === "serialized" || key === "signature") {
        proms.push(
          (async function reserialize() {
            // console.log("SERIALIZE");
            const buf = Buffer.from(value, "base64");
            // console.log("BUFFER", buf);
            parent[key] = buf;
          })()
        );
      } else if (key === "keys") {
        proms.push(
          (async function reserializeArray() {
            return Promise.all(
              parent[key].map((a) => Buffer.from(a, "base64"))
            ).then((newArray) => (parent[key] = newArray));
          })()
        );
      }
    };
    traverse(json, inPlace);
    return Promise.all(proms);
  }

  async _encodeCipher(cipher, twice = true) {
    const json = await cipher.toJSON();
    json.options = cipher.options;
    json.id = cipher.id;

    await this._exportKeys(json);
    console.log("ENCODE", cipher, json);
    const b64 = JSONToB64(json);
    return b64;
  }

  async _decodeCipher(identity, remote, b64) {
    // console.log("b64", b64);
    const json = b64ToJSON(b64);
    await this._importKeys(json);
    const cipher = await AsymmetricRatchet.fromJSON(identity, remote, json);
    cipher.options = json.options;
    cipher.id = json.id;
    return cipher;
  }
}

function b64ToJSON(b64) {
  const string = Buffer.from(b64, "base64").toString("ascii");
  const json = JSON.parse(string);
  return json;
}

function JSONToB64(json) {
  const string = JSON.stringify(json);
  const b64 = Buffer.from(string).toString("base64");
  return b64;
}

class RatchetClient {
  constructor({ id = 50, host = "localhost", namespace = "client" }, Storage) {
    this._ratchet = new Ratchet(Storage, { id });
    this._host = host;
    this._storage = new Storage(namespace);
    if (global$1.fetch) {
      this._fetch = global$1.fetch;
    }
    this._fetchJob = Promise.resolve();
  }

  async getServerID() {
    if (this._serverID) return this._serverID;

    this._serverID = await this._getServerIDFromStorage();
    if (this._serverID) return this._serverID;

    this._serverID = await this._getServerIDFromServer();
    return this._serverID;
  }

  async getServerPaths() {
    if (this._paths) return this._paths;

    this._paths = await this._getServerPathsFromStorage();
    if (this._paths) return this._paths;

    this._paths = await this._getServerIDFromServer();
  }

  async _getServerIDFromStorage() {
    return this._storage.getItem(`serverID`);
  }

  async _getServerPathsFromStorage() {
    return this._storage.getItem("serverPaths");
  }

  async _encryptRequest(options) {
    const packet = lobEnc.encode(options);
    const serverID = await this.getServerID();
    const buffer = await this._racket.encrypt(serverID, packet);
    return buffer;
  }

  async _getServerPathsFromServer() {
    return [];
  }

  async _getServerIDFromServer() {
    console.log("_getServerIDFromServer()", this._host);
    const res = await this._fetch(`http://${this._host}`);
    const buffer = await res.arrayBuffer();

    return this._ratchet.consumeBuffer(buffer);
  }

  async encryptFetch(reqObj, reqInit = {}) {
    const serverID = await this.getServerID();
    const packet = lobEnc.encode({ reqObj, reqInit }, reqObj.body || reqInit.body);
    const buffer = await this._ratchet.encrypt(serverID, packet);
    return Buffer.from(buffer);
  }

  async decryptFetchResponse(buffer) {
    const packet = await this._ratchet.decrypt(buffer);
    const response = lobEnc.decode(Buffer.from(packet));
    return response;
  }

  async _monkeyFetch(reqObj, reqInit) {
    const body = await this.encryptFetch(reqObj, reqInit);

    const res = await fetch({
      method: "POST",
      url: `http://${this._host}`,
      body,
    });

    const buffer = await res.arrayBuffer();

    const response = await this.decryptFetchResponse(Buffer.from(buffer));
    return response;
  }

  async patchFetch() {
    global$1.fetch = async (reqObj, reqInit) => {
      console.log("patched fetch", reqObj, reqInit);
      const body = await this.encryptFetch(reqObj, reqInit);
      const config = {
        method: "POST",
        body,
      };
      const outer = await this._fetch(`http://${this._host}`, config);
      const outerb = await outer.arrayBuffer();
      const innerb = await this.decryptFetchResponse(Buffer.from(outerb));
      const resp = lobEnc.decode(Buffer.from(innerb));
      console.log("decrypted response", resp);
      return new Response(resp.body, resp.json);
    };
  }

  async patchFetchBrowser() {
    this._fetch = window.fetch.bind(window);
    window.fetch = async (reqObj, reqInit) => {
      console.log("patched fetch", reqObj, reqInit);
      this._fetchJob = this._fetchJob.then(async () => {
        const body = await this.encryptFetch(reqObj, reqInit);
        const config = {
          method: "POST",
          body,
        };
        const outer = await this._fetch(`http://${this._host}`, config);
        const outerb = await outer.arrayBuffer();
        const innerb = await this.decryptFetchResponse(Buffer.from(outerb));
        const resp = lobEnc.decode(Buffer.from(innerb));
        console.log("decrypted response", resp);
        return new Response(resp.body, resp.json);
      });

      return this._fetchJob;
    };
  }
}

/*!
 Copyright (c) Peculiar Ventures, LLC
*/
function utilFromBase(inputBuffer, inputBase) {
    let result = 0;
    if (inputBuffer.length === 1) {
        return inputBuffer[0];
    }
    for (let i = (inputBuffer.length - 1); i >= 0; i--) {
        result += inputBuffer[(inputBuffer.length - 1) - i] * Math.pow(2, inputBase * i);
    }
    return result;
}
function utilToBase(value, base, reserved = (-1)) {
    const internalReserved = reserved;
    let internalValue = value;
    let result = 0;
    let biggest = Math.pow(2, base);
    for (let i = 1; i < 8; i++) {
        if (value < biggest) {
            let retBuf;
            if (internalReserved < 0) {
                retBuf = new ArrayBuffer(i);
                result = i;
            }
            else {
                if (internalReserved < i) {
                    return (new ArrayBuffer(0));
                }
                retBuf = new ArrayBuffer(internalReserved);
                result = internalReserved;
            }
            const retView = new Uint8Array(retBuf);
            for (let j = (i - 1); j >= 0; j--) {
                const basis = Math.pow(2, j * base);
                retView[result - j - 1] = Math.floor(internalValue / basis);
                internalValue -= (retView[result - j - 1]) * basis;
            }
            return retBuf;
        }
        biggest *= Math.pow(2, base);
    }
    return new ArrayBuffer(0);
}
function utilConcatView(...views) {
    let outputLength = 0;
    let prevLength = 0;
    for (const view of views) {
        outputLength += view.length;
    }
    const retBuf = new ArrayBuffer(outputLength);
    const retView = new Uint8Array(retBuf);
    for (const view of views) {
        retView.set(view, prevLength);
        prevLength += view.length;
    }
    return retView;
}
function utilDecodeTC() {
    const buf = new Uint8Array(this.valueHex);
    if (this.valueHex.byteLength >= 2) {
        const condition1 = (buf[0] === 0xFF) && (buf[1] & 0x80);
        const condition2 = (buf[0] === 0x00) && ((buf[1] & 0x80) === 0x00);
        if (condition1 || condition2) {
            this.warnings.push("Needlessly long format");
        }
    }
    const bigIntBuffer = new ArrayBuffer(this.valueHex.byteLength);
    const bigIntView = new Uint8Array(bigIntBuffer);
    for (let i = 0; i < this.valueHex.byteLength; i++) {
        bigIntView[i] = 0;
    }
    bigIntView[0] = (buf[0] & 0x80);
    const bigInt = utilFromBase(bigIntView, 8);
    const smallIntBuffer = new ArrayBuffer(this.valueHex.byteLength);
    const smallIntView = new Uint8Array(smallIntBuffer);
    for (let j = 0; j < this.valueHex.byteLength; j++) {
        smallIntView[j] = buf[j];
    }
    smallIntView[0] &= 0x7F;
    const smallInt = utilFromBase(smallIntView, 8);
    return (smallInt - bigInt);
}
function utilEncodeTC(value) {
    const modValue = (value < 0) ? (value * (-1)) : value;
    let bigInt = 128;
    for (let i = 1; i < 8; i++) {
        if (modValue <= bigInt) {
            if (value < 0) {
                const smallInt = bigInt - modValue;
                const retBuf = utilToBase(smallInt, 8, i);
                const retView = new Uint8Array(retBuf);
                retView[0] |= 0x80;
                return retBuf;
            }
            let retBuf = utilToBase(modValue, 8, i);
            let retView = new Uint8Array(retBuf);
            if (retView[0] & 0x80) {
                const tempBuf = retBuf.slice(0);
                const tempView = new Uint8Array(tempBuf);
                retBuf = new ArrayBuffer(retBuf.byteLength + 1);
                retView = new Uint8Array(retBuf);
                for (let k = 0; k < tempBuf.byteLength; k++) {
                    retView[k + 1] = tempView[k];
                }
                retView[0] = 0x00;
            }
            return retBuf;
        }
        bigInt *= Math.pow(2, 8);
    }
    return (new ArrayBuffer(0));
}
function isEqualBuffer(inputBuffer1, inputBuffer2) {
    if (inputBuffer1.byteLength !== inputBuffer2.byteLength) {
        return false;
    }
    const view1 = new Uint8Array(inputBuffer1);
    const view2 = new Uint8Array(inputBuffer2);
    for (let i = 0; i < view1.length; i++) {
        if (view1[i] !== view2[i]) {
            return false;
        }
    }
    return true;
}
function padNumber(inputNumber, fullLength) {
    const str = inputNumber.toString(10);
    if (fullLength < str.length) {
        return "";
    }
    const dif = fullLength - str.length;
    const padding = new Array(dif);
    for (let i = 0; i < dif; i++) {
        padding[i] = "0";
    }
    const paddingString = padding.join("");
    return paddingString.concat(str);
}

/*!
 * Copyright (c) 2014, GMO GlobalSign
 * Copyright (c) 2015-2022, Peculiar Ventures
 * All rights reserved.
 * 
 * Author 2014-2019, Yury Strozhevsky
 * 
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 * 
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 * 
 * * Redistributions in binary form must reproduce the above copyright notice, this
 *   list of conditions and the following disclaimer in the documentation and/or
 *   other materials provided with the distribution.
 * 
 * * Neither the name of the copyright holder nor the names of its
 *   contributors may be used to endorse or promote products derived from
 *   this software without specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * 
 */

function assertBigInt() {
    if (typeof BigInt === "undefined") {
        throw new Error("BigInt is not defined. Your environment doesn't implement BigInt.");
    }
}
function concat(buffers) {
    let outputLength = 0;
    let prevLength = 0;
    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        outputLength += buffer.byteLength;
    }
    const retView = new Uint8Array(outputLength);
    for (let i = 0; i < buffers.length; i++) {
        const buffer = buffers[i];
        retView.set(new Uint8Array(buffer), prevLength);
        prevLength += buffer.byteLength;
    }
    return retView.buffer;
}
function checkBufferParams(baseBlock, inputBuffer, inputOffset, inputLength) {
    if (!(inputBuffer instanceof Uint8Array)) {
        baseBlock.error = "Wrong parameter: inputBuffer must be 'Uint8Array'";
        return false;
    }
    if (!inputBuffer.byteLength) {
        baseBlock.error = "Wrong parameter: inputBuffer has zero length";
        return false;
    }
    if (inputOffset < 0) {
        baseBlock.error = "Wrong parameter: inputOffset less than zero";
        return false;
    }
    if (inputLength < 0) {
        baseBlock.error = "Wrong parameter: inputLength less than zero";
        return false;
    }
    if ((inputBuffer.byteLength - inputOffset - inputLength) < 0) {
        baseBlock.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
        return false;
    }
    return true;
}

class ViewWriter {
    constructor() {
        this.items = [];
    }
    write(buf) {
        this.items.push(buf);
    }
    final() {
        return concat(this.items);
    }
}

const powers2 = [new Uint8Array([1])];
const digitsString = "0123456789";
const NAME = "name";
const VALUE_HEX_VIEW = "valueHexView";
const IS_HEX_ONLY = "isHexOnly";
const ID_BLOCK = "idBlock";
const TAG_CLASS = "tagClass";
const TAG_NUMBER = "tagNumber";
const IS_CONSTRUCTED = "isConstructed";
const FROM_BER = "fromBER";
const TO_BER = "toBER";
const LOCAL = "local";
const EMPTY_STRING = "";
const EMPTY_BUFFER = new ArrayBuffer(0);
const EMPTY_VIEW = new Uint8Array(0);
const END_OF_CONTENT_NAME = "EndOfContent";
const OCTET_STRING_NAME = "OCTET STRING";
const BIT_STRING_NAME = "BIT STRING";

function HexBlock(BaseClass) {
    var _a;
    return _a = class Some extends BaseClass {
            constructor(...args) {
                var _a;
                super(...args);
                const params = args[0] || {};
                this.isHexOnly = (_a = params.isHexOnly) !== null && _a !== void 0 ? _a : false;
                this.valueHexView = params.valueHex ? BufferSourceConverter.toUint8Array(params.valueHex) : EMPTY_VIEW;
            }
            get valueHex() {
                return this.valueHexView.slice().buffer;
            }
            set valueHex(value) {
                this.valueHexView = new Uint8Array(value);
            }
            fromBER(inputBuffer, inputOffset, inputLength) {
                const view = inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer;
                if (!checkBufferParams(this, view, inputOffset, inputLength)) {
                    return -1;
                }
                const endLength = inputOffset + inputLength;
                this.valueHexView = view.subarray(inputOffset, endLength);
                if (!this.valueHexView.length) {
                    this.warnings.push("Zero buffer length");
                    return inputOffset;
                }
                this.blockLength = inputLength;
                return endLength;
            }
            toBER(sizeOnly = false) {
                if (!this.isHexOnly) {
                    this.error = "Flag 'isHexOnly' is not set, abort";
                    return EMPTY_BUFFER;
                }
                if (sizeOnly) {
                    return new ArrayBuffer(this.valueHexView.byteLength);
                }
                return (this.valueHexView.byteLength === this.valueHexView.buffer.byteLength)
                    ? this.valueHexView.buffer
                    : this.valueHexView.slice().buffer;
            }
            toJSON() {
                return {
                    ...super.toJSON(),
                    isHexOnly: this.isHexOnly,
                    valueHex: Convert.ToHex(this.valueHexView),
                };
            }
        },
        _a.NAME = "hexBlock",
        _a;
}

class LocalBaseBlock {
    constructor({ blockLength = 0, error = EMPTY_STRING, warnings = [], valueBeforeDecode = EMPTY_VIEW, } = {}) {
        this.blockLength = blockLength;
        this.error = error;
        this.warnings = warnings;
        this.valueBeforeDecodeView = BufferSourceConverter.toUint8Array(valueBeforeDecode);
    }
    static blockName() {
        return this.NAME;
    }
    get valueBeforeDecode() {
        return this.valueBeforeDecodeView.slice().buffer;
    }
    set valueBeforeDecode(value) {
        this.valueBeforeDecodeView = new Uint8Array(value);
    }
    toJSON() {
        return {
            blockName: this.constructor.NAME,
            blockLength: this.blockLength,
            error: this.error,
            warnings: this.warnings,
            valueBeforeDecode: Convert.ToHex(this.valueBeforeDecodeView),
        };
    }
}
LocalBaseBlock.NAME = "baseBlock";

class ValueBlock extends LocalBaseBlock {
    fromBER(inputBuffer, inputOffset, inputLength) {
        throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
    }
    toBER(sizeOnly, writer) {
        throw TypeError("User need to make a specific function in a class which extends 'ValueBlock'");
    }
}
ValueBlock.NAME = "valueBlock";

class LocalIdentificationBlock extends HexBlock(LocalBaseBlock) {
    constructor({ idBlock = {}, } = {}) {
        var _a, _b, _c, _d;
        super();
        if (idBlock) {
            this.isHexOnly = (_a = idBlock.isHexOnly) !== null && _a !== void 0 ? _a : false;
            this.valueHexView = idBlock.valueHex ? BufferSourceConverter.toUint8Array(idBlock.valueHex) : EMPTY_VIEW;
            this.tagClass = (_b = idBlock.tagClass) !== null && _b !== void 0 ? _b : -1;
            this.tagNumber = (_c = idBlock.tagNumber) !== null && _c !== void 0 ? _c : -1;
            this.isConstructed = (_d = idBlock.isConstructed) !== null && _d !== void 0 ? _d : false;
        }
        else {
            this.tagClass = -1;
            this.tagNumber = -1;
            this.isConstructed = false;
        }
    }
    toBER(sizeOnly = false) {
        let firstOctet = 0;
        switch (this.tagClass) {
            case 1:
                firstOctet |= 0x00;
                break;
            case 2:
                firstOctet |= 0x40;
                break;
            case 3:
                firstOctet |= 0x80;
                break;
            case 4:
                firstOctet |= 0xC0;
                break;
            default:
                this.error = "Unknown tag class";
                return EMPTY_BUFFER;
        }
        if (this.isConstructed)
            firstOctet |= 0x20;
        if (this.tagNumber < 31 && !this.isHexOnly) {
            const retView = new Uint8Array(1);
            if (!sizeOnly) {
                let number = this.tagNumber;
                number &= 0x1F;
                firstOctet |= number;
                retView[0] = firstOctet;
            }
            return retView.buffer;
        }
        if (!this.isHexOnly) {
            const encodedBuf = utilToBase(this.tagNumber, 7);
            const encodedView = new Uint8Array(encodedBuf);
            const size = encodedBuf.byteLength;
            const retView = new Uint8Array(size + 1);
            retView[0] = (firstOctet | 0x1F);
            if (!sizeOnly) {
                for (let i = 0; i < (size - 1); i++)
                    retView[i + 1] = encodedView[i] | 0x80;
                retView[size] = encodedView[size - 1];
            }
            return retView.buffer;
        }
        const retView = new Uint8Array(this.valueHexView.byteLength + 1);
        retView[0] = (firstOctet | 0x1F);
        if (!sizeOnly) {
            const curView = this.valueHexView;
            for (let i = 0; i < (curView.length - 1); i++)
                retView[i + 1] = curView[i] | 0x80;
            retView[this.valueHexView.byteLength] = curView[curView.length - 1];
        }
        return retView.buffer;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
            return -1;
        }
        const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        if (intBuffer.length === 0) {
            this.error = "Zero buffer length";
            return -1;
        }
        const tagClassMask = intBuffer[0] & 0xC0;
        switch (tagClassMask) {
            case 0x00:
                this.tagClass = (1);
                break;
            case 0x40:
                this.tagClass = (2);
                break;
            case 0x80:
                this.tagClass = (3);
                break;
            case 0xC0:
                this.tagClass = (4);
                break;
            default:
                this.error = "Unknown tag class";
                return -1;
        }
        this.isConstructed = (intBuffer[0] & 0x20) === 0x20;
        this.isHexOnly = false;
        const tagNumberMask = intBuffer[0] & 0x1F;
        if (tagNumberMask !== 0x1F) {
            this.tagNumber = (tagNumberMask);
            this.blockLength = 1;
        }
        else {
            let count = 1;
            let intTagNumberBuffer = this.valueHexView = new Uint8Array(255);
            let tagNumberBufferMaxLength = 255;
            while (intBuffer[count] & 0x80) {
                intTagNumberBuffer[count - 1] = intBuffer[count] & 0x7F;
                count++;
                if (count >= intBuffer.length) {
                    this.error = "End of input reached before message was fully decoded";
                    return -1;
                }
                if (count === tagNumberBufferMaxLength) {
                    tagNumberBufferMaxLength += 255;
                    const tempBufferView = new Uint8Array(tagNumberBufferMaxLength);
                    for (let i = 0; i < intTagNumberBuffer.length; i++)
                        tempBufferView[i] = intTagNumberBuffer[i];
                    intTagNumberBuffer = this.valueHexView = new Uint8Array(tagNumberBufferMaxLength);
                }
            }
            this.blockLength = (count + 1);
            intTagNumberBuffer[count - 1] = intBuffer[count] & 0x7F;
            const tempBufferView = new Uint8Array(count);
            for (let i = 0; i < count; i++)
                tempBufferView[i] = intTagNumberBuffer[i];
            intTagNumberBuffer = this.valueHexView = new Uint8Array(count);
            intTagNumberBuffer.set(tempBufferView);
            if (this.blockLength <= 9)
                this.tagNumber = utilFromBase(intTagNumberBuffer, 7);
            else {
                this.isHexOnly = true;
                this.warnings.push("Tag too long, represented as hex-coded");
            }
        }
        if (((this.tagClass === 1)) &&
            (this.isConstructed)) {
            switch (this.tagNumber) {
                case 1:
                case 2:
                case 5:
                case 6:
                case 9:
                case 13:
                case 14:
                case 23:
                case 24:
                case 31:
                case 32:
                case 33:
                case 34:
                    this.error = "Constructed encoding used for primitive type";
                    return -1;
            }
        }
        return (inputOffset + this.blockLength);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            tagClass: this.tagClass,
            tagNumber: this.tagNumber,
            isConstructed: this.isConstructed,
        };
    }
}
LocalIdentificationBlock.NAME = "identificationBlock";

class LocalLengthBlock extends LocalBaseBlock {
    constructor({ lenBlock = {}, } = {}) {
        var _a, _b, _c;
        super();
        this.isIndefiniteForm = (_a = lenBlock.isIndefiniteForm) !== null && _a !== void 0 ? _a : false;
        this.longFormUsed = (_b = lenBlock.longFormUsed) !== null && _b !== void 0 ? _b : false;
        this.length = (_c = lenBlock.length) !== null && _c !== void 0 ? _c : 0;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const view = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, view, inputOffset, inputLength)) {
            return -1;
        }
        const intBuffer = view.subarray(inputOffset, inputOffset + inputLength);
        if (intBuffer.length === 0) {
            this.error = "Zero buffer length";
            return -1;
        }
        if (intBuffer[0] === 0xFF) {
            this.error = "Length block 0xFF is reserved by standard";
            return -1;
        }
        this.isIndefiniteForm = intBuffer[0] === 0x80;
        if (this.isIndefiniteForm) {
            this.blockLength = 1;
            return (inputOffset + this.blockLength);
        }
        this.longFormUsed = !!(intBuffer[0] & 0x80);
        if (this.longFormUsed === false) {
            this.length = (intBuffer[0]);
            this.blockLength = 1;
            return (inputOffset + this.blockLength);
        }
        const count = intBuffer[0] & 0x7F;
        if (count > 8) {
            this.error = "Too big integer";
            return -1;
        }
        if ((count + 1) > intBuffer.length) {
            this.error = "End of input reached before message was fully decoded";
            return -1;
        }
        const lenOffset = inputOffset + 1;
        const lengthBufferView = view.subarray(lenOffset, lenOffset + count);
        if (lengthBufferView[count - 1] === 0x00)
            this.warnings.push("Needlessly long encoded length");
        this.length = utilFromBase(lengthBufferView, 8);
        if (this.longFormUsed && (this.length <= 127))
            this.warnings.push("Unnecessary usage of long length form");
        this.blockLength = count + 1;
        return (inputOffset + this.blockLength);
    }
    toBER(sizeOnly = false) {
        let retBuf;
        let retView;
        if (this.length > 127)
            this.longFormUsed = true;
        if (this.isIndefiniteForm) {
            retBuf = new ArrayBuffer(1);
            if (sizeOnly === false) {
                retView = new Uint8Array(retBuf);
                retView[0] = 0x80;
            }
            return retBuf;
        }
        if (this.longFormUsed) {
            const encodedBuf = utilToBase(this.length, 8);
            if (encodedBuf.byteLength > 127) {
                this.error = "Too big length";
                return (EMPTY_BUFFER);
            }
            retBuf = new ArrayBuffer(encodedBuf.byteLength + 1);
            if (sizeOnly)
                return retBuf;
            const encodedView = new Uint8Array(encodedBuf);
            retView = new Uint8Array(retBuf);
            retView[0] = encodedBuf.byteLength | 0x80;
            for (let i = 0; i < encodedBuf.byteLength; i++)
                retView[i + 1] = encodedView[i];
            return retBuf;
        }
        retBuf = new ArrayBuffer(1);
        if (sizeOnly === false) {
            retView = new Uint8Array(retBuf);
            retView[0] = this.length;
        }
        return retBuf;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            isIndefiniteForm: this.isIndefiniteForm,
            longFormUsed: this.longFormUsed,
            length: this.length,
        };
    }
}
LocalLengthBlock.NAME = "lengthBlock";

const typeStore = {};

class BaseBlock extends LocalBaseBlock {
    constructor({ name = EMPTY_STRING, optional = false, primitiveSchema, ...parameters } = {}, valueBlockType) {
        super(parameters);
        this.name = name;
        this.optional = optional;
        if (primitiveSchema) {
            this.primitiveSchema = primitiveSchema;
        }
        this.idBlock = new LocalIdentificationBlock(parameters);
        this.lenBlock = new LocalLengthBlock(parameters);
        this.valueBlock = valueBlockType ? new valueBlockType(parameters) : new ValueBlock(parameters);
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, (this.lenBlock.isIndefiniteForm) ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
            this.error = this.valueBlock.error;
            return resultOffset;
        }
        if (!this.idBlock.error.length)
            this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length)
            this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length)
            this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
    }
    toBER(sizeOnly, writer) {
        const _writer = writer || new ViewWriter();
        if (!writer) {
            prepareIndefiniteForm(this);
        }
        const idBlockBuf = this.idBlock.toBER(sizeOnly);
        _writer.write(idBlockBuf);
        if (this.lenBlock.isIndefiniteForm) {
            _writer.write(new Uint8Array([0x80]).buffer);
            this.valueBlock.toBER(sizeOnly, _writer);
            _writer.write(new ArrayBuffer(2));
        }
        else {
            const valueBlockBuf = this.valueBlock.toBER(sizeOnly);
            this.lenBlock.length = valueBlockBuf.byteLength;
            const lenBlockBuf = this.lenBlock.toBER(sizeOnly);
            _writer.write(lenBlockBuf);
            _writer.write(valueBlockBuf);
        }
        if (!writer) {
            return _writer.final();
        }
        return EMPTY_BUFFER;
    }
    toJSON() {
        const object = {
            ...super.toJSON(),
            idBlock: this.idBlock.toJSON(),
            lenBlock: this.lenBlock.toJSON(),
            valueBlock: this.valueBlock.toJSON(),
            name: this.name,
            optional: this.optional,
        };
        if (this.primitiveSchema)
            object.primitiveSchema = this.primitiveSchema.toJSON();
        return object;
    }
    toString(encoding = "ascii") {
        if (encoding === "ascii") {
            return this.onAsciiEncoding();
        }
        return Convert.ToHex(this.toBER());
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${Convert.ToHex(this.valueBlock.valueBeforeDecodeView)}`;
    }
    isEqual(other) {
        if (this === other) {
            return true;
        }
        if (!(other instanceof this.constructor)) {
            return false;
        }
        const thisRaw = this.toBER();
        const otherRaw = other.toBER();
        return isEqualBuffer(thisRaw, otherRaw);
    }
}
BaseBlock.NAME = "BaseBlock";
function prepareIndefiniteForm(baseBlock) {
    if (baseBlock instanceof typeStore.Constructed) {
        for (const value of baseBlock.valueBlock.value) {
            if (prepareIndefiniteForm(value)) {
                baseBlock.lenBlock.isIndefiniteForm = true;
            }
        }
    }
    return !!baseBlock.lenBlock.isIndefiniteForm;
}

class BaseStringBlock extends BaseBlock {
    constructor({ value = EMPTY_STRING, ...parameters } = {}, stringValueBlockType) {
        super(parameters, stringValueBlockType);
        if (value) {
            this.fromString(value);
        }
    }
    getValue() {
        return this.valueBlock.value;
    }
    setValue(value) {
        this.valueBlock.value = value;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, (this.lenBlock.isIndefiniteForm) ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
            this.error = this.valueBlock.error;
            return resultOffset;
        }
        this.fromBuffer(this.valueBlock.valueHexView);
        if (!this.idBlock.error.length)
            this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length)
            this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length)
            this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : '${this.valueBlock.value}'`;
    }
}
BaseStringBlock.NAME = "BaseStringBlock";

class LocalPrimitiveValueBlock extends HexBlock(ValueBlock) {
    constructor({ isHexOnly = true, ...parameters } = {}) {
        super(parameters);
        this.isHexOnly = isHexOnly;
    }
}
LocalPrimitiveValueBlock.NAME = "PrimitiveValueBlock";

var _a$w;
class Primitive extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalPrimitiveValueBlock);
        this.idBlock.isConstructed = false;
    }
}
_a$w = Primitive;
(() => {
    typeStore.Primitive = _a$w;
})();
Primitive.NAME = "PRIMITIVE";

function localChangeType(inputObject, newType) {
    if (inputObject instanceof newType) {
        return inputObject;
    }
    const newObject = new newType();
    newObject.idBlock = inputObject.idBlock;
    newObject.lenBlock = inputObject.lenBlock;
    newObject.warnings = inputObject.warnings;
    newObject.valueBeforeDecodeView = inputObject.valueBeforeDecodeView;
    return newObject;
}
function localFromBER(inputBuffer, inputOffset = 0, inputLength = inputBuffer.length) {
    const incomingOffset = inputOffset;
    let returnObject = new BaseBlock({}, ValueBlock);
    const baseBlock = new LocalBaseBlock();
    if (!checkBufferParams(baseBlock, inputBuffer, inputOffset, inputLength)) {
        returnObject.error = baseBlock.error;
        return {
            offset: -1,
            result: returnObject
        };
    }
    const intBuffer = inputBuffer.subarray(inputOffset, inputOffset + inputLength);
    if (!intBuffer.length) {
        returnObject.error = "Zero buffer length";
        return {
            offset: -1,
            result: returnObject
        };
    }
    let resultOffset = returnObject.idBlock.fromBER(inputBuffer, inputOffset, inputLength);
    if (returnObject.idBlock.warnings.length) {
        returnObject.warnings.concat(returnObject.idBlock.warnings);
    }
    if (resultOffset === -1) {
        returnObject.error = returnObject.idBlock.error;
        return {
            offset: -1,
            result: returnObject
        };
    }
    inputOffset = resultOffset;
    inputLength -= returnObject.idBlock.blockLength;
    resultOffset = returnObject.lenBlock.fromBER(inputBuffer, inputOffset, inputLength);
    if (returnObject.lenBlock.warnings.length) {
        returnObject.warnings.concat(returnObject.lenBlock.warnings);
    }
    if (resultOffset === -1) {
        returnObject.error = returnObject.lenBlock.error;
        return {
            offset: -1,
            result: returnObject
        };
    }
    inputOffset = resultOffset;
    inputLength -= returnObject.lenBlock.blockLength;
    if (!returnObject.idBlock.isConstructed &&
        returnObject.lenBlock.isIndefiniteForm) {
        returnObject.error = "Indefinite length form used for primitive encoding form";
        return {
            offset: -1,
            result: returnObject
        };
    }
    let newASN1Type = BaseBlock;
    switch (returnObject.idBlock.tagClass) {
        case 1:
            if ((returnObject.idBlock.tagNumber >= 37) &&
                (returnObject.idBlock.isHexOnly === false)) {
                returnObject.error = "UNIVERSAL 37 and upper tags are reserved by ASN.1 standard";
                return {
                    offset: -1,
                    result: returnObject
                };
            }
            switch (returnObject.idBlock.tagNumber) {
                case 0:
                    if ((returnObject.idBlock.isConstructed) &&
                        (returnObject.lenBlock.length > 0)) {
                        returnObject.error = "Type [UNIVERSAL 0] is reserved";
                        return {
                            offset: -1,
                            result: returnObject
                        };
                    }
                    newASN1Type = typeStore.EndOfContent;
                    break;
                case 1:
                    newASN1Type = typeStore.Boolean;
                    break;
                case 2:
                    newASN1Type = typeStore.Integer;
                    break;
                case 3:
                    newASN1Type = typeStore.BitString;
                    break;
                case 4:
                    newASN1Type = typeStore.OctetString;
                    break;
                case 5:
                    newASN1Type = typeStore.Null;
                    break;
                case 6:
                    newASN1Type = typeStore.ObjectIdentifier;
                    break;
                case 10:
                    newASN1Type = typeStore.Enumerated;
                    break;
                case 12:
                    newASN1Type = typeStore.Utf8String;
                    break;
                case 13:
                    newASN1Type = typeStore.RelativeObjectIdentifier;
                    break;
                case 14:
                    newASN1Type = typeStore.TIME;
                    break;
                case 15:
                    returnObject.error = "[UNIVERSAL 15] is reserved by ASN.1 standard";
                    return {
                        offset: -1,
                        result: returnObject
                    };
                case 16:
                    newASN1Type = typeStore.Sequence;
                    break;
                case 17:
                    newASN1Type = typeStore.Set;
                    break;
                case 18:
                    newASN1Type = typeStore.NumericString;
                    break;
                case 19:
                    newASN1Type = typeStore.PrintableString;
                    break;
                case 20:
                    newASN1Type = typeStore.TeletexString;
                    break;
                case 21:
                    newASN1Type = typeStore.VideotexString;
                    break;
                case 22:
                    newASN1Type = typeStore.IA5String;
                    break;
                case 23:
                    newASN1Type = typeStore.UTCTime;
                    break;
                case 24:
                    newASN1Type = typeStore.GeneralizedTime;
                    break;
                case 25:
                    newASN1Type = typeStore.GraphicString;
                    break;
                case 26:
                    newASN1Type = typeStore.VisibleString;
                    break;
                case 27:
                    newASN1Type = typeStore.GeneralString;
                    break;
                case 28:
                    newASN1Type = typeStore.UniversalString;
                    break;
                case 29:
                    newASN1Type = typeStore.CharacterString;
                    break;
                case 30:
                    newASN1Type = typeStore.BmpString;
                    break;
                case 31:
                    newASN1Type = typeStore.DATE;
                    break;
                case 32:
                    newASN1Type = typeStore.TimeOfDay;
                    break;
                case 33:
                    newASN1Type = typeStore.DateTime;
                    break;
                case 34:
                    newASN1Type = typeStore.Duration;
                    break;
                default: {
                    const newObject = returnObject.idBlock.isConstructed
                        ? new typeStore.Constructed()
                        : new typeStore.Primitive();
                    newObject.idBlock = returnObject.idBlock;
                    newObject.lenBlock = returnObject.lenBlock;
                    newObject.warnings = returnObject.warnings;
                    returnObject = newObject;
                }
            }
            break;
        case 2:
        case 3:
        case 4:
        default: {
            newASN1Type = returnObject.idBlock.isConstructed
                ? typeStore.Constructed
                : typeStore.Primitive;
        }
    }
    returnObject = localChangeType(returnObject, newASN1Type);
    resultOffset = returnObject.fromBER(inputBuffer, inputOffset, returnObject.lenBlock.isIndefiniteForm ? inputLength : returnObject.lenBlock.length);
    returnObject.valueBeforeDecodeView = inputBuffer.subarray(incomingOffset, incomingOffset + returnObject.blockLength);
    return {
        offset: resultOffset,
        result: returnObject
    };
}
function fromBER(inputBuffer) {
    if (!inputBuffer.byteLength) {
        const result = new BaseBlock({}, ValueBlock);
        result.error = "Input buffer has zero length";
        return {
            offset: -1,
            result
        };
    }
    return localFromBER(BufferSourceConverter.toUint8Array(inputBuffer).slice(), 0, inputBuffer.byteLength);
}

function checkLen(indefiniteLength, length) {
    if (indefiniteLength) {
        return 1;
    }
    return length;
}
class LocalConstructedValueBlock extends ValueBlock {
    constructor({ value = [], isIndefiniteForm = false, ...parameters } = {}) {
        super(parameters);
        this.value = value;
        this.isIndefiniteForm = isIndefiniteForm;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const view = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, view, inputOffset, inputLength)) {
            return -1;
        }
        this.valueBeforeDecodeView = view.subarray(inputOffset, inputOffset + inputLength);
        if (this.valueBeforeDecodeView.length === 0) {
            this.warnings.push("Zero buffer length");
            return inputOffset;
        }
        let currentOffset = inputOffset;
        while (checkLen(this.isIndefiniteForm, inputLength) > 0) {
            const returnObject = localFromBER(view, currentOffset, inputLength);
            if (returnObject.offset === -1) {
                this.error = returnObject.result.error;
                this.warnings.concat(returnObject.result.warnings);
                return -1;
            }
            currentOffset = returnObject.offset;
            this.blockLength += returnObject.result.blockLength;
            inputLength -= returnObject.result.blockLength;
            this.value.push(returnObject.result);
            if (this.isIndefiniteForm && returnObject.result.constructor.NAME === END_OF_CONTENT_NAME) {
                break;
            }
        }
        if (this.isIndefiniteForm) {
            if (this.value[this.value.length - 1].constructor.NAME === END_OF_CONTENT_NAME) {
                this.value.pop();
            }
            else {
                this.warnings.push("No EndOfContent block encoded");
            }
        }
        return currentOffset;
    }
    toBER(sizeOnly, writer) {
        const _writer = writer || new ViewWriter();
        for (let i = 0; i < this.value.length; i++) {
            this.value[i].toBER(sizeOnly, _writer);
        }
        if (!writer) {
            return _writer.final();
        }
        return EMPTY_BUFFER;
    }
    toJSON() {
        const object = {
            ...super.toJSON(),
            isIndefiniteForm: this.isIndefiniteForm,
            value: [],
        };
        for (const value of this.value) {
            object.value.push(value.toJSON());
        }
        return object;
    }
}
LocalConstructedValueBlock.NAME = "ConstructedValueBlock";

var _a$v;
class Constructed extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalConstructedValueBlock);
        this.idBlock.isConstructed = true;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        const resultOffset = this.valueBlock.fromBER(inputBuffer, inputOffset, (this.lenBlock.isIndefiniteForm) ? inputLength : this.lenBlock.length);
        if (resultOffset === -1) {
            this.error = this.valueBlock.error;
            return resultOffset;
        }
        if (!this.idBlock.error.length)
            this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length)
            this.blockLength += this.lenBlock.blockLength;
        if (!this.valueBlock.error.length)
            this.blockLength += this.valueBlock.blockLength;
        return resultOffset;
    }
    onAsciiEncoding() {
        const values = [];
        for (const value of this.valueBlock.value) {
            values.push(value.toString("ascii").split("\n").map(o => `  ${o}`).join("\n"));
        }
        const blockName = this.idBlock.tagClass === 3
            ? `[${this.idBlock.tagNumber}]`
            : this.constructor.NAME;
        return values.length
            ? `${blockName} :\n${values.join("\n")}`
            : `${blockName} :`;
    }
}
_a$v = Constructed;
(() => {
    typeStore.Constructed = _a$v;
})();
Constructed.NAME = "CONSTRUCTED";

class LocalEndOfContentValueBlock extends ValueBlock {
    fromBER(inputBuffer, inputOffset, inputLength) {
        return inputOffset;
    }
    toBER(sizeOnly) {
        return EMPTY_BUFFER;
    }
}
LocalEndOfContentValueBlock.override = "EndOfContentValueBlock";

var _a$u;
class EndOfContent extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalEndOfContentValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 0;
    }
}
_a$u = EndOfContent;
(() => {
    typeStore.EndOfContent = _a$u;
})();
EndOfContent.NAME = END_OF_CONTENT_NAME;

var _a$t;
class Null extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, ValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 5;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        if (this.lenBlock.length > 0)
            this.warnings.push("Non-zero length of value block for Null type");
        if (!this.idBlock.error.length)
            this.blockLength += this.idBlock.blockLength;
        if (!this.lenBlock.error.length)
            this.blockLength += this.lenBlock.blockLength;
        this.blockLength += inputLength;
        if ((inputOffset + inputLength) > inputBuffer.byteLength) {
            this.error = "End of input reached before message was fully decoded (inconsistent offset and length values)";
            return -1;
        }
        return (inputOffset + inputLength);
    }
    toBER(sizeOnly, writer) {
        const retBuf = new ArrayBuffer(2);
        if (!sizeOnly) {
            const retView = new Uint8Array(retBuf);
            retView[0] = 0x05;
            retView[1] = 0x00;
        }
        if (writer) {
            writer.write(retBuf);
        }
        return retBuf;
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME}`;
    }
}
_a$t = Null;
(() => {
    typeStore.Null = _a$t;
})();
Null.NAME = "NULL";

class LocalBooleanValueBlock extends HexBlock(ValueBlock) {
    constructor({ value, ...parameters } = {}) {
        super(parameters);
        if (parameters.valueHex) {
            this.valueHexView = BufferSourceConverter.toUint8Array(parameters.valueHex);
        }
        else {
            this.valueHexView = new Uint8Array(1);
        }
        if (value) {
            this.value = value;
        }
    }
    get value() {
        for (const octet of this.valueHexView) {
            if (octet > 0) {
                return true;
            }
        }
        return false;
    }
    set value(value) {
        this.valueHexView[0] = value ? 0xFF : 0x00;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
            return -1;
        }
        this.valueHexView = inputView.subarray(inputOffset, inputOffset + inputLength);
        if (inputLength > 1)
            this.warnings.push("Boolean value encoded in more then 1 octet");
        this.isHexOnly = true;
        utilDecodeTC.call(this);
        this.blockLength = inputLength;
        return (inputOffset + inputLength);
    }
    toBER() {
        return this.valueHexView.slice();
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
        };
    }
}
LocalBooleanValueBlock.NAME = "BooleanValueBlock";

var _a$s;
class Boolean$1 extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalBooleanValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 1;
    }
    getValue() {
        return this.valueBlock.value;
    }
    setValue(value) {
        this.valueBlock.value = value;
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${this.getValue}`;
    }
}
_a$s = Boolean$1;
(() => {
    typeStore.Boolean = _a$s;
})();
Boolean$1.NAME = "BOOLEAN";

class LocalOctetStringValueBlock extends HexBlock(LocalConstructedValueBlock) {
    constructor({ isConstructed = false, ...parameters } = {}) {
        super(parameters);
        this.isConstructed = isConstructed;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        let resultOffset = 0;
        if (this.isConstructed) {
            this.isHexOnly = false;
            resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength);
            if (resultOffset === -1)
                return resultOffset;
            for (let i = 0; i < this.value.length; i++) {
                const currentBlockName = this.value[i].constructor.NAME;
                if (currentBlockName === END_OF_CONTENT_NAME) {
                    if (this.isIndefiniteForm)
                        break;
                    else {
                        this.error = "EndOfContent is unexpected, OCTET STRING may consists of OCTET STRINGs only";
                        return -1;
                    }
                }
                if (currentBlockName !== OCTET_STRING_NAME) {
                    this.error = "OCTET STRING may consists of OCTET STRINGs only";
                    return -1;
                }
            }
        }
        else {
            this.isHexOnly = true;
            resultOffset = super.fromBER(inputBuffer, inputOffset, inputLength);
            this.blockLength = inputLength;
        }
        return resultOffset;
    }
    toBER(sizeOnly, writer) {
        if (this.isConstructed)
            return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
        return sizeOnly
            ? new ArrayBuffer(this.valueHexView.byteLength)
            : this.valueHexView.slice().buffer;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            isConstructed: this.isConstructed,
        };
    }
}
LocalOctetStringValueBlock.NAME = "OctetStringValueBlock";

var _a$r;
class OctetString extends BaseBlock {
    constructor({ idBlock = {}, lenBlock = {}, ...parameters } = {}) {
        var _b, _c;
        (_b = parameters.isConstructed) !== null && _b !== void 0 ? _b : (parameters.isConstructed = !!((_c = parameters.value) === null || _c === void 0 ? void 0 : _c.length));
        super({
            idBlock: {
                isConstructed: parameters.isConstructed,
                ...idBlock,
            },
            lenBlock: {
                ...lenBlock,
                isIndefiniteForm: !!parameters.isIndefiniteForm,
            },
            ...parameters,
        }, LocalOctetStringValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 4;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isConstructed = this.idBlock.isConstructed;
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        if (inputLength === 0) {
            if (this.idBlock.error.length === 0)
                this.blockLength += this.idBlock.blockLength;
            if (this.lenBlock.error.length === 0)
                this.blockLength += this.lenBlock.blockLength;
            return inputOffset;
        }
        if (!this.valueBlock.isConstructed) {
            const view = inputBuffer instanceof ArrayBuffer ? new Uint8Array(inputBuffer) : inputBuffer;
            const buf = view.subarray(inputOffset, inputOffset + inputLength);
            try {
                if (buf.byteLength) {
                    const asn = localFromBER(buf, 0, buf.byteLength);
                    if (asn.offset !== -1 && asn.offset === inputLength) {
                        this.valueBlock.value = [asn.result];
                    }
                }
            }
            catch (e) {
            }
        }
        return super.fromBER(inputBuffer, inputOffset, inputLength);
    }
    onAsciiEncoding() {
        if (this.valueBlock.isConstructed || (this.valueBlock.value && this.valueBlock.value.length)) {
            return Constructed.prototype.onAsciiEncoding.call(this);
        }
        return `${this.constructor.NAME} : ${Convert.ToHex(this.valueBlock.valueHexView)}`;
    }
    getValue() {
        if (!this.idBlock.isConstructed) {
            return this.valueBlock.valueHexView.slice().buffer;
        }
        const array = [];
        for (const content of this.valueBlock.value) {
            if (content instanceof OctetString) {
                array.push(content.valueBlock.valueHexView);
            }
        }
        return BufferSourceConverter.concat(array);
    }
}
_a$r = OctetString;
(() => {
    typeStore.OctetString = _a$r;
})();
OctetString.NAME = OCTET_STRING_NAME;

class LocalBitStringValueBlock extends HexBlock(LocalConstructedValueBlock) {
    constructor({ unusedBits = 0, isConstructed = false, ...parameters } = {}) {
        super(parameters);
        this.unusedBits = unusedBits;
        this.isConstructed = isConstructed;
        this.blockLength = this.valueHexView.byteLength;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        if (!inputLength) {
            return inputOffset;
        }
        let resultOffset = -1;
        if (this.isConstructed) {
            resultOffset = LocalConstructedValueBlock.prototype.fromBER.call(this, inputBuffer, inputOffset, inputLength);
            if (resultOffset === -1)
                return resultOffset;
            for (const value of this.value) {
                const currentBlockName = value.constructor.NAME;
                if (currentBlockName === END_OF_CONTENT_NAME) {
                    if (this.isIndefiniteForm)
                        break;
                    else {
                        this.error = "EndOfContent is unexpected, BIT STRING may consists of BIT STRINGs only";
                        return -1;
                    }
                }
                if (currentBlockName !== BIT_STRING_NAME) {
                    this.error = "BIT STRING may consists of BIT STRINGs only";
                    return -1;
                }
                const valueBlock = value.valueBlock;
                if ((this.unusedBits > 0) && (valueBlock.unusedBits > 0)) {
                    this.error = "Using of \"unused bits\" inside constructive BIT STRING allowed for least one only";
                    return -1;
                }
                this.unusedBits = valueBlock.unusedBits;
            }
            return resultOffset;
        }
        const inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
            return -1;
        }
        const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.unusedBits = intBuffer[0];
        if (this.unusedBits > 7) {
            this.error = "Unused bits for BitString must be in range 0-7";
            return -1;
        }
        if (!this.unusedBits) {
            const buf = intBuffer.subarray(1);
            try {
                if (buf.byteLength) {
                    const asn = localFromBER(buf, 0, buf.byteLength);
                    if (asn.offset !== -1 && asn.offset === (inputLength - 1)) {
                        this.value = [asn.result];
                    }
                }
            }
            catch (e) {
            }
        }
        this.valueHexView = intBuffer.subarray(1);
        this.blockLength = intBuffer.length;
        return (inputOffset + inputLength);
    }
    toBER(sizeOnly, writer) {
        if (this.isConstructed) {
            return LocalConstructedValueBlock.prototype.toBER.call(this, sizeOnly, writer);
        }
        if (sizeOnly) {
            return new ArrayBuffer(this.valueHexView.byteLength + 1);
        }
        if (!this.valueHexView.byteLength) {
            return EMPTY_BUFFER;
        }
        const retView = new Uint8Array(this.valueHexView.length + 1);
        retView[0] = this.unusedBits;
        retView.set(this.valueHexView, 1);
        return retView.buffer;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            unusedBits: this.unusedBits,
            isConstructed: this.isConstructed,
        };
    }
}
LocalBitStringValueBlock.NAME = "BitStringValueBlock";

var _a$q;
class BitString extends BaseBlock {
    constructor({ idBlock = {}, lenBlock = {}, ...parameters } = {}) {
        var _b, _c;
        (_b = parameters.isConstructed) !== null && _b !== void 0 ? _b : (parameters.isConstructed = !!((_c = parameters.value) === null || _c === void 0 ? void 0 : _c.length));
        super({
            idBlock: {
                isConstructed: parameters.isConstructed,
                ...idBlock,
            },
            lenBlock: {
                ...lenBlock,
                isIndefiniteForm: !!parameters.isIndefiniteForm,
            },
            ...parameters,
        }, LocalBitStringValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 3;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        this.valueBlock.isConstructed = this.idBlock.isConstructed;
        this.valueBlock.isIndefiniteForm = this.lenBlock.isIndefiniteForm;
        return super.fromBER(inputBuffer, inputOffset, inputLength);
    }
    onAsciiEncoding() {
        if (this.valueBlock.isConstructed || (this.valueBlock.value && this.valueBlock.value.length)) {
            return Constructed.prototype.onAsciiEncoding.call(this);
        }
        else {
            const bits = [];
            const valueHex = this.valueBlock.valueHexView;
            for (const byte of valueHex) {
                bits.push(byte.toString(2).padStart(8, "0"));
            }
            const bitsStr = bits.join("");
            return `${this.constructor.NAME} : ${bitsStr.substring(0, bitsStr.length - this.valueBlock.unusedBits)}`;
        }
    }
}
_a$q = BitString;
(() => {
    typeStore.BitString = _a$q;
})();
BitString.NAME = BIT_STRING_NAME;

var _a$p;
function viewAdd(first, second) {
    const c = new Uint8Array([0]);
    const firstView = new Uint8Array(first);
    const secondView = new Uint8Array(second);
    let firstViewCopy = firstView.slice(0);
    const firstViewCopyLength = firstViewCopy.length - 1;
    const secondViewCopy = secondView.slice(0);
    const secondViewCopyLength = secondViewCopy.length - 1;
    let value = 0;
    const max = (secondViewCopyLength < firstViewCopyLength) ? firstViewCopyLength : secondViewCopyLength;
    let counter = 0;
    for (let i = max; i >= 0; i--, counter++) {
        switch (true) {
            case (counter < secondViewCopy.length):
                value = firstViewCopy[firstViewCopyLength - counter] + secondViewCopy[secondViewCopyLength - counter] + c[0];
                break;
            default:
                value = firstViewCopy[firstViewCopyLength - counter] + c[0];
        }
        c[0] = value / 10;
        switch (true) {
            case (counter >= firstViewCopy.length):
                firstViewCopy = utilConcatView(new Uint8Array([value % 10]), firstViewCopy);
                break;
            default:
                firstViewCopy[firstViewCopyLength - counter] = value % 10;
        }
    }
    if (c[0] > 0)
        firstViewCopy = utilConcatView(c, firstViewCopy);
    return firstViewCopy;
}
function power2(n) {
    if (n >= powers2.length) {
        for (let p = powers2.length; p <= n; p++) {
            const c = new Uint8Array([0]);
            let digits = (powers2[p - 1]).slice(0);
            for (let i = (digits.length - 1); i >= 0; i--) {
                const newValue = new Uint8Array([(digits[i] << 1) + c[0]]);
                c[0] = newValue[0] / 10;
                digits[i] = newValue[0] % 10;
            }
            if (c[0] > 0)
                digits = utilConcatView(c, digits);
            powers2.push(digits);
        }
    }
    return powers2[n];
}
function viewSub(first, second) {
    let b = 0;
    const firstView = new Uint8Array(first);
    const secondView = new Uint8Array(second);
    const firstViewCopy = firstView.slice(0);
    const firstViewCopyLength = firstViewCopy.length - 1;
    const secondViewCopy = secondView.slice(0);
    const secondViewCopyLength = secondViewCopy.length - 1;
    let value;
    let counter = 0;
    for (let i = secondViewCopyLength; i >= 0; i--, counter++) {
        value = firstViewCopy[firstViewCopyLength - counter] - secondViewCopy[secondViewCopyLength - counter] - b;
        switch (true) {
            case (value < 0):
                b = 1;
                firstViewCopy[firstViewCopyLength - counter] = value + 10;
                break;
            default:
                b = 0;
                firstViewCopy[firstViewCopyLength - counter] = value;
        }
    }
    if (b > 0) {
        for (let i = (firstViewCopyLength - secondViewCopyLength + 1); i >= 0; i--, counter++) {
            value = firstViewCopy[firstViewCopyLength - counter] - b;
            if (value < 0) {
                b = 1;
                firstViewCopy[firstViewCopyLength - counter] = value + 10;
            }
            else {
                b = 0;
                firstViewCopy[firstViewCopyLength - counter] = value;
                break;
            }
        }
    }
    return firstViewCopy.slice();
}
class LocalIntegerValueBlock extends HexBlock(ValueBlock) {
    constructor({ value, ...parameters } = {}) {
        super(parameters);
        this._valueDec = 0;
        if (parameters.valueHex) {
            this.setValueHex();
        }
        if (value !== undefined) {
            this.valueDec = value;
        }
    }
    setValueHex() {
        if (this.valueHexView.length >= 4) {
            this.warnings.push("Too big Integer for decoding, hex only");
            this.isHexOnly = true;
            this._valueDec = 0;
        }
        else {
            this.isHexOnly = false;
            if (this.valueHexView.length > 0) {
                this._valueDec = utilDecodeTC.call(this);
            }
        }
    }
    set valueDec(v) {
        this._valueDec = v;
        this.isHexOnly = false;
        this.valueHexView = new Uint8Array(utilEncodeTC(v));
    }
    get valueDec() {
        return this._valueDec;
    }
    fromDER(inputBuffer, inputOffset, inputLength, expectedLength = 0) {
        const offset = this.fromBER(inputBuffer, inputOffset, inputLength);
        if (offset === -1)
            return offset;
        const view = this.valueHexView;
        if ((view[0] === 0x00) && ((view[1] & 0x80) !== 0)) {
            this.valueHexView = view.subarray(1);
        }
        else {
            if (expectedLength !== 0) {
                if (view.length < expectedLength) {
                    if ((expectedLength - view.length) > 1)
                        expectedLength = view.length + 1;
                    this.valueHexView = view.subarray(expectedLength - view.length);
                }
            }
        }
        return offset;
    }
    toDER(sizeOnly = false) {
        const view = this.valueHexView;
        switch (true) {
            case ((view[0] & 0x80) !== 0):
                {
                    const updatedView = new Uint8Array(this.valueHexView.length + 1);
                    updatedView[0] = 0x00;
                    updatedView.set(view, 1);
                    this.valueHexView = updatedView;
                }
                break;
            case ((view[0] === 0x00) && ((view[1] & 0x80) === 0)):
                {
                    this.valueHexView = this.valueHexView.subarray(1);
                }
                break;
        }
        return this.toBER(sizeOnly);
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const resultOffset = super.fromBER(inputBuffer, inputOffset, inputLength);
        if (resultOffset === -1) {
            return resultOffset;
        }
        this.setValueHex();
        return resultOffset;
    }
    toBER(sizeOnly) {
        return sizeOnly
            ? new ArrayBuffer(this.valueHexView.length)
            : this.valueHexView.slice().buffer;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            valueDec: this.valueDec,
        };
    }
    toString() {
        const firstBit = (this.valueHexView.length * 8) - 1;
        let digits = new Uint8Array((this.valueHexView.length * 8) / 3);
        let bitNumber = 0;
        let currentByte;
        const asn1View = this.valueHexView;
        let result = "";
        let flag = false;
        for (let byteNumber = (asn1View.byteLength - 1); byteNumber >= 0; byteNumber--) {
            currentByte = asn1View[byteNumber];
            for (let i = 0; i < 8; i++) {
                if ((currentByte & 1) === 1) {
                    switch (bitNumber) {
                        case firstBit:
                            digits = viewSub(power2(bitNumber), digits);
                            result = "-";
                            break;
                        default:
                            digits = viewAdd(digits, power2(bitNumber));
                    }
                }
                bitNumber++;
                currentByte >>= 1;
            }
        }
        for (let i = 0; i < digits.length; i++) {
            if (digits[i])
                flag = true;
            if (flag)
                result += digitsString.charAt(digits[i]);
        }
        if (flag === false)
            result += digitsString.charAt(0);
        return result;
    }
}
_a$p = LocalIntegerValueBlock;
LocalIntegerValueBlock.NAME = "IntegerValueBlock";
(() => {
    Object.defineProperty(_a$p.prototype, "valueHex", {
        set: function (v) {
            this.valueHexView = new Uint8Array(v);
            this.setValueHex();
        },
        get: function () {
            return this.valueHexView.slice().buffer;
        },
    });
})();

var _a$o;
class Integer extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalIntegerValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 2;
    }
    toBigInt() {
        assertBigInt();
        return BigInt(this.valueBlock.toString());
    }
    static fromBigInt(value) {
        assertBigInt();
        const bigIntValue = BigInt(value);
        const writer = new ViewWriter();
        const hex = bigIntValue.toString(16).replace(/^-/, "");
        const view = new Uint8Array(Convert.FromHex(hex));
        if (bigIntValue < 0) {
            const first = new Uint8Array(view.length + (view[0] & 0x80 ? 1 : 0));
            first[0] |= 0x80;
            const firstInt = BigInt(`0x${Convert.ToHex(first)}`);
            const secondInt = firstInt + bigIntValue;
            const second = BufferSourceConverter.toUint8Array(Convert.FromHex(secondInt.toString(16)));
            second[0] |= 0x80;
            writer.write(second);
        }
        else {
            if (view[0] & 0x80) {
                writer.write(new Uint8Array([0]));
            }
            writer.write(view);
        }
        const res = new Integer({
            valueHex: writer.final(),
        });
        return res;
    }
    convertToDER() {
        const integer = new Integer({ valueHex: this.valueBlock.valueHexView });
        integer.valueBlock.toDER();
        return integer;
    }
    convertFromDER() {
        return new Integer({
            valueHex: this.valueBlock.valueHexView[0] === 0
                ? this.valueBlock.valueHexView.subarray(1)
                : this.valueBlock.valueHexView,
        });
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${this.valueBlock.toString()}`;
    }
}
_a$o = Integer;
(() => {
    typeStore.Integer = _a$o;
})();
Integer.NAME = "INTEGER";

var _a$n;
class Enumerated extends Integer {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 10;
    }
}
_a$n = Enumerated;
(() => {
    typeStore.Enumerated = _a$n;
})();
Enumerated.NAME = "ENUMERATED";

class LocalSidValueBlock extends HexBlock(ValueBlock) {
    constructor({ valueDec = -1, isFirstSid = false, ...parameters } = {}) {
        super(parameters);
        this.valueDec = valueDec;
        this.isFirstSid = isFirstSid;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        if (!inputLength) {
            return inputOffset;
        }
        const inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength)) {
            return -1;
        }
        const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.valueHexView = new Uint8Array(inputLength);
        for (let i = 0; i < inputLength; i++) {
            this.valueHexView[i] = intBuffer[i] & 0x7F;
            this.blockLength++;
            if ((intBuffer[i] & 0x80) === 0x00)
                break;
        }
        const tempView = new Uint8Array(this.blockLength);
        for (let i = 0; i < this.blockLength; i++) {
            tempView[i] = this.valueHexView[i];
        }
        this.valueHexView = tempView;
        if ((intBuffer[this.blockLength - 1] & 0x80) !== 0x00) {
            this.error = "End of input reached before message was fully decoded";
            return -1;
        }
        if (this.valueHexView[0] === 0x00)
            this.warnings.push("Needlessly long format of SID encoding");
        if (this.blockLength <= 8)
            this.valueDec = utilFromBase(this.valueHexView, 7);
        else {
            this.isHexOnly = true;
            this.warnings.push("Too big SID for decoding, hex only");
        }
        return (inputOffset + this.blockLength);
    }
    set valueBigInt(value) {
        assertBigInt();
        let bits = BigInt(value).toString(2);
        while (bits.length % 7) {
            bits = "0" + bits;
        }
        const bytes = new Uint8Array(bits.length / 7);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(bits.slice(i * 7, i * 7 + 7), 2) + (i + 1 < bytes.length ? 0x80 : 0);
        }
        this.fromBER(bytes.buffer, 0, bytes.length);
    }
    toBER(sizeOnly) {
        if (this.isHexOnly) {
            if (sizeOnly)
                return (new ArrayBuffer(this.valueHexView.byteLength));
            const curView = this.valueHexView;
            const retView = new Uint8Array(this.blockLength);
            for (let i = 0; i < (this.blockLength - 1); i++)
                retView[i] = curView[i] | 0x80;
            retView[this.blockLength - 1] = curView[this.blockLength - 1];
            return retView.buffer;
        }
        const encodedBuf = utilToBase(this.valueDec, 7);
        if (encodedBuf.byteLength === 0) {
            this.error = "Error during encoding SID value";
            return EMPTY_BUFFER;
        }
        const retView = new Uint8Array(encodedBuf.byteLength);
        if (!sizeOnly) {
            const encodedView = new Uint8Array(encodedBuf);
            const len = encodedBuf.byteLength - 1;
            for (let i = 0; i < len; i++)
                retView[i] = encodedView[i] | 0x80;
            retView[len] = encodedView[len];
        }
        return retView;
    }
    toString() {
        let result = "";
        if (this.isHexOnly)
            result = Convert.ToHex(this.valueHexView);
        else {
            if (this.isFirstSid) {
                let sidValue = this.valueDec;
                if (this.valueDec <= 39)
                    result = "0.";
                else {
                    if (this.valueDec <= 79) {
                        result = "1.";
                        sidValue -= 40;
                    }
                    else {
                        result = "2.";
                        sidValue -= 80;
                    }
                }
                result += sidValue.toString();
            }
            else
                result = this.valueDec.toString();
        }
        return result;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            valueDec: this.valueDec,
            isFirstSid: this.isFirstSid,
        };
    }
}
LocalSidValueBlock.NAME = "sidBlock";

class LocalObjectIdentifierValueBlock extends ValueBlock {
    constructor({ value = EMPTY_STRING, ...parameters } = {}) {
        super(parameters);
        this.value = [];
        if (value) {
            this.fromString(value);
        }
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        let resultOffset = inputOffset;
        while (inputLength > 0) {
            const sidBlock = new LocalSidValueBlock();
            resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
            if (resultOffset === -1) {
                this.blockLength = 0;
                this.error = sidBlock.error;
                return resultOffset;
            }
            if (this.value.length === 0)
                sidBlock.isFirstSid = true;
            this.blockLength += sidBlock.blockLength;
            inputLength -= sidBlock.blockLength;
            this.value.push(sidBlock);
        }
        return resultOffset;
    }
    toBER(sizeOnly) {
        const retBuffers = [];
        for (let i = 0; i < this.value.length; i++) {
            const valueBuf = this.value[i].toBER(sizeOnly);
            if (valueBuf.byteLength === 0) {
                this.error = this.value[i].error;
                return EMPTY_BUFFER;
            }
            retBuffers.push(valueBuf);
        }
        return concat(retBuffers);
    }
    fromString(string) {
        this.value = [];
        let pos1 = 0;
        let pos2 = 0;
        let sid = "";
        let flag = false;
        do {
            pos2 = string.indexOf(".", pos1);
            if (pos2 === -1)
                sid = string.substring(pos1);
            else
                sid = string.substring(pos1, pos2);
            pos1 = pos2 + 1;
            if (flag) {
                const sidBlock = this.value[0];
                let plus = 0;
                switch (sidBlock.valueDec) {
                    case 0:
                        break;
                    case 1:
                        plus = 40;
                        break;
                    case 2:
                        plus = 80;
                        break;
                    default:
                        this.value = [];
                        return;
                }
                const parsedSID = parseInt(sid, 10);
                if (isNaN(parsedSID))
                    return;
                sidBlock.valueDec = parsedSID + plus;
                flag = false;
            }
            else {
                const sidBlock = new LocalSidValueBlock();
                if (sid > Number.MAX_SAFE_INTEGER) {
                    assertBigInt();
                    const sidValue = BigInt(sid);
                    sidBlock.valueBigInt = sidValue;
                }
                else {
                    sidBlock.valueDec = parseInt(sid, 10);
                    if (isNaN(sidBlock.valueDec))
                        return;
                }
                if (!this.value.length) {
                    sidBlock.isFirstSid = true;
                    flag = true;
                }
                this.value.push(sidBlock);
            }
        } while (pos2 !== -1);
    }
    toString() {
        let result = "";
        let isHexOnly = false;
        for (let i = 0; i < this.value.length; i++) {
            isHexOnly = this.value[i].isHexOnly;
            let sidStr = this.value[i].toString();
            if (i !== 0)
                result = `${result}.`;
            if (isHexOnly) {
                sidStr = `{${sidStr}}`;
                if (this.value[i].isFirstSid)
                    result = `2.{${sidStr} - 80}`;
                else
                    result += sidStr;
            }
            else
                result += sidStr;
        }
        return result;
    }
    toJSON() {
        const object = {
            ...super.toJSON(),
            value: this.toString(),
            sidArray: [],
        };
        for (let i = 0; i < this.value.length; i++) {
            object.sidArray.push(this.value[i].toJSON());
        }
        return object;
    }
}
LocalObjectIdentifierValueBlock.NAME = "ObjectIdentifierValueBlock";

var _a$m;
class ObjectIdentifier$1 extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalObjectIdentifierValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 6;
    }
    getValue() {
        return this.valueBlock.toString();
    }
    setValue(value) {
        this.valueBlock.fromString(value);
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${this.valueBlock.toString() || "empty"}`;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.getValue(),
        };
    }
}
_a$m = ObjectIdentifier$1;
(() => {
    typeStore.ObjectIdentifier = _a$m;
})();
ObjectIdentifier$1.NAME = "OBJECT IDENTIFIER";

class LocalRelativeSidValueBlock extends HexBlock(LocalBaseBlock) {
    constructor({ valueDec = 0, ...parameters } = {}) {
        super(parameters);
        this.valueDec = valueDec;
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        if (inputLength === 0)
            return inputOffset;
        const inputView = BufferSourceConverter.toUint8Array(inputBuffer);
        if (!checkBufferParams(this, inputView, inputOffset, inputLength))
            return -1;
        const intBuffer = inputView.subarray(inputOffset, inputOffset + inputLength);
        this.valueHexView = new Uint8Array(inputLength);
        for (let i = 0; i < inputLength; i++) {
            this.valueHexView[i] = intBuffer[i] & 0x7F;
            this.blockLength++;
            if ((intBuffer[i] & 0x80) === 0x00)
                break;
        }
        const tempView = new Uint8Array(this.blockLength);
        for (let i = 0; i < this.blockLength; i++)
            tempView[i] = this.valueHexView[i];
        this.valueHexView = tempView;
        if ((intBuffer[this.blockLength - 1] & 0x80) !== 0x00) {
            this.error = "End of input reached before message was fully decoded";
            return -1;
        }
        if (this.valueHexView[0] === 0x00)
            this.warnings.push("Needlessly long format of SID encoding");
        if (this.blockLength <= 8)
            this.valueDec = utilFromBase(this.valueHexView, 7);
        else {
            this.isHexOnly = true;
            this.warnings.push("Too big SID for decoding, hex only");
        }
        return (inputOffset + this.blockLength);
    }
    toBER(sizeOnly) {
        if (this.isHexOnly) {
            if (sizeOnly)
                return (new ArrayBuffer(this.valueHexView.byteLength));
            const curView = this.valueHexView;
            const retView = new Uint8Array(this.blockLength);
            for (let i = 0; i < (this.blockLength - 1); i++)
                retView[i] = curView[i] | 0x80;
            retView[this.blockLength - 1] = curView[this.blockLength - 1];
            return retView.buffer;
        }
        const encodedBuf = utilToBase(this.valueDec, 7);
        if (encodedBuf.byteLength === 0) {
            this.error = "Error during encoding SID value";
            return EMPTY_BUFFER;
        }
        const retView = new Uint8Array(encodedBuf.byteLength);
        if (!sizeOnly) {
            const encodedView = new Uint8Array(encodedBuf);
            const len = encodedBuf.byteLength - 1;
            for (let i = 0; i < len; i++)
                retView[i] = encodedView[i] | 0x80;
            retView[len] = encodedView[len];
        }
        return retView.buffer;
    }
    toString() {
        let result = "";
        if (this.isHexOnly)
            result = Convert.ToHex(this.valueHexView);
        else {
            result = this.valueDec.toString();
        }
        return result;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            valueDec: this.valueDec,
        };
    }
}
LocalRelativeSidValueBlock.NAME = "relativeSidBlock";

class LocalRelativeObjectIdentifierValueBlock extends ValueBlock {
    constructor({ value = EMPTY_STRING, ...parameters } = {}) {
        super(parameters);
        this.value = [];
        if (value) {
            this.fromString(value);
        }
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        let resultOffset = inputOffset;
        while (inputLength > 0) {
            const sidBlock = new LocalRelativeSidValueBlock();
            resultOffset = sidBlock.fromBER(inputBuffer, resultOffset, inputLength);
            if (resultOffset === -1) {
                this.blockLength = 0;
                this.error = sidBlock.error;
                return resultOffset;
            }
            this.blockLength += sidBlock.blockLength;
            inputLength -= sidBlock.blockLength;
            this.value.push(sidBlock);
        }
        return resultOffset;
    }
    toBER(sizeOnly, writer) {
        const retBuffers = [];
        for (let i = 0; i < this.value.length; i++) {
            const valueBuf = this.value[i].toBER(sizeOnly);
            if (valueBuf.byteLength === 0) {
                this.error = this.value[i].error;
                return EMPTY_BUFFER;
            }
            retBuffers.push(valueBuf);
        }
        return concat(retBuffers);
    }
    fromString(string) {
        this.value = [];
        let pos1 = 0;
        let pos2 = 0;
        let sid = "";
        do {
            pos2 = string.indexOf(".", pos1);
            if (pos2 === -1)
                sid = string.substring(pos1);
            else
                sid = string.substring(pos1, pos2);
            pos1 = pos2 + 1;
            const sidBlock = new LocalRelativeSidValueBlock();
            sidBlock.valueDec = parseInt(sid, 10);
            if (isNaN(sidBlock.valueDec))
                return true;
            this.value.push(sidBlock);
        } while (pos2 !== -1);
        return true;
    }
    toString() {
        let result = "";
        let isHexOnly = false;
        for (let i = 0; i < this.value.length; i++) {
            isHexOnly = this.value[i].isHexOnly;
            let sidStr = this.value[i].toString();
            if (i !== 0)
                result = `${result}.`;
            if (isHexOnly) {
                sidStr = `{${sidStr}}`;
                result += sidStr;
            }
            else
                result += sidStr;
        }
        return result;
    }
    toJSON() {
        const object = {
            ...super.toJSON(),
            value: this.toString(),
            sidArray: [],
        };
        for (let i = 0; i < this.value.length; i++)
            object.sidArray.push(this.value[i].toJSON());
        return object;
    }
}
LocalRelativeObjectIdentifierValueBlock.NAME = "RelativeObjectIdentifierValueBlock";

var _a$l;
class RelativeObjectIdentifier extends BaseBlock {
    constructor(parameters = {}) {
        super(parameters, LocalRelativeObjectIdentifierValueBlock);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 13;
    }
    getValue() {
        return this.valueBlock.toString();
    }
    setValue(value) {
        this.valueBlock.fromString(value);
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${this.valueBlock.toString() || "empty"}`;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.getValue(),
        };
    }
}
_a$l = RelativeObjectIdentifier;
(() => {
    typeStore.RelativeObjectIdentifier = _a$l;
})();
RelativeObjectIdentifier.NAME = "RelativeObjectIdentifier";

var _a$k;
class Sequence extends Constructed {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 16;
    }
}
_a$k = Sequence;
(() => {
    typeStore.Sequence = _a$k;
})();
Sequence.NAME = "SEQUENCE";

var _a$j;
class Set extends Constructed {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 17;
    }
}
_a$j = Set;
(() => {
    typeStore.Set = _a$j;
})();
Set.NAME = "SET";

class LocalStringValueBlock extends HexBlock(ValueBlock) {
    constructor({ ...parameters } = {}) {
        super(parameters);
        this.isHexOnly = true;
        this.value = EMPTY_STRING;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value,
        };
    }
}
LocalStringValueBlock.NAME = "StringValueBlock";

class LocalSimpleStringValueBlock extends LocalStringValueBlock {
}
LocalSimpleStringValueBlock.NAME = "SimpleStringValueBlock";

class LocalSimpleStringBlock extends BaseStringBlock {
    constructor({ ...parameters } = {}) {
        super(parameters, LocalSimpleStringValueBlock);
    }
    fromBuffer(inputBuffer) {
        this.valueBlock.value = String.fromCharCode.apply(null, BufferSourceConverter.toUint8Array(inputBuffer));
    }
    fromString(inputString) {
        const strLen = inputString.length;
        const view = this.valueBlock.valueHexView = new Uint8Array(strLen);
        for (let i = 0; i < strLen; i++)
            view[i] = inputString.charCodeAt(i);
        this.valueBlock.value = inputString;
    }
}
LocalSimpleStringBlock.NAME = "SIMPLE STRING";

class LocalUtf8StringValueBlock extends LocalSimpleStringBlock {
    fromBuffer(inputBuffer) {
        this.valueBlock.valueHexView = BufferSourceConverter.toUint8Array(inputBuffer);
        try {
            this.valueBlock.value = Convert.ToUtf8String(inputBuffer);
        }
        catch (ex) {
            this.warnings.push(`Error during "decodeURIComponent": ${ex}, using raw string`);
            this.valueBlock.value = Convert.ToBinary(inputBuffer);
        }
    }
    fromString(inputString) {
        this.valueBlock.valueHexView = new Uint8Array(Convert.FromUtf8String(inputString));
        this.valueBlock.value = inputString;
    }
}
LocalUtf8StringValueBlock.NAME = "Utf8StringValueBlock";

var _a$i;
class Utf8String extends LocalUtf8StringValueBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 12;
    }
}
_a$i = Utf8String;
(() => {
    typeStore.Utf8String = _a$i;
})();
Utf8String.NAME = "UTF8String";

class LocalBmpStringValueBlock extends LocalSimpleStringBlock {
    fromBuffer(inputBuffer) {
        this.valueBlock.value = Convert.ToUtf16String(inputBuffer);
        this.valueBlock.valueHexView = BufferSourceConverter.toUint8Array(inputBuffer);
    }
    fromString(inputString) {
        this.valueBlock.value = inputString;
        this.valueBlock.valueHexView = new Uint8Array(Convert.FromUtf16String(inputString));
    }
}
LocalBmpStringValueBlock.NAME = "BmpStringValueBlock";

var _a$h;
class BmpString extends LocalBmpStringValueBlock {
    constructor({ ...parameters } = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 30;
    }
}
_a$h = BmpString;
(() => {
    typeStore.BmpString = _a$h;
})();
BmpString.NAME = "BMPString";

class LocalUniversalStringValueBlock extends LocalSimpleStringBlock {
    fromBuffer(inputBuffer) {
        const copyBuffer = ArrayBuffer.isView(inputBuffer) ? inputBuffer.slice().buffer : inputBuffer.slice(0);
        const valueView = new Uint8Array(copyBuffer);
        for (let i = 0; i < valueView.length; i += 4) {
            valueView[i] = valueView[i + 3];
            valueView[i + 1] = valueView[i + 2];
            valueView[i + 2] = 0x00;
            valueView[i + 3] = 0x00;
        }
        this.valueBlock.value = String.fromCharCode.apply(null, new Uint32Array(copyBuffer));
    }
    fromString(inputString) {
        const strLength = inputString.length;
        const valueHexView = this.valueBlock.valueHexView = new Uint8Array(strLength * 4);
        for (let i = 0; i < strLength; i++) {
            const codeBuf = utilToBase(inputString.charCodeAt(i), 8);
            const codeView = new Uint8Array(codeBuf);
            if (codeView.length > 4)
                continue;
            const dif = 4 - codeView.length;
            for (let j = (codeView.length - 1); j >= 0; j--)
                valueHexView[i * 4 + j + dif] = codeView[j];
        }
        this.valueBlock.value = inputString;
    }
}
LocalUniversalStringValueBlock.NAME = "UniversalStringValueBlock";

var _a$g;
class UniversalString extends LocalUniversalStringValueBlock {
    constructor({ ...parameters } = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 28;
    }
}
_a$g = UniversalString;
(() => {
    typeStore.UniversalString = _a$g;
})();
UniversalString.NAME = "UniversalString";

var _a$f;
class NumericString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 18;
    }
}
_a$f = NumericString;
(() => {
    typeStore.NumericString = _a$f;
})();
NumericString.NAME = "NumericString";

var _a$e;
class PrintableString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 19;
    }
}
_a$e = PrintableString;
(() => {
    typeStore.PrintableString = _a$e;
})();
PrintableString.NAME = "PrintableString";

var _a$d;
class TeletexString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 20;
    }
}
_a$d = TeletexString;
(() => {
    typeStore.TeletexString = _a$d;
})();
TeletexString.NAME = "TeletexString";

var _a$c;
class VideotexString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 21;
    }
}
_a$c = VideotexString;
(() => {
    typeStore.VideotexString = _a$c;
})();
VideotexString.NAME = "VideotexString";

var _a$b;
class IA5String extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 22;
    }
}
_a$b = IA5String;
(() => {
    typeStore.IA5String = _a$b;
})();
IA5String.NAME = "IA5String";

var _a$a;
class GraphicString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 25;
    }
}
_a$a = GraphicString;
(() => {
    typeStore.GraphicString = _a$a;
})();
GraphicString.NAME = "GraphicString";

var _a$9;
class VisibleString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 26;
    }
}
_a$9 = VisibleString;
(() => {
    typeStore.VisibleString = _a$9;
})();
VisibleString.NAME = "VisibleString";

var _a$8;
class GeneralString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 27;
    }
}
_a$8 = GeneralString;
(() => {
    typeStore.GeneralString = _a$8;
})();
GeneralString.NAME = "GeneralString";

var _a$7;
class CharacterString extends LocalSimpleStringBlock {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 29;
    }
}
_a$7 = CharacterString;
(() => {
    typeStore.CharacterString = _a$7;
})();
CharacterString.NAME = "CharacterString";

var _a$6;
class UTCTime extends VisibleString {
    constructor({ value, valueDate, ...parameters } = {}) {
        super(parameters);
        this.year = 0;
        this.month = 0;
        this.day = 0;
        this.hour = 0;
        this.minute = 0;
        this.second = 0;
        if (value) {
            this.fromString(value);
            this.valueBlock.valueHexView = new Uint8Array(value.length);
            for (let i = 0; i < value.length; i++)
                this.valueBlock.valueHexView[i] = value.charCodeAt(i);
        }
        if (valueDate) {
            this.fromDate(valueDate);
            this.valueBlock.valueHexView = new Uint8Array(this.toBuffer());
        }
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 23;
    }
    fromBuffer(inputBuffer) {
        this.fromString(String.fromCharCode.apply(null, BufferSourceConverter.toUint8Array(inputBuffer)));
    }
    toBuffer() {
        const str = this.toString();
        const buffer = new ArrayBuffer(str.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < str.length; i++)
            view[i] = str.charCodeAt(i);
        return buffer;
    }
    fromDate(inputDate) {
        this.year = inputDate.getUTCFullYear();
        this.month = inputDate.getUTCMonth() + 1;
        this.day = inputDate.getUTCDate();
        this.hour = inputDate.getUTCHours();
        this.minute = inputDate.getUTCMinutes();
        this.second = inputDate.getUTCSeconds();
    }
    toDate() {
        return (new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second)));
    }
    fromString(inputString) {
        const parser = /(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z/ig;
        const parserArray = parser.exec(inputString);
        if (parserArray === null) {
            this.error = "Wrong input string for conversion";
            return;
        }
        const year = parseInt(parserArray[1], 10);
        if (year >= 50)
            this.year = 1900 + year;
        else
            this.year = 2000 + year;
        this.month = parseInt(parserArray[2], 10);
        this.day = parseInt(parserArray[3], 10);
        this.hour = parseInt(parserArray[4], 10);
        this.minute = parseInt(parserArray[5], 10);
        this.second = parseInt(parserArray[6], 10);
    }
    toString(encoding = "iso") {
        if (encoding === "iso") {
            const outputArray = new Array(7);
            outputArray[0] = padNumber(((this.year < 2000) ? (this.year - 1900) : (this.year - 2000)), 2);
            outputArray[1] = padNumber(this.month, 2);
            outputArray[2] = padNumber(this.day, 2);
            outputArray[3] = padNumber(this.hour, 2);
            outputArray[4] = padNumber(this.minute, 2);
            outputArray[5] = padNumber(this.second, 2);
            outputArray[6] = "Z";
            return outputArray.join("");
        }
        return super.toString(encoding);
    }
    onAsciiEncoding() {
        return `${this.constructor.NAME} : ${this.toDate().toISOString()}`;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            year: this.year,
            month: this.month,
            day: this.day,
            hour: this.hour,
            minute: this.minute,
            second: this.second,
        };
    }
}
_a$6 = UTCTime;
(() => {
    typeStore.UTCTime = _a$6;
})();
UTCTime.NAME = "UTCTime";

var _a$5;
class GeneralizedTime extends UTCTime {
    constructor(parameters = {}) {
        var _b;
        super(parameters);
        (_b = this.millisecond) !== null && _b !== void 0 ? _b : (this.millisecond = 0);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 24;
    }
    fromDate(inputDate) {
        super.fromDate(inputDate);
        this.millisecond = inputDate.getUTCMilliseconds();
    }
    toDate() {
        return (new Date(Date.UTC(this.year, this.month - 1, this.day, this.hour, this.minute, this.second, this.millisecond)));
    }
    fromString(inputString) {
        let isUTC = false;
        let timeString = "";
        let dateTimeString = "";
        let fractionPart = 0;
        let parser;
        let hourDifference = 0;
        let minuteDifference = 0;
        if (inputString[inputString.length - 1] === "Z") {
            timeString = inputString.substring(0, inputString.length - 1);
            isUTC = true;
        }
        else {
            const number = new Number(inputString[inputString.length - 1]);
            if (isNaN(number.valueOf()))
                throw new Error("Wrong input string for conversion");
            timeString = inputString;
        }
        if (isUTC) {
            if (timeString.indexOf("+") !== -1)
                throw new Error("Wrong input string for conversion");
            if (timeString.indexOf("-") !== -1)
                throw new Error("Wrong input string for conversion");
        }
        else {
            let multiplier = 1;
            let differencePosition = timeString.indexOf("+");
            let differenceString = "";
            if (differencePosition === -1) {
                differencePosition = timeString.indexOf("-");
                multiplier = -1;
            }
            if (differencePosition !== -1) {
                differenceString = timeString.substring(differencePosition + 1);
                timeString = timeString.substring(0, differencePosition);
                if ((differenceString.length !== 2) && (differenceString.length !== 4))
                    throw new Error("Wrong input string for conversion");
                let number = parseInt(differenceString.substring(0, 2), 10);
                if (isNaN(number.valueOf()))
                    throw new Error("Wrong input string for conversion");
                hourDifference = multiplier * number;
                if (differenceString.length === 4) {
                    number = parseInt(differenceString.substring(2, 4), 10);
                    if (isNaN(number.valueOf()))
                        throw new Error("Wrong input string for conversion");
                    minuteDifference = multiplier * number;
                }
            }
        }
        let fractionPointPosition = timeString.indexOf(".");
        if (fractionPointPosition === -1)
            fractionPointPosition = timeString.indexOf(",");
        if (fractionPointPosition !== -1) {
            const fractionPartCheck = new Number(`0${timeString.substring(fractionPointPosition)}`);
            if (isNaN(fractionPartCheck.valueOf()))
                throw new Error("Wrong input string for conversion");
            fractionPart = fractionPartCheck.valueOf();
            dateTimeString = timeString.substring(0, fractionPointPosition);
        }
        else
            dateTimeString = timeString;
        switch (true) {
            case (dateTimeString.length === 8):
                parser = /(\d{4})(\d{2})(\d{2})/ig;
                if (fractionPointPosition !== -1)
                    throw new Error("Wrong input string for conversion");
                break;
            case (dateTimeString.length === 10):
                parser = /(\d{4})(\d{2})(\d{2})(\d{2})/ig;
                if (fractionPointPosition !== -1) {
                    let fractionResult = 60 * fractionPart;
                    this.minute = Math.floor(fractionResult);
                    fractionResult = 60 * (fractionResult - this.minute);
                    this.second = Math.floor(fractionResult);
                    fractionResult = 1000 * (fractionResult - this.second);
                    this.millisecond = Math.floor(fractionResult);
                }
                break;
            case (dateTimeString.length === 12):
                parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})/ig;
                if (fractionPointPosition !== -1) {
                    let fractionResult = 60 * fractionPart;
                    this.second = Math.floor(fractionResult);
                    fractionResult = 1000 * (fractionResult - this.second);
                    this.millisecond = Math.floor(fractionResult);
                }
                break;
            case (dateTimeString.length === 14):
                parser = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/ig;
                if (fractionPointPosition !== -1) {
                    const fractionResult = 1000 * fractionPart;
                    this.millisecond = Math.floor(fractionResult);
                }
                break;
            default:
                throw new Error("Wrong input string for conversion");
        }
        const parserArray = parser.exec(dateTimeString);
        if (parserArray === null)
            throw new Error("Wrong input string for conversion");
        for (let j = 1; j < parserArray.length; j++) {
            switch (j) {
                case 1:
                    this.year = parseInt(parserArray[j], 10);
                    break;
                case 2:
                    this.month = parseInt(parserArray[j], 10);
                    break;
                case 3:
                    this.day = parseInt(parserArray[j], 10);
                    break;
                case 4:
                    this.hour = parseInt(parserArray[j], 10) + hourDifference;
                    break;
                case 5:
                    this.minute = parseInt(parserArray[j], 10) + minuteDifference;
                    break;
                case 6:
                    this.second = parseInt(parserArray[j], 10);
                    break;
                default:
                    throw new Error("Wrong input string for conversion");
            }
        }
        if (isUTC === false) {
            const tempDate = new Date(this.year, this.month, this.day, this.hour, this.minute, this.second, this.millisecond);
            this.year = tempDate.getUTCFullYear();
            this.month = tempDate.getUTCMonth();
            this.day = tempDate.getUTCDay();
            this.hour = tempDate.getUTCHours();
            this.minute = tempDate.getUTCMinutes();
            this.second = tempDate.getUTCSeconds();
            this.millisecond = tempDate.getUTCMilliseconds();
        }
    }
    toString(encoding = "iso") {
        if (encoding === "iso") {
            const outputArray = [];
            outputArray.push(padNumber(this.year, 4));
            outputArray.push(padNumber(this.month, 2));
            outputArray.push(padNumber(this.day, 2));
            outputArray.push(padNumber(this.hour, 2));
            outputArray.push(padNumber(this.minute, 2));
            outputArray.push(padNumber(this.second, 2));
            if (this.millisecond !== 0) {
                outputArray.push(".");
                outputArray.push(padNumber(this.millisecond, 3));
            }
            outputArray.push("Z");
            return outputArray.join("");
        }
        return super.toString(encoding);
    }
    toJSON() {
        return {
            ...super.toJSON(),
            millisecond: this.millisecond,
        };
    }
}
_a$5 = GeneralizedTime;
(() => {
    typeStore.GeneralizedTime = _a$5;
})();
GeneralizedTime.NAME = "GeneralizedTime";

var _a$4;
class DATE extends Utf8String {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 31;
    }
}
_a$4 = DATE;
(() => {
    typeStore.DATE = _a$4;
})();
DATE.NAME = "DATE";

var _a$3;
class TimeOfDay extends Utf8String {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 32;
    }
}
_a$3 = TimeOfDay;
(() => {
    typeStore.TimeOfDay = _a$3;
})();
TimeOfDay.NAME = "TimeOfDay";

var _a$2;
class DateTime extends Utf8String {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 33;
    }
}
_a$2 = DateTime;
(() => {
    typeStore.DateTime = _a$2;
})();
DateTime.NAME = "DateTime";

var _a$1;
class Duration extends Utf8String {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 34;
    }
}
_a$1 = Duration;
(() => {
    typeStore.Duration = _a$1;
})();
Duration.NAME = "Duration";

var _a;
class TIME extends Utf8String {
    constructor(parameters = {}) {
        super(parameters);
        this.idBlock.tagClass = 1;
        this.idBlock.tagNumber = 14;
    }
}
_a = TIME;
(() => {
    typeStore.TIME = _a;
})();
TIME.NAME = "TIME";

class Any {
    constructor({ name = EMPTY_STRING, optional = false, } = {}) {
        this.name = name;
        this.optional = optional;
    }
}

class Choice extends Any {
    constructor({ value = [], ...parameters } = {}) {
        super(parameters);
        this.value = value;
    }
}

class Repeated extends Any {
    constructor({ value = new Any(), local = false, ...parameters } = {}) {
        super(parameters);
        this.value = value;
        this.local = local;
    }
}

class RawData {
    constructor({ data = EMPTY_VIEW } = {}) {
        this.dataView = BufferSourceConverter.toUint8Array(data);
    }
    get data() {
        return this.dataView.slice().buffer;
    }
    set data(value) {
        this.dataView = BufferSourceConverter.toUint8Array(value);
    }
    fromBER(inputBuffer, inputOffset, inputLength) {
        const endLength = inputOffset + inputLength;
        this.dataView = BufferSourceConverter.toUint8Array(inputBuffer).subarray(inputOffset, endLength);
        return endLength;
    }
    toBER(sizeOnly) {
        return this.dataView.slice().buffer;
    }
}

function compareSchema(root, inputData, inputSchema) {
    if (inputSchema instanceof Choice) {
        for (let j = 0; j < inputSchema.value.length; j++) {
            const result = compareSchema(root, inputData, inputSchema.value[j]);
            if (result.verified) {
                return {
                    verified: true,
                    result: root
                };
            }
        }
        {
            const _result = {
                verified: false,
                result: {
                    error: "Wrong values for Choice type"
                },
            };
            if (inputSchema.hasOwnProperty(NAME))
                _result.name = inputSchema.name;
            return _result;
        }
    }
    if (inputSchema instanceof Any) {
        if (inputSchema.hasOwnProperty(NAME))
            root[inputSchema.name] = inputData;
        return {
            verified: true,
            result: root
        };
    }
    if ((root instanceof Object) === false) {
        return {
            verified: false,
            result: { error: "Wrong root object" }
        };
    }
    if ((inputData instanceof Object) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 data" }
        };
    }
    if ((inputSchema instanceof Object) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if ((ID_BLOCK in inputSchema) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if ((FROM_BER in inputSchema.idBlock) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if ((TO_BER in inputSchema.idBlock) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    const encodedId = inputSchema.idBlock.toBER(false);
    if (encodedId.byteLength === 0) {
        return {
            verified: false,
            result: { error: "Error encoding idBlock for ASN.1 schema" }
        };
    }
    const decodedOffset = inputSchema.idBlock.fromBER(encodedId, 0, encodedId.byteLength);
    if (decodedOffset === -1) {
        return {
            verified: false,
            result: { error: "Error decoding idBlock for ASN.1 schema" }
        };
    }
    if (inputSchema.idBlock.hasOwnProperty(TAG_CLASS) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if (inputSchema.idBlock.tagClass !== inputData.idBlock.tagClass) {
        return {
            verified: false,
            result: root
        };
    }
    if (inputSchema.idBlock.hasOwnProperty(TAG_NUMBER) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if (inputSchema.idBlock.tagNumber !== inputData.idBlock.tagNumber) {
        return {
            verified: false,
            result: root
        };
    }
    if (inputSchema.idBlock.hasOwnProperty(IS_CONSTRUCTED) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if (inputSchema.idBlock.isConstructed !== inputData.idBlock.isConstructed) {
        return {
            verified: false,
            result: root
        };
    }
    if (!(IS_HEX_ONLY in inputSchema.idBlock)) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema" }
        };
    }
    if (inputSchema.idBlock.isHexOnly !== inputData.idBlock.isHexOnly) {
        return {
            verified: false,
            result: root
        };
    }
    if (inputSchema.idBlock.isHexOnly) {
        if ((VALUE_HEX_VIEW in inputSchema.idBlock) === false) {
            return {
                verified: false,
                result: { error: "Wrong ASN.1 schema" }
            };
        }
        const schemaView = inputSchema.idBlock.valueHexView;
        const asn1View = inputData.idBlock.valueHexView;
        if (schemaView.length !== asn1View.length) {
            return {
                verified: false,
                result: root
            };
        }
        for (let i = 0; i < schemaView.length; i++) {
            if (schemaView[i] !== asn1View[1]) {
                return {
                    verified: false,
                    result: root
                };
            }
        }
    }
    if (inputSchema.name) {
        inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
        if (inputSchema.name)
            root[inputSchema.name] = inputData;
    }
    if (inputSchema instanceof typeStore.Constructed) {
        let admission = 0;
        let result = {
            verified: false,
            result: {
                error: "Unknown error",
            }
        };
        let maxLength = inputSchema.valueBlock.value.length;
        if (maxLength > 0) {
            if (inputSchema.valueBlock.value[0] instanceof Repeated) {
                maxLength = inputData.valueBlock.value.length;
            }
        }
        if (maxLength === 0) {
            return {
                verified: true,
                result: root
            };
        }
        if ((inputData.valueBlock.value.length === 0) &&
            (inputSchema.valueBlock.value.length !== 0)) {
            let _optional = true;
            for (let i = 0; i < inputSchema.valueBlock.value.length; i++)
                _optional = _optional && (inputSchema.valueBlock.value[i].optional || false);
            if (_optional) {
                return {
                    verified: true,
                    result: root
                };
            }
            if (inputSchema.name) {
                inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                if (inputSchema.name)
                    delete root[inputSchema.name];
            }
            root.error = "Inconsistent object length";
            return {
                verified: false,
                result: root
            };
        }
        for (let i = 0; i < maxLength; i++) {
            if ((i - admission) >= inputData.valueBlock.value.length) {
                if (inputSchema.valueBlock.value[i].optional === false) {
                    const _result = {
                        verified: false,
                        result: root
                    };
                    root.error = "Inconsistent length between ASN.1 data and schema";
                    if (inputSchema.name) {
                        inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                        if (inputSchema.name) {
                            delete root[inputSchema.name];
                            _result.name = inputSchema.name;
                        }
                    }
                    return _result;
                }
            }
            else {
                if (inputSchema.valueBlock.value[0] instanceof Repeated) {
                    result = compareSchema(root, inputData.valueBlock.value[i], inputSchema.valueBlock.value[0].value);
                    if (result.verified === false) {
                        if (inputSchema.valueBlock.value[0].optional)
                            admission++;
                        else {
                            if (inputSchema.name) {
                                inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                                if (inputSchema.name)
                                    delete root[inputSchema.name];
                            }
                            return result;
                        }
                    }
                    if ((NAME in inputSchema.valueBlock.value[0]) && (inputSchema.valueBlock.value[0].name.length > 0)) {
                        let arrayRoot = {};
                        if ((LOCAL in inputSchema.valueBlock.value[0]) && (inputSchema.valueBlock.value[0].local))
                            arrayRoot = inputData;
                        else
                            arrayRoot = root;
                        if (typeof arrayRoot[inputSchema.valueBlock.value[0].name] === "undefined")
                            arrayRoot[inputSchema.valueBlock.value[0].name] = [];
                        arrayRoot[inputSchema.valueBlock.value[0].name].push(inputData.valueBlock.value[i]);
                    }
                }
                else {
                    result = compareSchema(root, inputData.valueBlock.value[i - admission], inputSchema.valueBlock.value[i]);
                    if (result.verified === false) {
                        if (inputSchema.valueBlock.value[i].optional)
                            admission++;
                        else {
                            if (inputSchema.name) {
                                inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                                if (inputSchema.name)
                                    delete root[inputSchema.name];
                            }
                            return result;
                        }
                    }
                }
            }
        }
        if (result.verified === false) {
            const _result = {
                verified: false,
                result: root
            };
            if (inputSchema.name) {
                inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                if (inputSchema.name) {
                    delete root[inputSchema.name];
                    _result.name = inputSchema.name;
                }
            }
            return _result;
        }
        return {
            verified: true,
            result: root
        };
    }
    if (inputSchema.primitiveSchema &&
        (VALUE_HEX_VIEW in inputData.valueBlock)) {
        const asn1 = localFromBER(inputData.valueBlock.valueHexView);
        if (asn1.offset === -1) {
            const _result = {
                verified: false,
                result: asn1.result
            };
            if (inputSchema.name) {
                inputSchema.name = inputSchema.name.replace(/^\s+|\s+$/g, EMPTY_STRING);
                if (inputSchema.name) {
                    delete root[inputSchema.name];
                    _result.name = inputSchema.name;
                }
            }
            return _result;
        }
        return compareSchema(root, asn1.result, inputSchema.primitiveSchema);
    }
    return {
        verified: true,
        result: root
    };
}
function verifySchema(inputBuffer, inputSchema) {
    if ((inputSchema instanceof Object) === false) {
        return {
            verified: false,
            result: { error: "Wrong ASN.1 schema type" }
        };
    }
    const asn1 = localFromBER(BufferSourceConverter.toUint8Array(inputBuffer));
    if (asn1.offset === -1) {
        return {
            verified: false,
            result: asn1.result
        };
    }
    return compareSchema(asn1.result, asn1.result, inputSchema);
}

var asn1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Any: Any,
  BaseBlock: BaseBlock,
  BaseStringBlock: BaseStringBlock,
  BitString: BitString,
  BmpString: BmpString,
  Boolean: Boolean$1,
  CharacterString: CharacterString,
  Choice: Choice,
  Constructed: Constructed,
  DATE: DATE,
  DateTime: DateTime,
  Duration: Duration,
  EndOfContent: EndOfContent,
  Enumerated: Enumerated,
  GeneralString: GeneralString,
  GeneralizedTime: GeneralizedTime,
  GraphicString: GraphicString,
  HexBlock: HexBlock,
  IA5String: IA5String,
  Integer: Integer,
  Null: Null,
  NumericString: NumericString,
  ObjectIdentifier: ObjectIdentifier$1,
  OctetString: OctetString,
  Primitive: Primitive,
  PrintableString: PrintableString,
  RawData: RawData,
  RelativeObjectIdentifier: RelativeObjectIdentifier,
  Repeated: Repeated,
  Sequence: Sequence,
  Set: Set,
  TIME: TIME,
  TeletexString: TeletexString,
  TimeOfDay: TimeOfDay,
  UTCTime: UTCTime,
  UniversalString: UniversalString,
  Utf8String: Utf8String,
  ValueBlock: ValueBlock,
  VideotexString: VideotexString,
  ViewWriter: ViewWriter,
  VisibleString: VisibleString,
  compareSchema: compareSchema,
  fromBER: fromBER,
  verifySchema: verifySchema
});

var AsnTypeTypes;
(function (AsnTypeTypes) {
    AsnTypeTypes[AsnTypeTypes["Sequence"] = 0] = "Sequence";
    AsnTypeTypes[AsnTypeTypes["Set"] = 1] = "Set";
    AsnTypeTypes[AsnTypeTypes["Choice"] = 2] = "Choice";
})(AsnTypeTypes || (AsnTypeTypes = {}));
var AsnPropTypes;
(function (AsnPropTypes) {
    AsnPropTypes[AsnPropTypes["Any"] = 1] = "Any";
    AsnPropTypes[AsnPropTypes["Boolean"] = 2] = "Boolean";
    AsnPropTypes[AsnPropTypes["OctetString"] = 3] = "OctetString";
    AsnPropTypes[AsnPropTypes["BitString"] = 4] = "BitString";
    AsnPropTypes[AsnPropTypes["Integer"] = 5] = "Integer";
    AsnPropTypes[AsnPropTypes["Enumerated"] = 6] = "Enumerated";
    AsnPropTypes[AsnPropTypes["ObjectIdentifier"] = 7] = "ObjectIdentifier";
    AsnPropTypes[AsnPropTypes["Utf8String"] = 8] = "Utf8String";
    AsnPropTypes[AsnPropTypes["BmpString"] = 9] = "BmpString";
    AsnPropTypes[AsnPropTypes["UniversalString"] = 10] = "UniversalString";
    AsnPropTypes[AsnPropTypes["NumericString"] = 11] = "NumericString";
    AsnPropTypes[AsnPropTypes["PrintableString"] = 12] = "PrintableString";
    AsnPropTypes[AsnPropTypes["TeletexString"] = 13] = "TeletexString";
    AsnPropTypes[AsnPropTypes["VideotexString"] = 14] = "VideotexString";
    AsnPropTypes[AsnPropTypes["IA5String"] = 15] = "IA5String";
    AsnPropTypes[AsnPropTypes["GraphicString"] = 16] = "GraphicString";
    AsnPropTypes[AsnPropTypes["VisibleString"] = 17] = "VisibleString";
    AsnPropTypes[AsnPropTypes["GeneralString"] = 18] = "GeneralString";
    AsnPropTypes[AsnPropTypes["CharacterString"] = 19] = "CharacterString";
    AsnPropTypes[AsnPropTypes["UTCTime"] = 20] = "UTCTime";
    AsnPropTypes[AsnPropTypes["GeneralizedTime"] = 21] = "GeneralizedTime";
    AsnPropTypes[AsnPropTypes["DATE"] = 22] = "DATE";
    AsnPropTypes[AsnPropTypes["TimeOfDay"] = 23] = "TimeOfDay";
    AsnPropTypes[AsnPropTypes["DateTime"] = 24] = "DateTime";
    AsnPropTypes[AsnPropTypes["Duration"] = 25] = "Duration";
    AsnPropTypes[AsnPropTypes["TIME"] = 26] = "TIME";
    AsnPropTypes[AsnPropTypes["Null"] = 27] = "Null";
})(AsnPropTypes || (AsnPropTypes = {}));

const AsnAnyConverter = {
    fromASN: (value) => value instanceof Null ? null : value.valueBeforeDecode,
    toASN: (value) => {
        if (value === null) {
            return new Null();
        }
        const schema = fromBER(value);
        if (schema.result.error) {
            throw new Error(schema.result.error);
        }
        return schema.result;
    },
};
const AsnIntegerConverter = {
    fromASN: (value) => value.valueBlock.valueHex.byteLength > 4
        ? value.valueBlock.toString()
        : value.valueBlock.valueDec,
    toASN: (value) => new Integer({ value: value }),
};
const AsnEnumeratedConverter = {
    fromASN: (value) => value.valueBlock.valueDec,
    toASN: (value) => new Enumerated({ value }),
};
const AsnBitStringConverter = {
    fromASN: (value) => value.valueBlock.valueHex,
    toASN: (value) => new BitString({ valueHex: value }),
};
const AsnObjectIdentifierConverter = {
    fromASN: (value) => value.valueBlock.toString(),
    toASN: (value) => new ObjectIdentifier$1({ value }),
};
const AsnBooleanConverter = {
    fromASN: (value) => value.valueBlock.value,
    toASN: (value) => new Boolean$1({ value }),
};
const AsnOctetStringConverter = {
    fromASN: (value) => value.valueBlock.valueHex,
    toASN: (value) => new OctetString({ valueHex: value }),
};
function createStringConverter(Asn1Type) {
    return {
        fromASN: (value) => value.valueBlock.value,
        toASN: (value) => new Asn1Type({ value }),
    };
}
const AsnUtf8StringConverter = createStringConverter(Utf8String);
const AsnBmpStringConverter = createStringConverter(BmpString);
const AsnUniversalStringConverter = createStringConverter(UniversalString);
const AsnNumericStringConverter = createStringConverter(NumericString);
const AsnPrintableStringConverter = createStringConverter(PrintableString);
const AsnTeletexStringConverter = createStringConverter(TeletexString);
const AsnVideotexStringConverter = createStringConverter(VideotexString);
const AsnIA5StringConverter = createStringConverter(IA5String);
const AsnGraphicStringConverter = createStringConverter(GraphicString);
const AsnVisibleStringConverter = createStringConverter(VisibleString);
const AsnGeneralStringConverter = createStringConverter(GeneralString);
const AsnCharacterStringConverter = createStringConverter(CharacterString);
const AsnUTCTimeConverter = {
    fromASN: (value) => value.toDate(),
    toASN: (value) => new UTCTime({ valueDate: value }),
};
const AsnGeneralizedTimeConverter = {
    fromASN: (value) => value.toDate(),
    toASN: (value) => new GeneralizedTime({ valueDate: value }),
};
const AsnNullConverter = {
    fromASN: (value) => null,
    toASN: (value) => {
        return new Null();
    },
};
function defaultConverter(type) {
    switch (type) {
        case AsnPropTypes.Any:
            return AsnAnyConverter;
        case AsnPropTypes.BitString:
            return AsnBitStringConverter;
        case AsnPropTypes.BmpString:
            return AsnBmpStringConverter;
        case AsnPropTypes.Boolean:
            return AsnBooleanConverter;
        case AsnPropTypes.CharacterString:
            return AsnCharacterStringConverter;
        case AsnPropTypes.Enumerated:
            return AsnEnumeratedConverter;
        case AsnPropTypes.GeneralString:
            return AsnGeneralStringConverter;
        case AsnPropTypes.GeneralizedTime:
            return AsnGeneralizedTimeConverter;
        case AsnPropTypes.GraphicString:
            return AsnGraphicStringConverter;
        case AsnPropTypes.IA5String:
            return AsnIA5StringConverter;
        case AsnPropTypes.Integer:
            return AsnIntegerConverter;
        case AsnPropTypes.Null:
            return AsnNullConverter;
        case AsnPropTypes.NumericString:
            return AsnNumericStringConverter;
        case AsnPropTypes.ObjectIdentifier:
            return AsnObjectIdentifierConverter;
        case AsnPropTypes.OctetString:
            return AsnOctetStringConverter;
        case AsnPropTypes.PrintableString:
            return AsnPrintableStringConverter;
        case AsnPropTypes.TeletexString:
            return AsnTeletexStringConverter;
        case AsnPropTypes.UTCTime:
            return AsnUTCTimeConverter;
        case AsnPropTypes.UniversalString:
            return AsnUniversalStringConverter;
        case AsnPropTypes.Utf8String:
            return AsnUtf8StringConverter;
        case AsnPropTypes.VideotexString:
            return AsnVideotexStringConverter;
        case AsnPropTypes.VisibleString:
            return AsnVisibleStringConverter;
        default:
            return null;
    }
}

function isConvertible$1(target) {
    if (target && target.prototype) {
        if (target.prototype.toASN && target.prototype.fromASN) {
            return true;
        }
        else {
            return isConvertible$1(target.prototype);
        }
    }
    else {
        return !!(target && target.toASN && target.fromASN);
    }
}
function isTypeOfArray(target) {
    var _a;
    if (target) {
        const proto = Object.getPrototypeOf(target);
        if (((_a = proto === null || proto === void 0 ? void 0 : proto.prototype) === null || _a === void 0 ? void 0 : _a.constructor) === Array) {
            return true;
        }
        return isTypeOfArray(proto);
    }
    return false;
}
function isArrayEqual(bytes1, bytes2) {
    if (!(bytes1 && bytes2)) {
        return false;
    }
    if (bytes1.byteLength !== bytes2.byteLength) {
        return false;
    }
    const b1 = new Uint8Array(bytes1);
    const b2 = new Uint8Array(bytes2);
    for (let i = 0; i < bytes1.byteLength; i++) {
        if (b1[i] !== b2[i]) {
            return false;
        }
    }
    return true;
}

class AsnSchemaStorage {
    constructor() {
        this.items = new WeakMap();
    }
    has(target) {
        return this.items.has(target);
    }
    get(target) {
        var _a, _b, _c;
        const schema = this.items.get(target);
        if (!schema) {
            throw new Error(`Cannot get schema for '${(_c = (_b = (_a = target === null || target === void 0 ? void 0 : target.prototype) === null || _a === void 0 ? void 0 : _a.constructor) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : target}' target`);
        }
        return schema;
    }
    cache(target) {
        const schema = this.get(target);
        if (!schema.schema) {
            schema.schema = this.create(target, true);
        }
    }
    createDefault(target) {
        const schema = {
            type: AsnTypeTypes.Sequence,
            items: {},
        };
        const parentSchema = this.findParentSchema(target);
        if (parentSchema) {
            Object.assign(schema, parentSchema);
            schema.items = Object.assign({}, schema.items, parentSchema.items);
        }
        return schema;
    }
    create(target, useNames) {
        const schema = this.items.get(target) || this.createDefault(target);
        const asn1Value = [];
        for (const key in schema.items) {
            const item = schema.items[key];
            const name = useNames ? key : "";
            let asn1Item;
            if (typeof (item.type) === "number") {
                const Asn1TypeName = AsnPropTypes[item.type];
                const Asn1Type = asn1[Asn1TypeName];
                if (!Asn1Type) {
                    throw new Error(`Cannot get ASN1 class by name '${Asn1TypeName}'`);
                }
                asn1Item = new Asn1Type({ name });
            }
            else if (isConvertible$1(item.type)) {
                const instance = new item.type();
                asn1Item = instance.toSchema(name);
            }
            else if (item.optional) {
                const itemSchema = this.get(item.type);
                if (itemSchema.type === AsnTypeTypes.Choice) {
                    asn1Item = new Any({ name });
                }
                else {
                    asn1Item = this.create(item.type, false);
                    asn1Item.name = name;
                }
            }
            else {
                asn1Item = new Any({ name });
            }
            const optional = !!item.optional || item.defaultValue !== undefined;
            if (item.repeated) {
                asn1Item.name = "";
                const Container = item.repeated === "set"
                    ? Set
                    : Sequence;
                asn1Item = new Container({
                    name: "",
                    value: [
                        new Repeated({
                            name,
                            value: asn1Item,
                        }),
                    ],
                });
            }
            if (item.context !== null && item.context !== undefined) {
                if (item.implicit) {
                    if (typeof item.type === "number" || isConvertible$1(item.type)) {
                        const Container = item.repeated
                            ? Constructed
                            : Primitive;
                        asn1Value.push(new Container({
                            name,
                            optional,
                            idBlock: {
                                tagClass: 3,
                                tagNumber: item.context,
                            },
                        }));
                    }
                    else {
                        this.cache(item.type);
                        const isRepeated = !!item.repeated;
                        let value = !isRepeated
                            ? this.get(item.type).schema
                            : asn1Item;
                        value = value.valueBlock ? value.valueBlock.value : value.value;
                        asn1Value.push(new Constructed({
                            name: !isRepeated ? name : "",
                            optional,
                            idBlock: {
                                tagClass: 3,
                                tagNumber: item.context,
                            },
                            value,
                        }));
                    }
                }
                else {
                    asn1Value.push(new Constructed({
                        optional,
                        idBlock: {
                            tagClass: 3,
                            tagNumber: item.context,
                        },
                        value: [asn1Item],
                    }));
                }
            }
            else {
                asn1Item.optional = optional;
                asn1Value.push(asn1Item);
            }
        }
        switch (schema.type) {
            case AsnTypeTypes.Sequence:
                return new Sequence({ value: asn1Value, name: "" });
            case AsnTypeTypes.Set:
                return new Set({ value: asn1Value, name: "" });
            case AsnTypeTypes.Choice:
                return new Choice({ value: asn1Value, name: "" });
            default:
                throw new Error(`Unsupported ASN1 type in use`);
        }
    }
    set(target, schema) {
        this.items.set(target, schema);
        return this;
    }
    findParentSchema(target) {
        const parent = target.__proto__;
        if (parent) {
            const schema = this.items.get(parent);
            return schema || this.findParentSchema(parent);
        }
        return null;
    }
}

const schemaStorage$1 = new AsnSchemaStorage();

const AsnType = (options) => (target) => {
    let schema;
    if (!schemaStorage$1.has(target)) {
        schema = schemaStorage$1.createDefault(target);
        schemaStorage$1.set(target, schema);
    }
    else {
        schema = schemaStorage$1.get(target);
    }
    Object.assign(schema, options);
};
const AsnProp = (options) => (target, propertyKey) => {
    let schema;
    if (!schemaStorage$1.has(target.constructor)) {
        schema = schemaStorage$1.createDefault(target.constructor);
        schemaStorage$1.set(target.constructor, schema);
    }
    else {
        schema = schemaStorage$1.get(target.constructor);
    }
    const copyOptions = Object.assign({}, options);
    if (typeof copyOptions.type === "number" && !copyOptions.converter) {
        const defaultConverter$1 = defaultConverter(options.type);
        if (!defaultConverter$1) {
            throw new Error(`Cannot get default converter for property '${propertyKey}' of ${target.constructor.name}`);
        }
        copyOptions.converter = defaultConverter$1;
    }
    schema.items[propertyKey] = copyOptions;
};

class AsnSchemaValidationError extends Error {
    constructor() {
        super(...arguments);
        this.schemas = [];
    }
}

class AsnParser {
    static parse(data, target) {
        let buf;
        if (data instanceof ArrayBuffer) {
            buf = data;
        }
        else if (typeof Buffer !== "undefined" && isBuffer(data)) {
            buf = new Uint8Array(data).buffer;
        }
        else if (ArrayBuffer.isView(data) || data.buffer instanceof ArrayBuffer) {
            buf = data.buffer;
        }
        else {
            throw new TypeError("Wrong type of 'data' argument");
        }
        const asn1Parsed = fromBER(buf);
        if (asn1Parsed.result.error) {
            throw new Error(asn1Parsed.result.error);
        }
        const res = this.fromASN(asn1Parsed.result, target);
        return res;
    }
    static fromASN(asn1Schema, target) {
        var _a;
        try {
            if (isConvertible$1(target)) {
                const value = new target();
                return value.fromASN(asn1Schema);
            }
            const schema = schemaStorage$1.get(target);
            schemaStorage$1.cache(target);
            let targetSchema = schema.schema;
            if (asn1Schema.constructor === Constructed && schema.type !== AsnTypeTypes.Choice) {
                targetSchema = new Constructed({
                    idBlock: {
                        tagClass: 3,
                        tagNumber: asn1Schema.idBlock.tagNumber,
                    },
                    value: schema.schema.valueBlock.value,
                });
                for (const key in schema.items) {
                    delete asn1Schema[key];
                }
            }
            const asn1ComparedSchema = compareSchema(asn1Schema, asn1Schema, targetSchema);
            if (!asn1ComparedSchema.verified) {
                throw new AsnSchemaValidationError(`Data does not match to ${target.name} ASN1 schema. ${asn1ComparedSchema.result.error}`);
            }
            const res = new target();
            if (isTypeOfArray(target)) {
                if (typeof schema.itemType === "number") {
                    const converter = defaultConverter(schema.itemType);
                    if (!converter) {
                        throw new Error(`Cannot get default converter for array item of ${target.name} ASN1 schema`);
                    }
                    return target.from(asn1Schema.valueBlock.value, (element) => converter.fromASN(element));
                }
                else {
                    return target.from(asn1Schema.valueBlock.value, (element) => this.fromASN(element, schema.itemType));
                }
            }
            for (const key in schema.items) {
                if (!asn1Schema[key]) {
                    continue;
                }
                const schemaItem = schema.items[key];
                if (typeof (schemaItem.type) === "number" || isConvertible$1(schemaItem.type)) {
                    const converter = (_a = schemaItem.converter) !== null && _a !== void 0 ? _a : (isConvertible$1(schemaItem.type)
                        ? new schemaItem.type()
                        : null);
                    if (!converter) {
                        throw new Error("Converter is empty");
                    }
                    if (schemaItem.repeated) {
                        if (schemaItem.implicit) {
                            const Container = schemaItem.repeated === "sequence"
                                ? Sequence
                                : Set;
                            const newItem = new Container();
                            newItem.valueBlock = asn1Schema[key].valueBlock;
                            const value = fromBER(newItem.toBER(false)).result.valueBlock.value;
                            res[key] = Array.from(value, (element) => converter.fromASN(element));
                        }
                        else {
                            res[key] = Array.from(asn1Schema[key], (element) => converter.fromASN(element));
                        }
                    }
                    else {
                        let value = asn1Schema[key];
                        if (schemaItem.implicit) {
                            let newItem;
                            if (isConvertible$1(schemaItem.type)) {
                                newItem = new schemaItem.type().toSchema("");
                            }
                            else {
                                const Asn1TypeName = AsnPropTypes[schemaItem.type];
                                const Asn1Type = asn1[Asn1TypeName];
                                if (!Asn1Type) {
                                    throw new Error(`Cannot get '${Asn1TypeName}' class from asn1js module`);
                                }
                                newItem = new Asn1Type();
                            }
                            newItem.valueBlock = value.valueBlock;
                            value = fromBER(newItem.toBER(false)).result;
                        }
                        res[key] = converter.fromASN(value);
                    }
                }
                else {
                    if (schemaItem.repeated) {
                        res[key] = Array.from(asn1Schema[key], (element) => this.fromASN(element, schemaItem.type));
                    }
                    else {
                        res[key] = this.fromASN(asn1Schema[key], schemaItem.type);
                    }
                }
            }
            return res;
        }
        catch (error) {
            if (error instanceof AsnSchemaValidationError) {
                error.schemas.push(target.name);
            }
            throw error;
        }
    }
}

class AsnSerializer {
    static serialize(obj) {
        if (obj instanceof BaseBlock) {
            return obj.toBER(false);
        }
        return this.toASN(obj).toBER(false);
    }
    static toASN(obj) {
        if (obj && isConvertible$1(obj.constructor)) {
            return obj.toASN();
        }
        const target = obj.constructor;
        const schema = schemaStorage$1.get(target);
        schemaStorage$1.cache(target);
        let asn1Value = [];
        if (schema.itemType) {
            if (typeof schema.itemType === "number") {
                const converter = defaultConverter(schema.itemType);
                if (!converter) {
                    throw new Error(`Cannot get default converter for array item of ${target.name} ASN1 schema`);
                }
                asn1Value = obj.map((o) => converter.toASN(o));
            }
            else {
                asn1Value = obj.map((o) => this.toAsnItem({ type: schema.itemType }, "[]", target, o));
            }
        }
        else {
            for (const key in schema.items) {
                const schemaItem = schema.items[key];
                const objProp = obj[key];
                if (objProp === undefined
                    || schemaItem.defaultValue === objProp
                    || (typeof schemaItem.defaultValue === "object" && typeof objProp === "object"
                        && isArrayEqual(this.serialize(schemaItem.defaultValue), this.serialize(objProp)))) {
                    continue;
                }
                let asn1Item = AsnSerializer.toAsnItem(schemaItem, key, target, objProp);
                if (typeof schemaItem.context === "number") {
                    if (schemaItem.implicit) {
                        if (!schemaItem.repeated
                            && (typeof schemaItem.type === "number" || isConvertible$1(schemaItem.type))) {
                            const value = {};
                            value.valueHex = asn1Item instanceof Null ? asn1Item.valueBeforeDecode : asn1Item.valueBlock.toBER();
                            asn1Value.push(new Primitive({
                                optional: schemaItem.optional,
                                idBlock: {
                                    tagClass: 3,
                                    tagNumber: schemaItem.context,
                                },
                                ...value,
                            }));
                        }
                        else {
                            asn1Value.push(new Constructed({
                                optional: schemaItem.optional,
                                idBlock: {
                                    tagClass: 3,
                                    tagNumber: schemaItem.context,
                                },
                                value: asn1Item.valueBlock.value,
                            }));
                        }
                    }
                    else {
                        asn1Value.push(new Constructed({
                            optional: schemaItem.optional,
                            idBlock: {
                                tagClass: 3,
                                tagNumber: schemaItem.context,
                            },
                            value: [asn1Item],
                        }));
                    }
                }
                else if (schemaItem.repeated) {
                    asn1Value = asn1Value.concat(asn1Item);
                }
                else {
                    asn1Value.push(asn1Item);
                }
            }
        }
        let asnSchema;
        switch (schema.type) {
            case AsnTypeTypes.Sequence:
                asnSchema = new Sequence({ value: asn1Value });
                break;
            case AsnTypeTypes.Set:
                asnSchema = new Set({ value: asn1Value });
                break;
            case AsnTypeTypes.Choice:
                if (!asn1Value[0]) {
                    throw new Error(`Schema '${target.name}' has wrong data. Choice cannot be empty.`);
                }
                asnSchema = asn1Value[0];
                break;
        }
        return asnSchema;
    }
    static toAsnItem(schemaItem, key, target, objProp) {
        let asn1Item;
        if (typeof (schemaItem.type) === "number") {
            const converter = schemaItem.converter;
            if (!converter) {
                throw new Error(`Property '${key}' doesn't have converter for type ${AsnPropTypes[schemaItem.type]} in schema '${target.name}'`);
            }
            if (schemaItem.repeated) {
                const items = Array.from(objProp, (element) => converter.toASN(element));
                const Container = schemaItem.repeated === "sequence"
                    ? Sequence
                    : Set;
                asn1Item = new Container({
                    value: items,
                });
            }
            else {
                asn1Item = converter.toASN(objProp);
            }
        }
        else {
            if (schemaItem.repeated) {
                const items = Array.from(objProp, (element) => this.toASN(element));
                const Container = schemaItem.repeated === "sequence"
                    ? Sequence
                    : Set;
                asn1Item = new Container({
                    value: items,
                });
            }
            else {
                asn1Item = this.toASN(objProp);
            }
        }
        return asn1Item;
    }
}

class AsnConvert {
    static serialize(obj) {
        return AsnSerializer.serialize(obj);
    }
    static parse(data, target) {
        return AsnParser.parse(data, target);
    }
    static toString(data) {
        const buf = BufferSourceConverter.isBufferSource(data)
            ? BufferSourceConverter.toArrayBuffer(data)
            : AsnConvert.serialize(data);
        const asn = fromBER(buf);
        if (asn.offset === -1) {
            throw new Error(`Cannot decode ASN.1 data. ${asn.result.error}`);
        }
        return asn.result.toString();
    }
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __decorate$1(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

/**
 * Copyright (c) 2020, Peculiar Ventures, All rights reserved.
 */

class JsonError extends Error {
    constructor(message, innerError) {
        super(innerError
            ? `${message}. See the inner exception for more details.`
            : message);
        this.message = message;
        this.innerError = innerError;
    }
}

class TransformError extends JsonError {
    constructor(schema, message, innerError) {
        super(message, innerError);
        this.schema = schema;
    }
}

class ParserError extends TransformError {
    constructor(schema, message, innerError) {
        super(schema, `JSON doesn't match to '${schema.target.name}' schema. ${message}`, innerError);
    }
}

class ValidationError extends JsonError {
}

class SerializerError extends JsonError {
    constructor(schemaName, message, innerError) {
        super(`Cannot serialize by '${schemaName}' schema. ${message}`, innerError);
        this.schemaName = schemaName;
    }
}

class KeyError extends ParserError {
    constructor(schema, keys, errors = {}) {
        super(schema, "Some keys doesn't match to schema");
        this.keys = keys;
        this.errors = errors;
    }
}

var JsonPropTypes;
(function (JsonPropTypes) {
    JsonPropTypes[JsonPropTypes["Any"] = 0] = "Any";
    JsonPropTypes[JsonPropTypes["Boolean"] = 1] = "Boolean";
    JsonPropTypes[JsonPropTypes["Number"] = 2] = "Number";
    JsonPropTypes[JsonPropTypes["String"] = 3] = "String";
})(JsonPropTypes || (JsonPropTypes = {}));

function checkType(value, type) {
    switch (type) {
        case JsonPropTypes.Boolean:
            return typeof value === "boolean";
        case JsonPropTypes.Number:
            return typeof value === "number";
        case JsonPropTypes.String:
            return typeof value === "string";
    }
    return true;
}
function throwIfTypeIsWrong(value, type) {
    if (!checkType(value, type)) {
        throw new TypeError(`Value must be ${JsonPropTypes[type]}`);
    }
}
function isConvertible(target) {
    if (target && target.prototype) {
        if (target.prototype.toJSON && target.prototype.fromJSON) {
            return true;
        }
        else {
            return isConvertible(target.prototype);
        }
    }
    else {
        return !!(target && target.toJSON && target.fromJSON);
    }
}

class JsonSchemaStorage {
    constructor() {
        this.items = new Map();
    }
    has(target) {
        return this.items.has(target) || !!this.findParentSchema(target);
    }
    get(target) {
        const schema = this.items.get(target) || this.findParentSchema(target);
        if (!schema) {
            throw new Error("Cannot get schema for current target");
        }
        return schema;
    }
    create(target) {
        const schema = { names: {} };
        const parentSchema = this.findParentSchema(target);
        if (parentSchema) {
            Object.assign(schema, parentSchema);
            schema.names = {};
            for (const name in parentSchema.names) {
                schema.names[name] = Object.assign({}, parentSchema.names[name]);
            }
        }
        schema.target = target;
        return schema;
    }
    set(target, schema) {
        this.items.set(target, schema);
        return this;
    }
    findParentSchema(target) {
        const parent = target.__proto__;
        if (parent) {
            const schema = this.items.get(parent);
            return schema || this.findParentSchema(parent);
        }
        return null;
    }
}

const DEFAULT_SCHEMA = "default";
const schemaStorage = new JsonSchemaStorage();

class PatternValidation {
    constructor(pattern) {
        this.pattern = new RegExp(pattern);
    }
    validate(value) {
        const pattern = new RegExp(this.pattern.source, this.pattern.flags);
        if (typeof value !== "string") {
            throw new ValidationError("Incoming value must be string");
        }
        if (!pattern.exec(value)) {
            throw new ValidationError(`Value doesn't match to pattern '${pattern.toString()}'`);
        }
    }
}

class InclusiveValidation {
    constructor(min = Number.MIN_VALUE, max = Number.MAX_VALUE) {
        this.min = min;
        this.max = max;
    }
    validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.Number);
        if (!(this.min <= value && value <= this.max)) {
            const min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
            const max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
            throw new ValidationError(`Value doesn't match to diapason [${min},${max}]`);
        }
    }
}

class ExclusiveValidation {
    constructor(min = Number.MIN_VALUE, max = Number.MAX_VALUE) {
        this.min = min;
        this.max = max;
    }
    validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.Number);
        if (!(this.min < value && value < this.max)) {
            const min = this.min === Number.MIN_VALUE ? "MIN" : this.min;
            const max = this.max === Number.MAX_VALUE ? "MAX" : this.max;
            throw new ValidationError(`Value doesn't match to diapason (${min},${max})`);
        }
    }
}

class LengthValidation {
    constructor(length, minLength, maxLength) {
        this.length = length;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }
    validate(value) {
        if (this.length !== undefined) {
            if (value.length !== this.length) {
                throw new ValidationError(`Value length must be exactly ${this.length}.`);
            }
            return;
        }
        if (this.minLength !== undefined) {
            if (value.length < this.minLength) {
                throw new ValidationError(`Value length must be more than ${this.minLength}.`);
            }
        }
        if (this.maxLength !== undefined) {
            if (value.length > this.maxLength) {
                throw new ValidationError(`Value length must be less than ${this.maxLength}.`);
            }
        }
    }
}

class EnumerationValidation {
    constructor(enumeration) {
        this.enumeration = enumeration;
    }
    validate(value) {
        throwIfTypeIsWrong(value, JsonPropTypes.String);
        if (!this.enumeration.includes(value)) {
            throw new ValidationError(`Value must be one of ${this.enumeration.map((v) => `'${v}'`).join(", ")}`);
        }
    }
}

class JsonTransform {
    static checkValues(data, schemaItem) {
        const values = Array.isArray(data) ? data : [data];
        for (const value of values) {
            for (const validation of schemaItem.validations) {
                if (validation instanceof LengthValidation && schemaItem.repeated) {
                    validation.validate(data);
                }
                else {
                    validation.validate(value);
                }
            }
        }
    }
    static checkTypes(value, schemaItem) {
        if (schemaItem.repeated && !Array.isArray(value)) {
            throw new TypeError("Value must be Array");
        }
        if (typeof schemaItem.type === "number") {
            const values = Array.isArray(value) ? value : [value];
            for (const v of values) {
                throwIfTypeIsWrong(v, schemaItem.type);
            }
        }
    }
    static getSchemaByName(schema, name = DEFAULT_SCHEMA) {
        return { ...schema.names[DEFAULT_SCHEMA], ...schema.names[name] };
    }
}

class JsonSerializer extends JsonTransform {
    static serialize(obj, options, replacer, space) {
        const json = this.toJSON(obj, options);
        return JSON.stringify(json, replacer, space);
    }
    static toJSON(obj, options = {}) {
        let res;
        let targetSchema = options.targetSchema;
        const schemaName = options.schemaName || DEFAULT_SCHEMA;
        if (isConvertible(obj)) {
            return obj.toJSON();
        }
        if (Array.isArray(obj)) {
            res = [];
            for (const item of obj) {
                res.push(this.toJSON(item, options));
            }
        }
        else if (typeof obj === "object") {
            if (targetSchema && !schemaStorage.has(targetSchema)) {
                throw new JsonError("Cannot get schema for `targetSchema` param");
            }
            targetSchema = (targetSchema || obj.constructor);
            if (schemaStorage.has(targetSchema)) {
                const schema = schemaStorage.get(targetSchema);
                res = {};
                const namedSchema = this.getSchemaByName(schema, schemaName);
                for (const key in namedSchema) {
                    try {
                        const item = namedSchema[key];
                        const objItem = obj[key];
                        let value;
                        if ((item.optional && objItem === undefined)
                            || (item.defaultValue !== undefined && objItem === item.defaultValue)) {
                            continue;
                        }
                        if (!item.optional && objItem === undefined) {
                            throw new SerializerError(targetSchema.name, `Property '${key}' is required.`);
                        }
                        if (typeof item.type === "number") {
                            if (item.converter) {
                                if (item.repeated) {
                                    value = objItem.map((el) => item.converter.toJSON(el, obj));
                                }
                                else {
                                    value = item.converter.toJSON(objItem, obj);
                                }
                            }
                            else {
                                value = objItem;
                            }
                        }
                        else {
                            if (item.repeated) {
                                value = objItem.map((el) => this.toJSON(el, { schemaName }));
                            }
                            else {
                                value = this.toJSON(objItem, { schemaName });
                            }
                        }
                        this.checkTypes(value, item);
                        this.checkValues(value, item);
                        res[item.name || key] = value;
                    }
                    catch (e) {
                        if (e instanceof SerializerError) {
                            throw e;
                        }
                        else {
                            throw new SerializerError(schema.target.name, `Property '${key}' is wrong. ${e.message}`, e);
                        }
                    }
                }
            }
            else {
                res = {};
                for (const key in obj) {
                    res[key] = this.toJSON(obj[key], { schemaName });
                }
            }
        }
        else {
            res = obj;
        }
        return res;
    }
}

class JsonParser extends JsonTransform {
    static parse(data, options) {
        const obj = JSON.parse(data);
        return this.fromJSON(obj, options);
    }
    static fromJSON(target, options) {
        const targetSchema = options.targetSchema;
        const schemaName = options.schemaName || DEFAULT_SCHEMA;
        const obj = new targetSchema();
        if (isConvertible(obj)) {
            return obj.fromJSON(target);
        }
        const schema = schemaStorage.get(targetSchema);
        const namedSchema = this.getSchemaByName(schema, schemaName);
        const keyErrors = {};
        if (options.strictProperty && !Array.isArray(target)) {
            JsonParser.checkStrictProperty(target, namedSchema, schema);
        }
        for (const key in namedSchema) {
            try {
                const item = namedSchema[key];
                const name = item.name || key;
                const value = target[name];
                if (value === undefined && (item.optional || item.defaultValue !== undefined)) {
                    continue;
                }
                if (!item.optional && value === undefined) {
                    throw new ParserError(schema, `Property '${name}' is required.`);
                }
                this.checkTypes(value, item);
                this.checkValues(value, item);
                if (typeof (item.type) === "number") {
                    if (item.converter) {
                        if (item.repeated) {
                            obj[key] = value.map((el) => item.converter.fromJSON(el, obj));
                        }
                        else {
                            obj[key] = item.converter.fromJSON(value, obj);
                        }
                    }
                    else {
                        obj[key] = value;
                    }
                }
                else {
                    const newOptions = {
                        ...options,
                        targetSchema: item.type,
                        schemaName,
                    };
                    if (item.repeated) {
                        obj[key] = value.map((el) => this.fromJSON(el, newOptions));
                    }
                    else {
                        obj[key] = this.fromJSON(value, newOptions);
                    }
                }
            }
            catch (e) {
                if (!(e instanceof ParserError)) {
                    e = new ParserError(schema, `Property '${key}' is wrong. ${e.message}`, e);
                }
                if (options.strictAllKeys) {
                    keyErrors[key] = e;
                }
                else {
                    throw e;
                }
            }
        }
        const keys = Object.keys(keyErrors);
        if (keys.length) {
            throw new KeyError(schema, keys, keyErrors);
        }
        return obj;
    }
    static checkStrictProperty(target, namedSchema, schema) {
        const jsonProps = Object.keys(target);
        const schemaProps = Object.keys(namedSchema);
        const keys = [];
        for (const key of jsonProps) {
            if (schemaProps.indexOf(key) === -1) {
                keys.push(key);
            }
        }
        if (keys.length) {
            throw new KeyError(schema, keys);
        }
    }
}

function getValidations(item) {
    const validations = [];
    if (item.pattern) {
        validations.push(new PatternValidation(item.pattern));
    }
    if (item.type === JsonPropTypes.Number || item.type === JsonPropTypes.Any) {
        if (item.minInclusive !== undefined || item.maxInclusive !== undefined) {
            validations.push(new InclusiveValidation(item.minInclusive, item.maxInclusive));
        }
        if (item.minExclusive !== undefined || item.maxExclusive !== undefined) {
            validations.push(new ExclusiveValidation(item.minExclusive, item.maxExclusive));
        }
        if (item.enumeration !== undefined) {
            validations.push(new EnumerationValidation(item.enumeration));
        }
    }
    if (item.type === JsonPropTypes.String || item.repeated || item.type === JsonPropTypes.Any) {
        if (item.length !== undefined || item.minLength !== undefined || item.maxLength !== undefined) {
            validations.push(new LengthValidation(item.length, item.minLength, item.maxLength));
        }
    }
    return validations;
}
const JsonProp = (options = {}) => (target, propertyKey) => {
    const errorMessage = `Cannot set type for ${propertyKey} property of ${target.constructor.name} schema`;
    let schema;
    if (!schemaStorage.has(target.constructor)) {
        schema = schemaStorage.create(target.constructor);
        schemaStorage.set(target.constructor, schema);
    }
    else {
        schema = schemaStorage.get(target.constructor);
        if (schema.target !== target.constructor) {
            schema = schemaStorage.create(target.constructor);
            schemaStorage.set(target.constructor, schema);
        }
    }
    const defaultSchema = {
        type: JsonPropTypes.Any,
        validations: [],
    };
    const copyOptions = Object.assign(defaultSchema, options);
    copyOptions.validations = getValidations(copyOptions);
    if (typeof copyOptions.type !== "number") {
        if (!schemaStorage.has(copyOptions.type) && !isConvertible(copyOptions.type)) {
            throw new Error(`${errorMessage}. Assigning type doesn't have schema.`);
        }
    }
    let schemaNames;
    if (Array.isArray(options.schema)) {
        schemaNames = options.schema;
    }
    else {
        schemaNames = [options.schema || DEFAULT_SCHEMA];
    }
    for (const schemaName of schemaNames) {
        if (!schema.names[schemaName]) {
            schema.names[schemaName] = {};
        }
        const namedSchema = schema.names[schemaName];
        namedSchema[propertyKey] = copyOptions;
    }
};

/*!
 Copyright (c) Peculiar Ventures, LLC
*/

class CryptoError extends Error {
}

class AlgorithmError extends CryptoError {
}

class UnsupportedOperationError extends CryptoError {
    constructor(methodName) {
        super(`Unsupported operation: ${methodName ? `${methodName}` : ""}`);
    }
}

class OperationError extends CryptoError {
}

class RequiredPropertyError extends CryptoError {
    constructor(propName) {
        super(`${propName}: Missing required property`);
    }
}

function isJWK(data) {
    return typeof data === "object" && "kty" in data;
}

class ProviderCrypto {
    async digest(...args) {
        this.checkDigest.apply(this, args);
        return this.onDigest.apply(this, args);
    }
    checkDigest(algorithm, data) {
        this.checkAlgorithmName(algorithm);
    }
    async onDigest(algorithm, data) {
        throw new UnsupportedOperationError("digest");
    }
    async generateKey(...args) {
        this.checkGenerateKey.apply(this, args);
        return this.onGenerateKey.apply(this, args);
    }
    checkGenerateKey(algorithm, extractable, keyUsages, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkGenerateKeyParams(algorithm);
        if (!(keyUsages && keyUsages.length)) {
            throw new TypeError(`Usages cannot be empty when creating a key.`);
        }
        let allowedUsages;
        if (Array.isArray(this.usages)) {
            allowedUsages = this.usages;
        }
        else {
            allowedUsages = this.usages.privateKey.concat(this.usages.publicKey);
        }
        this.checkKeyUsages(keyUsages, allowedUsages);
    }
    checkGenerateKeyParams(algorithm) {
    }
    async onGenerateKey(algorithm, extractable, keyUsages, ...args) {
        throw new UnsupportedOperationError("generateKey");
    }
    async sign(...args) {
        this.checkSign.apply(this, args);
        return this.onSign.apply(this, args);
    }
    checkSign(algorithm, key, data, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, "sign");
    }
    async onSign(algorithm, key, data, ...args) {
        throw new UnsupportedOperationError("sign");
    }
    async verify(...args) {
        this.checkVerify.apply(this, args);
        return this.onVerify.apply(this, args);
    }
    checkVerify(algorithm, key, signature, data, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, "verify");
    }
    async onVerify(algorithm, key, signature, data, ...args) {
        throw new UnsupportedOperationError("verify");
    }
    async encrypt(...args) {
        this.checkEncrypt.apply(this, args);
        return this.onEncrypt.apply(this, args);
    }
    checkEncrypt(algorithm, key, data, options = {}, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, options.keyUsage ? "encrypt" : void 0);
    }
    async onEncrypt(algorithm, key, data, ...args) {
        throw new UnsupportedOperationError("encrypt");
    }
    async decrypt(...args) {
        this.checkDecrypt.apply(this, args);
        return this.onDecrypt.apply(this, args);
    }
    checkDecrypt(algorithm, key, data, options = {}, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(key, options.keyUsage ? "decrypt" : void 0);
    }
    async onDecrypt(algorithm, key, data, ...args) {
        throw new UnsupportedOperationError("decrypt");
    }
    async deriveBits(...args) {
        this.checkDeriveBits.apply(this, args);
        return this.onDeriveBits.apply(this, args);
    }
    checkDeriveBits(algorithm, baseKey, length, options = {}, ...args) {
        this.checkAlgorithmName(algorithm);
        this.checkAlgorithmParams(algorithm);
        this.checkCryptoKey(baseKey, options.keyUsage ? "deriveBits" : void 0);
        if (length % 8 !== 0) {
            throw new OperationError("length: Is not multiple of 8");
        }
    }
    async onDeriveBits(algorithm, baseKey, length, ...args) {
        throw new UnsupportedOperationError("deriveBits");
    }
    async exportKey(...args) {
        this.checkExportKey.apply(this, args);
        return this.onExportKey.apply(this, args);
    }
    checkExportKey(format, key, ...args) {
        this.checkKeyFormat(format);
        this.checkCryptoKey(key);
        if (!key.extractable) {
            throw new CryptoError("key: Is not extractable");
        }
    }
    async onExportKey(format, key, ...args) {
        throw new UnsupportedOperationError("exportKey");
    }
    async importKey(...args) {
        this.checkImportKey.apply(this, args);
        return this.onImportKey.apply(this, args);
    }
    checkImportKey(format, keyData, algorithm, extractable, keyUsages, ...args) {
        this.checkKeyFormat(format);
        this.checkKeyData(format, keyData);
        this.checkAlgorithmName(algorithm);
        this.checkImportParams(algorithm);
        if (Array.isArray(this.usages)) {
            this.checkKeyUsages(keyUsages, this.usages);
        }
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages, ...args) {
        throw new UnsupportedOperationError("importKey");
    }
    checkAlgorithmName(algorithm) {
        if (algorithm.name.toLowerCase() !== this.name.toLowerCase()) {
            throw new AlgorithmError("Unrecognized name");
        }
    }
    checkAlgorithmParams(algorithm) {
    }
    checkDerivedKeyParams(algorithm) {
    }
    checkKeyUsages(usages, allowed) {
        for (const usage of usages) {
            if (allowed.indexOf(usage) === -1) {
                throw new TypeError("Cannot create a key using the specified key usages");
            }
        }
    }
    checkCryptoKey(key, keyUsage) {
        this.checkAlgorithmName(key.algorithm);
        if (keyUsage && key.usages.indexOf(keyUsage) === -1) {
            throw new CryptoError(`key does not match that of operation`);
        }
    }
    checkRequiredProperty(data, propName) {
        if (!(propName in data)) {
            throw new RequiredPropertyError(propName);
        }
    }
    checkHashAlgorithm(algorithm, hashAlgorithms) {
        for (const item of hashAlgorithms) {
            if (item.toLowerCase() === algorithm.name.toLowerCase()) {
                return;
            }
        }
        throw new OperationError(`hash: Must be one of ${hashAlgorithms.join(", ")}`);
    }
    checkImportParams(algorithm) {
    }
    checkKeyFormat(format) {
        switch (format) {
            case "raw":
            case "pkcs8":
            case "spki":
            case "jwk":
                break;
            default:
                throw new TypeError("format: Is invalid value. Must be 'jwk', 'raw', 'spki', or 'pkcs8'");
        }
    }
    checkKeyData(format, keyData) {
        if (!keyData) {
            throw new TypeError("keyData: Cannot be empty on empty on key importing");
        }
        if (format === "jwk") {
            if (!isJWK(keyData)) {
                throw new TypeError("keyData: Is not JsonWebToken");
            }
        }
        else if (!BufferSourceConverter.isBufferSource(keyData)) {
            throw new TypeError("keyData: Is not ArrayBufferView or ArrayBuffer");
        }
    }
    prepareData(data) {
        return BufferSourceConverter.toArrayBuffer(data);
    }
}

class AesProvider extends ProviderCrypto {
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
            throw new TypeError("length: Is not of type Number");
        }
        switch (algorithm.length) {
            case 128:
            case 192:
            case 256:
                break;
            default:
                throw new TypeError("length: Must be 128, 192, or 256");
        }
    }
    checkDerivedKeyParams(algorithm) {
        this.checkGenerateKeyParams(algorithm);
    }
}

class AesCbcProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-CBC";
        this.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "iv");
        if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
            throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.iv.byteLength !== 16) {
            throw new TypeError("iv: Must have length 16 bytes");
        }
    }
}

class AesCmacProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-CMAC";
        this.usages = ["sign", "verify"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
            throw new TypeError("length: Is not a Number");
        }
        if (algorithm.length < 1) {
            throw new OperationError("length: Must be more than 0");
        }
    }
}

class AesCtrProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-CTR";
        this.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "counter");
        if (!(algorithm.counter instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.counter))) {
            throw new TypeError("counter: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.counter.byteLength !== 16) {
            throw new TypeError("iv: Must have length 16 bytes");
        }
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
            throw new TypeError("length: Is not a Number");
        }
        if (algorithm.length < 1) {
            throw new OperationError("length: Must be more than 0");
        }
    }
}

class AesEcbProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-ECB";
        this.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
    }
}

class AesGcmProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-GCM";
        this.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "iv");
        if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
            throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        if (algorithm.iv.byteLength < 1) {
            throw new OperationError("iv: Must have length more than 0 and less than 2^64 - 1");
        }
        if (!("tagLength" in algorithm)) {
            algorithm.tagLength = 128;
        }
        switch (algorithm.tagLength) {
            case 32:
            case 64:
            case 96:
            case 104:
            case 112:
            case 120:
            case 128:
                break;
            default:
                throw new OperationError("tagLength: Must be one of 32, 64, 96, 104, 112, 120 or 128");
        }
    }
}

class AesKwProvider$1 extends AesProvider {
    constructor() {
        super(...arguments);
        this.name = "AES-KW";
        this.usages = ["wrapKey", "unwrapKey"];
    }
}

class DesProvider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.usages = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];
    }
    checkAlgorithmParams(algorithm) {
        if (this.ivSize) {
            this.checkRequiredProperty(algorithm, "iv");
            if (!(algorithm.iv instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.iv))) {
                throw new TypeError("iv: Is not of type '(ArrayBuffer or ArrayBufferView)'");
            }
            if (algorithm.iv.byteLength !== this.ivSize) {
                throw new TypeError(`iv: Must have length ${this.ivSize} bytes`);
            }
        }
    }
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "length");
        if (typeof algorithm.length !== "number") {
            throw new TypeError("length: Is not of type Number");
        }
        if (algorithm.length !== this.keySizeBits) {
            throw new OperationError(`algorithm.length: Must be ${this.keySizeBits}`);
        }
    }
    checkDerivedKeyParams(algorithm) {
        this.checkGenerateKeyParams(algorithm);
    }
}

class RsaProvider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
    }
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        this.checkRequiredProperty(algorithm, "publicExponent");
        if (!(algorithm.publicExponent && algorithm.publicExponent instanceof Uint8Array)) {
            throw new TypeError("publicExponent: Missing or not a Uint8Array");
        }
        const publicExponent = Convert.ToBase64(algorithm.publicExponent);
        if (!(publicExponent === "Aw==" || publicExponent === "AQAB")) {
            throw new TypeError("publicExponent: Must be [3] or [1,0,1]");
        }
        this.checkRequiredProperty(algorithm, "modulusLength");
        if (algorithm.modulusLength % 8
            || algorithm.modulusLength < 256
            || algorithm.modulusLength > 16384) {
            throw new TypeError("The modulus length must be a multiple of 8 bits and >= 256 and <= 16384");
        }
    }
    checkImportParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
    }
}

class RsaSsaProvider$1 extends RsaProvider {
    constructor() {
        super(...arguments);
        this.name = "RSASSA-PKCS1-v1_5";
        this.usages = {
            privateKey: ["sign"],
            publicKey: ["verify"],
        };
    }
}

class RsaPssProvider$1 extends RsaProvider {
    constructor() {
        super(...arguments);
        this.name = "RSA-PSS";
        this.usages = {
            privateKey: ["sign"],
            publicKey: ["verify"],
        };
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "saltLength");
        if (typeof algorithm.saltLength !== "number") {
            throw new TypeError("saltLength: Is not a Number");
        }
        if (algorithm.saltLength < 0) {
            throw new RangeError("saltLength: Must be positive number");
        }
    }
}

class RsaOaepProvider$1 extends RsaProvider {
    constructor() {
        super(...arguments);
        this.name = "RSA-OAEP";
        this.usages = {
            privateKey: ["decrypt", "unwrapKey"],
            publicKey: ["encrypt", "wrapKey"],
        };
    }
    checkAlgorithmParams(algorithm) {
        if (algorithm.label
            && !(algorithm.label instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.label))) {
            throw new TypeError("label: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
    }
}

class EllipticProvider extends ProviderCrypto {
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "namedCurve");
        this.checkNamedCurve(algorithm.namedCurve);
    }
    checkNamedCurve(namedCurve) {
        for (const item of this.namedCurves) {
            if (item.toLowerCase() === namedCurve.toLowerCase()) {
                return;
            }
        }
        throw new OperationError(`namedCurve: Must be one of ${this.namedCurves.join(", ")}`);
    }
}

class EcdsaProvider$1 extends EllipticProvider {
    constructor() {
        super(...arguments);
        this.name = "ECDSA";
        this.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
        this.usages = {
            privateKey: ["sign"],
            publicKey: ["verify"],
        };
        this.namedCurves = ["P-256", "P-384", "P-521", "K-256"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
    }
}

const KEY_TYPES = ["secret", "private", "public"];
class CryptoKey$1 {
    static create(algorithm, type, extractable, usages) {
        const key = new this();
        key.algorithm = algorithm;
        key.type = type;
        key.extractable = extractable;
        key.usages = usages;
        return key;
    }
    static isKeyType(data) {
        return KEY_TYPES.indexOf(data) !== -1;
    }
    get [Symbol.toStringTag]() {
        return "CryptoKey";
    }
}

class EcdhProvider$1 extends EllipticProvider {
    constructor() {
        super(...arguments);
        this.name = "ECDH";
        this.usages = {
            privateKey: ["deriveBits", "deriveKey"],
            publicKey: [],
        };
        this.namedCurves = ["P-256", "P-384", "P-521", "K-256"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "public");
        if (!(algorithm.public instanceof CryptoKey$1)) {
            throw new TypeError("public: Is not a CryptoKey");
        }
        if (algorithm.public.type !== "public") {
            throw new OperationError("public: Is not a public key");
        }
        if (algorithm.public.algorithm.name !== this.name) {
            throw new OperationError(`public: Is not ${this.name} key`);
        }
    }
}

class EcdhEsProvider$1 extends EcdhProvider$1 {
    constructor() {
        super(...arguments);
        this.name = "ECDH-ES";
        this.namedCurves = ["X25519", "X448"];
    }
}

class EdDsaProvider$1 extends EllipticProvider {
    constructor() {
        super(...arguments);
        this.name = "EdDSA";
        this.usages = {
            privateKey: ["sign"],
            publicKey: ["verify"],
        };
        this.namedCurves = ["Ed25519", "Ed448"];
    }
}

let ObjectIdentifier = class ObjectIdentifier {
    constructor(value) {
        if (value) {
            this.value = value;
        }
    }
};
__decorate$1([
    AsnProp({ type: AsnPropTypes.ObjectIdentifier })
], ObjectIdentifier.prototype, "value", void 0);
ObjectIdentifier = __decorate$1([
    AsnType({ type: AsnTypeTypes.Choice })
], ObjectIdentifier);

class AlgorithmIdentifier {
    constructor(params) {
        Object.assign(this, params);
    }
}
__decorate$1([
    AsnProp({
        type: AsnPropTypes.ObjectIdentifier,
    })
], AlgorithmIdentifier.prototype, "algorithm", void 0);
__decorate$1([
    AsnProp({
        type: AsnPropTypes.Any,
        optional: true,
    })
], AlgorithmIdentifier.prototype, "parameters", void 0);

class PrivateKeyInfo {
    constructor() {
        this.version = 0;
        this.privateKeyAlgorithm = new AlgorithmIdentifier();
        this.privateKey = new ArrayBuffer(0);
    }
}
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer })
], PrivateKeyInfo.prototype, "version", void 0);
__decorate$1([
    AsnProp({ type: AlgorithmIdentifier })
], PrivateKeyInfo.prototype, "privateKeyAlgorithm", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.OctetString })
], PrivateKeyInfo.prototype, "privateKey", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Any, optional: true })
], PrivateKeyInfo.prototype, "attributes", void 0);

class PublicKeyInfo {
    constructor() {
        this.publicKeyAlgorithm = new AlgorithmIdentifier();
        this.publicKey = new ArrayBuffer(0);
    }
}
__decorate$1([
    AsnProp({ type: AlgorithmIdentifier })
], PublicKeyInfo.prototype, "publicKeyAlgorithm", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.BitString })
], PublicKeyInfo.prototype, "publicKey", void 0);

const JsonBase64UrlArrayBufferConverter = {
    fromJSON: (value) => Convert.FromBase64Url(value),
    toJSON: (value) => Convert.ToBase64Url(new Uint8Array(value)),
};

const AsnIntegerArrayBufferConverter = {
    fromASN: (value) => {
        const valueHex = value.valueBlock.valueHex;
        return !(new Uint8Array(valueHex)[0])
            ? value.valueBlock.valueHex.slice(1)
            : value.valueBlock.valueHex;
    },
    toASN: (value) => {
        const valueHex = new Uint8Array(value)[0] > 127
            ? combine(new Uint8Array([0]).buffer, value)
            : value;
        return new Integer({ valueHex });
    },
};

class RsaPrivateKey$1 {
    constructor() {
        this.version = 0;
        this.modulus = new ArrayBuffer(0);
        this.publicExponent = new ArrayBuffer(0);
        this.privateExponent = new ArrayBuffer(0);
        this.prime1 = new ArrayBuffer(0);
        this.prime2 = new ArrayBuffer(0);
        this.exponent1 = new ArrayBuffer(0);
        this.exponent2 = new ArrayBuffer(0);
        this.coefficient = new ArrayBuffer(0);
    }
}
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerConverter })
], RsaPrivateKey$1.prototype, "version", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "n", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "modulus", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "e", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "publicExponent", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "d", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "privateExponent", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "p", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "prime1", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "q", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "prime2", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "dp", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "exponent1", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "dq", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "exponent2", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "qi", converter: JsonBase64UrlArrayBufferConverter })
], RsaPrivateKey$1.prototype, "coefficient", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Any, optional: true })
], RsaPrivateKey$1.prototype, "otherPrimeInfos", void 0);

class RsaPublicKey$1 {
    constructor() {
        this.modulus = new ArrayBuffer(0);
        this.publicExponent = new ArrayBuffer(0);
    }
}
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "n", converter: JsonBase64UrlArrayBufferConverter })
], RsaPublicKey$1.prototype, "modulus", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerArrayBufferConverter }),
    JsonProp({ name: "e", converter: JsonBase64UrlArrayBufferConverter })
], RsaPublicKey$1.prototype, "publicExponent", void 0);

let EcPublicKey$1 = class EcPublicKey {
    constructor(value) {
        this.value = new ArrayBuffer(0);
        if (value) {
            this.value = value;
        }
    }
    toJSON() {
        let bytes = new Uint8Array(this.value);
        if (bytes[0] !== 0x04) {
            throw new CryptoError("Wrong ECPoint. Current version supports only Uncompressed (0x04) point");
        }
        bytes = new Uint8Array(this.value.slice(1));
        const size = bytes.length / 2;
        const offset = 0;
        const json = {
            x: Convert.ToBase64Url(bytes.buffer.slice(offset, offset + size)),
            y: Convert.ToBase64Url(bytes.buffer.slice(offset + size, offset + size + size)),
        };
        return json;
    }
    fromJSON(json) {
        if (!("x" in json)) {
            throw new Error("x: Missing required property");
        }
        if (!("y" in json)) {
            throw new Error("y: Missing required property");
        }
        const x = Convert.FromBase64Url(json.x);
        const y = Convert.FromBase64Url(json.y);
        const value = combine(new Uint8Array([0x04]).buffer, x, y);
        this.value = new Uint8Array(value).buffer;
        return this;
    }
};
__decorate$1([
    AsnProp({ type: AsnPropTypes.OctetString })
], EcPublicKey$1.prototype, "value", void 0);
EcPublicKey$1 = __decorate$1([
    AsnType({ type: AsnTypeTypes.Choice })
], EcPublicKey$1);

class EcPrivateKey$1 {
    constructor() {
        this.version = 1;
        this.privateKey = new ArrayBuffer(0);
    }
    fromJSON(json) {
        if (!("d" in json)) {
            throw new Error("d: Missing required property");
        }
        this.privateKey = Convert.FromBase64Url(json.d);
        if ("x" in json) {
            const publicKey = new EcPublicKey$1();
            publicKey.fromJSON(json);
            this.publicKey = AsnSerializer.toASN(publicKey).valueBlock.valueHex;
        }
        return this;
    }
    toJSON() {
        const jwk = {};
        jwk.d = Convert.ToBase64Url(this.privateKey);
        if (this.publicKey) {
            Object.assign(jwk, new EcPublicKey$1(this.publicKey).toJSON());
        }
        return jwk;
    }
}
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerConverter })
], EcPrivateKey$1.prototype, "version", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.OctetString })
], EcPrivateKey$1.prototype, "privateKey", void 0);
__decorate$1([
    AsnProp({ context: 0, type: AsnPropTypes.Any, optional: true })
], EcPrivateKey$1.prototype, "parameters", void 0);
__decorate$1([
    AsnProp({ context: 1, type: AsnPropTypes.BitString, optional: true })
], EcPrivateKey$1.prototype, "publicKey", void 0);

const AsnIntegerWithoutPaddingConverter = {
    fromASN: (value) => {
        const bytes = new Uint8Array(value.valueBlock.valueHex);
        return (bytes[0] === 0)
            ? bytes.buffer.slice(1)
            : bytes.buffer;
    },
    toASN: (value) => {
        const bytes = new Uint8Array(value);
        if (bytes[0] > 127) {
            const newValue = new Uint8Array(bytes.length + 1);
            newValue.set(bytes, 1);
            return new Integer({ valueHex: newValue.buffer });
        }
        return new Integer({ valueHex: value });
    },
};

var index$2 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AsnIntegerWithoutPaddingConverter: AsnIntegerWithoutPaddingConverter
});

class EcUtils {
    static decodePoint(data, pointSize) {
        const view = BufferSourceConverter.toUint8Array(data);
        if ((view.length === 0) || (view[0] !== 4)) {
            throw new Error("Only uncompressed point format supported");
        }
        const n = (view.length - 1) / 2;
        if (n !== (Math.ceil(pointSize / 8))) {
            throw new Error("Point does not match field size");
        }
        const xb = view.slice(1, n + 1);
        const yb = view.slice(n + 1, n + 1 + n);
        return { x: xb, y: yb };
    }
    static encodePoint(point, pointSize) {
        const size = Math.ceil(pointSize / 8);
        if (point.x.byteLength !== size || point.y.byteLength !== size) {
            throw new Error("X,Y coordinates don't match point size criteria");
        }
        const x = BufferSourceConverter.toUint8Array(point.x);
        const y = BufferSourceConverter.toUint8Array(point.y);
        const res = new Uint8Array(size * 2 + 1);
        res[0] = 4;
        res.set(x, 1);
        res.set(y, size + 1);
        return res;
    }
    static getSize(pointSize) {
        return Math.ceil(pointSize / 8);
    }
    static encodeSignature(signature, pointSize) {
        const size = this.getSize(pointSize);
        const r = BufferSourceConverter.toUint8Array(signature.r);
        const s = BufferSourceConverter.toUint8Array(signature.s);
        const res = new Uint8Array(size * 2);
        res.set(this.padStart(r, size));
        res.set(this.padStart(s, size), size);
        return res;
    }
    static decodeSignature(data, pointSize) {
        const size = this.getSize(pointSize);
        const view = BufferSourceConverter.toUint8Array(data);
        if (view.length !== (size * 2)) {
            throw new Error("Incorrect size of the signature");
        }
        const r = view.slice(0, size);
        const s = view.slice(size);
        return {
            r: this.trimStart(r),
            s: this.trimStart(s),
        };
    }
    static trimStart(data) {
        let i = 0;
        while ((i < data.length - 1) && (data[i] === 0)) {
            i++;
        }
        if (i === 0) {
            return data;
        }
        return data.slice(i, data.length);
    }
    static padStart(data, size) {
        if (size === data.length) {
            return data;
        }
        const res = new Uint8Array(size);
        res.set(data, size - data.length);
        return res;
    }
}

class EcDsaSignature {
    constructor() {
        this.r = new ArrayBuffer(0);
        this.s = new ArrayBuffer(0);
    }
    static fromWebCryptoSignature(value) {
        const pointSize = value.byteLength / 2;
        const point = EcUtils.decodeSignature(value, pointSize * 8);
        const ecSignature = new EcDsaSignature();
        ecSignature.r = BufferSourceConverter.toArrayBuffer(point.r);
        ecSignature.s = BufferSourceConverter.toArrayBuffer(point.s);
        return ecSignature;
    }
    toWebCryptoSignature(pointSize) {
        pointSize !== null && pointSize !== void 0 ? pointSize : (pointSize = Math.max(this.r.byteLength, this.s.byteLength) * 8);
        const signature = EcUtils.encodeSignature(this, pointSize);
        return signature.buffer;
    }
}
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerWithoutPaddingConverter })
], EcDsaSignature.prototype, "r", void 0);
__decorate$1([
    AsnProp({ type: AsnPropTypes.Integer, converter: AsnIntegerWithoutPaddingConverter })
], EcDsaSignature.prototype, "s", void 0);

class OneAsymmetricKey extends PrivateKeyInfo {
}
__decorate$1([
    AsnProp({ context: 1, implicit: true, type: AsnPropTypes.BitString, optional: true })
], OneAsymmetricKey.prototype, "publicKey", void 0);

let EdPrivateKey$1 = class EdPrivateKey {
    constructor() {
        this.value = new ArrayBuffer(0);
    }
    fromJSON(json) {
        if (!json.d) {
            throw new Error("d: Missing required property");
        }
        this.value = Convert.FromBase64Url(json.d);
        return this;
    }
    toJSON() {
        const jwk = {
            d: Convert.ToBase64Url(this.value),
        };
        return jwk;
    }
};
__decorate$1([
    AsnProp({ type: AsnPropTypes.OctetString })
], EdPrivateKey$1.prototype, "value", void 0);
EdPrivateKey$1 = __decorate$1([
    AsnType({ type: AsnTypeTypes.Choice })
], EdPrivateKey$1);

let EdPublicKey$1 = class EdPublicKey {
    constructor(value) {
        this.value = new ArrayBuffer(0);
        if (value) {
            this.value = value;
        }
    }
    toJSON() {
        const json = {
            x: Convert.ToBase64Url(this.value),
        };
        return json;
    }
    fromJSON(json) {
        if (!("x" in json)) {
            throw new Error("x: Missing required property");
        }
        this.value = Convert.FromBase64Url(json.x);
        return this;
    }
};
__decorate$1([
    AsnProp({ type: AsnPropTypes.BitString })
], EdPublicKey$1.prototype, "value", void 0);
EdPublicKey$1 = __decorate$1([
    AsnType({ type: AsnTypeTypes.Choice })
], EdPublicKey$1);

let CurvePrivateKey = class CurvePrivateKey {
};
__decorate$1([
    AsnProp({ type: AsnPropTypes.OctetString }),
    JsonProp({ type: JsonPropTypes.String, converter: JsonBase64UrlArrayBufferConverter })
], CurvePrivateKey.prototype, "d", void 0);
CurvePrivateKey = __decorate$1([
    AsnType({ type: AsnTypeTypes.Choice })
], CurvePrivateKey);

const idSecp256r1 = "1.2.840.10045.3.1.7";
const idEllipticCurve = "1.3.132.0";
const idSecp384r1 = `${idEllipticCurve}.34`;
const idSecp521r1 = `${idEllipticCurve}.35`;
const idSecp256k1 = `${idEllipticCurve}.10`;
const idVersionOne = "1.3.36.3.3.2.8.1.1";
const idBrainpoolP160r1 = `${idVersionOne}.1`;
const idBrainpoolP160t1 = `${idVersionOne}.2`;
const idBrainpoolP192r1 = `${idVersionOne}.3`;
const idBrainpoolP192t1 = `${idVersionOne}.4`;
const idBrainpoolP224r1 = `${idVersionOne}.5`;
const idBrainpoolP224t1 = `${idVersionOne}.6`;
const idBrainpoolP256r1 = `${idVersionOne}.7`;
const idBrainpoolP256t1 = `${idVersionOne}.8`;
const idBrainpoolP320r1 = `${idVersionOne}.9`;
const idBrainpoolP320t1 = `${idVersionOne}.10`;
const idBrainpoolP384r1 = `${idVersionOne}.11`;
const idBrainpoolP384t1 = `${idVersionOne}.12`;
const idBrainpoolP512r1 = `${idVersionOne}.13`;
const idBrainpoolP512t1 = `${idVersionOne}.14`;
const idX25519 = "1.3.101.110";
const idX448 = "1.3.101.111";
const idEd25519 = "1.3.101.112";
const idEd448 = "1.3.101.113";

var index$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  converters: index$2,
  get ObjectIdentifier () { return ObjectIdentifier; },
  AlgorithmIdentifier: AlgorithmIdentifier,
  PrivateKeyInfo: PrivateKeyInfo,
  PublicKeyInfo: PublicKeyInfo,
  RsaPrivateKey: RsaPrivateKey$1,
  RsaPublicKey: RsaPublicKey$1,
  EcPrivateKey: EcPrivateKey$1,
  get EcPublicKey () { return EcPublicKey$1; },
  EcDsaSignature: EcDsaSignature,
  OneAsymmetricKey: OneAsymmetricKey,
  get EdPrivateKey () { return EdPrivateKey$1; },
  get EdPublicKey () { return EdPublicKey$1; },
  get CurvePrivateKey () { return CurvePrivateKey; },
  idSecp256r1: idSecp256r1,
  idEllipticCurve: idEllipticCurve,
  idSecp384r1: idSecp384r1,
  idSecp521r1: idSecp521r1,
  idSecp256k1: idSecp256k1,
  idVersionOne: idVersionOne,
  idBrainpoolP160r1: idBrainpoolP160r1,
  idBrainpoolP160t1: idBrainpoolP160t1,
  idBrainpoolP192r1: idBrainpoolP192r1,
  idBrainpoolP192t1: idBrainpoolP192t1,
  idBrainpoolP224r1: idBrainpoolP224r1,
  idBrainpoolP224t1: idBrainpoolP224t1,
  idBrainpoolP256r1: idBrainpoolP256r1,
  idBrainpoolP256t1: idBrainpoolP256t1,
  idBrainpoolP320r1: idBrainpoolP320r1,
  idBrainpoolP320t1: idBrainpoolP320t1,
  idBrainpoolP384r1: idBrainpoolP384r1,
  idBrainpoolP384t1: idBrainpoolP384t1,
  idBrainpoolP512r1: idBrainpoolP512r1,
  idBrainpoolP512t1: idBrainpoolP512t1,
  idX25519: idX25519,
  idX448: idX448,
  idEd25519: idEd25519,
  idEd448: idEd448
});

class EcCurves {
    constructor() { }
    static register(item) {
        const oid = new ObjectIdentifier();
        oid.value = item.id;
        const raw = AsnConvert.serialize(oid);
        this.items.push({
            ...item,
            raw,
        });
        this.names.push(item.name);
    }
    static find(nameOrId) {
        nameOrId = nameOrId.toUpperCase();
        for (const item of this.items) {
            if (item.name.toUpperCase() === nameOrId || item.id.toUpperCase() === nameOrId) {
                return item;
            }
        }
        return null;
    }
    static get(nameOrId) {
        const res = this.find(nameOrId);
        if (!res) {
            throw new Error(`Unsupported EC named curve '${nameOrId}'`);
        }
        return res;
    }
}
EcCurves.items = [];
EcCurves.names = [];
EcCurves.register({ name: "P-256", id: idSecp256r1, size: 256 });
EcCurves.register({ name: "P-384", id: idSecp384r1, size: 384 });
EcCurves.register({ name: "P-521", id: idSecp521r1, size: 521 });
EcCurves.register({ name: "K-256", id: idSecp256k1, size: 256 });
EcCurves.register({ name: "brainpoolP160r1", id: idBrainpoolP160r1, size: 160 });
EcCurves.register({ name: "brainpoolP160t1", id: idBrainpoolP160t1, size: 160 });
EcCurves.register({ name: "brainpoolP192r1", id: idBrainpoolP192r1, size: 192 });
EcCurves.register({ name: "brainpoolP192t1", id: idBrainpoolP192t1, size: 192 });
EcCurves.register({ name: "brainpoolP224r1", id: idBrainpoolP224r1, size: 224 });
EcCurves.register({ name: "brainpoolP224t1", id: idBrainpoolP224t1, size: 224 });
EcCurves.register({ name: "brainpoolP256r1", id: idBrainpoolP256r1, size: 256 });
EcCurves.register({ name: "brainpoolP256t1", id: idBrainpoolP256t1, size: 256 });
EcCurves.register({ name: "brainpoolP320r1", id: idBrainpoolP320r1, size: 320 });
EcCurves.register({ name: "brainpoolP320t1", id: idBrainpoolP320t1, size: 320 });
EcCurves.register({ name: "brainpoolP384r1", id: idBrainpoolP384r1, size: 384 });
EcCurves.register({ name: "brainpoolP384t1", id: idBrainpoolP384t1, size: 384 });
EcCurves.register({ name: "brainpoolP512r1", id: idBrainpoolP512r1, size: 512 });
EcCurves.register({ name: "brainpoolP512t1", id: idBrainpoolP512t1, size: 512 });

class HmacProvider$1 extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "HMAC";
        this.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
        this.usages = ["sign", "verify"];
    }
    getDefaultLength(algName) {
        switch (algName.toUpperCase()) {
            case "SHA-1":
            case "SHA-256":
            case "SHA-384":
            case "SHA-512":
                return 512;
            default:
                throw new Error(`Unknown algorithm name '${algName}'`);
        }
    }
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        if ("length" in algorithm) {
            if (typeof algorithm.length !== "number") {
                throw new TypeError("length: Is not a Number");
            }
            if (algorithm.length < 1) {
                throw new RangeError("length: Number is out of range");
            }
        }
    }
    checkImportParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
    }
}

class Pbkdf2Provider$1 extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "PBKDF2";
        this.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
        this.usages = ["deriveBits", "deriveKey"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        this.checkRequiredProperty(algorithm, "salt");
        if (!(algorithm.salt instanceof ArrayBuffer || ArrayBuffer.isView(algorithm.salt))) {
            throw new TypeError("salt: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        this.checkRequiredProperty(algorithm, "iterations");
        if (typeof algorithm.iterations !== "number") {
            throw new TypeError("iterations: Is not a Number");
        }
        if (algorithm.iterations < 1) {
            throw new TypeError("iterations: Is less than 1");
        }
    }
    checkImportKey(format, keyData, algorithm, extractable, keyUsages, ...args) {
        super.checkImportKey(format, keyData, algorithm, extractable, keyUsages);
        if (extractable) {
            throw new SyntaxError("extractable: Must be 'false'");
        }
    }
}

class HkdfProvider$1 extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "HKDF";
        this.hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];
        this.usages = ["deriveKey", "deriveBits"];
    }
    checkAlgorithmParams(algorithm) {
        this.checkRequiredProperty(algorithm, "hash");
        this.checkHashAlgorithm(algorithm.hash, this.hashAlgorithms);
        this.checkRequiredProperty(algorithm, "salt");
        if (!BufferSourceConverter.isBufferSource(algorithm.salt)) {
            throw new TypeError("salt: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
        this.checkRequiredProperty(algorithm, "info");
        if (!BufferSourceConverter.isBufferSource(algorithm.info)) {
            throw new TypeError("salt: Is not of type '(ArrayBuffer or ArrayBufferView)'");
        }
    }
    checkImportKey(format, keyData, algorithm, extractable, keyUsages, ...args) {
        super.checkImportKey(format, keyData, algorithm, extractable, keyUsages);
        if (extractable) {
            throw new SyntaxError("extractable: Must be 'false'");
        }
    }
}

class ShakeProvider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.usages = [];
        this.defaultLength = 0;
    }
    digest(...args) {
        args[0] = { length: this.defaultLength, ...args[0] };
        return super.digest.apply(this, args);
    }
    checkDigest(algorithm, data) {
        super.checkDigest(algorithm, data);
        const length = algorithm.length || 0;
        if (typeof length !== "number") {
            throw new TypeError("length: Is not a Number");
        }
        if (length < 0) {
            throw new TypeError("length: Is negative");
        }
    }
}

class Shake128Provider$1 extends ShakeProvider {
    constructor() {
        super(...arguments);
        this.name = "shake128";
        this.defaultLength = 16;
    }
}

class Shake256Provider$1 extends ShakeProvider {
    constructor() {
        super(...arguments);
        this.name = "shake256";
        this.defaultLength = 32;
    }
}

class Crypto$1 {
    get [Symbol.toStringTag]() {
        return "Crypto";
    }
    randomUUID() {
        const b = this.getRandomValues(new Uint8Array(16));
        b[6] = (b[6] & 0x0f) | 0x40;
        b[8] = (b[8] & 0x3f) | 0x80;
        const uuid = Convert.ToHex(b).toLowerCase();
        return `${uuid.substring(0, 8)}-${uuid.substring(8, 12)}-${uuid.substring(12, 16)}-${uuid.substring(16)}`;
    }
}

class ProviderStorage {
    constructor() {
        this.items = {};
    }
    get(algorithmName) {
        return this.items[algorithmName.toLowerCase()] || null;
    }
    set(provider) {
        this.items[provider.name.toLowerCase()] = provider;
    }
    removeAt(algorithmName) {
        const provider = this.get(algorithmName.toLowerCase());
        if (provider) {
            delete this.items[algorithmName];
        }
        return provider;
    }
    has(name) {
        return !!this.get(name);
    }
    get length() {
        return Object.keys(this.items).length;
    }
    get algorithms() {
        const algorithms = [];
        for (const key in this.items) {
            const provider = this.items[key];
            algorithms.push(provider.name);
        }
        return algorithms.sort();
    }
}

class SubtleCrypto$1 {
    constructor() {
        this.providers = new ProviderStorage();
    }
    static isHashedAlgorithm(data) {
        return data
            && typeof data === "object"
            && "name" in data
            && "hash" in data
            ? true
            : false;
    }
    get [Symbol.toStringTag]() {
        return "SubtleCrypto";
    }
    async digest(...args) {
        this.checkRequiredArguments(args, 2, "digest");
        const [algorithm, data, ...params] = args;
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(data);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.digest(preparedAlgorithm, preparedData, ...params);
        return result;
    }
    async generateKey(...args) {
        this.checkRequiredArguments(args, 3, "generateKey");
        const [algorithm, extractable, keyUsages, ...params] = args;
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.generateKey({ ...preparedAlgorithm, name: provider.name }, extractable, keyUsages, ...params);
        return result;
    }
    async sign(...args) {
        this.checkRequiredArguments(args, 3, "sign");
        const [algorithm, key, data, ...params] = args;
        this.checkCryptoKey(key);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(data);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.sign({ ...preparedAlgorithm, name: provider.name }, key, preparedData, ...params);
        return result;
    }
    async verify(...args) {
        this.checkRequiredArguments(args, 4, "verify");
        const [algorithm, key, signature, data, ...params] = args;
        this.checkCryptoKey(key);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(data);
        const preparedSignature = BufferSourceConverter.toArrayBuffer(signature);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.verify({ ...preparedAlgorithm, name: provider.name }, key, preparedSignature, preparedData, ...params);
        return result;
    }
    async encrypt(...args) {
        this.checkRequiredArguments(args, 3, "encrypt");
        const [algorithm, key, data, ...params] = args;
        this.checkCryptoKey(key);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(data);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.encrypt({ ...preparedAlgorithm, name: provider.name }, key, preparedData, { keyUsage: true }, ...params);
        return result;
    }
    async decrypt(...args) {
        this.checkRequiredArguments(args, 3, "decrypt");
        const [algorithm, key, data, ...params] = args;
        this.checkCryptoKey(key);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(data);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.decrypt({ ...preparedAlgorithm, name: provider.name }, key, preparedData, { keyUsage: true }, ...params);
        return result;
    }
    async deriveBits(...args) {
        this.checkRequiredArguments(args, 3, "deriveBits");
        const [algorithm, baseKey, length, ...params] = args;
        this.checkCryptoKey(baseKey);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const provider = this.getProvider(preparedAlgorithm.name);
        const result = await provider.deriveBits({ ...preparedAlgorithm, name: provider.name }, baseKey, length, { keyUsage: true }, ...params);
        return result;
    }
    async deriveKey(...args) {
        this.checkRequiredArguments(args, 5, "deriveKey");
        const [algorithm, baseKey, derivedKeyType, extractable, keyUsages, ...params] = args;
        const preparedDerivedKeyType = this.prepareAlgorithm(derivedKeyType);
        const importProvider = this.getProvider(preparedDerivedKeyType.name);
        importProvider.checkDerivedKeyParams(preparedDerivedKeyType);
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const provider = this.getProvider(preparedAlgorithm.name);
        provider.checkCryptoKey(baseKey, "deriveKey");
        const derivedBits = await provider.deriveBits({ ...preparedAlgorithm, name: provider.name }, baseKey, derivedKeyType.length || 512, { keyUsage: false }, ...params);
        return this.importKey("raw", derivedBits, derivedKeyType, extractable, keyUsages, ...params);
    }
    async exportKey(...args) {
        this.checkRequiredArguments(args, 2, "exportKey");
        const [format, key, ...params] = args;
        this.checkCryptoKey(key);
        const provider = this.getProvider(key.algorithm.name);
        const result = await provider.exportKey(format, key, ...params);
        return result;
    }
    async importKey(...args) {
        this.checkRequiredArguments(args, 5, "importKey");
        const [format, keyData, algorithm, extractable, keyUsages, ...params] = args;
        const preparedAlgorithm = this.prepareAlgorithm(algorithm);
        const provider = this.getProvider(preparedAlgorithm.name);
        if (["pkcs8", "spki", "raw"].indexOf(format) !== -1) {
            const preparedData = BufferSourceConverter.toArrayBuffer(keyData);
            return provider.importKey(format, preparedData, { ...preparedAlgorithm, name: provider.name }, extractable, keyUsages, ...params);
        }
        else {
            if (!keyData.kty) {
                throw new TypeError("keyData: Is not JSON");
            }
        }
        return provider.importKey(format, keyData, { ...preparedAlgorithm, name: provider.name }, extractable, keyUsages, ...params);
    }
    async wrapKey(format, key, wrappingKey, wrapAlgorithm, ...args) {
        let keyData = await this.exportKey(format, key, ...args);
        if (format === "jwk") {
            const json = JSON.stringify(keyData);
            keyData = Convert.FromUtf8String(json);
        }
        const preparedAlgorithm = this.prepareAlgorithm(wrapAlgorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(keyData);
        const provider = this.getProvider(preparedAlgorithm.name);
        return provider.encrypt({ ...preparedAlgorithm, name: provider.name }, wrappingKey, preparedData, { keyUsage: false }, ...args);
    }
    async unwrapKey(format, wrappedKey, unwrappingKey, unwrapAlgorithm, unwrappedKeyAlgorithm, extractable, keyUsages, ...args) {
        const preparedAlgorithm = this.prepareAlgorithm(unwrapAlgorithm);
        const preparedData = BufferSourceConverter.toArrayBuffer(wrappedKey);
        const provider = this.getProvider(preparedAlgorithm.name);
        let keyData = await provider.decrypt({ ...preparedAlgorithm, name: provider.name }, unwrappingKey, preparedData, { keyUsage: false }, ...args);
        if (format === "jwk") {
            try {
                keyData = JSON.parse(Convert.ToUtf8String(keyData));
            }
            catch (e) {
                const error = new TypeError("wrappedKey: Is not a JSON");
                error.internal = e;
                throw error;
            }
        }
        return this.importKey(format, keyData, unwrappedKeyAlgorithm, extractable, keyUsages, ...args);
    }
    checkRequiredArguments(args, size, methodName) {
        if (args.length < size) {
            throw new TypeError(`Failed to execute '${methodName}' on 'SubtleCrypto': ${size} arguments required, but only ${args.length} present`);
        }
    }
    prepareAlgorithm(algorithm) {
        if (typeof algorithm === "string") {
            return {
                name: algorithm,
            };
        }
        if (SubtleCrypto$1.isHashedAlgorithm(algorithm)) {
            const preparedAlgorithm = { ...algorithm };
            preparedAlgorithm.hash = this.prepareAlgorithm(algorithm.hash);
            return preparedAlgorithm;
        }
        return { ...algorithm };
    }
    getProvider(name) {
        const provider = this.providers.get(name);
        if (!provider) {
            throw new AlgorithmError("Unrecognized name");
        }
        return provider;
    }
    checkCryptoKey(key) {
        if (!(key instanceof CryptoKey$1)) {
            throw new TypeError(`Key is not of type 'CryptoKey'`);
        }
    }
}

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}

const JsonBase64UrlConverter = {
    fromJSON: (value) => Buffer.from(Convert.FromBase64Url(value)),
    toJSON: (value) => Convert.ToBase64Url(value),
};

class CryptoKey extends CryptoKey$1 {
    constructor() {
        super(...arguments);
        this.data = Buffer.alloc(0);
        this.algorithm = { name: "" };
        this.extractable = false;
        this.type = "secret";
        this.usages = [];
        this.kty = "oct";
        this.alg = "";
    }
}
__decorate([
    JsonProp({ name: "ext", type: JsonPropTypes.Boolean, optional: true })
], CryptoKey.prototype, "extractable", void 0);
__decorate([
    JsonProp({ name: "key_ops", type: JsonPropTypes.String, repeated: true, optional: true })
], CryptoKey.prototype, "usages", void 0);
__decorate([
    JsonProp({ type: JsonPropTypes.String })
], CryptoKey.prototype, "kty", void 0);
__decorate([
    JsonProp({ type: JsonPropTypes.String, optional: true })
], CryptoKey.prototype, "alg", void 0);

class SymmetricKey extends CryptoKey {
    constructor() {
        super(...arguments);
        this.kty = "oct";
        this.type = "secret";
    }
}

class AsymmetricKey extends CryptoKey {
}

class AesCryptoKey extends SymmetricKey {
    get alg() {
        switch (this.algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return `A${this.algorithm.length}CBC`;
            case "AES-CTR":
                return `A${this.algorithm.length}CTR`;
            case "AES-GCM":
                return `A${this.algorithm.length}GCM`;
            case "AES-KW":
                return `A${this.algorithm.length}KW`;
            case "AES-CMAC":
                return `A${this.algorithm.length}CMAC`;
            case "AES-ECB":
                return `A${this.algorithm.length}ECB`;
            default:
                throw new AlgorithmError("Unsupported algorithm name");
        }
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], AesCryptoKey.prototype, "data", void 0);

const keyStorage = new WeakMap();
function getCryptoKey(key) {
    const res = keyStorage.get(key);
    if (!res) {
        throw new OperationError("Cannot get CryptoKey from secure storage");
    }
    return res;
}
function setCryptoKey(value) {
    const key = CryptoKey$1.create(value.algorithm, value.type, value.extractable, value.usages);
    Object.freeze(key);
    keyStorage.set(key, value);
    return key;
}

class AesCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const key = new AesCryptoKey();
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto__default__default["default"].randomBytes(algorithm.length >> 3);
        return key;
    }
    static async exportKey(format, key) {
        if (!(key instanceof AesCryptoKey)) {
            throw new Error("key: Is not AesCryptoKey");
        }
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "raw":
                return new Uint8Array(key.data).buffer;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: AesCryptoKey });
                break;
            case "raw":
                key = new AesCryptoKey();
                key.data = Buffer.from(keyData);
                break;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = algorithm;
        key.algorithm.length = key.data.length << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        switch (key.algorithm.length) {
            case 128:
            case 192:
            case 256:
                break;
            default:
                throw new OperationError("keyData: Is wrong key length");
        }
        return key;
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return this.encryptAesCBC(algorithm, key, Buffer.from(data));
            case "AES-CTR":
                return this.encryptAesCTR(algorithm, key, Buffer.from(data));
            case "AES-GCM":
                return this.encryptAesGCM(algorithm, key, Buffer.from(data));
            case "AES-KW":
                return this.encryptAesKW(algorithm, key, Buffer.from(data));
            case "AES-ECB":
                return this.encryptAesECB(algorithm, key, Buffer.from(data));
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        if (!(key instanceof AesCryptoKey)) {
            throw new Error("key: Is not AesCryptoKey");
        }
        switch (algorithm.name.toUpperCase()) {
            case "AES-CBC":
                return this.decryptAesCBC(algorithm, key, Buffer.from(data));
            case "AES-CTR":
                return this.decryptAesCTR(algorithm, key, Buffer.from(data));
            case "AES-GCM":
                return this.decryptAesGCM(algorithm, key, Buffer.from(data));
            case "AES-KW":
                return this.decryptAesKW(algorithm, key, Buffer.from(data));
            case "AES-ECB":
                return this.decryptAesECB(algorithm, key, Buffer.from(data));
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async encryptAesCBC(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`aes-${key.algorithm.length}-cbc`, key.data, new Uint8Array(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesCBC(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`aes-${key.algorithm.length}-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesCTR(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`aes-${key.algorithm.length}-ctr`, key.data, Buffer.from(algorithm.counter));
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesCTR(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`aes-${key.algorithm.length}-ctr`, key.data, new Uint8Array(algorithm.counter));
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesGCM(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`aes-${key.algorithm.length}-gcm`, key.data, Buffer.from(algorithm.iv), {
            authTagLength: (algorithm.tagLength || 128) >> 3,
        });
        if (algorithm.additionalData) {
            cipher.setAAD(Buffer.from(algorithm.additionalData));
        }
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final(), cipher.getAuthTag()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesGCM(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`aes-${key.algorithm.length}-gcm`, key.data, new Uint8Array(algorithm.iv));
        const tagLength = (algorithm.tagLength || 128) >> 3;
        const enc = data.slice(0, data.length - tagLength);
        const tag = data.slice(data.length - tagLength);
        if (algorithm.additionalData) {
            decipher.setAAD(Buffer.from(algorithm.additionalData));
        }
        decipher.setAuthTag(tag);
        let dec = decipher.update(enc);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesKW(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`id-aes${key.algorithm.length}-wrap`, key.data, this.AES_KW_IV);
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        return new Uint8Array(enc).buffer;
    }
    static async decryptAesKW(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`id-aes${key.algorithm.length}-wrap`, key.data, this.AES_KW_IV);
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptAesECB(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`aes-${key.algorithm.length}-ecb`, key.data, new Uint8Array(0));
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptAesECB(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`aes-${key.algorithm.length}-ecb`, key.data, new Uint8Array(0));
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
}
AesCrypto.AES_KW_IV = Buffer.from("A6A6A6A6A6A6A6A6", "hex");

class AesCbcProvider extends AesCbcProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

const zero = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const rb = Buffer.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 135]);
const blockSize = 16;
function bitShiftLeft(buffer) {
    const shifted = Buffer.alloc(buffer.length);
    const last = buffer.length - 1;
    for (let index = 0; index < last; index++) {
        shifted[index] = buffer[index] << 1;
        if (buffer[index + 1] & 0x80) {
            shifted[index] += 0x01;
        }
    }
    shifted[last] = buffer[last] << 1;
    return shifted;
}
function xor(a, b) {
    const length = Math.min(a.length, b.length);
    const output = Buffer.alloc(length);
    for (let index = 0; index < length; index++) {
        output[index] = a[index] ^ b[index];
    }
    return output;
}
function aes(key, message) {
    const cipher = crypto__default__namespace.createCipheriv(`aes${key.length << 3}`, key, zero);
    const result = cipher.update(message);
    cipher.final();
    return result;
}
function getMessageBlock(message, blockIndex) {
    const block = Buffer.alloc(blockSize);
    const start = blockIndex * blockSize;
    const end = start + blockSize;
    message.copy(block, 0, start, end);
    return block;
}
function getPaddedMessageBlock(message, blockIndex) {
    const block = Buffer.alloc(blockSize);
    const start = blockIndex * blockSize;
    const end = message.length;
    block.fill(0);
    message.copy(block, 0, start, end);
    block[end - start] = 0x80;
    return block;
}
function generateSubkeys(key) {
    const l = aes(key, zero);
    let subkey1 = bitShiftLeft(l);
    if (l[0] & 0x80) {
        subkey1 = xor(subkey1, rb);
    }
    let subkey2 = bitShiftLeft(subkey1);
    if (subkey1[0] & 0x80) {
        subkey2 = xor(subkey2, rb);
    }
    return { subkey1, subkey2 };
}
function aesCmac(key, message) {
    const subkeys = generateSubkeys(key);
    let blockCount = Math.ceil(message.length / blockSize);
    let lastBlockCompleteFlag;
    let lastBlock;
    if (blockCount === 0) {
        blockCount = 1;
        lastBlockCompleteFlag = false;
    }
    else {
        lastBlockCompleteFlag = (message.length % blockSize === 0);
    }
    const lastBlockIndex = blockCount - 1;
    if (lastBlockCompleteFlag) {
        lastBlock = xor(getMessageBlock(message, lastBlockIndex), subkeys.subkey1);
    }
    else {
        lastBlock = xor(getPaddedMessageBlock(message, lastBlockIndex), subkeys.subkey2);
    }
    let x = zero;
    let y;
    for (let index = 0; index < lastBlockIndex; index++) {
        y = xor(x, getMessageBlock(message, index));
        x = aes(key, y);
    }
    y = xor(lastBlock, x);
    return aes(key, y);
}
class AesCmacProvider extends AesCmacProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onSign(algorithm, key, data) {
        const result = aesCmac(getCryptoKey(key).data, Buffer.from(data));
        return new Uint8Array(result).buffer;
    }
    async onVerify(algorithm, key, signature, data) {
        const signature2 = await this.sign(algorithm, key, data);
        return Buffer.from(signature).compare(Buffer.from(signature2)) === 0;
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesCtrProvider extends AesCtrProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesGcmProvider extends AesGcmProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesKwProvider extends AesKwProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const res = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class AesEcbProvider extends AesEcbProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await AesCrypto.generateKey({
            name: this.name,
            length: algorithm.length,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return AesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return AesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return AesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const res = await AesCrypto.importKey(format, keyData, { name: algorithm.name }, extractable, keyUsages);
        return setCryptoKey(res);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof AesCryptoKey)) {
            throw new TypeError("key: Is not a AesCryptoKey");
        }
    }
}

class DesCryptoKey extends SymmetricKey {
    get alg() {
        switch (this.algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return `DES-CBC`;
            case "DES-EDE3-CBC":
                return `3DES-CBC`;
            default:
                throw new AlgorithmError("Unsupported algorithm name");
        }
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], DesCryptoKey.prototype, "data", void 0);

class DesCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const key = new DesCryptoKey();
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto__default__default["default"].randomBytes(algorithm.length >> 3);
        return key;
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "raw":
                return new Uint8Array(key.data).buffer;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: DesCryptoKey });
                break;
            case "raw":
                key = new DesCryptoKey();
                key.data = Buffer.from(keyData);
                break;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = algorithm;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return this.encryptDesCBC(algorithm, key, Buffer.from(data));
            case "DES-EDE3-CBC":
                return this.encryptDesEDE3CBC(algorithm, key, Buffer.from(data));
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        if (!(key instanceof DesCryptoKey)) {
            throw new Error("key: Is not DesCryptoKey");
        }
        switch (algorithm.name.toUpperCase()) {
            case "DES-CBC":
                return this.decryptDesCBC(algorithm, key, Buffer.from(data));
            case "DES-EDE3-CBC":
                return this.decryptDesEDE3CBC(algorithm, key, Buffer.from(data));
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async encryptDesCBC(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`des-cbc`, key.data, new Uint8Array(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptDesCBC(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`des-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
    static async encryptDesEDE3CBC(algorithm, key, data) {
        const cipher = crypto__default__default["default"].createCipheriv(`des-ede3-cbc`, key.data, Buffer.from(algorithm.iv));
        let enc = cipher.update(data);
        enc = Buffer.concat([enc, cipher.final()]);
        const res = new Uint8Array(enc).buffer;
        return res;
    }
    static async decryptDesEDE3CBC(algorithm, key, data) {
        const decipher = crypto__default__default["default"].createDecipheriv(`des-ede3-cbc`, key.data, new Uint8Array(algorithm.iv));
        let dec = decipher.update(data);
        dec = Buffer.concat([dec, decipher.final()]);
        return new Uint8Array(dec).buffer;
    }
}

class DesCbcProvider extends DesProvider {
    constructor() {
        super(...arguments);
        this.keySizeBits = 64;
        this.ivSize = 8;
        this.name = "DES-CBC";
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await DesCrypto.generateKey({
            name: this.name,
            length: this.keySizeBits,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return DesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return DesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return DesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await DesCrypto.importKey(format, keyData, { name: this.name, length: this.keySizeBits }, extractable, keyUsages);
        if (key.data.length !== (this.keySizeBits >> 3)) {
            throw new OperationError("keyData: Wrong key size");
        }
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof DesCryptoKey)) {
            throw new TypeError("key: Is not a DesCryptoKey");
        }
    }
}

class DesEde3CbcProvider extends DesProvider {
    constructor() {
        super(...arguments);
        this.keySizeBits = 192;
        this.ivSize = 8;
        this.name = "DES-EDE3-CBC";
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const key = await DesCrypto.generateKey({
            name: this.name,
            length: this.keySizeBits,
        }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    async onEncrypt(algorithm, key, data) {
        return DesCrypto.encrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onDecrypt(algorithm, key, data) {
        return DesCrypto.decrypt(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return DesCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await DesCrypto.importKey(format, keyData, { name: this.name, length: this.keySizeBits }, extractable, keyUsages);
        if (key.data.length !== (this.keySizeBits >> 3)) {
            throw new OperationError("keyData: Wrong key size");
        }
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof DesCryptoKey)) {
            throw new TypeError("key: Is not a DesCryptoKey");
        }
    }
}

function getJwkAlgorithm(algorithm) {
    switch (algorithm.name.toUpperCase()) {
        case "RSA-OAEP": {
            const mdSize = /(\d+)$/.exec(algorithm.hash.name)[1];
            return `RSA-OAEP${mdSize !== "1" ? `-${mdSize}` : ""}`;
        }
        case "RSASSA-PKCS1-V1_5":
            return `RS${/(\d+)$/.exec(algorithm.hash.name)[1]}`;
        case "RSA-PSS":
            return `PS${/(\d+)$/.exec(algorithm.hash.name)[1]}`;
        case "RSA-PKCS1":
            return `RS1`;
        default:
            throw new OperationError("algorithm: Is not recognized");
    }
}

class RsaPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, index$1.RsaPrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "RSA",
            alg: getJwkAlgorithm(this.algorithm),
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        const key = JsonParser.fromJSON(json, { targetSchema: index$1.RsaPrivateKey });
        const keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.privateKeyAlgorithm.parameters = null;
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
    }
}

class RsaPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PublicKeyInfo);
        return AsnParser.parse(keyInfo.publicKey, index$1.RsaPublicKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "RSA",
            alg: getJwkAlgorithm(this.algorithm),
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        const key = JsonParser.fromJSON(json, { targetSchema: index$1.RsaPublicKey });
        const keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.publicKeyAlgorithm.parameters = null;
        keyInfo.publicKey = AsnSerializer.serialize(key);
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
    }
}

class RsaCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new RsaPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new RsaPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const publicExponent = Buffer.concat([
            Buffer.alloc(4 - algorithm.publicExponent.byteLength, 0),
            Buffer.from(algorithm.publicExponent),
        ]).readInt32BE(0);
        const keys = crypto__default__default["default"].generateKeyPairSync("rsa", {
            modulusLength: algorithm.modulusLength,
            publicExponent,
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            default:
                throw new OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: index$1.RsaPrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: index$1.RsaPublicKey });
                    return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
                }
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PublicKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.publicKey, index$1.RsaPublicKey);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, index$1.RsaPrivateKey);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new OperationError("format: Must be 'jwk', 'pkcs8' or 'spki'");
        }
    }
    static async sign(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-PSS":
            case "RSASSA-PKCS1-V1_5":
                return this.signRsa(algorithm, key, data);
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async verify(algorithm, key, signature, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-PSS":
            case "RSASSA-PKCS1-V1_5":
                return this.verifySSA(algorithm, key, data, signature);
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async encrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-OAEP":
                return this.encryptOAEP(algorithm, key, data);
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static async decrypt(algorithm, key, data) {
        switch (algorithm.name.toUpperCase()) {
            case "RSA-OAEP":
                return this.decryptOAEP(algorithm, key, data);
            default:
                throw new OperationError("algorithm: Is not recognized");
        }
    }
    static importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.privateKeyAlgorithm.parameters = null;
        keyInfo.privateKey = AsnSerializer.serialize(asnKey);
        const key = new RsaPrivateKey();
        key.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.algorithm.publicExponent = new Uint8Array(asnKey.publicExponent);
        key.algorithm.modulusLength = asnKey.modulus.byteLength << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.113549.1.1.1";
        keyInfo.publicKeyAlgorithm.parameters = null;
        keyInfo.publicKey = AsnSerializer.serialize(asnKey);
        const key = new RsaPublicKey();
        key.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.algorithm.publicExponent = new Uint8Array(asnKey.publicExponent);
        key.algorithm.modulusLength = asnKey.modulus.byteLength << 3;
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static getCryptoAlgorithm(alg) {
        switch (alg.hash.name.toUpperCase()) {
            case "SHA-1":
                return "RSA-SHA1";
            case "SHA-256":
                return "RSA-SHA256";
            case "SHA-384":
                return "RSA-SHA384";
            case "SHA-512":
                return "RSA-SHA512";
            case "SHA3-256":
                return "RSA-SHA3-256";
            case "SHA3-384":
                return "RSA-SHA3-384";
            case "SHA3-512":
                return "RSA-SHA3-512";
            default:
                throw new OperationError("algorithm.hash: Is not recognized");
        }
    }
    static signRsa(algorithm, key, data) {
        const cryptoAlg = this.getCryptoAlgorithm(key.algorithm);
        const signer = crypto__default__default["default"].createSign(cryptoAlg);
        signer.update(Buffer.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        if (algorithm.name.toUpperCase() === "RSA-PSS") {
            options.padding = crypto__default__default["default"].constants.RSA_PKCS1_PSS_PADDING;
            options.saltLength = algorithm.saltLength;
        }
        const signature = signer.sign(options);
        return new Uint8Array(signature).buffer;
    }
    static verifySSA(algorithm, key, data, signature) {
        const cryptoAlg = this.getCryptoAlgorithm(key.algorithm);
        const signer = crypto__default__default["default"].createVerify(cryptoAlg);
        signer.update(Buffer.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        if (algorithm.name.toUpperCase() === "RSA-PSS") {
            options.padding = crypto__default__default["default"].constants.RSA_PKCS1_PSS_PADDING;
            options.saltLength = algorithm.saltLength;
        }
        const ok = signer.verify(options, signature);
        return ok;
    }
    static encryptOAEP(algorithm, key, data) {
        const options = {
            key: `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`,
            padding: crypto__default__default["default"].constants.RSA_PKCS1_OAEP_PADDING,
        };
        if (algorithm.label) ;
        return new Uint8Array(crypto__default__default["default"].publicEncrypt(options, data)).buffer;
    }
    static decryptOAEP(algorithm, key, data) {
        const options = {
            key: `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`,
            padding: crypto__default__default["default"].constants.RSA_PKCS1_OAEP_PADDING,
        };
        if (algorithm.label) ;
        return new Uint8Array(crypto__default__default["default"].privateDecrypt(options, data)).buffer;
    }
}
RsaCrypto.publicKeyUsages = ["verify", "encrypt", "wrapKey"];
RsaCrypto.privateKeyUsages = ["sign", "decrypt", "unwrapKey"];

class RsaSsaProvider extends RsaSsaProvider$1 {
    constructor() {
        super(...arguments);
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return RsaCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return RsaCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
}

class RsaPssProvider extends RsaPssProvider$1 {
    constructor() {
        super(...arguments);
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return RsaCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return RsaCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
}

class ShaCrypto {
    static size(algorithm) {
        switch (algorithm.name.toUpperCase()) {
            case "SHA-1":
                return 160;
            case "SHA-256":
            case "SHA3-256":
                return 256;
            case "SHA-384":
            case "SHA3-384":
                return 384;
            case "SHA-512":
            case "SHA3-512":
                return 512;
            default:
                throw new Error("Unrecognized name");
        }
    }
    static getAlgorithmName(algorithm) {
        switch (algorithm.name.toUpperCase()) {
            case "SHA-1":
                return "sha1";
            case "SHA-256":
                return "sha256";
            case "SHA-384":
                return "sha384";
            case "SHA-512":
                return "sha512";
            case "SHA3-256":
                return "sha3-256";
            case "SHA3-384":
                return "sha3-384";
            case "SHA3-512":
                return "sha3-512";
            default:
                throw new Error("Unrecognized name");
        }
    }
    static digest(algorithm, data) {
        const hashAlg = this.getAlgorithmName(algorithm);
        const hash = crypto__default__default["default"].createHash(hashAlg)
            .update(Buffer.from(data)).digest();
        return new Uint8Array(hash).buffer;
    }
}

class RsaOaepProvider extends RsaOaepProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onEncrypt(algorithm, key, data) {
        const internalKey = getCryptoKey(key);
        const dataView = new Uint8Array(data);
        const keySize = Math.ceil(internalKey.algorithm.modulusLength >> 3);
        const hashSize = ShaCrypto.size(internalKey.algorithm.hash) >> 3;
        const dataLength = dataView.byteLength;
        const psLength = keySize - dataLength - 2 * hashSize - 2;
        if (dataLength > keySize - 2 * hashSize - 2) {
            throw new Error("Data too large");
        }
        const message = new Uint8Array(keySize);
        const seed = message.subarray(1, hashSize + 1);
        const dataBlock = message.subarray(hashSize + 1);
        dataBlock.set(dataView, hashSize + psLength + 1);
        const labelHash = crypto__default__default["default"].createHash(internalKey.algorithm.hash.name.replace("-", ""))
            .update(BufferSourceConverter.toUint8Array(algorithm.label || new Uint8Array(0)))
            .digest();
        dataBlock.set(labelHash, 0);
        dataBlock[hashSize + psLength] = 1;
        crypto__default__default["default"].randomFillSync(seed);
        const dataBlockMask = this.mgf1(internalKey.algorithm.hash, seed, dataBlock.length);
        for (let i = 0; i < dataBlock.length; i++) {
            dataBlock[i] ^= dataBlockMask[i];
        }
        const seedMask = this.mgf1(internalKey.algorithm.hash, dataBlock, seed.length);
        for (let i = 0; i < seed.length; i++) {
            seed[i] ^= seedMask[i];
        }
        if (!internalKey.pem) {
            internalKey.pem = `-----BEGIN PUBLIC KEY-----\n${internalKey.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const pkcs0 = crypto__default__default["default"].publicEncrypt({
            key: internalKey.pem,
            padding: crypto__default__default["default"].constants.RSA_NO_PADDING,
        }, Buffer.from(message));
        return new Uint8Array(pkcs0).buffer;
    }
    async onDecrypt(algorithm, key, data) {
        const internalKey = getCryptoKey(key);
        const keySize = Math.ceil(internalKey.algorithm.modulusLength >> 3);
        const hashSize = ShaCrypto.size(internalKey.algorithm.hash) >> 3;
        const dataLength = data.byteLength;
        if (dataLength !== keySize) {
            throw new Error("Bad data");
        }
        if (!internalKey.pem) {
            internalKey.pem = `-----BEGIN PRIVATE KEY-----\n${internalKey.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        let pkcs0 = crypto__default__default["default"].privateDecrypt({
            key: internalKey.pem,
            padding: crypto__default__default["default"].constants.RSA_NO_PADDING,
        }, Buffer.from(data));
        const z = pkcs0[0];
        const seed = pkcs0.subarray(1, hashSize + 1);
        const dataBlock = pkcs0.subarray(hashSize + 1);
        if (z !== 0) {
            throw new Error("Decryption failed");
        }
        const seedMask = this.mgf1(internalKey.algorithm.hash, dataBlock, seed.length);
        for (let i = 0; i < seed.length; i++) {
            seed[i] ^= seedMask[i];
        }
        const dataBlockMask = this.mgf1(internalKey.algorithm.hash, seed, dataBlock.length);
        for (let i = 0; i < dataBlock.length; i++) {
            dataBlock[i] ^= dataBlockMask[i];
        }
        const labelHash = crypto__default__default["default"].createHash(internalKey.algorithm.hash.name.replace("-", ""))
            .update(BufferSourceConverter.toUint8Array(algorithm.label || new Uint8Array(0)))
            .digest();
        for (let i = 0; i < hashSize; i++) {
            if (labelHash[i] !== dataBlock[i]) {
                throw new Error("Decryption failed");
            }
        }
        let psEnd = hashSize;
        for (; psEnd < dataBlock.length; psEnd++) {
            const psz = dataBlock[psEnd];
            if (psz === 1) {
                break;
            }
            if (psz !== 0) {
                throw new Error("Decryption failed");
            }
        }
        if (psEnd === dataBlock.length) {
            throw new Error("Decryption failed");
        }
        pkcs0 = dataBlock.subarray(psEnd + 1);
        return new Uint8Array(pkcs0).buffer;
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
    mgf1(algorithm, seed, length = 0) {
        const hashSize = ShaCrypto.size(algorithm) >> 3;
        const mask = new Uint8Array(length);
        const counter = new Uint8Array(4);
        const chunks = Math.ceil(length / hashSize);
        for (let i = 0; i < chunks; i++) {
            counter[0] = i >>> 24;
            counter[1] = (i >>> 16) & 255;
            counter[2] = (i >>> 8) & 255;
            counter[3] = i & 255;
            const submask = mask.subarray(i * hashSize);
            let chunk = crypto__default__default["default"].createHash(algorithm.name.replace("-", ""))
                .update(seed)
                .update(counter)
                .digest();
            if (chunk.length > submask.length) {
                chunk = chunk.subarray(0, submask.length);
            }
            submask.set(chunk);
        }
        return mask;
    }
}

class RsaEsProvider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "RSAES-PKCS1-v1_5";
        this.usages = {
            publicKey: ["encrypt", "wrapKey"],
            privateKey: ["decrypt", "unwrapKey"],
        };
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await RsaCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    checkGenerateKeyParams(algorithm) {
        this.checkRequiredProperty(algorithm, "publicExponent");
        if (!(algorithm.publicExponent && algorithm.publicExponent instanceof Uint8Array)) {
            throw new TypeError("publicExponent: Missing or not a Uint8Array");
        }
        const publicExponent = Convert.ToBase64(algorithm.publicExponent);
        if (!(publicExponent === "Aw==" || publicExponent === "AQAB")) {
            throw new TypeError("publicExponent: Must be [3] or [1,0,1]");
        }
        this.checkRequiredProperty(algorithm, "modulusLength");
        switch (algorithm.modulusLength) {
            case 1024:
            case 2048:
            case 4096:
                break;
            default:
                throw new TypeError("modulusLength: Must be 1024, 2048, or 4096");
        }
    }
    async onEncrypt(algorithm, key, data) {
        const options = this.toCryptoOptions(key);
        const enc = crypto__default__namespace.publicEncrypt(options, new Uint8Array(data));
        return new Uint8Array(enc).buffer;
    }
    async onDecrypt(algorithm, key, data) {
        const options = this.toCryptoOptions(key);
        const dec = crypto__default__namespace.privateDecrypt(options, new Uint8Array(data));
        return new Uint8Array(dec).buffer;
    }
    async onExportKey(format, key) {
        return RsaCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await RsaCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof RsaPrivateKey || internalKey instanceof RsaPublicKey)) {
            throw new TypeError("key: Is not RSA CryptoKey");
        }
    }
    toCryptoOptions(key) {
        const type = key.type.toUpperCase();
        return {
            key: `-----BEGIN ${type} KEY-----\n${getCryptoKey(key).data.toString("base64")}\n-----END ${type} KEY-----`,
            padding: crypto__default__namespace.constants.RSA_PKCS1_PADDING,
        };
    }
}

const namedOIDs = {
    "1.2.840.10045.3.1.7": "P-256",
    "P-256": "1.2.840.10045.3.1.7",
    "1.3.132.0.34": "P-384",
    "P-384": "1.3.132.0.34",
    "1.3.132.0.35": "P-521",
    "P-521": "1.3.132.0.35",
    "1.3.132.0.10": "K-256",
    "K-256": "1.3.132.0.10",
    "brainpoolP160r1": "1.3.36.3.3.2.8.1.1.1",
    "1.3.36.3.3.2.8.1.1.1": "brainpoolP160r1",
    "brainpoolP160t1": "1.3.36.3.3.2.8.1.1.2",
    "1.3.36.3.3.2.8.1.1.2": "brainpoolP160t1",
    "brainpoolP192r1": "1.3.36.3.3.2.8.1.1.3",
    "1.3.36.3.3.2.8.1.1.3": "brainpoolP192r1",
    "brainpoolP192t1": "1.3.36.3.3.2.8.1.1.4",
    "1.3.36.3.3.2.8.1.1.4": "brainpoolP192t1",
    "brainpoolP224r1": "1.3.36.3.3.2.8.1.1.5",
    "1.3.36.3.3.2.8.1.1.5": "brainpoolP224r1",
    "brainpoolP224t1": "1.3.36.3.3.2.8.1.1.6",
    "1.3.36.3.3.2.8.1.1.6": "brainpoolP224t1",
    "brainpoolP256r1": "1.3.36.3.3.2.8.1.1.7",
    "1.3.36.3.3.2.8.1.1.7": "brainpoolP256r1",
    "brainpoolP256t1": "1.3.36.3.3.2.8.1.1.8",
    "1.3.36.3.3.2.8.1.1.8": "brainpoolP256t1",
    "brainpoolP320r1": "1.3.36.3.3.2.8.1.1.9",
    "1.3.36.3.3.2.8.1.1.9": "brainpoolP320r1",
    "brainpoolP320t1": "1.3.36.3.3.2.8.1.1.10",
    "1.3.36.3.3.2.8.1.1.10": "brainpoolP320t1",
    "brainpoolP384r1": "1.3.36.3.3.2.8.1.1.11",
    "1.3.36.3.3.2.8.1.1.11": "brainpoolP384r1",
    "brainpoolP384t1": "1.3.36.3.3.2.8.1.1.12",
    "1.3.36.3.3.2.8.1.1.12": "brainpoolP384t1",
    "brainpoolP512r1": "1.3.36.3.3.2.8.1.1.13",
    "1.3.36.3.3.2.8.1.1.13": "brainpoolP512r1",
    "brainpoolP512t1": "1.3.36.3.3.2.8.1.1.14",
    "1.3.36.3.3.2.8.1.1.14": "brainpoolP512t1",
};
function getOidByNamedCurve$1(namedCurve) {
    const oid = namedOIDs[namedCurve];
    if (!oid) {
        throw new OperationError(`Cannot convert WebCrypto named curve '${namedCurve}' to OID`);
    }
    return oid;
}

class EcPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, index$1.EcPrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "EC",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.privateKeyAlgorithm.parameters = AsnSerializer.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(json.crv)));
        const key = JsonParser.fromJSON(json, { targetSchema: index$1.EcPrivateKey });
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EcPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PublicKeyInfo);
        return new index$1.EcPublicKey(keyInfo.publicKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "EC",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const key = JsonParser.fromJSON(json, { targetSchema: index$1.EcPublicKey });
        const keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.publicKeyAlgorithm.parameters = AsnSerializer.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(json.crv)));
        keyInfo.publicKey = AsnSerializer.toASN(key).valueHex;
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class Sha1Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-1";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha256Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-256";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha384Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-384";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha512Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA-512";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3256Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-256";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3384Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-384";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class Sha3512Provider extends ProviderCrypto {
    constructor() {
        super(...arguments);
        this.name = "SHA3-512";
        this.usages = [];
    }
    async onDigest(algorithm, data) {
        return ShaCrypto.digest(algorithm, data);
    }
}

class EcCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new EcPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new EcPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const keys = crypto__default__default["default"].generateKeyPairSync("ec", {
            namedCurve: this.getOpenSSLNamedCurve(algorithm.namedCurve),
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async sign(algorithm, key, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(algorithm.hash);
        const signer = crypto__default__default["default"].createSign(cryptoAlg);
        signer.update(Buffer.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const signature = signer.sign(options);
        const ecSignature = AsnParser.parse(signature, index$1.EcDsaSignature);
        const signatureRaw = EcUtils.encodeSignature(ecSignature, EcCurves.get(key.algorithm.namedCurve).size);
        return signatureRaw.buffer;
    }
    static async verify(algorithm, key, signature, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(algorithm.hash);
        const signer = crypto__default__default["default"].createVerify(cryptoAlg);
        signer.update(Buffer.from(data));
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const ecSignature = new index$1.EcDsaSignature();
        const namedCurve = EcCurves.get(key.algorithm.namedCurve);
        const signaturePoint = EcUtils.decodeSignature(signature, namedCurve.size);
        ecSignature.r = BufferSourceConverter.toArrayBuffer(signaturePoint.r);
        ecSignature.s = BufferSourceConverter.toArrayBuffer(signaturePoint.s);
        const ecSignatureRaw = Buffer.from(AsnSerializer.serialize(ecSignature));
        const ok = signer.verify(options, ecSignatureRaw);
        return ok;
    }
    static async deriveBits(algorithm, baseKey, length) {
        const cryptoAlg = this.getOpenSSLNamedCurve(baseKey.algorithm.namedCurve);
        const ecdh = crypto__default__default["default"].createECDH(cryptoAlg);
        const asnPrivateKey = AsnParser.parse(baseKey.data, index$1.PrivateKeyInfo);
        const asnEcPrivateKey = AsnParser.parse(asnPrivateKey.privateKey, index$1.EcPrivateKey);
        ecdh.setPrivateKey(Buffer.from(asnEcPrivateKey.privateKey));
        const asnPublicKey = AsnParser.parse(algorithm.public.data, index$1.PublicKeyInfo);
        const bits = ecdh.computeSecret(Buffer.from(asnPublicKey.publicKey));
        return new Uint8Array(bits).buffer.slice(0, length >> 3);
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            case "raw": {
                const publicKeyInfo = AsnParser.parse(key.data, index$1.PublicKeyInfo);
                return publicKeyInfo.publicKey;
            }
            default:
                throw new OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: index$1.EcPrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: index$1.EcPublicKey });
                    return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
                }
            }
            case "raw": {
                const asnKey = new index$1.EcPublicKey(keyData);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PublicKeyInfo);
                const asnKey = new index$1.EcPublicKey(keyInfo.publicKey);
                this.assertKeyParameters(keyInfo.publicKeyAlgorithm.parameters, algorithm.namedCurve);
                return this.importPublicKey(asnKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, index$1.EcPrivateKey);
                this.assertKeyParameters(keyInfo.privateKeyAlgorithm.parameters, algorithm.namedCurve);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
        }
    }
    static assertKeyParameters(parameters, namedCurve) {
        if (!parameters) {
            throw new CryptoError("Key info doesn't have required parameters");
        }
        let namedCurveIdentifier = "";
        try {
            namedCurveIdentifier = AsnParser.parse(parameters, index$1.ObjectIdentifier).value;
        }
        catch (e) {
            throw new CryptoError("Cannot read key info parameters");
        }
        if (getOidByNamedCurve$1(namedCurve) !== namedCurveIdentifier) {
            throw new CryptoError("Key info parameter doesn't match to named curve");
        }
    }
    static async importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        keyInfo.privateKeyAlgorithm.parameters = AsnSerializer.serialize(new index$1.ObjectIdentifier(getOidByNamedCurve$1(algorithm.namedCurve)));
        keyInfo.privateKey = AsnSerializer.serialize(asnKey);
        const key = new EcPrivateKey();
        key.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = "1.2.840.10045.2.1";
        const namedCurve = getOidByNamedCurve$1(algorithm.namedCurve);
        keyInfo.publicKeyAlgorithm.parameters = AsnSerializer.serialize(new index$1.ObjectIdentifier(namedCurve));
        keyInfo.publicKey = asnKey.value;
        const key = new EcPublicKey();
        key.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static getOpenSSLNamedCurve(curve) {
        switch (curve.toUpperCase()) {
            case "P-256":
                return "prime256v1";
            case "K-256":
                return "secp256k1";
            case "P-384":
                return "secp384r1";
            case "P-521":
                return "secp521r1";
            default:
                return curve;
        }
    }
}
EcCrypto.publicKeyUsages = ["verify"];
EcCrypto.privateKeyUsages = ["sign", "deriveKey", "deriveBits"];

class EcdsaProvider extends EcdsaProvider$1 {
    constructor() {
        super(...arguments);
        this.namedCurves = EcCurves.names;
        this.hashAlgorithms = [
            "SHA-1", "SHA-256", "SHA-384", "SHA-512",
            "shake128", "shake256",
            "SHA3-256", "SHA3-384", "SHA3-512"
        ];
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EcCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return EcCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return EcCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return EcCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EcCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof EcPrivateKey || internalKey instanceof EcPublicKey)) {
            throw new TypeError("key: Is not EC CryptoKey");
        }
    }
}

class EcdhProvider extends EcdhProvider$1 {
    constructor() {
        super(...arguments);
        this.namedCurves = EcCurves.names;
    }
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EcCrypto.generateKey({
            ...algorithm,
            name: this.name,
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onExportKey(format, key) {
        return EcCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EcCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        const internalKey = getCryptoKey(key);
        if (!(internalKey instanceof EcPrivateKey || internalKey instanceof EcPublicKey)) {
            throw new TypeError("key: Is not EC CryptoKey");
        }
    }
    async onDeriveBits(algorithm, baseKey, length) {
        const bits = await EcCrypto.deriveBits({ ...algorithm, public: getCryptoKey(algorithm.public) }, getCryptoKey(baseKey), length);
        return bits;
    }
}

const edOIDs = {
    [index$1.idEd448]: "Ed448",
    "ed448": index$1.idEd448,
    [index$1.idX448]: "X448",
    "x448": index$1.idX448,
    [index$1.idEd25519]: "Ed25519",
    "ed25519": index$1.idEd25519,
    [index$1.idX25519]: "X25519",
    "x25519": index$1.idX25519,
};
function getOidByNamedCurve(namedCurve) {
    const oid = edOIDs[namedCurve.toLowerCase()];
    if (!oid) {
        throw new OperationError(`Cannot convert WebCrypto named curve '${namedCurve}' to OID`);
    }
    return oid;
}

class EdPrivateKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "private";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PrivateKeyInfo);
        return AsnParser.parse(keyInfo.privateKey, index$1.CurvePrivateKey);
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "OKP",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, JsonSerializer.toJSON(key));
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        const keyInfo = new index$1.PrivateKeyInfo();
        keyInfo.privateKeyAlgorithm.algorithm = getOidByNamedCurve(json.crv);
        const key = JsonParser.fromJSON(json, { targetSchema: index$1.CurvePrivateKey });
        keyInfo.privateKey = AsnSerializer.serialize(key);
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EdPublicKey extends AsymmetricKey {
    constructor() {
        super(...arguments);
        this.type = "public";
    }
    getKey() {
        const keyInfo = AsnParser.parse(this.data, index$1.PublicKeyInfo);
        return keyInfo.publicKey;
    }
    toJSON() {
        const key = this.getKey();
        const json = {
            kty: "OKP",
            crv: this.algorithm.namedCurve,
            key_ops: this.usages,
            ext: this.extractable,
        };
        return Object.assign(json, {
            x: Convert.ToBase64Url(key)
        });
    }
    fromJSON(json) {
        if (!json.crv) {
            throw new OperationError(`Cannot get named curve from JWK. Property 'crv' is required`);
        }
        if (!json.x) {
            throw new OperationError(`Cannot get property from JWK. Property 'x' is required`);
        }
        const keyInfo = new index$1.PublicKeyInfo();
        keyInfo.publicKeyAlgorithm.algorithm = getOidByNamedCurve(json.crv);
        keyInfo.publicKey = Convert.FromBase64Url(json.x);
        this.data = Buffer.from(AsnSerializer.serialize(keyInfo));
        return this;
    }
}

class EdCrypto {
    static async generateKey(algorithm, extractable, keyUsages) {
        const privateKey = new EdPrivateKey();
        privateKey.algorithm = algorithm;
        privateKey.extractable = extractable;
        privateKey.usages = keyUsages.filter((usage) => this.privateKeyUsages.indexOf(usage) !== -1);
        const publicKey = new EdPublicKey();
        publicKey.algorithm = algorithm;
        publicKey.extractable = true;
        publicKey.usages = keyUsages.filter((usage) => this.publicKeyUsages.indexOf(usage) !== -1);
        const type = algorithm.namedCurve.toLowerCase();
        const keys = crypto__default__default["default"].generateKeyPairSync(type, {
            publicKeyEncoding: {
                format: "der",
                type: "spki",
            },
            privateKeyEncoding: {
                format: "der",
                type: "pkcs8",
            },
        });
        privateKey.data = keys.privateKey;
        publicKey.data = keys.publicKey;
        const res = {
            privateKey,
            publicKey,
        };
        return res;
    }
    static async sign(algorithm, key, data) {
        if (!key.pem) {
            key.pem = `-----BEGIN PRIVATE KEY-----\n${key.data.toString("base64")}\n-----END PRIVATE KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const signature = crypto__default__default["default"].sign(null, Buffer.from(data), options);
        return BufferSourceConverter.toArrayBuffer(signature);
    }
    static async verify(algorithm, key, signature, data) {
        if (!key.pem) {
            key.pem = `-----BEGIN PUBLIC KEY-----\n${key.data.toString("base64")}\n-----END PUBLIC KEY-----`;
        }
        const options = {
            key: key.pem,
        };
        const ok = crypto__default__default["default"].verify(null, Buffer.from(data), options, Buffer.from(signature));
        return ok;
    }
    static async deriveBits(algorithm, baseKey, length) {
        const publicKey = crypto__default__default["default"].createPublicKey({
            key: algorithm.public.data,
            format: "der",
            type: "spki",
        });
        const privateKey = crypto__default__default["default"].createPrivateKey({
            key: baseKey.data,
            format: "der",
            type: "pkcs8",
        });
        const bits = crypto__default__default["default"].diffieHellman({
            publicKey,
            privateKey,
        });
        return new Uint8Array(bits).buffer.slice(0, length >> 3);
    }
    static async exportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(key);
            case "pkcs8":
            case "spki":
                return new Uint8Array(key.data).buffer;
            case "raw": {
                const publicKeyInfo = AsnParser.parse(key.data, index$1.PublicKeyInfo);
                return publicKeyInfo.publicKey;
            }
            default:
                throw new OperationError("format: Must be 'jwk', 'raw', pkcs8' or 'spki'");
        }
    }
    static async importKey(format, keyData, algorithm, extractable, keyUsages) {
        switch (format.toLowerCase()) {
            case "jwk": {
                const jwk = keyData;
                if (jwk.d) {
                    const asnKey = JsonParser.fromJSON(keyData, { targetSchema: index$1.CurvePrivateKey });
                    return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
                }
                else {
                    if (!jwk.x) {
                        throw new TypeError("keyData: Cannot get required 'x' filed");
                    }
                    return this.importPublicKey(Convert.FromBase64Url(jwk.x), algorithm, extractable, keyUsages);
                }
            }
            case "raw": {
                return this.importPublicKey(keyData, algorithm, extractable, keyUsages);
            }
            case "spki": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PublicKeyInfo);
                return this.importPublicKey(keyInfo.publicKey, algorithm, extractable, keyUsages);
            }
            case "pkcs8": {
                const keyInfo = AsnParser.parse(new Uint8Array(keyData), index$1.PrivateKeyInfo);
                const asnKey = AsnParser.parse(keyInfo.privateKey, index$1.CurvePrivateKey);
                return this.importPrivateKey(asnKey, algorithm, extractable, keyUsages);
            }
            default:
                throw new OperationError("format: Must be 'jwk', 'raw', 'pkcs8' or 'spki'");
        }
    }
    static importPrivateKey(asnKey, algorithm, extractable, keyUsages) {
        const key = new EdPrivateKey();
        key.fromJSON({
            crv: algorithm.namedCurve,
            d: Convert.ToBase64Url(asnKey.d),
        });
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
    static async importPublicKey(asnKey, algorithm, extractable, keyUsages) {
        const key = new EdPublicKey();
        key.fromJSON({
            crv: algorithm.namedCurve,
            x: Convert.ToBase64Url(asnKey),
        });
        key.algorithm = Object.assign({}, algorithm);
        key.extractable = extractable;
        key.usages = keyUsages;
        return key;
    }
}
EdCrypto.publicKeyUsages = ["verify"];
EdCrypto.privateKeyUsages = ["sign", "deriveKey", "deriveBits"];

class EdDsaProvider extends EdDsaProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EdCrypto.generateKey({
            name: this.name,
            namedCurve: algorithm.namedCurve.replace(/^ed/i, "Ed"),
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onSign(algorithm, key, data) {
        return EdCrypto.sign(algorithm, getCryptoKey(key), new Uint8Array(data));
    }
    async onVerify(algorithm, key, signature, data) {
        return EdCrypto.verify(algorithm, getCryptoKey(key), new Uint8Array(signature), new Uint8Array(data));
    }
    async onExportKey(format, key) {
        return EdCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EdCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
}

class EcdhEsProvider extends EcdhEsProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const keys = await EdCrypto.generateKey({
            name: this.name,
            namedCurve: algorithm.namedCurve.toUpperCase(),
        }, extractable, keyUsages);
        return {
            privateKey: setCryptoKey(keys.privateKey),
            publicKey: setCryptoKey(keys.publicKey),
        };
    }
    async onDeriveBits(algorithm, baseKey, length) {
        const bits = await EdCrypto.deriveBits({ ...algorithm, public: getCryptoKey(algorithm.public) }, getCryptoKey(baseKey), length);
        return bits;
    }
    async onExportKey(format, key) {
        return EdCrypto.exportKey(format, getCryptoKey(key));
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        const key = await EdCrypto.importKey(format, keyData, { ...algorithm, name: this.name }, extractable, keyUsages);
        return setCryptoKey(key);
    }
}

class PbkdfCryptoKey extends CryptoKey {
}

class Pbkdf2Provider extends Pbkdf2Provider$1 {
    async onDeriveBits(algorithm, baseKey, length) {
        return new Promise((resolve, reject) => {
            const salt = BufferSourceConverter.toArrayBuffer(algorithm.salt);
            const hash = algorithm.hash.name.replace("-", "");
            crypto__default__default["default"].pbkdf2(getCryptoKey(baseKey).data, Buffer.from(salt), algorithm.iterations, length >> 3, hash, (err, derivedBits) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(new Uint8Array(derivedBits).buffer);
                }
            });
        });
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        if (format === "raw") {
            const key = new PbkdfCryptoKey();
            key.data = Buffer.from(keyData);
            key.algorithm = { name: this.name };
            key.extractable = false;
            key.usages = keyUsages;
            return setCryptoKey(key);
        }
        throw new OperationError("format: Must be 'raw'");
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof PbkdfCryptoKey)) {
            throw new TypeError("key: Is not PBKDF CryptoKey");
        }
    }
}

class HmacCryptoKey extends CryptoKey {
    get alg() {
        const hash = this.algorithm.hash.name.toUpperCase();
        return `HS${hash.replace("SHA-", "")}`;
    }
    set alg(value) {
    }
}
__decorate([
    JsonProp({ name: "k", converter: JsonBase64UrlConverter })
], HmacCryptoKey.prototype, "data", void 0);

class HmacProvider extends HmacProvider$1 {
    async onGenerateKey(algorithm, extractable, keyUsages) {
        const length = (algorithm.length || this.getDefaultLength(algorithm.hash.name)) >> 3 << 3;
        const key = new HmacCryptoKey();
        key.algorithm = {
            ...algorithm,
            length,
            name: this.name,
        };
        key.extractable = extractable;
        key.usages = keyUsages;
        key.data = crypto__default__default["default"].randomBytes(length >> 3);
        return setCryptoKey(key);
    }
    async onSign(algorithm, key, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
        const hmac = crypto__default__default["default"].createHmac(cryptoAlg, getCryptoKey(key).data)
            .update(Buffer.from(data)).digest();
        return new Uint8Array(hmac).buffer;
    }
    async onVerify(algorithm, key, signature, data) {
        const cryptoAlg = ShaCrypto.getAlgorithmName(key.algorithm.hash);
        const hmac = crypto__default__default["default"].createHmac(cryptoAlg, getCryptoKey(key).data)
            .update(Buffer.from(data)).digest();
        return hmac.compare(Buffer.from(signature)) === 0;
    }
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        let key;
        switch (format.toLowerCase()) {
            case "jwk":
                key = JsonParser.fromJSON(keyData, { targetSchema: HmacCryptoKey });
                break;
            case "raw":
                key = new HmacCryptoKey();
                key.data = Buffer.from(keyData);
                break;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
        key.algorithm = {
            hash: { name: algorithm.hash.name },
            name: this.name,
            length: key.data.length << 3,
        };
        key.extractable = extractable;
        key.usages = keyUsages;
        return setCryptoKey(key);
    }
    async onExportKey(format, key) {
        switch (format.toLowerCase()) {
            case "jwk":
                return JsonSerializer.toJSON(getCryptoKey(key));
            case "raw":
                return new Uint8Array(getCryptoKey(key).data).buffer;
            default:
                throw new OperationError("format: Must be 'jwk' or 'raw'");
        }
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof HmacCryptoKey)) {
            throw new TypeError("key: Is not HMAC CryptoKey");
        }
    }
}

class HkdfCryptoKey extends CryptoKey {
}

class HkdfProvider extends HkdfProvider$1 {
    async onImportKey(format, keyData, algorithm, extractable, keyUsages) {
        if (format.toLowerCase() !== "raw") {
            throw new OperationError("Operation not supported");
        }
        const key = new HkdfCryptoKey();
        key.data = Buffer.from(keyData);
        key.algorithm = { name: this.name };
        key.extractable = extractable;
        key.usages = keyUsages;
        return setCryptoKey(key);
    }
    async onDeriveBits(params, baseKey, length) {
        const hash = params.hash.name.replace("-", "");
        const hashLength = crypto__default__default["default"].createHash(hash).digest().length;
        const byteLength = length / 8;
        const info = BufferSourceConverter.toUint8Array(params.info);
        const PRK = crypto__default__default["default"].createHmac(hash, BufferSourceConverter.toUint8Array(params.salt))
            .update(BufferSourceConverter.toUint8Array(getCryptoKey(baseKey).data))
            .digest();
        const blocks = [Buffer.alloc(0)];
        const blockCount = Math.ceil(byteLength / hashLength) + 1;
        for (let i = 1; i < blockCount; ++i) {
            blocks.push(crypto__default__default["default"].createHmac(hash, PRK)
                .update(Buffer.concat([blocks[i - 1], info, Buffer.from([i])]))
                .digest());
        }
        return Buffer.concat(blocks).slice(0, byteLength);
    }
    checkCryptoKey(key, keyUsage) {
        super.checkCryptoKey(key, keyUsage);
        if (!(getCryptoKey(key) instanceof HkdfCryptoKey)) {
            throw new TypeError("key: Is not HKDF CryptoKey");
        }
    }
}

class ShakeCrypto {
    static digest(algorithm, data) {
        const hash = crypto__default__default["default"].createHash(algorithm.name.toLowerCase(), { outputLength: algorithm.length })
            .update(Buffer.from(data)).digest();
        return new Uint8Array(hash).buffer;
    }
}

class Shake128Provider extends Shake128Provider$1 {
    async onDigest(algorithm, data) {
        return ShakeCrypto.digest(algorithm, data);
    }
}

class Shake256Provider extends Shake256Provider$1 {
    async onDigest(algorithm, data) {
        return ShakeCrypto.digest(algorithm, data);
    }
}

class SubtleCrypto extends SubtleCrypto$1 {
    constructor() {
        var _a;
        super();
        this.providers.set(new AesCbcProvider());
        this.providers.set(new AesCtrProvider());
        this.providers.set(new AesGcmProvider());
        this.providers.set(new AesCmacProvider());
        this.providers.set(new AesKwProvider());
        this.providers.set(new AesEcbProvider());
        this.providers.set(new DesCbcProvider());
        this.providers.set(new DesEde3CbcProvider());
        this.providers.set(new RsaSsaProvider());
        this.providers.set(new RsaPssProvider());
        this.providers.set(new RsaOaepProvider());
        this.providers.set(new RsaEsProvider());
        this.providers.set(new EcdsaProvider());
        this.providers.set(new EcdhProvider());
        this.providers.set(new Sha1Provider());
        this.providers.set(new Sha256Provider());
        this.providers.set(new Sha384Provider());
        this.providers.set(new Sha512Provider());
        this.providers.set(new Pbkdf2Provider());
        this.providers.set(new HmacProvider());
        this.providers.set(new HkdfProvider());
        const nodeMajorVersion = (_a = /^v(\d+)/.exec(process__namespace.version)) === null || _a === void 0 ? void 0 : _a[1];
        if (nodeMajorVersion && parseInt(nodeMajorVersion, 10) >= 12) {
            this.providers.set(new Shake128Provider());
            this.providers.set(new Shake256Provider());
        }
        const hashes = crypto__default__namespace.getHashes();
        if (hashes.includes("sha3-256")) {
            this.providers.set(new Sha3256Provider());
        }
        if (hashes.includes("sha3-384")) {
            this.providers.set(new Sha3384Provider());
        }
        if (hashes.includes("sha3-512")) {
            this.providers.set(new Sha3512Provider());
        }
        if (nodeMajorVersion && parseInt(nodeMajorVersion, 10) >= 14) {
            this.providers.set(new EdDsaProvider());
            this.providers.set(new EcdhEsProvider());
        }
    }
}

class Crypto extends Crypto$1 {
    constructor() {
        super(...arguments);
        this.subtle = new SubtleCrypto();
    }
    getRandomValues(array) {
        if (!ArrayBuffer.isView(array)) {
            throw new TypeError("Failed to execute 'getRandomValues' on 'Crypto': parameter 1 is not of type 'ArrayBufferView'");
        }
        const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
        crypto__default__default["default"].randomFillSync(buffer);
        return array;
    }
}

async function patchFetch() {
  Ratchet.useCrypto(Crypto, CryptoKey$1);
  const client = new RatchetClient(
    {
      id: 100,
      host: "localhost:3000",
      namespace: "client_test",
    },
    ExpoStorage
  );
  client.patchFetch();
}

async function onMessage(args, webview, host) {
  const client = new RatchetClient(
    {
      id: 100,
      host,
      namespace: "client_test",
    },
    ExpoStorage
  );

  const body = await client.encryptFetch(args[0], args[1]);
  const config = {
    method: "POST",
    body,
  };
  const outer = await fetch(`http://${host}`, config);
  const outerb = await outer.arrayBuffer();
  const innerb = await client.decryptFetchResponse(Buffer.from(outerb));
  const resp = decode(Buffer.from(innerb));
  console.log("decrypted response", resp);

  webview.injectJavaScript(
    `window.postMessage(\`${JSON.stringify({
      options: resp.json,
      body: Buffer.from(resp.body).toString("base64"),
    })}\`);true;`
  );
}

exports.onMessage = onMessage;
exports.patchFetch = patchFetch;
