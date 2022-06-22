(function () {
  'use strict';

  var global$2 = (typeof global$1 !== "undefined" ? global$1 :
    typeof self !== "undefined" ? self :
    typeof window !== "undefined" ? window : {});

  var global$1 = (typeof global$2 !== "undefined" ? global$2 :
              typeof self !== "undefined" ? self :
              typeof window !== "undefined" ? window : {});

  var lookup$1 = [];
  var revLookup$1 = [];
  var Arr$1 = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
  var inited = false;
  function init$1 () {
    inited = true;
    var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (var i = 0, len = code.length; i < len; ++i) {
      lookup$1[i] = code[i];
      revLookup$1[code.charCodeAt(i)] = i;
    }

    revLookup$1['-'.charCodeAt(0)] = 62;
    revLookup$1['_'.charCodeAt(0)] = 63;
  }

  function toByteArray$1 (b64) {
    if (!inited) {
      init$1();
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
    arr = new Arr$1(len * 3 / 4 - placeHolders);

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? len - 4 : len;

    var L = 0;

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (revLookup$1[b64.charCodeAt(i)] << 18) | (revLookup$1[b64.charCodeAt(i + 1)] << 12) | (revLookup$1[b64.charCodeAt(i + 2)] << 6) | revLookup$1[b64.charCodeAt(i + 3)];
      arr[L++] = (tmp >> 16) & 0xFF;
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    if (placeHolders === 2) {
      tmp = (revLookup$1[b64.charCodeAt(i)] << 2) | (revLookup$1[b64.charCodeAt(i + 1)] >> 4);
      arr[L++] = tmp & 0xFF;
    } else if (placeHolders === 1) {
      tmp = (revLookup$1[b64.charCodeAt(i)] << 10) | (revLookup$1[b64.charCodeAt(i + 1)] << 4) | (revLookup$1[b64.charCodeAt(i + 2)] >> 2);
      arr[L++] = (tmp >> 8) & 0xFF;
      arr[L++] = tmp & 0xFF;
    }

    return arr
  }

  function tripletToBase64$1 (num) {
    return lookup$1[num >> 18 & 0x3F] + lookup$1[num >> 12 & 0x3F] + lookup$1[num >> 6 & 0x3F] + lookup$1[num & 0x3F]
  }

  function encodeChunk$1 (uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
      output.push(tripletToBase64$1(tmp));
    }
    return output.join('')
  }

  function fromByteArray$1 (uint8) {
    if (!inited) {
      init$1();
    }
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var output = '';
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk$1(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      output += lookup$1[tmp >> 2];
      output += lookup$1[(tmp << 4) & 0x3F];
      output += '==';
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
      output += lookup$1[tmp >> 10];
      output += lookup$1[(tmp >> 4) & 0x3F];
      output += lookup$1[(tmp << 2) & 0x3F];
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

  var isArray$2 = Array.isArray || function (arr) {
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
  Buffer$1.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
    ? global$1.TYPED_ARRAY_SUPPORT
    : true;

  /*
   * Export kMaxLength after typed array support is determined.
   */
  kMaxLength();

  function kMaxLength () {
    return Buffer$1.TYPED_ARRAY_SUPPORT
      ? 0x7fffffff
      : 0x3fffffff
  }

  function createBuffer (that, length) {
    if (kMaxLength() < length) {
      throw new RangeError('Invalid typed array length')
    }
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = new Uint8Array(length);
      that.__proto__ = Buffer$1.prototype;
    } else {
      // Fallback: Return an object instance of the Buffer class
      if (that === null) {
        that = new Buffer$1(length);
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

  function Buffer$1 (arg, encodingOrOffset, length) {
    if (!Buffer$1.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$1)) {
      return new Buffer$1(arg, encodingOrOffset, length)
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

  Buffer$1.poolSize = 8192; // not used by this implementation

  // TODO: Legacy, not needed anymore. Remove in next major version.
  Buffer$1._augment = function (arr) {
    arr.__proto__ = Buffer$1.prototype;
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
  Buffer$1.from = function (value, encodingOrOffset, length) {
    return from(null, value, encodingOrOffset, length)
  };

  if (Buffer$1.TYPED_ARRAY_SUPPORT) {
    Buffer$1.prototype.__proto__ = Uint8Array.prototype;
    Buffer$1.__proto__ = Uint8Array;
    if (typeof Symbol !== 'undefined' && Symbol.species &&
        Buffer$1[Symbol.species] === Buffer$1) ;
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
  Buffer$1.alloc = function (size, fill, encoding) {
    return alloc(null, size, fill, encoding)
  };

  function allocUnsafe (that, size) {
    assertSize(size);
    that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) {
      for (var i = 0; i < size; ++i) {
        that[i] = 0;
      }
    }
    return that
  }

  /**
   * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
   * */
  Buffer$1.allocUnsafe = function (size) {
    return allocUnsafe(null, size)
  };
  /**
   * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
   */
  Buffer$1.allocUnsafeSlow = function (size) {
    return allocUnsafe(null, size)
  };

  function fromString (that, string, encoding) {
    if (typeof encoding !== 'string' || encoding === '') {
      encoding = 'utf8';
    }

    if (!Buffer$1.isEncoding(encoding)) {
      throw new TypeError('"encoding" must be a valid string encoding')
    }

    var length = byteLength$1(string, encoding) | 0;
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

    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      // Return an augmented `Uint8Array` instance, for best performance
      that = array;
      that.__proto__ = Buffer$1.prototype;
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

      if (obj.type === 'Buffer' && isArray$2(obj.data)) {
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
  Buffer$1.isBuffer = isBuffer;
  function internalIsBuffer (b) {
    return !!(b != null && b._isBuffer)
  }

  Buffer$1.compare = function compare (a, b) {
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

  Buffer$1.isEncoding = function isEncoding (encoding) {
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

  Buffer$1.concat = function concat (list, length) {
    if (!isArray$2(list)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }

    if (list.length === 0) {
      return Buffer$1.alloc(0)
    }

    var i;
    if (length === undefined) {
      length = 0;
      for (i = 0; i < list.length; ++i) {
        length += list[i].length;
      }
    }

    var buffer = Buffer$1.allocUnsafe(length);
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

  function byteLength$1 (string, encoding) {
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
  Buffer$1.byteLength = byteLength$1;

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
  Buffer$1.prototype._isBuffer = true;

  function swap (b, n, m) {
    var i = b[n];
    b[n] = b[m];
    b[m] = i;
  }

  Buffer$1.prototype.swap16 = function swap16 () {
    var len = this.length;
    if (len % 2 !== 0) {
      throw new RangeError('Buffer size must be a multiple of 16-bits')
    }
    for (var i = 0; i < len; i += 2) {
      swap(this, i, i + 1);
    }
    return this
  };

  Buffer$1.prototype.swap32 = function swap32 () {
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

  Buffer$1.prototype.swap64 = function swap64 () {
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

  Buffer$1.prototype.toString = function toString () {
    var length = this.length | 0;
    if (length === 0) return ''
    if (arguments.length === 0) return utf8Slice(this, 0, length)
    return slowToString.apply(this, arguments)
  };

  Buffer$1.prototype.equals = function equals (b) {
    if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
    if (this === b) return true
    return Buffer$1.compare(this, b) === 0
  };

  Buffer$1.prototype.inspect = function inspect () {
    var str = '';
    var max = INSPECT_MAX_BYTES;
    if (this.length > 0) {
      str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
      if (this.length > max) str += ' ... ';
    }
    return '<Buffer ' + str + '>'
  };

  Buffer$1.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
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
      val = Buffer$1.from(val, encoding);
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
      if (Buffer$1.TYPED_ARRAY_SUPPORT &&
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

  Buffer$1.prototype.includes = function includes (val, byteOffset, encoding) {
    return this.indexOf(val, byteOffset, encoding) !== -1
  };

  Buffer$1.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
    return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
  };

  Buffer$1.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
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

  Buffer$1.prototype.write = function write (string, offset, length, encoding) {
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

  Buffer$1.prototype.toJSON = function toJSON () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  };

  function base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return fromByteArray$1(buf)
    } else {
      return fromByteArray$1(buf.slice(start, end))
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

  Buffer$1.prototype.slice = function slice (start, end) {
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
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      newBuf = this.subarray(start, end);
      newBuf.__proto__ = Buffer$1.prototype;
    } else {
      var sliceLen = end - start;
      newBuf = new Buffer$1(sliceLen, undefined);
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

  Buffer$1.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
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

  Buffer$1.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
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

  Buffer$1.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    return this[offset]
  };

  Buffer$1.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return this[offset] | (this[offset + 1] << 8)
  };

  Buffer$1.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    return (this[offset] << 8) | this[offset + 1]
  };

  Buffer$1.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return ((this[offset]) |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16)) +
        (this[offset + 3] * 0x1000000)
  };

  Buffer$1.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
  };

  Buffer$1.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
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

  Buffer$1.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
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

  Buffer$1.prototype.readInt8 = function readInt8 (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 1, this.length);
    if (!(this[offset] & 0x80)) return (this[offset])
    return ((0xff - this[offset] + 1) * -1)
  };

  Buffer$1.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset] | (this[offset + 1] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer$1.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 2, this.length);
    var val = this[offset + 1] | (this[offset] << 8);
    return (val & 0x8000) ? val | 0xFFFF0000 : val
  };

  Buffer$1.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
  };

  Buffer$1.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);

    return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
  };

  Buffer$1.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, true, 23, 4)
  };

  Buffer$1.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 4, this.length);
    return read(this, offset, false, 23, 4)
  };

  Buffer$1.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, true, 52, 8)
  };

  Buffer$1.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
    if (!noAssert) checkOffset(offset, 8, this.length);
    return read(this, offset, false, 52, 8)
  };

  function checkInt (buf, value, offset, ext, max, min) {
    if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
    if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
    if (offset + ext > buf.length) throw new RangeError('Index out of range')
  }

  Buffer$1.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
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

  Buffer$1.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
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

  Buffer$1.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
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

  Buffer$1.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer$1.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
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

  Buffer$1.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset + 3] = (value >>> 24);
      this[offset + 2] = (value >>> 16);
      this[offset + 1] = (value >>> 8);
      this[offset] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer$1.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 24);
      this[offset + 1] = (value >>> 16);
      this[offset + 2] = (value >>> 8);
      this[offset + 3] = (value & 0xff);
    } else {
      objectWriteUInt32(this, value, offset, false);
    }
    return offset + 4
  };

  Buffer$1.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
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

  Buffer$1.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
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

  Buffer$1.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
    if (!Buffer$1.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
    if (value < 0) value = 0xff + value + 1;
    this[offset] = (value & 0xff);
    return offset + 1
  };

  Buffer$1.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
    } else {
      objectWriteUInt16(this, value, offset, true);
    }
    return offset + 2
  };

  Buffer$1.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value >>> 8);
      this[offset + 1] = (value & 0xff);
    } else {
      objectWriteUInt16(this, value, offset, false);
    }
    return offset + 2
  };

  Buffer$1.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
      this[offset] = (value & 0xff);
      this[offset + 1] = (value >>> 8);
      this[offset + 2] = (value >>> 16);
      this[offset + 3] = (value >>> 24);
    } else {
      objectWriteUInt32(this, value, offset, true);
    }
    return offset + 4
  };

  Buffer$1.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
    value = +value;
    offset = offset | 0;
    if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
    if (value < 0) value = 0xffffffff + value + 1;
    if (Buffer$1.TYPED_ARRAY_SUPPORT) {
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

  Buffer$1.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
    return writeFloat(this, value, offset, true, noAssert)
  };

  Buffer$1.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
    return writeFloat(this, value, offset, false, noAssert)
  };

  function writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      checkIEEE754(buf, value, offset, 8);
    }
    write(buf, value, offset, littleEndian, 52, 8);
    return offset + 8
  }

  Buffer$1.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
    return writeDouble(this, value, offset, true, noAssert)
  };

  Buffer$1.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
    return writeDouble(this, value, offset, false, noAssert)
  };

  // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer$1.prototype.copy = function copy (target, targetStart, start, end) {
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
    } else if (len < 1000 || !Buffer$1.TYPED_ARRAY_SUPPORT) {
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
  Buffer$1.prototype.fill = function fill (val, start, end, encoding) {
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
      if (typeof encoding === 'string' && !Buffer$1.isEncoding(encoding)) {
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
        : utf8ToBytes(new Buffer$1(val, encoding).toString());
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
    return toByteArray$1(base64clean(str))
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

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function getAugmentedNamespace(n) {
    var f = n.default;
  	if (typeof f == "function") {
  		var a = function () {
  			return f.apply(this, arguments);
  		};
  		a.prototype = f.prototype;
    } else a = {};
    Object.defineProperty(a, '__esModule', {value: true});
  	Object.keys(n).forEach(function (k) {
  		var d = Object.getOwnPropertyDescriptor(n, k);
  		Object.defineProperty(a, k, d.get ? d : {
  			enumerable: true,
  			get: function () {
  				return n[k];
  			}
  		});
  	});
  	return a;
  }

  var lobEnc = {};

  var empty = {};

  var empty$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': empty
  });

  var require$$2 = /*@__PURE__*/getAugmentedNamespace(empty$1);

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
    var ret = new Buffer$1(data.length);
    cipher.encrypt(ret, data, data.length);
    return ret;
  };

  var R = typeof Reflect === 'object' ? Reflect : null;
  var ReflectApply = R && typeof R.apply === 'function'
    ? R.apply
    : function ReflectApply(target, receiver, args) {
      return Function.prototype.apply.call(target, receiver, args);
    };

  var ReflectOwnKeys;
  if (R && typeof R.ownKeys === 'function') {
    ReflectOwnKeys = R.ownKeys;
  } else if (Object.getOwnPropertySymbols) {
    ReflectOwnKeys = function ReflectOwnKeys(target) {
      return Object.getOwnPropertyNames(target)
        .concat(Object.getOwnPropertySymbols(target));
    };
  } else {
    ReflectOwnKeys = function ReflectOwnKeys(target) {
      return Object.getOwnPropertyNames(target);
    };
  }

  function ProcessEmitWarning(warning) {
    if (console && console.warn) console.warn(warning);
  }

  var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
    return value !== value;
  };

  function EventEmitter$2() {
    EventEmitter$2.init.call(this);
  }
  var events = EventEmitter$2;

  // Backwards-compat with node 0.10.x
  EventEmitter$2.EventEmitter = EventEmitter$2;

  EventEmitter$2.prototype._events = undefined;
  EventEmitter$2.prototype._eventsCount = 0;
  EventEmitter$2.prototype._maxListeners = undefined;

  // By default EventEmitters will print a warning if more than 10 listeners are
  // added to it. This is a useful default which helps finding memory leaks.
  var defaultMaxListeners = 10;

  Object.defineProperty(EventEmitter$2, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
        throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
      }
      defaultMaxListeners = arg;
    }
  });

  EventEmitter$2.init = function() {

    if (this._events === undefined ||
        this._events === Object.getPrototypeOf(this)._events) {
      this._events = Object.create(null);
      this._eventsCount = 0;
    }

    this._maxListeners = this._maxListeners || undefined;
  };

  // Obviously not all Emitters should be limited to 10. This function allows
  // that to be increased. Set to zero for unlimited.
  EventEmitter$2.prototype.setMaxListeners = function setMaxListeners(n) {
    if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
      throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
    }
    this._maxListeners = n;
    return this;
  };

  function $getMaxListeners(that) {
    if (that._maxListeners === undefined)
      return EventEmitter$2.defaultMaxListeners;
    return that._maxListeners;
  }

  EventEmitter$2.prototype.getMaxListeners = function getMaxListeners() {
    return $getMaxListeners(this);
  };

  EventEmitter$2.prototype.emit = function emit(type) {
    var args = [];
    for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
    var doError = (type === 'error');

    var events = this._events;
    if (events !== undefined)
      doError = (doError && events.error === undefined);
    else if (!doError)
      return false;

    // If there is no 'error' event listener then throw.
    if (doError) {
      var er;
      if (args.length > 0)
        er = args[0];
      if (er instanceof Error) {
        // Note: The comments on the `throw` lines are intentional, they show
        // up in Node's output if this results in an unhandled exception.
        throw er; // Unhandled 'error' event
      }
      // At least give some kind of context to the user
      var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
      err.context = er;
      throw err; // Unhandled 'error' event
    }

    var handler = events[type];

    if (handler === undefined)
      return false;

    if (typeof handler === 'function') {
      ReflectApply(handler, this, args);
    } else {
      var len = handler.length;
      var listeners = arrayClone(handler, len);
      for (var i = 0; i < len; ++i)
        ReflectApply(listeners[i], this, args);
    }

    return true;
  };

  function _addListener(target, type, listener, prepend) {
    var m;
    var events;
    var existing;

    if (typeof listener !== 'function') {
      throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
    }

    events = target._events;
    if (events === undefined) {
      events = target._events = Object.create(null);
      target._eventsCount = 0;
    } else {
      // To avoid recursion in the case that type === "newListener"! Before
      // adding it to the listeners, first emit "newListener".
      if (events.newListener !== undefined) {
        target.emit('newListener', type,
                    listener.listener ? listener.listener : listener);

        // Re-assign `events` because a newListener handler could have caused the
        // this._events to be assigned to a new object
        events = target._events;
      }
      existing = events[type];
    }

    if (existing === undefined) {
      // Optimize the case of one listener. Don't need the extra array object.
      existing = events[type] = listener;
      ++target._eventsCount;
    } else {
      if (typeof existing === 'function') {
        // Adding the second element, need to change to array.
        existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
        // If we've already got an array, just append.
      } else if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }

      // Check for listener leak
      m = $getMaxListeners(target);
      if (m > 0 && existing.length > m && !existing.warned) {
        existing.warned = true;
        // No error code for this since it is a Warning
        // eslint-disable-next-line no-restricted-syntax
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + String(type) + ' listeners ' +
                            'added. Use emitter.setMaxListeners() to ' +
                            'increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        ProcessEmitWarning(w);
      }
    }

    return target;
  }

  EventEmitter$2.prototype.addListener = function addListener(type, listener) {
    return _addListener(this, type, listener, false);
  };

  EventEmitter$2.prototype.on = EventEmitter$2.prototype.addListener;

  EventEmitter$2.prototype.prependListener =
      function prependListener(type, listener) {
        return _addListener(this, type, listener, true);
      };

  function onceWrapper() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
    if (!this.fired) {
      this.target.removeListener(this.type, this.wrapFn);
      this.fired = true;
      ReflectApply(this.listener, this.target, args);
    }
  }

  function _onceWrap(target, type, listener) {
    var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
    var wrapped = onceWrapper.bind(state);
    wrapped.listener = listener;
    state.wrapFn = wrapped;
    return wrapped;
  }

  EventEmitter$2.prototype.once = function once(type, listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
    }
    this.on(type, _onceWrap(this, type, listener));
    return this;
  };

  EventEmitter$2.prototype.prependOnceListener =
      function prependOnceListener(type, listener) {
        if (typeof listener !== 'function') {
          throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
        }
        this.prependListener(type, _onceWrap(this, type, listener));
        return this;
      };

  // Emits a 'removeListener' event if and only if the listener was removed.
  EventEmitter$2.prototype.removeListener =
      function removeListener(type, listener) {
        var list, events, position, i, originalListener;

        if (typeof listener !== 'function') {
          throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
        }

        events = this._events;
        if (events === undefined)
          return this;

        list = events[type];
        if (list === undefined)
          return this;

        if (list === listener || list.listener === listener) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else {
            delete events[type];
            if (events.removeListener)
              this.emit('removeListener', type, list.listener || listener);
          }
        } else if (typeof list !== 'function') {
          position = -1;

          for (i = list.length - 1; i >= 0; i--) {
            if (list[i] === listener || list[i].listener === listener) {
              originalListener = list[i].listener;
              position = i;
              break;
            }
          }

          if (position < 0)
            return this;

          if (position === 0)
            list.shift();
          else {
            spliceOne(list, position);
          }

          if (list.length === 1)
            events[type] = list[0];

          if (events.removeListener !== undefined)
            this.emit('removeListener', type, originalListener || listener);
        }

        return this;
      };

  EventEmitter$2.prototype.off = EventEmitter$2.prototype.removeListener;

  EventEmitter$2.prototype.removeAllListeners =
      function removeAllListeners(type) {
        var listeners, events, i;

        events = this._events;
        if (events === undefined)
          return this;

        // not listening for removeListener, no need to emit
        if (events.removeListener === undefined) {
          if (arguments.length === 0) {
            this._events = Object.create(null);
            this._eventsCount = 0;
          } else if (events[type] !== undefined) {
            if (--this._eventsCount === 0)
              this._events = Object.create(null);
            else
              delete events[type];
          }
          return this;
        }

        // emit removeListener for all listeners on all events
        if (arguments.length === 0) {
          var keys = Object.keys(events);
          var key;
          for (i = 0; i < keys.length; ++i) {
            key = keys[i];
            if (key === 'removeListener') continue;
            this.removeAllListeners(key);
          }
          this.removeAllListeners('removeListener');
          this._events = Object.create(null);
          this._eventsCount = 0;
          return this;
        }

        listeners = events[type];

        if (typeof listeners === 'function') {
          this.removeListener(type, listeners);
        } else if (listeners !== undefined) {
          // LIFO order
          for (i = listeners.length - 1; i >= 0; i--) {
            this.removeListener(type, listeners[i]);
          }
        }

        return this;
      };

  function _listeners(target, type, unwrap) {
    var events = target._events;

    if (events === undefined)
      return [];

    var evlistener = events[type];
    if (evlistener === undefined)
      return [];

    if (typeof evlistener === 'function')
      return unwrap ? [evlistener.listener || evlistener] : [evlistener];

    return unwrap ?
      unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
  }

  EventEmitter$2.prototype.listeners = function listeners(type) {
    return _listeners(this, type, true);
  };

  EventEmitter$2.prototype.rawListeners = function rawListeners(type) {
    return _listeners(this, type, false);
  };

  EventEmitter$2.listenerCount = function(emitter, type) {
    if (typeof emitter.listenerCount === 'function') {
      return emitter.listenerCount(type);
    } else {
      return listenerCount$1.call(emitter, type);
    }
  };

  EventEmitter$2.prototype.listenerCount = listenerCount$1;
  function listenerCount$1(type) {
    var events = this._events;

    if (events !== undefined) {
      var evlistener = events[type];

      if (typeof evlistener === 'function') {
        return 1;
      } else if (evlistener !== undefined) {
        return evlistener.length;
      }
    }

    return 0;
  }

  EventEmitter$2.prototype.eventNames = function eventNames() {
    return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
  };

  function arrayClone(arr, n) {
    var copy = new Array(n);
    for (var i = 0; i < n; ++i)
      copy[i] = arr[i];
    return copy;
  }

  function spliceOne(list, index) {
    for (; index + 1 < list.length; index++)
      list[index] = list[index + 1];
    list.pop();
  }

  function unwrapListeners(arr) {
    var ret = new Array(arr.length);
    for (var i = 0; i < ret.length; ++i) {
      ret[i] = arr[i].listener || arr[i];
    }
    return ret;
  }

  // shim for using process in browser
  // based off https://github.com/defunctzombie/node-process/blob/master/browser.js

  function defaultSetTimout$1() {
      throw new Error('setTimeout has not been defined');
  }
  function defaultClearTimeout$1 () {
      throw new Error('clearTimeout has not been defined');
  }
  var cachedSetTimeout$1 = defaultSetTimout$1;
  var cachedClearTimeout$1 = defaultClearTimeout$1;
  if (typeof global$1.setTimeout === 'function') {
      cachedSetTimeout$1 = setTimeout;
  }
  if (typeof global$1.clearTimeout === 'function') {
      cachedClearTimeout$1 = clearTimeout;
  }

  function runTimeout$1(fun) {
      if (cachedSetTimeout$1 === setTimeout) {
          //normal enviroments in sane situations
          return setTimeout(fun, 0);
      }
      // if setTimeout wasn't available but was latter defined
      if ((cachedSetTimeout$1 === defaultSetTimout$1 || !cachedSetTimeout$1) && setTimeout) {
          cachedSetTimeout$1 = setTimeout;
          return setTimeout(fun, 0);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedSetTimeout$1(fun, 0);
      } catch(e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
              return cachedSetTimeout$1.call(null, fun, 0);
          } catch(e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
              return cachedSetTimeout$1.call(this, fun, 0);
          }
      }


  }
  function runClearTimeout$1(marker) {
      if (cachedClearTimeout$1 === clearTimeout) {
          //normal enviroments in sane situations
          return clearTimeout(marker);
      }
      // if clearTimeout wasn't available but was latter defined
      if ((cachedClearTimeout$1 === defaultClearTimeout$1 || !cachedClearTimeout$1) && clearTimeout) {
          cachedClearTimeout$1 = clearTimeout;
          return clearTimeout(marker);
      }
      try {
          // when when somebody has screwed with setTimeout but no I.E. maddness
          return cachedClearTimeout$1(marker);
      } catch (e){
          try {
              // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
              return cachedClearTimeout$1.call(null, marker);
          } catch (e){
              // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
              // Some versions of I.E. have different rules for clearTimeout vs setTimeout
              return cachedClearTimeout$1.call(this, marker);
          }
      }



  }
  var queue$1 = [];
  var draining$1 = false;
  var currentQueue$1;
  var queueIndex$1 = -1;

  function cleanUpNextTick$1() {
      if (!draining$1 || !currentQueue$1) {
          return;
      }
      draining$1 = false;
      if (currentQueue$1.length) {
          queue$1 = currentQueue$1.concat(queue$1);
      } else {
          queueIndex$1 = -1;
      }
      if (queue$1.length) {
          drainQueue$1();
      }
  }

  function drainQueue$1() {
      if (draining$1) {
          return;
      }
      var timeout = runTimeout$1(cleanUpNextTick$1);
      draining$1 = true;

      var len = queue$1.length;
      while(len) {
          currentQueue$1 = queue$1;
          queue$1 = [];
          while (++queueIndex$1 < len) {
              if (currentQueue$1) {
                  currentQueue$1[queueIndex$1].run();
              }
          }
          queueIndex$1 = -1;
          len = queue$1.length;
      }
      currentQueue$1 = null;
      draining$1 = false;
      runClearTimeout$1(timeout);
  }
  function nextTick$1(fun) {
      var args = new Array(arguments.length - 1);
      if (arguments.length > 1) {
          for (var i = 1; i < arguments.length; i++) {
              args[i - 1] = arguments[i];
          }
      }
      queue$1.push(new Item$1(fun, args));
      if (queue$1.length === 1 && !draining$1) {
          runTimeout$1(drainQueue$1);
      }
  }
  // v8 likes predictible objects
  function Item$1(fun, array) {
      this.fun = fun;
      this.array = array;
  }
  Item$1.prototype.run = function () {
      this.fun.apply(null, this.array);
  };
  var title$1 = 'browser';
  var platform$1 = 'browser';
  var browser$1 = true;
  var env$1 = {};
  var argv$1 = [];
  var version$1 = ''; // empty string to avoid regexp issues
  var versions$1 = {};
  var release$1 = {};
  var config$1 = {};

  function noop$1() {}

  var on$1 = noop$1;
  var addListener$1 = noop$1;
  var once$2 = noop$1;
  var off$1 = noop$1;
  var removeListener$1 = noop$1;
  var removeAllListeners$1 = noop$1;
  var emit$1 = noop$1;

  function binding$2(name) {
      throw new Error('process.binding is not supported');
  }

  function cwd$1 () { return '/' }
  function chdir$1 (dir) {
      throw new Error('process.chdir is not supported');
  }function umask$1() { return 0; }

  // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
  var performance$1 = global$1.performance || {};
  var performanceNow$1 =
    performance$1.now        ||
    performance$1.mozNow     ||
    performance$1.msNow      ||
    performance$1.oNow       ||
    performance$1.webkitNow  ||
    function(){ return (new Date()).getTime() };

  // generate timestamp or delta
  // see http://nodejs.org/api/process.html#process_process_hrtime
  function hrtime$1(previousTimestamp){
    var clocktime = performanceNow$1.call(performance$1)*1e-3;
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

  var startTime$1 = new Date();
  function uptime$1() {
    var currentTime = new Date();
    var dif = currentTime - startTime$1;
    return dif / 1000;
  }

  var browser$1$1 = {
    nextTick: nextTick$1,
    title: title$1,
    browser: browser$1,
    env: env$1,
    argv: argv$1,
    version: version$1,
    versions: versions$1,
    on: on$1,
    addListener: addListener$1,
    once: once$2,
    off: off$1,
    removeListener: removeListener$1,
    removeAllListeners: removeAllListeners$1,
    emit: emit$1,
    binding: binding$2,
    cwd: cwd$1,
    chdir: chdir$1,
    umask: umask$1,
    hrtime: hrtime$1,
    platform: platform$1,
    release: release$1,
    config: config$1,
    uptime: uptime$1
  };

  var process$1 = browser$1$1;

  var inherits;
  if (typeof Object.create === 'function'){
    inherits = function inherits(ctor, superCtor) {
      // implementation from standard node.js 'util' module
      ctor.super_ = superCtor;
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    inherits = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor;
      var TempCtor = function () {};
      TempCtor.prototype = superCtor.prototype;
      ctor.prototype = new TempCtor();
      ctor.prototype.constructor = ctor;
    };
  }
  var inherits$1 = inherits;

  var formatRegExp = /%[sdj%]/g;
  function format$3(f) {
    if (!isString(f)) {
      var objects = [];
      for (var i = 0; i < arguments.length; i++) {
        objects.push(inspect(arguments[i]));
      }
      return objects.join(' ');
    }

    var i = 1;
    var args = arguments;
    var len = args.length;
    var str = String(f).replace(formatRegExp, function(x) {
      if (x === '%%') return '%';
      if (i >= len) return x;
      switch (x) {
        case '%s': return String(args[i++]);
        case '%d': return Number(args[i++]);
        case '%j':
          try {
            return JSON.stringify(args[i++]);
          } catch (_) {
            return '[Circular]';
          }
        default:
          return x;
      }
    });
    for (var x = args[i]; i < len; x = args[++i]) {
      if (isNull(x) || !isObject(x)) {
        str += ' ' + x;
      } else {
        str += ' ' + inspect(x);
      }
    }
    return str;
  }

  // Mark that a method should not be used.
  // Returns a modified function which warns once by default.
  // If --no-deprecation is set, then it is a no-op.
  function deprecate(fn, msg) {
    // Allow for deprecating things in the process of starting up.
    if (isUndefined(global$1.process)) {
      return function() {
        return deprecate(fn, msg).apply(this, arguments);
      };
    }

    if (process$1.noDeprecation === true) {
      return fn;
    }

    var warned = false;
    function deprecated() {
      if (!warned) {
        if (process$1.throwDeprecation) {
          throw new Error(msg);
        } else if (process$1.traceDeprecation) {
          console.trace(msg);
        } else {
          console.error(msg);
        }
        warned = true;
      }
      return fn.apply(this, arguments);
    }

    return deprecated;
  }

  var debugs = {};
  var debugEnviron;
  function debuglog(set) {
    if (isUndefined(debugEnviron))
      debugEnviron = process$1.env.NODE_DEBUG || '';
    set = set.toUpperCase();
    if (!debugs[set]) {
      if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
        var pid = 0;
        debugs[set] = function() {
          var msg = format$3.apply(null, arguments);
          console.error('%s %d: %s', set, pid, msg);
        };
      } else {
        debugs[set] = function() {};
      }
    }
    return debugs[set];
  }

  /**
   * Echos the value of a value. Trys to print the value out
   * in the best way possible given the different types.
   *
   * @param {Object} obj The object to print out.
   * @param {Object} opts Optional options object that alters the output.
   */
  /* legacy: obj, showHidden, depth, colors*/
  function inspect(obj, opts) {
    // default options
    var ctx = {
      seen: [],
      stylize: stylizeNoColor
    };
    // legacy...
    if (arguments.length >= 3) ctx.depth = arguments[2];
    if (arguments.length >= 4) ctx.colors = arguments[3];
    if (isBoolean(opts)) {
      // legacy...
      ctx.showHidden = opts;
    } else if (opts) {
      // got an "options" object
      _extend(ctx, opts);
    }
    // set default options
    if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
    if (isUndefined(ctx.depth)) ctx.depth = 2;
    if (isUndefined(ctx.colors)) ctx.colors = false;
    if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
    if (ctx.colors) ctx.stylize = stylizeWithColor;
    return formatValue(ctx, obj, ctx.depth);
  }

  // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
  inspect.colors = {
    'bold' : [1, 22],
    'italic' : [3, 23],
    'underline' : [4, 24],
    'inverse' : [7, 27],
    'white' : [37, 39],
    'grey' : [90, 39],
    'black' : [30, 39],
    'blue' : [34, 39],
    'cyan' : [36, 39],
    'green' : [32, 39],
    'magenta' : [35, 39],
    'red' : [31, 39],
    'yellow' : [33, 39]
  };

  // Don't use 'blue' not visible on cmd.exe
  inspect.styles = {
    'special': 'cyan',
    'number': 'yellow',
    'boolean': 'yellow',
    'undefined': 'grey',
    'null': 'bold',
    'string': 'green',
    'date': 'magenta',
    // "name": intentionally not styling
    'regexp': 'red'
  };


  function stylizeWithColor(str, styleType) {
    var style = inspect.styles[styleType];

    if (style) {
      return '\u001b[' + inspect.colors[style][0] + 'm' + str +
             '\u001b[' + inspect.colors[style][1] + 'm';
    } else {
      return str;
    }
  }


  function stylizeNoColor(str, styleType) {
    return str;
  }


  function arrayToHash(array) {
    var hash = {};

    array.forEach(function(val, idx) {
      hash[val] = true;
    });

    return hash;
  }


  function formatValue(ctx, value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (ctx.customInspect &&
        value &&
        isFunction$1(value.inspect) &&
        // Filter out the util module, it's inspect function is special
        value.inspect !== inspect &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      var ret = value.inspect(recurseTimes, ctx);
      if (!isString(ret)) {
        ret = formatValue(ctx, ret, recurseTimes);
      }
      return ret;
    }

    // Primitive types cannot have properties
    var primitive = formatPrimitive(ctx, value);
    if (primitive) {
      return primitive;
    }

    // Look up the keys of the object.
    var keys = Object.keys(value);
    var visibleKeys = arrayToHash(keys);

    if (ctx.showHidden) {
      keys = Object.getOwnPropertyNames(value);
    }

    // IE doesn't make error fields non-enumerable
    // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
    if (isError(value)
        && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
      return formatError(value);
    }

    // Some type of object without properties can be shortcutted.
    if (keys.length === 0) {
      if (isFunction$1(value)) {
        var name = value.name ? ': ' + value.name : '';
        return ctx.stylize('[Function' + name + ']', 'special');
      }
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      }
      if (isDate(value)) {
        return ctx.stylize(Date.prototype.toString.call(value), 'date');
      }
      if (isError(value)) {
        return formatError(value);
      }
    }

    var base = '', array = false, braces = ['{', '}'];

    // Make Array say that they are Array
    if (isArray$1(value)) {
      array = true;
      braces = ['[', ']'];
    }

    // Make functions say that they are functions
    if (isFunction$1(value)) {
      var n = value.name ? ': ' + value.name : '';
      base = ' [Function' + n + ']';
    }

    // Make RegExps say that they are RegExps
    if (isRegExp(value)) {
      base = ' ' + RegExp.prototype.toString.call(value);
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + Date.prototype.toUTCString.call(value);
    }

    // Make error with message first say the error
    if (isError(value)) {
      base = ' ' + formatError(value);
    }

    if (keys.length === 0 && (!array || value.length == 0)) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
      } else {
        return ctx.stylize('[Object]', 'special');
      }
    }

    ctx.seen.push(value);

    var output;
    if (array) {
      output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
    } else {
      output = keys.map(function(key) {
        return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
      });
    }

    ctx.seen.pop();

    return reduceToSingleString(output, base, braces);
  }


  function formatPrimitive(ctx, value) {
    if (isUndefined(value))
      return ctx.stylize('undefined', 'undefined');
    if (isString(value)) {
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');
    }
    if (isNumber(value))
      return ctx.stylize('' + value, 'number');
    if (isBoolean(value))
      return ctx.stylize('' + value, 'boolean');
    // For some reason typeof null is "object", so special case here.
    if (isNull(value))
      return ctx.stylize('null', 'null');
  }


  function formatError(value) {
    return '[' + Error.prototype.toString.call(value) + ']';
  }


  function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
    var output = [];
    for (var i = 0, l = value.length; i < l; ++i) {
      if (hasOwnProperty$1(value, String(i))) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            String(i), true));
      } else {
        output.push('');
      }
    }
    keys.forEach(function(key) {
      if (!key.match(/^\d+$/)) {
        output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            key, true));
      }
    });
    return output;
  }


  function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
    var name, str, desc;
    desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
    if (desc.get) {
      if (desc.set) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (desc.set) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
    if (!hasOwnProperty$1(visibleKeys, key)) {
      name = '[' + key + ']';
    }
    if (!str) {
      if (ctx.seen.indexOf(desc.value) < 0) {
        if (isNull(recurseTimes)) {
          str = formatValue(ctx, desc.value, null);
        } else {
          str = formatValue(ctx, desc.value, recurseTimes - 1);
        }
        if (str.indexOf('\n') > -1) {
          if (array) {
            str = str.split('\n').map(function(line) {
              return '  ' + line;
            }).join('\n').substr(2);
          } else {
            str = '\n' + str.split('\n').map(function(line) {
              return '   ' + line;
            }).join('\n');
          }
        }
      } else {
        str = ctx.stylize('[Circular]', 'special');
      }
    }
    if (isUndefined(name)) {
      if (array && key.match(/^\d+$/)) {
        return str;
      }
      name = JSON.stringify('' + key);
      if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
        name = name.substr(1, name.length - 2);
        name = ctx.stylize(name, 'name');
      } else {
        name = name.replace(/'/g, "\\'")
                   .replace(/\\"/g, '"')
                   .replace(/(^"|"$)/g, "'");
        name = ctx.stylize(name, 'string');
      }
    }

    return name + ': ' + str;
  }


  function reduceToSingleString(output, base, braces) {
    var length = output.reduce(function(prev, cur) {
      if (cur.indexOf('\n') >= 0) ;
      return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
    }, 0);

    if (length > 60) {
      return braces[0] +
             (base === '' ? '' : base + '\n ') +
             ' ' +
             output.join(',\n  ') +
             ' ' +
             braces[1];
    }

    return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
  }


  // NOTE: These type checking functions intentionally don't use `instanceof`
  // because it is fragile and can be easily faked with `Object.create()`.
  function isArray$1(ar) {
    return Array.isArray(ar);
  }

  function isBoolean(arg) {
    return typeof arg === 'boolean';
  }

  function isNull(arg) {
    return arg === null;
  }

  function isNullOrUndefined(arg) {
    return arg == null;
  }

  function isNumber(arg) {
    return typeof arg === 'number';
  }

  function isString(arg) {
    return typeof arg === 'string';
  }

  function isUndefined(arg) {
    return arg === void 0;
  }

  function isRegExp(re) {
    return isObject(re) && objectToString(re) === '[object RegExp]';
  }

  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }

  function isDate(d) {
    return isObject(d) && objectToString(d) === '[object Date]';
  }

  function isError(e) {
    return isObject(e) &&
        (objectToString(e) === '[object Error]' || e instanceof Error);
  }

  function isFunction$1(arg) {
    return typeof arg === 'function';
  }

  function objectToString(o) {
    return Object.prototype.toString.call(o);
  }

  function _extend(origin, add) {
    // Don't do anything if add isn't an object
    if (!add || !isObject(add)) return origin;

    var keys = Object.keys(add);
    var i = keys.length;
    while (i--) {
      origin[keys[i]] = add[keys[i]];
    }
    return origin;
  }
  function hasOwnProperty$1(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }

  var buffer = {};

  var base64Js = {};

  base64Js.byteLength = byteLength;
  base64Js.toByteArray = toByteArray;
  base64Js.fromByteArray = fromByteArray;

  var lookup = [];
  var revLookup = [];
  var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;

  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  // Support decoding URL-safe base64 strings, as Node.js does.
  // See: https://en.wikipedia.org/wiki/Base64#URL_applications
  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;

  function getLens (b64) {
    var len = b64.length;

    if (len % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // Trim off extra bytes after placeholder bytes are found
    // See: https://github.com/beatgammit/base64-js/issues/42
    var validLen = b64.indexOf('=');
    if (validLen === -1) validLen = len;

    var placeHoldersLen = validLen === len
      ? 0
      : 4 - (validLen % 4);

    return [validLen, placeHoldersLen]
  }

  // base64 is 4/3 + up to two characters of the original data
  function byteLength (b64) {
    var lens = getLens(b64);
    var validLen = lens[0];
    var placeHoldersLen = lens[1];
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function _byteLength (b64, validLen, placeHoldersLen) {
    return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
  }

  function toByteArray (b64) {
    var tmp;
    var lens = getLens(b64);
    var validLen = lens[0];
    var placeHoldersLen = lens[1];

    var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen));

    var curByte = 0;

    // if there are placeholders, only get up to the last complete 4 chars
    var len = placeHoldersLen > 0
      ? validLen - 4
      : validLen;

    var i;
    for (i = 0; i < len; i += 4) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 18) |
        (revLookup[b64.charCodeAt(i + 1)] << 12) |
        (revLookup[b64.charCodeAt(i + 2)] << 6) |
        revLookup[b64.charCodeAt(i + 3)];
      arr[curByte++] = (tmp >> 16) & 0xFF;
      arr[curByte++] = (tmp >> 8) & 0xFF;
      arr[curByte++] = tmp & 0xFF;
    }

    if (placeHoldersLen === 2) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 2) |
        (revLookup[b64.charCodeAt(i + 1)] >> 4);
      arr[curByte++] = tmp & 0xFF;
    }

    if (placeHoldersLen === 1) {
      tmp =
        (revLookup[b64.charCodeAt(i)] << 10) |
        (revLookup[b64.charCodeAt(i + 1)] << 4) |
        (revLookup[b64.charCodeAt(i + 2)] >> 2);
      arr[curByte++] = (tmp >> 8) & 0xFF;
      arr[curByte++] = tmp & 0xFF;
    }

    return arr
  }

  function tripletToBase64 (num) {
    return lookup[num >> 18 & 0x3F] +
      lookup[num >> 12 & 0x3F] +
      lookup[num >> 6 & 0x3F] +
      lookup[num & 0x3F]
  }

  function encodeChunk (uint8, start, end) {
    var tmp;
    var output = [];
    for (var i = start; i < end; i += 3) {
      tmp =
        ((uint8[i] << 16) & 0xFF0000) +
        ((uint8[i + 1] << 8) & 0xFF00) +
        (uint8[i + 2] & 0xFF);
      output.push(tripletToBase64(tmp));
    }
    return output.join('')
  }

  function fromByteArray (uint8) {
    var tmp;
    var len = uint8.length;
    var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
    var parts = [];
    var maxChunkLength = 16383; // must be multiple of 3

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
      parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    if (extraBytes === 1) {
      tmp = uint8[len - 1];
      parts.push(
        lookup[tmp >> 2] +
        lookup[(tmp << 4) & 0x3F] +
        '=='
      );
    } else if (extraBytes === 2) {
      tmp = (uint8[len - 2] << 8) + uint8[len - 1];
      parts.push(
        lookup[tmp >> 10] +
        lookup[(tmp >> 4) & 0x3F] +
        lookup[(tmp << 2) & 0x3F] +
        '='
      );
    }

    return parts.join('')
  }

  var ieee754 = {};

  /*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */

  ieee754.read = function (buffer, offset, isLE, mLen, nBytes) {
    var e, m;
    var eLen = (nBytes * 8) - mLen - 1;
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
    for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1);
    e >>= (-nBits);
    nBits += mLen;
    for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias;
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen);
      e = e - eBias;
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  };

  ieee754.write = function (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c;
    var eLen = (nBytes * 8) - mLen - 1;
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
        m = ((value * c) - 1) * Math.pow(2, mLen);
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
  };

  /*!
   * The buffer module from node.js, for the browser.
   *
   * @author   Feross Aboukhadijeh <https://feross.org>
   * @license  MIT
   */

  (function (exports) {

  	var base64 = base64Js;
  	var ieee754$1 = ieee754;
  	var customInspectSymbol =
  	  (typeof Symbol === 'function' && typeof Symbol['for'] === 'function') // eslint-disable-line dot-notation
  	    ? Symbol['for']('nodejs.util.inspect.custom') // eslint-disable-line dot-notation
  	    : null;

  	exports.Buffer = Buffer;
  	exports.SlowBuffer = SlowBuffer;
  	exports.INSPECT_MAX_BYTES = 50;

  	var K_MAX_LENGTH = 0x7fffffff;
  	exports.kMaxLength = K_MAX_LENGTH;

  	/**
  	 * If `Buffer.TYPED_ARRAY_SUPPORT`:
  	 *   === true    Use Uint8Array implementation (fastest)
  	 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
  	 *               implementation (most compatible, even IE6)
  	 *
  	 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
  	 * Opera 11.6+, iOS 4.2+.
  	 *
  	 * We report that the browser does not support typed arrays if the are not subclassable
  	 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
  	 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
  	 * for __proto__ and has a buggy typed array implementation.
  	 */
  	Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport();

  	if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
  	    typeof console.error === 'function') {
  	  console.error(
  	    'This browser lacks typed array (Uint8Array) support which is required by ' +
  	    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  	  );
  	}

  	function typedArraySupport () {
  	  // Can typed array instances can be augmented?
  	  try {
  	    var arr = new Uint8Array(1);
  	    var proto = { foo: function () { return 42 } };
  	    Object.setPrototypeOf(proto, Uint8Array.prototype);
  	    Object.setPrototypeOf(arr, proto);
  	    return arr.foo() === 42
  	  } catch (e) {
  	    return false
  	  }
  	}

  	Object.defineProperty(Buffer.prototype, 'parent', {
  	  enumerable: true,
  	  get: function () {
  	    if (!Buffer.isBuffer(this)) return undefined
  	    return this.buffer
  	  }
  	});

  	Object.defineProperty(Buffer.prototype, 'offset', {
  	  enumerable: true,
  	  get: function () {
  	    if (!Buffer.isBuffer(this)) return undefined
  	    return this.byteOffset
  	  }
  	});

  	function createBuffer (length) {
  	  if (length > K_MAX_LENGTH) {
  	    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  	  }
  	  // Return an augmented `Uint8Array` instance
  	  var buf = new Uint8Array(length);
  	  Object.setPrototypeOf(buf, Buffer.prototype);
  	  return buf
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
  	  // Common case.
  	  if (typeof arg === 'number') {
  	    if (typeof encodingOrOffset === 'string') {
  	      throw new TypeError(
  	        'The "string" argument must be of type string. Received type number'
  	      )
  	    }
  	    return allocUnsafe(arg)
  	  }
  	  return from(arg, encodingOrOffset, length)
  	}

  	Buffer.poolSize = 8192; // not used by this implementation

  	function from (value, encodingOrOffset, length) {
  	  if (typeof value === 'string') {
  	    return fromString(value, encodingOrOffset)
  	  }

  	  if (ArrayBuffer.isView(value)) {
  	    return fromArrayView(value)
  	  }

  	  if (value == null) {
  	    throw new TypeError(
  	      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
  	      'or Array-like Object. Received type ' + (typeof value)
  	    )
  	  }

  	  if (isInstance(value, ArrayBuffer) ||
  	      (value && isInstance(value.buffer, ArrayBuffer))) {
  	    return fromArrayBuffer(value, encodingOrOffset, length)
  	  }

  	  if (typeof SharedArrayBuffer !== 'undefined' &&
  	      (isInstance(value, SharedArrayBuffer) ||
  	      (value && isInstance(value.buffer, SharedArrayBuffer)))) {
  	    return fromArrayBuffer(value, encodingOrOffset, length)
  	  }

  	  if (typeof value === 'number') {
  	    throw new TypeError(
  	      'The "value" argument must not be of type number. Received type number'
  	    )
  	  }

  	  var valueOf = value.valueOf && value.valueOf();
  	  if (valueOf != null && valueOf !== value) {
  	    return Buffer.from(valueOf, encodingOrOffset, length)
  	  }

  	  var b = fromObject(value);
  	  if (b) return b

  	  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
  	      typeof value[Symbol.toPrimitive] === 'function') {
  	    return Buffer.from(
  	      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
  	    )
  	  }

  	  throw new TypeError(
  	    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
  	    'or Array-like Object. Received type ' + (typeof value)
  	  )
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
  	  return from(value, encodingOrOffset, length)
  	};

  	// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
  	// https://github.com/feross/buffer/pull/148
  	Object.setPrototypeOf(Buffer.prototype, Uint8Array.prototype);
  	Object.setPrototypeOf(Buffer, Uint8Array);

  	function assertSize (size) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('"size" argument must be of type number')
  	  } else if (size < 0) {
  	    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  	  }
  	}

  	function alloc (size, fill, encoding) {
  	  assertSize(size);
  	  if (size <= 0) {
  	    return createBuffer(size)
  	  }
  	  if (fill !== undefined) {
  	    // Only pay attention to encoding if it's a string. This
  	    // prevents accidentally sending in a number that would
  	    // be interpreted as a start offset.
  	    return typeof encoding === 'string'
  	      ? createBuffer(size).fill(fill, encoding)
  	      : createBuffer(size).fill(fill)
  	  }
  	  return createBuffer(size)
  	}

  	/**
  	 * Creates a new filled Buffer instance.
  	 * alloc(size[, fill[, encoding]])
  	 **/
  	Buffer.alloc = function (size, fill, encoding) {
  	  return alloc(size, fill, encoding)
  	};

  	function allocUnsafe (size) {
  	  assertSize(size);
  	  return createBuffer(size < 0 ? 0 : checked(size) | 0)
  	}

  	/**
  	 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
  	 * */
  	Buffer.allocUnsafe = function (size) {
  	  return allocUnsafe(size)
  	};
  	/**
  	 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
  	 */
  	Buffer.allocUnsafeSlow = function (size) {
  	  return allocUnsafe(size)
  	};

  	function fromString (string, encoding) {
  	  if (typeof encoding !== 'string' || encoding === '') {
  	    encoding = 'utf8';
  	  }

  	  if (!Buffer.isEncoding(encoding)) {
  	    throw new TypeError('Unknown encoding: ' + encoding)
  	  }

  	  var length = byteLength(string, encoding) | 0;
  	  var buf = createBuffer(length);

  	  var actual = buf.write(string, encoding);

  	  if (actual !== length) {
  	    // Writing a hex string, for example, that contains invalid characters will
  	    // cause everything after the first invalid character to be ignored. (e.g.
  	    // 'abxxcd' will be treated as 'ab')
  	    buf = buf.slice(0, actual);
  	  }

  	  return buf
  	}

  	function fromArrayLike (array) {
  	  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  	  var buf = createBuffer(length);
  	  for (var i = 0; i < length; i += 1) {
  	    buf[i] = array[i] & 255;
  	  }
  	  return buf
  	}

  	function fromArrayView (arrayView) {
  	  if (isInstance(arrayView, Uint8Array)) {
  	    var copy = new Uint8Array(arrayView);
  	    return fromArrayBuffer(copy.buffer, copy.byteOffset, copy.byteLength)
  	  }
  	  return fromArrayLike(arrayView)
  	}

  	function fromArrayBuffer (array, byteOffset, length) {
  	  if (byteOffset < 0 || array.byteLength < byteOffset) {
  	    throw new RangeError('"offset" is outside of buffer bounds')
  	  }

  	  if (array.byteLength < byteOffset + (length || 0)) {
  	    throw new RangeError('"length" is outside of buffer bounds')
  	  }

  	  var buf;
  	  if (byteOffset === undefined && length === undefined) {
  	    buf = new Uint8Array(array);
  	  } else if (length === undefined) {
  	    buf = new Uint8Array(array, byteOffset);
  	  } else {
  	    buf = new Uint8Array(array, byteOffset, length);
  	  }

  	  // Return an augmented `Uint8Array` instance
  	  Object.setPrototypeOf(buf, Buffer.prototype);

  	  return buf
  	}

  	function fromObject (obj) {
  	  if (Buffer.isBuffer(obj)) {
  	    var len = checked(obj.length) | 0;
  	    var buf = createBuffer(len);

  	    if (buf.length === 0) {
  	      return buf
  	    }

  	    obj.copy(buf, 0, 0, len);
  	    return buf
  	  }

  	  if (obj.length !== undefined) {
  	    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
  	      return createBuffer(0)
  	    }
  	    return fromArrayLike(obj)
  	  }

  	  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
  	    return fromArrayLike(obj.data)
  	  }
  	}

  	function checked (length) {
  	  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  	  // length is NaN (which is otherwise coerced to zero.)
  	  if (length >= K_MAX_LENGTH) {
  	    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
  	                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  	  }
  	  return length | 0
  	}

  	function SlowBuffer (length) {
  	  if (+length != length) { // eslint-disable-line eqeqeq
  	    length = 0;
  	  }
  	  return Buffer.alloc(+length)
  	}

  	Buffer.isBuffer = function isBuffer (b) {
  	  return b != null && b._isBuffer === true &&
  	    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
  	};

  	Buffer.compare = function compare (a, b) {
  	  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength);
  	  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength);
  	  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
  	    throw new TypeError(
  	      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
  	    )
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
  	  if (!Array.isArray(list)) {
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
  	    if (isInstance(buf, Uint8Array)) {
  	      if (pos + buf.length > buffer.length) {
  	        Buffer.from(buf).copy(buffer, pos);
  	      } else {
  	        Uint8Array.prototype.set.call(
  	          buffer,
  	          buf,
  	          pos
  	        );
  	      }
  	    } else if (!Buffer.isBuffer(buf)) {
  	      throw new TypeError('"list" argument must be an Array of Buffers')
  	    } else {
  	      buf.copy(buffer, pos);
  	    }
  	    pos += buf.length;
  	  }
  	  return buffer
  	};

  	function byteLength (string, encoding) {
  	  if (Buffer.isBuffer(string)) {
  	    return string.length
  	  }
  	  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
  	    return string.byteLength
  	  }
  	  if (typeof string !== 'string') {
  	    throw new TypeError(
  	      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
  	      'Received type ' + typeof string
  	    )
  	  }

  	  var len = string.length;
  	  var mustMatch = (arguments.length > 2 && arguments[2] === true);
  	  if (!mustMatch && len === 0) return 0

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
  	        if (loweredCase) {
  	          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
  	        }
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

  	  // Force coercion to uint32. This will also coerce falsey/NaN values to 0.
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

  	// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
  	// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
  	// reliably in a browserify context because there could be multiple different
  	// copies of the 'buffer' package in use. This method works even for Buffer
  	// instances that were created from another copy of the `buffer` package.
  	// See: https://github.com/feross/buffer/issues/154
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
  	  var length = this.length;
  	  if (length === 0) return ''
  	  if (arguments.length === 0) return utf8Slice(this, 0, length)
  	  return slowToString.apply(this, arguments)
  	};

  	Buffer.prototype.toLocaleString = Buffer.prototype.toString;

  	Buffer.prototype.equals = function equals (b) {
  	  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  	  if (this === b) return true
  	  return Buffer.compare(this, b) === 0
  	};

  	Buffer.prototype.inspect = function inspect () {
  	  var str = '';
  	  var max = exports.INSPECT_MAX_BYTES;
  	  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim();
  	  if (this.length > max) str += ' ... ';
  	  return '<Buffer ' + str + '>'
  	};
  	if (customInspectSymbol) {
  	  Buffer.prototype[customInspectSymbol] = Buffer.prototype.inspect;
  	}

  	Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  	  if (isInstance(target, Uint8Array)) {
  	    target = Buffer.from(target, target.offset, target.byteLength);
  	  }
  	  if (!Buffer.isBuffer(target)) {
  	    throw new TypeError(
  	      'The "target" argument must be one of type Buffer or Uint8Array. ' +
  	      'Received type ' + (typeof target)
  	    )
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
  	  byteOffset = +byteOffset; // Coerce to Number.
  	  if (numberIsNaN(byteOffset)) {
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
  	  if (Buffer.isBuffer(val)) {
  	    // Special case: looking for empty string/buffer always fails
  	    if (val.length === 0) {
  	      return -1
  	    }
  	    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  	  } else if (typeof val === 'number') {
  	    val = val & 0xFF; // Search for a byte value [0-255]
  	    if (typeof Uint8Array.prototype.indexOf === 'function') {
  	      if (dir) {
  	        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
  	      } else {
  	        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
  	      }
  	    }
  	    return arrayIndexOf(buffer, [val], byteOffset, encoding, dir)
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

  	  var strLen = string.length;

  	  if (length > strLen / 2) {
  	    length = strLen / 2;
  	  }
  	  for (var i = 0; i < length; ++i) {
  	    var parsed = parseInt(string.substr(i * 2, 2), 16);
  	    if (numberIsNaN(parsed)) return i
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
  	    offset = offset >>> 0;
  	    if (isFinite(length)) {
  	      length = length >>> 0;
  	      if (encoding === undefined) encoding = 'utf8';
  	    } else {
  	      encoding = length;
  	      length = undefined;
  	    }
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
  	      case 'latin1':
  	      case 'binary':
  	        return asciiWrite(this, string, offset, length)

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
  	    return base64.fromByteArray(buf)
  	  } else {
  	    return base64.fromByteArray(buf.slice(start, end))
  	  }
  	}

  	function utf8Slice (buf, start, end) {
  	  end = Math.min(buf.length, end);
  	  var res = [];

  	  var i = start;
  	  while (i < end) {
  	    var firstByte = buf[i];
  	    var codePoint = null;
  	    var bytesPerSequence = (firstByte > 0xEF)
  	      ? 4
  	      : (firstByte > 0xDF)
  	          ? 3
  	          : (firstByte > 0xBF)
  	              ? 2
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
  	    out += hexSliceLookupTable[buf[i]];
  	  }
  	  return out
  	}

  	function utf16leSlice (buf, start, end) {
  	  var bytes = buf.slice(start, end);
  	  var res = '';
  	  // If bytes.length is odd, the last 8 bits must be ignored (same as node.js)
  	  for (var i = 0; i < bytes.length - 1; i += 2) {
  	    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256));
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

  	  var newBuf = this.subarray(start, end);
  	  // Return an augmented `Uint8Array` instance
  	  Object.setPrototypeOf(newBuf, Buffer.prototype);

  	  return newBuf
  	};

  	/*
  	 * Need to make sure that buffer isn't trying to write out of bounds.
  	 */
  	function checkOffset (offset, ext, length) {
  	  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  	  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
  	}

  	Buffer.prototype.readUintLE =
  	Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
  	  if (!noAssert) checkOffset(offset, byteLength, this.length);

  	  var val = this[offset];
  	  var mul = 1;
  	  var i = 0;
  	  while (++i < byteLength && (mul *= 0x100)) {
  	    val += this[offset + i] * mul;
  	  }

  	  return val
  	};

  	Buffer.prototype.readUintBE =
  	Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
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

  	Buffer.prototype.readUint8 =
  	Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 1, this.length);
  	  return this[offset]
  	};

  	Buffer.prototype.readUint16LE =
  	Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 2, this.length);
  	  return this[offset] | (this[offset + 1] << 8)
  	};

  	Buffer.prototype.readUint16BE =
  	Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 2, this.length);
  	  return (this[offset] << 8) | this[offset + 1]
  	};

  	Buffer.prototype.readUint32LE =
  	Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);

  	  return ((this[offset]) |
  	      (this[offset + 1] << 8) |
  	      (this[offset + 2] << 16)) +
  	      (this[offset + 3] * 0x1000000)
  	};

  	Buffer.prototype.readUint32BE =
  	Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);

  	  return (this[offset] * 0x1000000) +
  	    ((this[offset + 1] << 16) |
  	    (this[offset + 2] << 8) |
  	    this[offset + 3])
  	};

  	Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
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
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
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
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 1, this.length);
  	  if (!(this[offset] & 0x80)) return (this[offset])
  	  return ((0xff - this[offset] + 1) * -1)
  	};

  	Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 2, this.length);
  	  var val = this[offset] | (this[offset + 1] << 8);
  	  return (val & 0x8000) ? val | 0xFFFF0000 : val
  	};

  	Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 2, this.length);
  	  var val = this[offset + 1] | (this[offset] << 8);
  	  return (val & 0x8000) ? val | 0xFFFF0000 : val
  	};

  	Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);

  	  return (this[offset]) |
  	    (this[offset + 1] << 8) |
  	    (this[offset + 2] << 16) |
  	    (this[offset + 3] << 24)
  	};

  	Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);

  	  return (this[offset] << 24) |
  	    (this[offset + 1] << 16) |
  	    (this[offset + 2] << 8) |
  	    (this[offset + 3])
  	};

  	Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);
  	  return ieee754$1.read(this, offset, true, 23, 4)
  	};

  	Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 4, this.length);
  	  return ieee754$1.read(this, offset, false, 23, 4)
  	};

  	Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 8, this.length);
  	  return ieee754$1.read(this, offset, true, 52, 8)
  	};

  	Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  	  offset = offset >>> 0;
  	  if (!noAssert) checkOffset(offset, 8, this.length);
  	  return ieee754$1.read(this, offset, false, 52, 8)
  	};

  	function checkInt (buf, value, offset, ext, max, min) {
  	  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  	  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  	}

  	Buffer.prototype.writeUintLE =
  	Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
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

  	Buffer.prototype.writeUintBE =
  	Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  byteLength = byteLength >>> 0;
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

  	Buffer.prototype.writeUint8 =
  	Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  	  this[offset] = (value & 0xff);
  	  return offset + 1
  	};

  	Buffer.prototype.writeUint16LE =
  	Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  	  this[offset] = (value & 0xff);
  	  this[offset + 1] = (value >>> 8);
  	  return offset + 2
  	};

  	Buffer.prototype.writeUint16BE =
  	Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  	  this[offset] = (value >>> 8);
  	  this[offset + 1] = (value & 0xff);
  	  return offset + 2
  	};

  	Buffer.prototype.writeUint32LE =
  	Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  	  this[offset + 3] = (value >>> 24);
  	  this[offset + 2] = (value >>> 16);
  	  this[offset + 1] = (value >>> 8);
  	  this[offset] = (value & 0xff);
  	  return offset + 4
  	};

  	Buffer.prototype.writeUint32BE =
  	Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  	  this[offset] = (value >>> 24);
  	  this[offset + 1] = (value >>> 16);
  	  this[offset + 2] = (value >>> 8);
  	  this[offset + 3] = (value & 0xff);
  	  return offset + 4
  	};

  	Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) {
  	    var limit = Math.pow(2, (8 * byteLength) - 1);

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
  	  offset = offset >>> 0;
  	  if (!noAssert) {
  	    var limit = Math.pow(2, (8 * byteLength) - 1);

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
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  	  if (value < 0) value = 0xff + value + 1;
  	  this[offset] = (value & 0xff);
  	  return offset + 1
  	};

  	Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  	  this[offset] = (value & 0xff);
  	  this[offset + 1] = (value >>> 8);
  	  return offset + 2
  	};

  	Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  	  this[offset] = (value >>> 8);
  	  this[offset + 1] = (value & 0xff);
  	  return offset + 2
  	};

  	Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  	  this[offset] = (value & 0xff);
  	  this[offset + 1] = (value >>> 8);
  	  this[offset + 2] = (value >>> 16);
  	  this[offset + 3] = (value >>> 24);
  	  return offset + 4
  	};

  	Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  	  if (value < 0) value = 0xffffffff + value + 1;
  	  this[offset] = (value >>> 24);
  	  this[offset + 1] = (value >>> 16);
  	  this[offset + 2] = (value >>> 8);
  	  this[offset + 3] = (value & 0xff);
  	  return offset + 4
  	};

  	function checkIEEE754 (buf, value, offset, ext, max, min) {
  	  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  	  if (offset < 0) throw new RangeError('Index out of range')
  	}

  	function writeFloat (buf, value, offset, littleEndian, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) {
  	    checkIEEE754(buf, value, offset, 4);
  	  }
  	  ieee754$1.write(buf, value, offset, littleEndian, 23, 4);
  	  return offset + 4
  	}

  	Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  	  return writeFloat(this, value, offset, true, noAssert)
  	};

  	Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  	  return writeFloat(this, value, offset, false, noAssert)
  	};

  	function writeDouble (buf, value, offset, littleEndian, noAssert) {
  	  value = +value;
  	  offset = offset >>> 0;
  	  if (!noAssert) {
  	    checkIEEE754(buf, value, offset, 8);
  	  }
  	  ieee754$1.write(buf, value, offset, littleEndian, 52, 8);
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
  	  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
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
  	  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  	  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  	  // Are we oob?
  	  if (end > this.length) end = this.length;
  	  if (target.length - targetStart < end - start) {
  	    end = target.length - targetStart + start;
  	  }

  	  var len = end - start;

  	  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
  	    // Use built-in when available, missing from IE11
  	    this.copyWithin(targetStart, start, end);
  	  } else {
  	    Uint8Array.prototype.set.call(
  	      target,
  	      this.subarray(start, end),
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
  	    if (encoding !== undefined && typeof encoding !== 'string') {
  	      throw new TypeError('encoding must be a string')
  	    }
  	    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
  	      throw new TypeError('Unknown encoding: ' + encoding)
  	    }
  	    if (val.length === 1) {
  	      var code = val.charCodeAt(0);
  	      if ((encoding === 'utf8' && code < 128) ||
  	          encoding === 'latin1') {
  	        // Fast path: If `val` fits into a single byte, use that numeric value.
  	        val = code;
  	      }
  	    }
  	  } else if (typeof val === 'number') {
  	    val = val & 255;
  	  } else if (typeof val === 'boolean') {
  	    val = Number(val);
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
  	    var bytes = Buffer.isBuffer(val)
  	      ? val
  	      : Buffer.from(val, encoding);
  	    var len = bytes.length;
  	    if (len === 0) {
  	      throw new TypeError('The value "' + val +
  	        '" is invalid for argument "value"')
  	    }
  	    for (i = 0; i < end - start; ++i) {
  	      this[i + start] = bytes[i % len];
  	    }
  	  }

  	  return this
  	};

  	// HELPER FUNCTIONS
  	// ================

  	var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g;

  	function base64clean (str) {
  	  // Node takes equal signs as end of the Base64 encoding
  	  str = str.split('=')[0];
  	  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  	  str = str.trim().replace(INVALID_BASE64_RE, '');
  	  // Node converts strings with length < 2 to ''
  	  if (str.length < 2) return ''
  	  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  	  while (str.length % 4 !== 0) {
  	    str = str + '=';
  	  }
  	  return str
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
  	  return base64.toByteArray(base64clean(str))
  	}

  	function blitBuffer (src, dst, offset, length) {
  	  for (var i = 0; i < length; ++i) {
  	    if ((i + offset >= dst.length) || (i >= src.length)) break
  	    dst[i + offset] = src[i];
  	  }
  	  return i
  	}

  	// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
  	// the `instanceof` check but they should be treated as of that type.
  	// See: https://github.com/feross/buffer/issues/166
  	function isInstance (obj, type) {
  	  return obj instanceof type ||
  	    (obj != null && obj.constructor != null && obj.constructor.name != null &&
  	      obj.constructor.name === type.name)
  	}
  	function numberIsNaN (obj) {
  	  // For IE11 support
  	  return obj !== obj // eslint-disable-line no-self-compare
  	}

  	// Create lookup table for `toString('hex')`
  	// See: https://github.com/feross/buffer/issues/219
  	var hexSliceLookupTable = (function () {
  	  var alphabet = '0123456789abcdef';
  	  var table = new Array(256);
  	  for (var i = 0; i < 16; ++i) {
  	    var i16 = i * 16;
  	    for (var j = 0; j < 16; ++j) {
  	      table[i16 + j] = alphabet[i] + alphabet[j];
  	    }
  	  }
  	  return table
  	})();
  } (buffer));

  function BufferList() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function (v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function (v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function () {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function () {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function (s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function (n) {
    if (this.length === 0) return buffer.Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = buffer.Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      p.data.copy(ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  var safeBuffer = {exports: {}};

  /* eslint-disable node/no-deprecated-api */

  (function (module, exports) {
  	var buffer$1 = buffer;
  	var Buffer = buffer$1.Buffer;

  	// alternative to using Object.keys for old browsers
  	function copyProps (src, dst) {
  	  for (var key in src) {
  	    dst[key] = src[key];
  	  }
  	}
  	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  	  module.exports = buffer$1;
  	} else {
  	  // Copy properties from require('buffer')
  	  copyProps(buffer$1, exports);
  	  exports.Buffer = SafeBuffer;
  	}

  	function SafeBuffer (arg, encodingOrOffset, length) {
  	  return Buffer(arg, encodingOrOffset, length)
  	}

  	// Copy static methods from Buffer
  	copyProps(Buffer, SafeBuffer);

  	SafeBuffer.from = function (arg, encodingOrOffset, length) {
  	  if (typeof arg === 'number') {
  	    throw new TypeError('Argument must not be a number')
  	  }
  	  return Buffer(arg, encodingOrOffset, length)
  	};

  	SafeBuffer.alloc = function (size, fill, encoding) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  var buf = Buffer(size);
  	  if (fill !== undefined) {
  	    if (typeof encoding === 'string') {
  	      buf.fill(fill, encoding);
  	    } else {
  	      buf.fill(fill);
  	    }
  	  } else {
  	    buf.fill(0);
  	  }
  	  return buf
  	};

  	SafeBuffer.allocUnsafe = function (size) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  return Buffer(size)
  	};

  	SafeBuffer.allocUnsafeSlow = function (size) {
  	  if (typeof size !== 'number') {
  	    throw new TypeError('Argument must be a number')
  	  }
  	  return buffer$1.SlowBuffer(size)
  	};
  } (safeBuffer, safeBuffer.exports));

  /*<replacement>*/

  var Buffer = safeBuffer.exports.Buffer;
  /*</replacement>*/

  var isEncoding = Buffer.isEncoding || function (encoding) {
    encoding = '' + encoding;
    switch (encoding && encoding.toLowerCase()) {
      case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
        return true;
      default:
        return false;
    }
  };

  function _normalizeEncoding(enc) {
    if (!enc) return 'utf8';
    var retried;
    while (true) {
      switch (enc) {
        case 'utf8':
        case 'utf-8':
          return 'utf8';
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return 'utf16le';
        case 'latin1':
        case 'binary':
          return 'latin1';
        case 'base64':
        case 'ascii':
        case 'hex':
          return enc;
        default:
          if (retried) return; // undefined
          enc = ('' + enc).toLowerCase();
          retried = true;
      }
    }
  }
  // Do not cache `Buffer.isEncoding` when checking encoding names as some
  // modules monkey-patch it to support additional encodings
  function normalizeEncoding(enc) {
    var nenc = _normalizeEncoding(enc);
    if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
    return nenc || enc;
  }

  // StringDecoder provides an interface for efficiently splitting a series of
  // buffers into a series of JS strings without breaking apart multi-byte
  // characters.
  var StringDecoder_1 = StringDecoder;
  function StringDecoder(encoding) {
    this.encoding = normalizeEncoding(encoding);
    var nb;
    switch (this.encoding) {
      case 'utf16le':
        this.text = utf16Text;
        this.end = utf16End;
        nb = 4;
        break;
      case 'utf8':
        this.fillLast = utf8FillLast;
        nb = 4;
        break;
      case 'base64':
        this.text = base64Text;
        this.end = base64End;
        nb = 3;
        break;
      default:
        this.write = simpleWrite;
        this.end = simpleEnd;
        return;
    }
    this.lastNeed = 0;
    this.lastTotal = 0;
    this.lastChar = Buffer.allocUnsafe(nb);
  }

  StringDecoder.prototype.write = function (buf) {
    if (buf.length === 0) return '';
    var r;
    var i;
    if (this.lastNeed) {
      r = this.fillLast(buf);
      if (r === undefined) return '';
      i = this.lastNeed;
      this.lastNeed = 0;
    } else {
      i = 0;
    }
    if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
    return r || '';
  };

  StringDecoder.prototype.end = utf8End;

  // Returns only complete characters in a Buffer
  StringDecoder.prototype.text = utf8Text;

  // Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
  StringDecoder.prototype.fillLast = function (buf) {
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
    this.lastNeed -= buf.length;
  };

  // Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
  // continuation byte. If an invalid byte is detected, -2 is returned.
  function utf8CheckByte(byte) {
    if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
    return byte >> 6 === 0x02 ? -1 : -2;
  }

  // Checks at most 3 bytes at the end of a Buffer in order to detect an
  // incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
  // needed to complete the UTF-8 character (if applicable) are returned.
  function utf8CheckIncomplete(self, buf, i) {
    var j = buf.length - 1;
    if (j < i) return 0;
    var nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self.lastNeed = nb - 1;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) self.lastNeed = nb - 2;
      return nb;
    }
    if (--j < i || nb === -2) return 0;
    nb = utf8CheckByte(buf[j]);
    if (nb >= 0) {
      if (nb > 0) {
        if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
      }
      return nb;
    }
    return 0;
  }

  // Validates as many continuation bytes for a multi-byte UTF-8 character as
  // needed or are available. If we see a non-continuation byte where we expect
  // one, we "replace" the validated continuation bytes we've seen so far with
  // a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
  // behavior. The continuation byte check is included three times in the case
  // where all of the continuation bytes for a character exist in the same buffer.
  // It is also done this way as a slight performance increase instead of using a
  // loop.
  function utf8CheckExtraBytes(self, buf, p) {
    if ((buf[0] & 0xC0) !== 0x80) {
      self.lastNeed = 0;
      return '\ufffd';
    }
    if (self.lastNeed > 1 && buf.length > 1) {
      if ((buf[1] & 0xC0) !== 0x80) {
        self.lastNeed = 1;
        return '\ufffd';
      }
      if (self.lastNeed > 2 && buf.length > 2) {
        if ((buf[2] & 0xC0) !== 0x80) {
          self.lastNeed = 2;
          return '\ufffd';
        }
      }
    }
  }

  // Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
  function utf8FillLast(buf) {
    var p = this.lastTotal - this.lastNeed;
    var r = utf8CheckExtraBytes(this, buf);
    if (r !== undefined) return r;
    if (this.lastNeed <= buf.length) {
      buf.copy(this.lastChar, p, 0, this.lastNeed);
      return this.lastChar.toString(this.encoding, 0, this.lastTotal);
    }
    buf.copy(this.lastChar, p, 0, buf.length);
    this.lastNeed -= buf.length;
  }

  // Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
  // partial character, the character's bytes are buffered until the required
  // number of bytes are available.
  function utf8Text(buf, i) {
    var total = utf8CheckIncomplete(this, buf, i);
    if (!this.lastNeed) return buf.toString('utf8', i);
    this.lastTotal = total;
    var end = buf.length - (total - this.lastNeed);
    buf.copy(this.lastChar, 0, end);
    return buf.toString('utf8', i, end);
  }

  // For UTF-8, a replacement character is added when ending on a partial
  // character.
  function utf8End(buf) {
    var r = buf && buf.length ? this.write(buf) : '';
    if (this.lastNeed) return r + '\ufffd';
    return r;
  }

  // UTF-16LE typically needs two bytes per character, but even if we have an even
  // number of bytes available, we need to check if we end on a leading/high
  // surrogate. In that case, we need to wait for the next two bytes in order to
  // decode the last character properly.
  function utf16Text(buf, i) {
    if ((buf.length - i) % 2 === 0) {
      var r = buf.toString('utf16le', i);
      if (r) {
        var c = r.charCodeAt(r.length - 1);
        if (c >= 0xD800 && c <= 0xDBFF) {
          this.lastNeed = 2;
          this.lastTotal = 4;
          this.lastChar[0] = buf[buf.length - 2];
          this.lastChar[1] = buf[buf.length - 1];
          return r.slice(0, -1);
        }
      }
      return r;
    }
    this.lastNeed = 1;
    this.lastTotal = 2;
    this.lastChar[0] = buf[buf.length - 1];
    return buf.toString('utf16le', i, buf.length - 1);
  }

  // For UTF-16LE we do not explicitly append special replacement characters if we
  // end on a partial character, we simply let v8 handle that.
  function utf16End(buf) {
    var r = buf && buf.length ? this.write(buf) : '';
    if (this.lastNeed) {
      var end = this.lastTotal - this.lastNeed;
      return r + this.lastChar.toString('utf16le', 0, end);
    }
    return r;
  }

  function base64Text(buf, i) {
    var n = (buf.length - i) % 3;
    if (n === 0) return buf.toString('base64', i);
    this.lastNeed = 3 - n;
    this.lastTotal = 3;
    if (n === 1) {
      this.lastChar[0] = buf[buf.length - 1];
    } else {
      this.lastChar[0] = buf[buf.length - 2];
      this.lastChar[1] = buf[buf.length - 1];
    }
    return buf.toString('base64', i, buf.length - n);
  }

  function base64End(buf) {
    var r = buf && buf.length ? this.write(buf) : '';
    if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
    return r;
  }

  // Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
  function simpleWrite(buf) {
    return buf.toString(this.encoding);
  }

  function simpleEnd(buf) {
    return buf && buf.length ? this.write(buf) : '';
  }

  Readable.ReadableState = ReadableState;

  var debug = debuglog('stream');
  inherits$1(Readable, events);

  function prependListener(emitter, event, fn) {
    // Sadly this is not cacheable as some libraries bundle their own
    // event emitter implementation with them.
    if (typeof emitter.prependListener === 'function') {
      return emitter.prependListener(event, fn);
    } else {
      // This is a hack to make sure that our error handler is attached before any
      // userland ones.  NEVER DO THIS. This is here only because this code needs
      // to continue to work with older versions of Node.js that do not include
      // the prependListener() method. The goal is to eventually remove this hack.
      if (!emitter._events || !emitter._events[event])
        emitter.on(event, fn);
      else if (Array.isArray(emitter._events[event]))
        emitter._events[event].unshift(fn);
      else
        emitter._events[event] = [fn, emitter._events[event]];
    }
  }
  function listenerCount (emitter, type) {
    return emitter.listeners(type).length;
  }
  function ReadableState(options, stream) {

    options = options || {};

    // object stream flag. Used to make read(n) ignore n and to
    // make all the buffer merging and length checks go away
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex$1) this.objectMode = this.objectMode || !!options.readableObjectMode;

    // the point at which it stops calling _read() to fill the buffer
    // Note: 0 is a valid value, means "don't call _read preemptively ever"
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    // A linked list is used to store data chunks instead of an array because the
    // linked list can remove elements from the beginning faster than
    // array.shift()
    this.buffer = new BufferList();
    this.length = 0;
    this.pipes = null;
    this.pipesCount = 0;
    this.flowing = null;
    this.ended = false;
    this.endEmitted = false;
    this.reading = false;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // whenever we return null, then we set a flag to say
    // that we're awaiting a 'readable' event emission.
    this.needReadable = false;
    this.emittedReadable = false;
    this.readableListening = false;
    this.resumeScheduled = false;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // when piping, we only care about 'readable' events that happen
    // after read()ing all the bytes and not getting any pushback.
    this.ranOut = false;

    // the number of writers that are awaiting a drain event in .pipe()s
    this.awaitDrain = 0;

    // if true, a maybeReadMore has been scheduled
    this.readingMore = false;

    this.decoder = null;
    this.encoding = null;
    if (options.encoding) {
      this.decoder = new StringDecoder_1(options.encoding);
      this.encoding = options.encoding;
    }
  }
  function Readable(options) {

    if (!(this instanceof Readable)) return new Readable(options);

    this._readableState = new ReadableState(options, this);

    // legacy
    this.readable = true;

    if (options && typeof options.read === 'function') this._read = options.read;

    events.call(this);
  }

  // Manually shove something into the read() buffer.
  // This returns true if the highWaterMark has not been hit yet,
  // similar to how Writable.write() returns true if you should
  // write() some more.
  Readable.prototype.push = function (chunk, encoding) {
    var state = this._readableState;

    if (!state.objectMode && typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer$1.from(chunk, encoding);
        encoding = '';
      }
    }

    return readableAddChunk(this, state, chunk, encoding, false);
  };

  // Unshift should *always* be something directly out of read()
  Readable.prototype.unshift = function (chunk) {
    var state = this._readableState;
    return readableAddChunk(this, state, chunk, '', true);
  };

  Readable.prototype.isPaused = function () {
    return this._readableState.flowing === false;
  };

  function readableAddChunk(stream, state, chunk, encoding, addToFront) {
    var er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (chunk === null) {
      state.reading = false;
      onEofChunk(stream, state);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (state.ended && !addToFront) {
        var e = new Error('stream.push() after EOF');
        stream.emit('error', e);
      } else if (state.endEmitted && addToFront) {
        var _e = new Error('stream.unshift() after end event');
        stream.emit('error', _e);
      } else {
        var skipAdd;
        if (state.decoder && !addToFront && !encoding) {
          chunk = state.decoder.write(chunk);
          skipAdd = !state.objectMode && chunk.length === 0;
        }

        if (!addToFront) state.reading = false;

        // Don't add to the buffer if we've decoded to an empty string chunk and
        // we're not in object mode
        if (!skipAdd) {
          // if we want the data now, just emit it.
          if (state.flowing && state.length === 0 && !state.sync) {
            stream.emit('data', chunk);
            stream.read(0);
          } else {
            // update the buffer info.
            state.length += state.objectMode ? 1 : chunk.length;
            if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

            if (state.needReadable) emitReadable(stream);
          }
        }

        maybeReadMore(stream, state);
      }
    } else if (!addToFront) {
      state.reading = false;
    }

    return needMoreData(state);
  }

  // if it's past the high water mark, we can push in some more.
  // Also, if we have no data yet, we can stand some
  // more bytes.  This is to work around cases where hwm=0,
  // such as the repl.  Also, if the push() triggered a
  // readable event, and the user called read(largeNumber) such that
  // needReadable was set, then we ought to push more, so that another
  // 'readable' event will be triggered.
  function needMoreData(state) {
    return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
  }

  // backwards compatibility.
  Readable.prototype.setEncoding = function (enc) {
    this._readableState.decoder = new StringDecoder_1(enc);
    this._readableState.encoding = enc;
    return this;
  };

  // Don't raise the hwm > 8MB
  var MAX_HWM = 0x800000;
  function computeNewHighWaterMark(n) {
    if (n >= MAX_HWM) {
      n = MAX_HWM;
    } else {
      // Get the next highest power of 2 to prevent increasing hwm excessively in
      // tiny amounts
      n--;
      n |= n >>> 1;
      n |= n >>> 2;
      n |= n >>> 4;
      n |= n >>> 8;
      n |= n >>> 16;
      n++;
    }
    return n;
  }

  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function howMuchToRead(n, state) {
    if (n <= 0 || state.length === 0 && state.ended) return 0;
    if (state.objectMode) return 1;
    if (n !== n) {
      // Only flow one buffer at a time
      if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
    }
    // If we're asking for more than the current hwm, then raise the hwm.
    if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
    if (n <= state.length) return n;
    // Don't have enough
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    }
    return state.length;
  }

  // you can override either this method, or the async _read(n) below.
  Readable.prototype.read = function (n) {
    debug('read', n);
    n = parseInt(n, 10);
    var state = this._readableState;
    var nOrig = n;

    if (n !== 0) state.emittedReadable = false;

    // if we're doing read(0) to trigger a readable event, but we
    // already have a bunch of data in the buffer, then just trigger
    // the 'readable' event and move on.
    if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
      debug('read: emitReadable', state.length, state.ended);
      if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
      return null;
    }

    n = howMuchToRead(n, state);

    // if we've ended, and we're now clear, then finish it up.
    if (n === 0 && state.ended) {
      if (state.length === 0) endReadable(this);
      return null;
    }

    // All the actual chunk generation logic needs to be
    // *below* the call to _read.  The reason is that in certain
    // synthetic stream cases, such as passthrough streams, _read
    // may be a completely synchronous operation which may change
    // the state of the read buffer, providing enough data when
    // before there was *not* enough.
    //
    // So, the steps are:
    // 1. Figure out what the state of things will be after we do
    // a read from the buffer.
    //
    // 2. If that resulting state will trigger a _read, then call _read.
    // Note that this may be asynchronous, or synchronous.  Yes, it is
    // deeply ugly to write APIs this way, but that still doesn't mean
    // that the Readable class should behave improperly, as streams are
    // designed to be sync/async agnostic.
    // Take note if the _read call is sync or async (ie, if the read call
    // has returned yet), so that we know whether or not it's safe to emit
    // 'readable' etc.
    //
    // 3. Actually pull the requested chunks out of the buffer and return.

    // if we need a readable event, then we need to do some reading.
    var doRead = state.needReadable;
    debug('need readable', doRead);

    // if we currently have less than the highWaterMark, then also read some
    if (state.length === 0 || state.length - n < state.highWaterMark) {
      doRead = true;
      debug('length less than watermark', doRead);
    }

    // however, if we've ended, then there's no point, and if we're already
    // reading, then it's unnecessary.
    if (state.ended || state.reading) {
      doRead = false;
      debug('reading or ended', doRead);
    } else if (doRead) {
      debug('do read');
      state.reading = true;
      state.sync = true;
      // if the length is currently zero, then we *need* a readable event.
      if (state.length === 0) state.needReadable = true;
      // call internal read method
      this._read(state.highWaterMark);
      state.sync = false;
      // If _read pushed data synchronously, then `reading` will be false,
      // and we need to re-evaluate how much data we can return to the user.
      if (!state.reading) n = howMuchToRead(nOrig, state);
    }

    var ret;
    if (n > 0) ret = fromList(n, state);else ret = null;

    if (ret === null) {
      state.needReadable = true;
      n = 0;
    } else {
      state.length -= n;
    }

    if (state.length === 0) {
      // If we have nothing in the buffer, then we want to know
      // as soon as we *do* get something into the buffer.
      if (!state.ended) state.needReadable = true;

      // If we tried to read() past the EOF, then emit end on the next tick.
      if (nOrig !== n && state.ended) endReadable(this);
    }

    if (ret !== null) this.emit('data', ret);

    return ret;
  };

  function chunkInvalid(state, chunk) {
    var er = null;
    if (!isBuffer(chunk) && typeof chunk !== 'string' && chunk !== null && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    return er;
  }

  function onEofChunk(stream, state) {
    if (state.ended) return;
    if (state.decoder) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) {
        state.buffer.push(chunk);
        state.length += state.objectMode ? 1 : chunk.length;
      }
    }
    state.ended = true;

    // emit 'readable' now to make sure it gets picked up.
    emitReadable(stream);
  }

  // Don't emit readable right away in sync mode, because this can trigger
  // another read() call => stack overflow.  This way, it might trigger
  // a nextTick recursion warning, but that's not so bad.
  function emitReadable(stream) {
    var state = stream._readableState;
    state.needReadable = false;
    if (!state.emittedReadable) {
      debug('emitReadable', state.flowing);
      state.emittedReadable = true;
      if (state.sync) nextTick$1(emitReadable_, stream);else emitReadable_(stream);
    }
  }

  function emitReadable_(stream) {
    debug('emit readable');
    stream.emit('readable');
    flow(stream);
  }

  // at this point, the user has presumably seen the 'readable' event,
  // and called read() to consume some data.  that may have triggered
  // in turn another _read(n) call, in which case reading = true if
  // it's in progress.
  // However, if we're not ended, or reading, and the length < hwm,
  // then go ahead and try to read some more preemptively.
  function maybeReadMore(stream, state) {
    if (!state.readingMore) {
      state.readingMore = true;
      nextTick$1(maybeReadMore_, stream, state);
    }
  }

  function maybeReadMore_(stream, state) {
    var len = state.length;
    while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
      debug('maybeReadMore read 0');
      stream.read(0);
      if (len === state.length)
        // didn't get any data, stop spinning.
        break;else len = state.length;
    }
    state.readingMore = false;
  }

  // abstract method.  to be overridden in specific implementation classes.
  // call cb(er, data) where data is <= n in length.
  // for virtual (non-string, non-buffer) streams, "length" is somewhat
  // arbitrary, and perhaps not very meaningful.
  Readable.prototype._read = function (n) {
    this.emit('error', new Error('not implemented'));
  };

  Readable.prototype.pipe = function (dest, pipeOpts) {
    var src = this;
    var state = this._readableState;

    switch (state.pipesCount) {
      case 0:
        state.pipes = dest;
        break;
      case 1:
        state.pipes = [state.pipes, dest];
        break;
      default:
        state.pipes.push(dest);
        break;
    }
    state.pipesCount += 1;
    debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

    var doEnd = (!pipeOpts || pipeOpts.end !== false);

    var endFn = doEnd ? onend : cleanup;
    if (state.endEmitted) nextTick$1(endFn);else src.once('end', endFn);

    dest.on('unpipe', onunpipe);
    function onunpipe(readable) {
      debug('onunpipe');
      if (readable === src) {
        cleanup();
      }
    }

    function onend() {
      debug('onend');
      dest.end();
    }

    // when the dest drains, it reduces the awaitDrain counter
    // on the source.  This would be more elegant with a .once()
    // handler in flow(), but adding and removing repeatedly is
    // too slow.
    var ondrain = pipeOnDrain(src);
    dest.on('drain', ondrain);

    var cleanedUp = false;
    function cleanup() {
      debug('cleanup');
      // cleanup event handlers once the pipe is broken
      dest.removeListener('close', onclose);
      dest.removeListener('finish', onfinish);
      dest.removeListener('drain', ondrain);
      dest.removeListener('error', onerror);
      dest.removeListener('unpipe', onunpipe);
      src.removeListener('end', onend);
      src.removeListener('end', cleanup);
      src.removeListener('data', ondata);

      cleanedUp = true;

      // if the reader is waiting for a drain event from this
      // specific writer, then it would cause it to never start
      // flowing again.
      // So, if this is awaiting a drain, then we just call it now.
      // If we don't know, then assume that we are waiting for one.
      if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
    }

    // If the user pushes more data while we're writing to dest then we'll end up
    // in ondata again. However, we only want to increase awaitDrain once because
    // dest will only emit one 'drain' event for the multiple writes.
    // => Introduce a guard on increasing awaitDrain.
    var increasedAwaitDrain = false;
    src.on('data', ondata);
    function ondata(chunk) {
      debug('ondata');
      increasedAwaitDrain = false;
      var ret = dest.write(chunk);
      if (false === ret && !increasedAwaitDrain) {
        // If the user unpiped during `dest.write()`, it is possible
        // to get stuck in a permanently paused state if that write
        // also returned false.
        // => Check whether `dest` is still a piping destination.
        if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
          debug('false write response, pause', src._readableState.awaitDrain);
          src._readableState.awaitDrain++;
          increasedAwaitDrain = true;
        }
        src.pause();
      }
    }

    // if the dest has an error, then stop piping into it.
    // however, don't suppress the throwing behavior for this.
    function onerror(er) {
      debug('onerror', er);
      unpipe();
      dest.removeListener('error', onerror);
      if (listenerCount(dest, 'error') === 0) dest.emit('error', er);
    }

    // Make sure our error handler is attached before userland ones.
    prependListener(dest, 'error', onerror);

    // Both close and finish should trigger unpipe, but only once.
    function onclose() {
      dest.removeListener('finish', onfinish);
      unpipe();
    }
    dest.once('close', onclose);
    function onfinish() {
      debug('onfinish');
      dest.removeListener('close', onclose);
      unpipe();
    }
    dest.once('finish', onfinish);

    function unpipe() {
      debug('unpipe');
      src.unpipe(dest);
    }

    // tell the dest that it's being piped to
    dest.emit('pipe', src);

    // start the flow if it hasn't been started already.
    if (!state.flowing) {
      debug('pipe resume');
      src.resume();
    }

    return dest;
  };

  function pipeOnDrain(src) {
    return function () {
      var state = src._readableState;
      debug('pipeOnDrain', state.awaitDrain);
      if (state.awaitDrain) state.awaitDrain--;
      if (state.awaitDrain === 0 && src.listeners('data').length) {
        state.flowing = true;
        flow(src);
      }
    };
  }

  Readable.prototype.unpipe = function (dest) {
    var state = this._readableState;

    // if we're not piping anywhere, then do nothing.
    if (state.pipesCount === 0) return this;

    // just one destination.  most common case.
    if (state.pipesCount === 1) {
      // passed in one, but it's not the right one.
      if (dest && dest !== state.pipes) return this;

      if (!dest) dest = state.pipes;

      // got a match.
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;
      if (dest) dest.emit('unpipe', this);
      return this;
    }

    // slow case. multiple pipe destinations.

    if (!dest) {
      // remove all.
      var dests = state.pipes;
      var len = state.pipesCount;
      state.pipes = null;
      state.pipesCount = 0;
      state.flowing = false;

      for (var _i = 0; _i < len; _i++) {
        dests[_i].emit('unpipe', this);
      }return this;
    }

    // try to find the right one.
    var i = indexOf(state.pipes, dest);
    if (i === -1) return this;

    state.pipes.splice(i, 1);
    state.pipesCount -= 1;
    if (state.pipesCount === 1) state.pipes = state.pipes[0];

    dest.emit('unpipe', this);

    return this;
  };

  // set up data events if they are asked for
  // Ensure readable listeners eventually get something
  Readable.prototype.on = function (ev, fn) {
    var res = events.prototype.on.call(this, ev, fn);

    if (ev === 'data') {
      // Start flowing on next tick if stream isn't explicitly paused
      if (this._readableState.flowing !== false) this.resume();
    } else if (ev === 'readable') {
      var state = this._readableState;
      if (!state.endEmitted && !state.readableListening) {
        state.readableListening = state.needReadable = true;
        state.emittedReadable = false;
        if (!state.reading) {
          nextTick$1(nReadingNextTick, this);
        } else if (state.length) {
          emitReadable(this);
        }
      }
    }

    return res;
  };
  Readable.prototype.addListener = Readable.prototype.on;

  function nReadingNextTick(self) {
    debug('readable nexttick read 0');
    self.read(0);
  }

  // pause() and resume() are remnants of the legacy readable stream API
  // If the user uses them, then switch into old mode.
  Readable.prototype.resume = function () {
    var state = this._readableState;
    if (!state.flowing) {
      debug('resume');
      state.flowing = true;
      resume$1(this, state);
    }
    return this;
  };

  function resume$1(stream, state) {
    if (!state.resumeScheduled) {
      state.resumeScheduled = true;
      nextTick$1(resume_, stream, state);
    }
  }

  function resume_(stream, state) {
    if (!state.reading) {
      debug('resume read 0');
      stream.read(0);
    }

    state.resumeScheduled = false;
    state.awaitDrain = 0;
    stream.emit('resume');
    flow(stream);
    if (state.flowing && !state.reading) stream.read(0);
  }

  Readable.prototype.pause = function () {
    debug('call pause flowing=%j', this._readableState.flowing);
    if (false !== this._readableState.flowing) {
      debug('pause');
      this._readableState.flowing = false;
      this.emit('pause');
    }
    return this;
  };

  function flow(stream) {
    var state = stream._readableState;
    debug('flow', state.flowing);
    while (state.flowing && stream.read() !== null) {}
  }

  // wrap an old-style stream as the async data source.
  // This is *not* part of the readable stream interface.
  // It is an ugly unfortunate mess of history.
  Readable.prototype.wrap = function (stream) {
    var state = this._readableState;
    var paused = false;

    var self = this;
    stream.on('end', function () {
      debug('wrapped end');
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) self.push(chunk);
      }

      self.push(null);
    });

    stream.on('data', function (chunk) {
      debug('wrapped data');
      if (state.decoder) chunk = state.decoder.write(chunk);

      // don't skip over falsy values in objectMode
      if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

      var ret = self.push(chunk);
      if (!ret) {
        paused = true;
        stream.pause();
      }
    });

    // proxy all the other methods.
    // important when wrapping filters and duplexes.
    for (var i in stream) {
      if (this[i] === undefined && typeof stream[i] === 'function') {
        this[i] = function (method) {
          return function () {
            return stream[method].apply(stream, arguments);
          };
        }(i);
      }
    }

    // proxy certain important events.
    var events = ['error', 'close', 'destroy', 'pause', 'resume'];
    forEach(events, function (ev) {
      stream.on(ev, self.emit.bind(self, ev));
    });

    // when we try to consume some more bytes, simply unpause the
    // underlying stream.
    self._read = function (n) {
      debug('wrapped _read', n);
      if (paused) {
        paused = false;
        stream.resume();
      }
    };

    return self;
  };

  // exposed for testing purposes only.
  Readable._fromList = fromList;

  // Pluck off n bytes from an array of buffers.
  // Length is the combined lengths of all the buffers in the list.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromList(n, state) {
    // nothing buffered
    if (state.length === 0) return null;

    var ret;
    if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
      // read it all, truncate the list
      if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
      state.buffer.clear();
    } else {
      // read part of list
      ret = fromListPartial(n, state.buffer, state.decoder);
    }

    return ret;
  }

  // Extracts only enough buffered data to satisfy the amount requested.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function fromListPartial(n, list, hasStrings) {
    var ret;
    if (n < list.head.data.length) {
      // slice is the same for buffers and strings
      ret = list.head.data.slice(0, n);
      list.head.data = list.head.data.slice(n);
    } else if (n === list.head.data.length) {
      // first chunk is a perfect match
      ret = list.shift();
    } else {
      // result spans more than one buffer
      ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
    }
    return ret;
  }

  // Copies a specified amount of characters from the list of buffered data
  // chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBufferString(n, list) {
    var p = list.head;
    var c = 1;
    var ret = p.data;
    n -= ret.length;
    while (p = p.next) {
      var str = p.data;
      var nb = n > str.length ? str.length : n;
      if (nb === str.length) ret += str;else ret += str.slice(0, n);
      n -= nb;
      if (n === 0) {
        if (nb === str.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = str.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  // Copies a specified amount of bytes from the list of buffered data chunks.
  // This function is designed to be inlinable, so please take care when making
  // changes to the function body.
  function copyFromBuffer(n, list) {
    var ret = Buffer$1.allocUnsafe(n);
    var p = list.head;
    var c = 1;
    p.data.copy(ret);
    n -= p.data.length;
    while (p = p.next) {
      var buf = p.data;
      var nb = n > buf.length ? buf.length : n;
      buf.copy(ret, ret.length - n, 0, nb);
      n -= nb;
      if (n === 0) {
        if (nb === buf.length) {
          ++c;
          if (p.next) list.head = p.next;else list.head = list.tail = null;
        } else {
          list.head = p;
          p.data = buf.slice(nb);
        }
        break;
      }
      ++c;
    }
    list.length -= c;
    return ret;
  }

  function endReadable(stream) {
    var state = stream._readableState;

    // If we get here before consuming all the bytes, then that is a
    // bug in node.  Should never happen.
    if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

    if (!state.endEmitted) {
      state.ended = true;
      nextTick$1(endReadableNT, state, stream);
    }
  }

  function endReadableNT(state, stream) {
    // Check that we didn't get one last unshift.
    if (!state.endEmitted && state.length === 0) {
      state.endEmitted = true;
      stream.readable = false;
      stream.emit('end');
    }
  }

  function forEach(xs, f) {
    for (var i = 0, l = xs.length; i < l; i++) {
      f(xs[i], i);
    }
  }

  function indexOf(xs, x) {
    for (var i = 0, l = xs.length; i < l; i++) {
      if (xs[i] === x) return i;
    }
    return -1;
  }

  // A bit simpler than readable streams.
  Writable$1.WritableState = WritableState;
  inherits$1(Writable$1, events.EventEmitter);

  function nop() {}

  function WriteReq(chunk, encoding, cb) {
    this.chunk = chunk;
    this.encoding = encoding;
    this.callback = cb;
    this.next = null;
  }

  function WritableState(options, stream) {
    Object.defineProperty(this, 'buffer', {
      get: deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.')
    });
    options = options || {};

    // object stream flag to indicate whether or not this stream
    // contains buffers or objects.
    this.objectMode = !!options.objectMode;

    if (stream instanceof Duplex$1) this.objectMode = this.objectMode || !!options.writableObjectMode;

    // the point at which write() starts returning false
    // Note: 0 is a valid value, means that we always return false if
    // the entire buffer is not flushed immediately on write()
    var hwm = options.highWaterMark;
    var defaultHwm = this.objectMode ? 16 : 16 * 1024;
    this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

    // cast to ints.
    this.highWaterMark = ~ ~this.highWaterMark;

    this.needDrain = false;
    // at the start of calling end()
    this.ending = false;
    // when end() has been called, and returned
    this.ended = false;
    // when 'finish' is emitted
    this.finished = false;

    // should we decode strings into buffers before passing to _write?
    // this is here so that some node-core streams can optimize string
    // handling at a lower level.
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // not an actual buffer we keep track of, but a measurement
    // of how much we're waiting to get pushed to some underlying
    // socket or file.
    this.length = 0;

    // a flag to see when we're in the middle of a write.
    this.writing = false;

    // when true all writes will be buffered until .uncork() call
    this.corked = 0;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, because any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // a flag to know if we're processing previously buffered items, which
    // may call the _write() callback in the same tick, so that we don't
    // end up in an overlapped onwrite situation.
    this.bufferProcessing = false;

    // the callback that's passed to _write(chunk,cb)
    this.onwrite = function (er) {
      onwrite(stream, er);
    };

    // the callback that the user supplies to write(chunk,encoding,cb)
    this.writecb = null;

    // the amount that is being written when _write is called.
    this.writelen = 0;

    this.bufferedRequest = null;
    this.lastBufferedRequest = null;

    // number of pending user-supplied write callbacks
    // this must be 0 before 'finish' can be emitted
    this.pendingcb = 0;

    // emit prefinish if the only thing we're waiting for is _write cbs
    // This is relevant for synchronous Transform streams
    this.prefinished = false;

    // True if the error was already emitted and should not be thrown again
    this.errorEmitted = false;

    // count buffered requests
    this.bufferedRequestCount = 0;

    // allocate the first CorkedRequest, there is always
    // one allocated and free to use, and we maintain at most two
    this.corkedRequestsFree = new CorkedRequest(this);
  }

  WritableState.prototype.getBuffer = function writableStateGetBuffer() {
    var current = this.bufferedRequest;
    var out = [];
    while (current) {
      out.push(current);
      current = current.next;
    }
    return out;
  };
  function Writable$1(options) {

    // Writable ctor is applied to Duplexes, though they're not
    // instanceof Writable, they're instanceof Readable.
    if (!(this instanceof Writable$1) && !(this instanceof Duplex$1)) return new Writable$1(options);

    this._writableState = new WritableState(options, this);

    // legacy.
    this.writable = true;

    if (options) {
      if (typeof options.write === 'function') this._write = options.write;

      if (typeof options.writev === 'function') this._writev = options.writev;
    }

    events.EventEmitter.call(this);
  }

  // Otherwise people can pipe Writable streams, which is just wrong.
  Writable$1.prototype.pipe = function () {
    this.emit('error', new Error('Cannot pipe, not readable'));
  };

  function writeAfterEnd(stream, cb) {
    var er = new Error('write after end');
    // TODO: defer error events consistently everywhere, not just the cb
    stream.emit('error', er);
    nextTick$1(cb, er);
  }

  // If we get something that is not a buffer, string, null, or undefined,
  // and we're not in objectMode, then that's an error.
  // Otherwise stream chunks are all considered to be of length=1, and the
  // watermarks determine how many objects to keep in the buffer, rather than
  // how many bytes or characters.
  function validChunk(stream, state, chunk, cb) {
    var valid = true;
    var er = false;
    // Always throw error if a null is written
    // if we are not in object mode then throw
    // if it is not a buffer, string, or undefined.
    if (chunk === null) {
      er = new TypeError('May not write null values to stream');
    } else if (!buffer.Buffer.isBuffer(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
      er = new TypeError('Invalid non-string/buffer chunk');
    }
    if (er) {
      stream.emit('error', er);
      nextTick$1(cb, er);
      valid = false;
    }
    return valid;
  }

  Writable$1.prototype.write = function (chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (buffer.Buffer.isBuffer(chunk)) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

    if (typeof cb !== 'function') cb = nop;

    if (state.ended) writeAfterEnd(this, cb);else if (validChunk(this, state, chunk, cb)) {
      state.pendingcb++;
      ret = writeOrBuffer(this, state, chunk, encoding, cb);
    }

    return ret;
  };

  Writable$1.prototype.cork = function () {
    var state = this._writableState;

    state.corked++;
  };

  Writable$1.prototype.uncork = function () {
    var state = this._writableState;

    if (state.corked) {
      state.corked--;

      if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
    }
  };

  Writable$1.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
    // node::ParseEncoding() requires lower case.
    if (typeof encoding === 'string') encoding = encoding.toLowerCase();
    if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
    this._writableState.defaultEncoding = encoding;
    return this;
  };

  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
      chunk = buffer.Buffer.from(chunk, encoding);
    }
    return chunk;
  }

  // if we're already writing something, then just put this
  // in the queue, and wait our turn.  Otherwise, call _write
  // If we return false, then we need a drain event, so set that flag.
  function writeOrBuffer(stream, state, chunk, encoding, cb) {
    chunk = decodeChunk(state, chunk, encoding);

    if (buffer.Buffer.isBuffer(chunk)) encoding = 'buffer';
    var len = state.objectMode ? 1 : chunk.length;

    state.length += len;

    var ret = state.length < state.highWaterMark;
    // we must ensure that previous needDrain will not be reset to false.
    if (!ret) state.needDrain = true;

    if (state.writing || state.corked) {
      var last = state.lastBufferedRequest;
      state.lastBufferedRequest = new WriteReq(chunk, encoding, cb);
      if (last) {
        last.next = state.lastBufferedRequest;
      } else {
        state.bufferedRequest = state.lastBufferedRequest;
      }
      state.bufferedRequestCount += 1;
    } else {
      doWrite(stream, state, false, len, chunk, encoding, cb);
    }

    return ret;
  }

  function doWrite(stream, state, writev, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }

  function onwriteError(stream, state, sync, er, cb) {
    --state.pendingcb;
    if (sync) nextTick$1(cb, er);else cb(er);

    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  }

  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }

  function onwrite(stream, er) {
    var state = stream._writableState;
    var sync = state.sync;
    var cb = state.writecb;

    onwriteStateUpdate(state);

    if (er) onwriteError(stream, state, sync, er, cb);else {
      // Check if we're actually ready to finish, but don't emit yet
      var finished = needFinish(state);

      if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
        clearBuffer(stream, state);
      }

      if (sync) {
        /*<replacement>*/
          nextTick$1(afterWrite, stream, state, finished, cb);
        /*</replacement>*/
      } else {
          afterWrite(stream, state, finished, cb);
        }
    }
  }

  function afterWrite(stream, state, finished, cb) {
    if (!finished) onwriteDrain(stream, state);
    state.pendingcb--;
    cb();
    finishMaybe(stream, state);
  }

  // Must force callback to be called on nextTick, so that we don't
  // emit 'drain' before the write() consumer gets the 'false' return
  // value, and has a chance to attach a 'drain' listener.
  function onwriteDrain(stream, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream.emit('drain');
    }
  }

  // if there's something in the buffer waiting, then process it
  function clearBuffer(stream, state) {
    state.bufferProcessing = true;
    var entry = state.bufferedRequest;

    if (stream._writev && entry && entry.next) {
      // Fast case, write everything using _writev()
      var l = state.bufferedRequestCount;
      var buffer = new Array(l);
      var holder = state.corkedRequestsFree;
      holder.entry = entry;

      var count = 0;
      while (entry) {
        buffer[count] = entry;
        entry = entry.next;
        count += 1;
      }

      doWrite(stream, state, true, state.length, buffer, '', holder.finish);

      // doWrite is almost always async, defer these to save a bit of time
      // as the hot path ends with doWrite
      state.pendingcb++;
      state.lastBufferedRequest = null;
      if (holder.next) {
        state.corkedRequestsFree = holder.next;
        holder.next = null;
      } else {
        state.corkedRequestsFree = new CorkedRequest(state);
      }
    } else {
      // Slow case, write chunks one-by-one
      while (entry) {
        var chunk = entry.chunk;
        var encoding = entry.encoding;
        var cb = entry.callback;
        var len = state.objectMode ? 1 : chunk.length;

        doWrite(stream, state, false, len, chunk, encoding, cb);
        entry = entry.next;
        // if we didn't call the onwrite immediately, then
        // it means that we need to wait until it does.
        // also, that means that the chunk and cb are currently
        // being processed, so move the buffer counter past them.
        if (state.writing) {
          break;
        }
      }

      if (entry === null) state.lastBufferedRequest = null;
    }

    state.bufferedRequestCount = 0;
    state.bufferedRequest = entry;
    state.bufferProcessing = false;
  }

  Writable$1.prototype._write = function (chunk, encoding, cb) {
    cb(new Error('not implemented'));
  };

  Writable$1.prototype._writev = null;

  Writable$1.prototype.end = function (chunk, encoding, cb) {
    var state = this._writableState;

    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

    // .end() fully uncorks
    if (state.corked) {
      state.corked = 1;
      this.uncork();
    }

    // ignore unnecessary end() calls.
    if (!state.ending && !state.finished) endWritable(this, state, cb);
  };

  function needFinish(state) {
    return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
  }

  function prefinish(stream, state) {
    if (!state.prefinished) {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }

  function finishMaybe(stream, state) {
    var need = needFinish(state);
    if (need) {
      if (state.pendingcb === 0) {
        prefinish(stream, state);
        state.finished = true;
        stream.emit('finish');
      } else {
        prefinish(stream, state);
      }
    }
    return need;
  }

  function endWritable(stream, state, cb) {
    state.ending = true;
    finishMaybe(stream, state);
    if (cb) {
      if (state.finished) nextTick$1(cb);else stream.once('finish', cb);
    }
    state.ended = true;
    stream.writable = false;
  }

  // It seems a linked list but it is not
  // there will be only 2 of these for each stream
  function CorkedRequest(state) {
    var _this = this;

    this.next = null;
    this.entry = null;

    this.finish = function (err) {
      var entry = _this.entry;
      _this.entry = null;
      while (entry) {
        var cb = entry.callback;
        state.pendingcb--;
        cb(err);
        entry = entry.next;
      }
      if (state.corkedRequestsFree) {
        state.corkedRequestsFree.next = _this;
      } else {
        state.corkedRequestsFree = _this;
      }
    };
  }

  inherits$1(Duplex$1, Readable);

  var keys = Object.keys(Writable$1.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex$1.prototype[method]) Duplex$1.prototype[method] = Writable$1.prototype[method];
  }
  function Duplex$1(options) {
    if (!(this instanceof Duplex$1)) return new Duplex$1(options);

    Readable.call(this, options);
    Writable$1.call(this, options);

    if (options && options.readable === false) this.readable = false;

    if (options && options.writable === false) this.writable = false;

    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

    this.once('end', onend);
  }

  // the no-half-open enforcer
  function onend() {
    // if we allow half-open state, or if the writable side ended,
    // then we're ok.
    if (this.allowHalfOpen || this._writableState.ended) return;

    // no more data can be written.
    // But allow more writes to happen in this tick.
    nextTick$1(onEndNT, this);
  }

  function onEndNT(self) {
    self.end();
  }

  // a transform stream is a readable/writable stream where you do
  inherits$1(Transform, Duplex$1);

  function TransformState(stream) {
    this.afterTransform = function (er, data) {
      return afterTransform(stream, er, data);
    };

    this.needTransform = false;
    this.transforming = false;
    this.writecb = null;
    this.writechunk = null;
    this.writeencoding = null;
  }

  function afterTransform(stream, er, data) {
    var ts = stream._transformState;
    ts.transforming = false;

    var cb = ts.writecb;

    if (!cb) return stream.emit('error', new Error('no writecb in Transform class'));

    ts.writechunk = null;
    ts.writecb = null;

    if (data !== null && data !== undefined) stream.push(data);

    cb(er);

    var rs = stream._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read(rs.highWaterMark);
    }
  }
  function Transform(options) {
    if (!(this instanceof Transform)) return new Transform(options);

    Duplex$1.call(this, options);

    this._transformState = new TransformState(this);

    // when the writable side finishes, then flush out anything remaining.
    var stream = this;

    // start out asking for a readable event once data is transformed.
    this._readableState.needReadable = true;

    // we have implemented the _read method, and done the other things
    // that Readable wants before the first _read call, so unset the
    // sync guard flag.
    this._readableState.sync = false;

    if (options) {
      if (typeof options.transform === 'function') this._transform = options.transform;

      if (typeof options.flush === 'function') this._flush = options.flush;
    }

    this.once('prefinish', function () {
      if (typeof this._flush === 'function') this._flush(function (er) {
        done(stream, er);
      });else done(stream);
    });
  }

  Transform.prototype.push = function (chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex$1.prototype.push.call(this, chunk, encoding);
  };

  // This is the part where you do stuff!
  // override this function in implementation classes.
  // 'chunk' is an input chunk.
  //
  // Call `push(newChunk)` to pass along transformed output
  // to the readable side.  You may call 'push' zero or more times.
  //
  // Call `cb(err)` when you are done with this chunk.  If you pass
  // an error, then that'll put the hurt on the whole operation.  If you
  // never call cb(), then you'll never get another chunk.
  Transform.prototype._transform = function (chunk, encoding, cb) {
    throw new Error('Not implemented');
  };

  Transform.prototype._write = function (chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
    }
  };

  // Doesn't matter what the args are here.
  // _transform does all the work.
  // That we got here means that the readable side wants more data.
  Transform.prototype._read = function (n) {
    var ts = this._transformState;

    if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      // mark that we need a transform, so that any data that comes in
      // will get processed, now that we've asked for it.
      ts.needTransform = true;
    }
  };

  function done(stream, er) {
    if (er) return stream.emit('error', er);

    // if there's nothing in the write buffer, then that means
    // that nothing more will ever be provided
    var ws = stream._writableState;
    var ts = stream._transformState;

    if (ws.length) throw new Error('Calling transform done when ws.length != 0');

    if (ts.transforming) throw new Error('Calling transform done when still transforming');

    return stream.push(null);
  }

  inherits$1(PassThrough, Transform);
  function PassThrough(options) {
    if (!(this instanceof PassThrough)) return new PassThrough(options);

    Transform.call(this, options);
  }

  PassThrough.prototype._transform = function (chunk, encoding, cb) {
    cb(null, chunk);
  };

  inherits$1(Stream, events);
  Stream.Readable = Readable;
  Stream.Writable = Writable$1;
  Stream.Duplex = Duplex$1;
  Stream.Transform = Transform;
  Stream.PassThrough = PassThrough;

  // Backwards-compat with node 0.4.x
  Stream.Stream = Stream;

  // old-style streams.  Note that the pipe method (the only relevant
  // part of this class) is overridden in the Readable class.

  function Stream() {
    events.call(this);
  }

  Stream.prototype.pipe = function(dest, options) {
    var source = this;

    function ondata(chunk) {
      if (dest.writable) {
        if (false === dest.write(chunk) && source.pause) {
          source.pause();
        }
      }
    }

    source.on('data', ondata);

    function ondrain() {
      if (source.readable && source.resume) {
        source.resume();
      }
    }

    dest.on('drain', ondrain);

    // If the 'end' option is not supplied, dest.end() will be called when
    // source gets the 'end' or 'close' events.  Only dest.end() once.
    if (!dest._isStdio && (!options || options.end !== false)) {
      source.on('end', onend);
      source.on('close', onclose);
    }

    var didOnEnd = false;
    function onend() {
      if (didOnEnd) return;
      didOnEnd = true;

      dest.end();
    }


    function onclose() {
      if (didOnEnd) return;
      didOnEnd = true;

      if (typeof dest.destroy === 'function') dest.destroy();
    }

    // don't leave dangling pipes when there are errors.
    function onerror(er) {
      cleanup();
      if (events.listenerCount(this, 'error') === 0) {
        throw er; // Unhandled stream error in pipe.
      }
    }

    source.on('error', onerror);
    dest.on('error', onerror);

    // remove all the event listeners that were added.
    function cleanup() {
      source.removeListener('data', ondata);
      dest.removeListener('drain', ondrain);

      source.removeListener('end', onend);
      source.removeListener('close', onclose);

      source.removeListener('error', onerror);
      dest.removeListener('error', onerror);

      source.removeListener('end', cleanup);
      source.removeListener('close', cleanup);

      dest.removeListener('close', cleanup);
    }

    source.on('end', cleanup);
    source.on('close', cleanup);

    dest.on('close', cleanup);

    dest.emit('pipe', source);

    // Allow for unix-like usage: A.pipe(B).pipe(C)
    return dest;
  };

  var stream$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': Stream,
    Readable: Readable,
    Writable: Writable$1,
    Duplex: Duplex$1,
    Transform: Transform,
    PassThrough: PassThrough,
    Stream: Stream
  });

  var require$$0$2 = /*@__PURE__*/getAugmentedNamespace(stream$1);

  (function (exports) {
  	var crypto = require$$2;
  	var chacha20$1 = chacha20;

  	// encode a packet
  	exports.encode = function(head, body)
  	{
  	  // support different arg types
  	  if(head === null) head = false; // grrrr
  	  if(typeof head == 'number') head = new Buffer$1(String.fromCharCode(json));
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
  	      head = new Buffer$1(JSON.stringify(head));
  	      // require real json object
  	      if(head.length < 7) head = false;
  	    }
  	  }
  	  head = head || new Buffer$1(0);
  	  if(typeof body == 'string') body = new Buffer$1(body, 'binary');
  	  body = body || new Buffer$1(0);
  	  var len = new Buffer$1(2);
  	  len.writeInt16BE(head.length, 0);
  	  return Buffer$1.concat([len, head, body]);
  	};

  	// packet decoding, add values to a buffer return
  	exports.decode =function(bin)
  	{
  	  if(!bin) return undefined;
  	  var buf = (typeof bin == 'string') ? new Buffer$1(bin, 'binary') : bin;
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
  	var Transform = require$$0$2.Transform;
  	exports.stream = function(cbHead){
  	  var stream = new Transform();
  	  var buf = new Buffer$1(0);
  	  stream._transform = function(data,enc,cbTransform)
  	  {
  	    // no buffer means pass everything through
  	    if(!buf)
  	    {
  	      stream.push(data);
  	      return cbTransform();
  	    }
  	    // gather until full header
  	    buf = Buffer$1.concat([buf,data]);
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
  	var Duplex = require$$0$2.Duplex;
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
  	  var chunks = new Buffer$1(0);
  	  var data = new Buffer$1(0);
  	  stream._write = function(data2,enc,cbWrite)
  	  {
  	    // trigger an error when http is detected, but otherwise continue
  	    if(data.length == 0 && data2.slice(0,5).toString() == 'GET /')
  	    {
  	      cbPacket("HTTP detected",data2);
  	    }
  	    data = Buffer$1.concat([data,data2]);
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
  	          chunks = new Buffer$1(0);
  	          if(packet) cbPacket(false, packet);
  	        }
  	        data = data.slice(1);
  	        continue;
  	      }
  	      // not a full chunk yet, wait for more
  	      if(data.length < (len+1)) break;

  	      // full chunk, buffer it up
  	      blocked = false;
  	      chunks = Buffer$1.concat([chunks,data.slice(1,len+1)]);
  	      data = data.slice(len+1);
  	      // ensure a response when enabled
  	      if(args.ack)
  	      {
  	        if(!queue.length) queue.push(new Buffer$1("\0"));
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
  	      var len = new Buffer$1(1);
  	      var chunk = packet.slice(0,space);
  	      packet = packet.slice(chunk.length);
  	      len.writeUInt8(chunk.length,0);
  	      // check if we can include the packet terminating zero
  	      var zero = new Buffer$1(0);
  	      if(packet.length == 0 && chunk.length <= space)
  	      {
  	        zero = new Buffer$1("\0");
  	        packet = false;
  	      }
  	      queue.push(Buffer$1.concat([len,chunk,zero]));
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
  	  var cloaked = Buffer$1.concat([nonce, chacha20$1.encrypt(key, nonce, packet)]);
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

  var build$1 = {};

  var TCPClient$1 = {};

  var Client$1 = {};

  Object.defineProperty(Client$1, "__esModule", { value: true });
  Client$1.Client = void 0;
  /**
   * Class for wrapping a socket (TCP, Websocket or Virtual) under a common interface.
   *
   * Socket specific functions need to be overridden/implemented in dervived classes.
   */
  class Client {
      constructor(clientOptions) {
          /**
           * Base close event procedure responsible for triggering the close event.
           */
          this.socketClosed = (hadError) => {
              this.isClosed = true;
              this.triggerEvent("close", hadError);
          };
          /**
           * Base data event procedure responsible for triggering the data event.
           *
           * @param {Buffer} data - data buffer.
           *
           */
          this.socketData = (data) => {
              var _a;
              if (!(data instanceof Buffer$1)) {
                  throw "Must read buffer.";
              }
              const bufferData = ((_a = this.clientOptions) === null || _a === void 0 ? void 0 : _a.bufferData) === undefined ? true : this.clientOptions.bufferData;
              this.triggerEvent("data", data, bufferData);
          };
          /**
           * Base connect event procedure responsible for triggering the connect event.
           */
          this.socketConnected = () => {
              this.triggerEvent("connect");
          };
          /**
           * Base error event procedure responsible for triggering the error event.
           *
           * @param {Buffer} data - error message.
           *
           */
          this.socketError = (message) => {
              this.triggerEvent("error", message);
          };
          this.clientOptions = clientOptions;
          this.eventHandlers = {};
          this.isClosed = false;
      }
      /**
       * Connect to server.
       *
       */
      connect() {
          this.socketConnect();
          this.socketHook();
      }
      /**
       * Send string on socket.
       *
       */
      sendString(data) {
          this.send(Buffer$1.from(data));
      }
      /**
       * Send buffer on socket.
       *
       * @param {Buffer} data to be sent
       * @throws An error will be thrown when buffer data type is incompatible.
       */
      send(data) {
          if (this.isClosed) {
              return;
          }
          if (!(data instanceof Buffer$1)) {
              throw "Data must be of Buffer type.";
          }
          this.socketSend(data);
      }
      /**
       * Close socket.
       */
      close() {
          if (this.isClosed) {
              return;
          }
          this.socketClose();
      }
      /**
       * User hook for socket errors.
       *
       * @param {Function} fn - on error callback. Function is passed a Buffer object with the error message
       *
       */
      onError(fn) {
          this.on("error", fn);
      }
      /**
       * Unhook handler for socket errors.
       *
       * @param {Function} fn - remove existing error callback
       *
       */
      offError(fn) {
          this.off("error", fn);
      }
      /**
       * User hook for incoming data.
       *
       * @param {Function} fn - on data callback. Function is passed a Buffer object.
       */
      onData(fn) {
          this.on("data", fn);
      }
      /**
       * Unhook handler for incoming data.
       *
       * @param {Function} fn - remove data callback.
       *
       */
      offData(fn) {
          this.off("data", fn);
      }
      /**
       * User hook for connection event.
       *
       * @param {Function} fn - on connect callback.
       *
       */
      onConnect(fn) {
          this.on("connect", fn);
      }
      /**
       * Unhook handler for connection event.
       *
       * @param {Function} fn - remove connect callback.
       *
       */
      offConnect(fn) {
          this.off("connect", fn);
      }
      /**
       * User hook for close event.
       *
       * @param {Function} fn - on close callback.
       *
       */
      onClose(fn) {
          this.on("close", fn);
      }
      /**
       * Unhook handler for close event.
       *
       * @param {Function} fn - remove close callback.
       *
       */
      offClose(fn) {
          this.off("close", fn);
      }
      getLocalAddress() {
          // Override in implementation if applicable
          return undefined;
      }
      getRemoteAddress() {
          // Override in implementation if applicable
          return undefined;
      }
      getRemotePort() {
          // Override in implementation if applicable
          return undefined;
      }
      getLocalPort() {
          // Override in implementation if applicable
          return undefined;
      }
      /**
       * Unread data by putting it back into the event queue.
       * @param {Buffer} data
       */
      unRead(data) {
          var _a;
          const bufferData = ((_a = this.clientOptions) === null || _a === void 0 ? void 0 : _a.bufferData) === undefined ? true : this.clientOptions.bufferData;
          this.triggerEvent("data", data, bufferData, true);
      }
      /**
       * Create the socket object and initiate a connection.
       * This only done for initiating client sockets.
       * A server listener socket client is already connected and must be passed in the constructor.
       */
      socketConnect() {
          throw "Function not implemented.";
      }
      /**
       * Hook events on the socket.
       */
      socketHook() {
          throw "Function not implemented.";
      }
      /**
       * Send the given buffer on socket.
       * Socket specific implementation.
       */
      socketSend(buffer) {
          throw "Function not implemented.";
      }
      /**
       * Socket-specific close procedure.
       */
      socketClose() {
          throw "Function not implemented.";
      }
      /**
       * Base "off" event procedure responsible for removing a callback from the list of event handlers.
       *
       * @param {string} event - event name.
       * @param {Function} fn - callback.
       *
       */
      off(event, fn) {
          const [fns, queue] = (this.eventHandlers[event] || [[], []]);
          const index = fns.indexOf(fn);
          if (index > -1) {
              fns.splice(index, 1);
          }
      }
      /**
       * Base "on" event procedure responsible for adding a callback to the list of event handlers.
       *
       * @param {string} event - event name.
       * @param {Function} fn - callback.
       *
       */
      on(event, fn) {
          const tuple = (this.eventHandlers[event] || [[], []]);
          this.eventHandlers[event] = tuple;
          const [fns, queue] = tuple;
          if (fns.length === 0) {
              // Send buffered up events.
              queue.forEach((event) => {
                  fn(event);
              });
              queue.length = 0;
          }
          fns.push(fn);
      }
      /**
       * Trigger event calls the appropriate handler based on the event name.
       *
       * @param {string} event - event name.
       * @param {Buffer} [data] - event data.
       * @param {boolean} [doBuffer] - buffers up event data.
       * @param {boolean} [invertOrder] - used for "unreading" an event and puts it first in the queue (if doBuffer is true)
       *
       */
      triggerEvent(event, data, doBuffer = false, invertOrder = false) {
          const tuple = (this.eventHandlers[event] || [[], []]);
          this.eventHandlers[event] = tuple;
          const [fns, queue] = tuple;
          if (fns.length === 0) {
              if (doBuffer) {
                  // Buffer up the event
                  if (invertOrder) {
                      queue.unshift(data);
                  }
                  else {
                      queue.push(data);
                  }
              }
          }
          else {
              fns.forEach((fn) => {
                  fn(data);
              });
          }
      }
  }
  Client$1.Client = Client;

  var __createBinding$3 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  }) : (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      o[k2] = m[k];
  }));
  var __setModuleDefault$3 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
  }) : function(o, v) {
      o["default"] = v;
  });
  var __importStar$3 = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding$3(result, mod, k);
      __setModuleDefault$3(result, mod);
      return result;
  };
  Object.defineProperty(TCPClient$1, "__esModule", { value: true });
  TCPClient$1.TCPClient = void 0;
  const net$2 = __importStar$3(require$$2);
  const tls$2 = __importStar$3(require$$2);
  const Client_1$2 = Client$1;
  /**
   * TCP client socket implementation.
   */
  class TCPClient extends Client_1$2.Client {
      constructor(clientOptions, socket) {
          super(clientOptions);
          this.error = (error) => {
              this.socketError(Buffer$1.from(error.message));
          };
          this.socket = socket;
          if (this.socket) {
              this.socketHook();
          }
      }
      /**
       * @return {string | undefined} local IP address
       */
      getLocalAddress() {
          if (this.socket && typeof this.socket.localAddress === "string") {
              return this.socket.localAddress;
          }
      }
      /**
       * @return {string | undefined} remote IP address
       */
      getRemoteAddress() {
          if (this.socket && typeof this.socket.remoteAddress === "string") {
              return this.socket.remoteAddress;
          }
      }
      /**
       * @return {number | undefined} remote port
       */
      getRemotePort() {
          if (this.socket && typeof this.socket.remotePort === "number") {
              return this.socket.remotePort;
          }
      }
      /**
       * @return {number | undefined} local port
       */
      getLocalPort() {
          if (this.socket && typeof this.socket.localPort === "number") {
              return this.socket.localPort;
          }
      }
      /**
       * Specifies how the socket gets initialized and created, then establishes a connection.
       */
      socketConnect() {
          if (this.socket) {
              throw "Socket already created.";
          }
          if (!this.clientOptions) {
              throw "clientOptions is required to create socket.";
          }
          const USE_TLS = this.clientOptions.secure ? true : false;
          if (USE_TLS) {
              this.socket = tls$2.connect({
                  host: this.clientOptions.host,
                  port: this.clientOptions.port,
                  cert: this.clientOptions.cert,
                  key: this.clientOptions.key,
                  rejectUnauthorized: this.clientOptions.rejectUnauthorized,
                  ca: this.clientOptions.ca
              });
              if (this.socket) {
                  this.socket.on("secureConnect", this.socketConnected);
              }
          }
          else {
              this.socket = net$2.connect({
                  host: this.clientOptions.host,
                  port: this.clientOptions.port,
              });
              if (this.socket) {
                  this.socket.on("connect", this.socketConnected);
              }
          }
          if (!this.socket) {
              throw "Could not create socket.";
          }
      }
      /**
       * Specifies hooks to be called as part of the connect procedure.
       */
      socketHook() {
          if (!this.socket) {
              return;
          }
          this.socket.on("data", this.socketData); // Incoming data
          this.socket.on("error", this.error); // Error connecting
          this.socket.on("close", this.socketClosed); // Socket closed
      }
      /**
       * Defines how data gets written to the socket.
       * @param {Buffer} buffer - data to be sent
       */
      socketSend(buffer) {
          if (this.socket) {
              this.socket.write(buffer);
          }
      }
      /**
       * Defines the steps to be performed during close.
       */
      socketClose() {
          if (this.socket) {
              this.socket.end();
          }
      }
  }
  TCPClient$1.TCPClient = TCPClient;

  var TCPServer$1 = {};

  var Server$1 = {};

  Object.defineProperty(Server$1, "__esModule", { value: true });
  Server$1.Server = void 0;
  /**
   * Boilerplate for creating and wrapping a server socket listener (TCP or Websocket) under a common interface.
   *
   * Socket specific functions need to be overridden/implemented.
   *
   */
  class Server {
      constructor(serverOptions) {
          /**
           * Internal error event implementation.
           *
           * @param {Error} err
           */
          this.serverError = (err) => {
              this.triggerEvent("error", (err && err.message) ? err.message : err);
          };
          /**
           * Internal close event implementation.
           */
          this.serverClosed = () => {
              this.isClosed = true;
              this.triggerEvent("close");
          };
          this.serverOptions = serverOptions;
          this.eventHandlers = {};
          this.clients = [];
          this.isClosed = false;
      }
      /**
       * Listens for connections and yields connected client sockets.
       *
       */
      listen() {
          this.serverListen();
      }
      /**
       * Close listener and all accepted socket clients.
       */
      close() {
          if (this.isClosed) {
              return;
          }
          this.serverClose();
          this.clients.forEach(client => client.close());
          this.clients = [];
      }
      /**
       * Event handler triggered when client has connected.
       *
       * A Client object is passed as argument to fn() of the instance type this.SocketClass.
       *
       * @param {Function} fn callback
       */
      onConnection(fn) {
          this.on("connection", fn);
      }
      /**
       * Event handler triggered when a server error occurs.
       *
       * An error object is passed as argument to fn().
       *
       * @param {Function} fn callback
       */
      onError(fn) {
          this.on("error", fn);
      }
      /**
       * Event handler triggered when server has closed together with all its client sockets.
       *
       * @param {Function} fn callback
       */
      onClose(fn) {
          this.on("close", fn);
      }
      /**
       * Create the server socket.
       */
      serverCreate() {
          throw "Not implemented.";
      }
      /**
       * Initiate the server listener.
       */
      serverListen() {
          throw "Not implemented.";
      }
      /**
       * Close the server.
       * Override as necessary.
       */
      serverClose() {
          throw "Not implemented.";
      }
      /**
       * Performs all operations involved in registering a new client connection.
       *
       * @param {Client} client
       */
      addClient(client) {
          this.clients.push(client);
          client.onClose(() => { this.removeClient(client); });
          this.triggerEvent("connection", client);
      }
      /**
       * Performs all operations involved in removing an existing client registration.
       *
       * @param {Client} client
       */
      removeClient(client) {
          const index = this.clients.indexOf(client);
          if (index > -1) {
              this.clients.splice(index, 1);
          }
      }
      /**
       * Internal event implementation.
       *
       * @param {string} event
       * @param {Function} fn
       */
      on(event, fn) {
          const fns = this.eventHandlers[event] || [];
          this.eventHandlers[event] = fns;
          fns.push(fn);
      }
      /**
       * Internal event trigger implementation.
       *
       * @param {string} event
       * @param {any} data
       */
      triggerEvent(event, data) {
          const fns = this.eventHandlers[event] || [];
          fns.forEach(fn => {
              fn(data);
          });
      }
  }
  Server$1.Server = Server;

  var __createBinding$2 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  }) : (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      o[k2] = m[k];
  }));
  var __setModuleDefault$2 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
  }) : function(o, v) {
      o["default"] = v;
  });
  var __importStar$2 = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding$2(result, mod, k);
      __setModuleDefault$2(result, mod);
      return result;
  };
  Object.defineProperty(TCPServer$1, "__esModule", { value: true });
  TCPServer$1.TCPServer = void 0;
  const net$1 = __importStar$2(require$$2);
  const tls$1 = __importStar$2(require$$2);
  const Server_1$1 = Server$1;
  const TCPClient_1 = TCPClient$1;
  /**
   * TCP server implementation.
   */
  class TCPServer extends Server_1$1.Server {
      constructor(serverOptions) {
          super(serverOptions);
          this.clientConnected = (socket) => {
              const client = new TCPClient_1.TCPClient({ bufferData: this.serverOptions.bufferData, port: this.serverOptions.port }, socket);
              this.addClient(client);
          };
          this.error = (error) => {
              this.serverError(Buffer$1.from(error.message));
          };
          this.serverCreate();
      }
      /**
       * Specifies how the server gets initialized, then creates the server with the specified options.
       */
      serverCreate() {
          var _a, _b, _c, _d, _e;
          const USE_TLS = this.serverOptions.cert != null;
          if (USE_TLS) {
              const tlsOptions = {
                  cert: this.serverOptions.cert,
                  key: this.serverOptions.key,
                  requestCert: this.serverOptions.requestCert,
                  rejectUnauthorized: this.serverOptions.rejectUnauthorized,
                  ca: this.serverOptions.ca,
                  handshakeTimeout: 30000,
              };
              this.server = tls$1.createServer(tlsOptions);
              (_a = this.server) === null || _a === void 0 ? void 0 : _a.on("secureConnection", this.clientConnected);
          }
          else {
              this.server = net$1.createServer();
              (_b = this.server) === null || _b === void 0 ? void 0 : _b.on("connection", this.clientConnected);
          }
          (_c = this.server) === null || _c === void 0 ? void 0 : _c.on("error", this.error);
          (_d = this.server) === null || _d === void 0 ? void 0 : _d.on("close", this.serverClosed);
          (_e = this.server) === null || _e === void 0 ? void 0 : _e.on("tlsClientError", (_err, socket) => socket.end());
      }
      /**
       * Starts a previously created server listening for connections.
       * Assumes the server is instantiated during object creation.
       */
      serverListen() {
          var _a;
          (_a = this.server) === null || _a === void 0 ? void 0 : _a.listen({
              host: this.serverOptions.host,
              port: this.serverOptions.port,
              ipv6Only: this.serverOptions.ipv6Only,
          });
      }
      serverClose() {
          if (this.server) {
              this.server.close();
          }
      }
  }
  TCPServer$1.TCPServer = TCPServer;

  var VirtualClient$1 = {};

  Object.defineProperty(VirtualClient$1, "__esModule", { value: true });
  VirtualClient$1.CreatePair = void 0;
  const Client_1$1 = Client$1;
  class VirtualClient extends Client_1$1.Client {
      /**
       * @constructor
       * @param {VirtualClient} [pairedSocket] When creating the second socket of a socket-pair provide the first socket as argument to get them paired.
       */
      constructor(pairedSocket) {
          super({ port: 0 });
          this.pairedSocket = pairedSocket;
          /** We can set this to simulate some latency in the paired socket communication */
          this.latency = 0; // Milliseconds
          /**
           * Queue of outgoing messages.
           * We need this if we use simulated latency,
           * because the ordering of setTimeout might not be guaranteed
           * for identical timeout values.
           */
          this.outQueue = [];
          /* Complete the pairing by assigning this socket as our paired socket's paired socket */
          if (this.pairedSocket) {
              this.pairedSocket.pairedSocket = this;
          }
      }
      /**
       * Set a simulated latency of the socket communications.
       *
       * @param {number} latency in milliseconds for each send
       */
      setLatency(latency) {
          if (latency < this.latency && this.outQueue.length > 0) {
              throw "Cannot decrease latency while data is still waiting to send.";
          }
          this.latency = latency;
      }
      /**
       * Hook events on the socket.
       */
      socketHook() {
          // Do nothing
          // We handle events in different ways since this is not an actual socket.
      }
      /**
       * Send the given buffer on socket.
       * @param {Buffer} buffer
       */
      socketSend(buffer) {
          // Put msg into paired socket.
          if (this.pairedSocket) {
              this.outQueue.push(buffer);
              if (this.latency > 0) {
                  setTimeout(() => this.copyToPaired(), this.latency);
              }
              else {
                  this.copyToPaired();
              }
          }
      }
      /**
       * Specify the paired close procedure.
       */
      socketClose() {
          const hadError = false;
          if (this.pairedSocket) {
              this.pairedSocket.socketClosed(hadError);
          }
          this.socketClosed(hadError);
      }
      /**
       * Internal function to copy one message in the out queue to the paired socket.
       *
       */
      copyToPaired() {
          if (this.pairedSocket) {
              const buffer = this.outQueue.shift();
              if (buffer) {
                  this.pairedSocket.socketData(buffer);
              }
          }
      }
  }
  function CreatePair() {
      const socket1 = new VirtualClient();
      const socket2 = new VirtualClient(socket1);
      return [socket1, socket2];
  }
  VirtualClient$1.CreatePair = CreatePair;

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

  function noop() {}

  var on = noop;
  var addListener = noop;
  var once$1 = noop;
  var off = noop;
  var removeListener = noop;
  var removeAllListeners = noop;
  var emit = noop;

  function binding$1(name) {
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
    once: once$1,
    off: off,
    removeListener: removeListener,
    removeAllListeners: removeAllListeners,
    emit: emit,
    binding: binding$1,
    cwd: cwd,
    chdir: chdir,
    umask: umask,
    hrtime: hrtime,
    platform: platform,
    release: release,
    config: config,
    uptime: uptime
  };

  var WSClient$1 = {};

  var hasFetch = isFunction(global$1.fetch) && isFunction(global$1.ReadableStream);

  var _blobConstructor;
  function blobConstructor() {
    if (typeof _blobConstructor !== 'undefined') {
      return _blobConstructor;
    }
    try {
      new global$1.Blob([new ArrayBuffer(1)]);
      _blobConstructor = true;
    } catch (e) {
      _blobConstructor = false;
    }
    return _blobConstructor
  }
  var xhr;

  function checkTypeSupport(type) {
    if (!xhr) {
      xhr = new global$1.XMLHttpRequest();
      // If location.host is empty, e.g. if this page/worker was loaded
      // from a Blob, then use example.com to avoid an error
      xhr.open('GET', global$1.location.host ? '/' : 'https://example.com');
    }
    try {
      xhr.responseType = type;
      return xhr.responseType === type
    } catch (e) {
      return false
    }

  }

  // For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
  // Safari 7.1 appears to have fixed this bug.
  var haveArrayBuffer = typeof global$1.ArrayBuffer !== 'undefined';
  var haveSlice = haveArrayBuffer && isFunction(global$1.ArrayBuffer.prototype.slice);

  var arraybuffer = haveArrayBuffer && checkTypeSupport('arraybuffer');
    // These next two tests unavoidably show warnings in Chrome. Since fetch will always
    // be used if it's available, just return false for these to avoid the warnings.
  var msstream = !hasFetch && haveSlice && checkTypeSupport('ms-stream');
  var mozchunkedarraybuffer = !hasFetch && haveArrayBuffer &&
    checkTypeSupport('moz-chunked-arraybuffer');
  var overrideMimeType = isFunction(xhr.overrideMimeType);
  var vbArray = isFunction(global$1.VBArray);

  function isFunction(value) {
    return typeof value === 'function'
  }

  xhr = null; // Help gc

  var rStates = {
    UNSENT: 0,
    OPENED: 1,
    HEADERS_RECEIVED: 2,
    LOADING: 3,
    DONE: 4
  };
  function IncomingMessage(xhr, response, mode) {
    var self = this;
    Readable.call(self);

    self._mode = mode;
    self.headers = {};
    self.rawHeaders = [];
    self.trailers = {};
    self.rawTrailers = [];

    // Fake the 'close' event, but only once 'end' fires
    self.on('end', function() {
      // The nextTick is necessary to prevent the 'request' module from causing an infinite loop
      nextTick(function() {
        self.emit('close');
      });
    });
    var read;
    if (mode === 'fetch') {
      self._fetchResponse = response;

      self.url = response.url;
      self.statusCode = response.status;
      self.statusMessage = response.statusText;
        // backwards compatible version of for (<item> of <iterable>):
        // for (var <item>,_i,_it = <iterable>[Symbol.iterator](); <item> = (_i = _it.next()).value,!_i.done;)
      for (var header, _i, _it = response.headers[Symbol.iterator](); header = (_i = _it.next()).value, !_i.done;) {
        self.headers[header[0].toLowerCase()] = header[1];
        self.rawHeaders.push(header[0], header[1]);
      }

      // TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
      var reader = response.body.getReader();

      read = function () {
        reader.read().then(function(result) {
          if (self._destroyed)
            return
          if (result.done) {
            self.push(null);
            return
          }
          self.push(new Buffer$1(result.value));
          read();
        });
      };
      read();

    } else {
      self._xhr = xhr;
      self._pos = 0;

      self.url = xhr.responseURL;
      self.statusCode = xhr.status;
      self.statusMessage = xhr.statusText;
      var headers = xhr.getAllResponseHeaders().split(/\r?\n/);
      headers.forEach(function(header) {
        var matches = header.match(/^([^:]+):\s*(.*)/);
        if (matches) {
          var key = matches[1].toLowerCase();
          if (key === 'set-cookie') {
            if (self.headers[key] === undefined) {
              self.headers[key] = [];
            }
            self.headers[key].push(matches[2]);
          } else if (self.headers[key] !== undefined) {
            self.headers[key] += ', ' + matches[2];
          } else {
            self.headers[key] = matches[2];
          }
          self.rawHeaders.push(matches[1], matches[2]);
        }
      });

      self._charset = 'x-user-defined';
      if (!overrideMimeType) {
        var mimeType = self.rawHeaders['mime-type'];
        if (mimeType) {
          var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/);
          if (charsetMatch) {
            self._charset = charsetMatch[1].toLowerCase();
          }
        }
        if (!self._charset)
          self._charset = 'utf-8'; // best guess
      }
    }
  }

  inherits$1(IncomingMessage, Readable);

  IncomingMessage.prototype._read = function() {};

  IncomingMessage.prototype._onXHRProgress = function() {
    var self = this;

    var xhr = self._xhr;

    var response = null;
    switch (self._mode) {
    case 'text:vbarray': // For IE9
      if (xhr.readyState !== rStates.DONE)
        break
      try {
        // This fails in IE8
        response = new global$1.VBArray(xhr.responseBody).toArray();
      } catch (e) {
        // pass
      }
      if (response !== null) {
        self.push(new Buffer$1(response));
        break
      }
      // Falls through in IE8
    case 'text':
      try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
        response = xhr.responseText;
      } catch (e) {
        self._mode = 'text:vbarray';
        break
      }
      if (response.length > self._pos) {
        var newData = response.substr(self._pos);
        if (self._charset === 'x-user-defined') {
          var buffer = new Buffer$1(newData.length);
          for (var i = 0; i < newData.length; i++)
            buffer[i] = newData.charCodeAt(i) & 0xff;

          self.push(buffer);
        } else {
          self.push(newData, self._charset);
        }
        self._pos = response.length;
      }
      break
    case 'arraybuffer':
      if (xhr.readyState !== rStates.DONE || !xhr.response)
        break
      response = xhr.response;
      self.push(new Buffer$1(new Uint8Array(response)));
      break
    case 'moz-chunked-arraybuffer': // take whole
      response = xhr.response;
      if (xhr.readyState !== rStates.LOADING || !response)
        break
      self.push(new Buffer$1(new Uint8Array(response)));
      break
    case 'ms-stream':
      response = xhr.response;
      if (xhr.readyState !== rStates.LOADING)
        break
      var reader = new global$1.MSStreamReader();
      reader.onprogress = function() {
        if (reader.result.byteLength > self._pos) {
          self.push(new Buffer$1(new Uint8Array(reader.result.slice(self._pos))));
          self._pos = reader.result.byteLength;
        }
      };
      reader.onload = function() {
        self.push(null);
      };
        // reader.onerror = ??? // TODO: this
      reader.readAsArrayBuffer(response);
      break
    }

    // The ms-stream case handles end separately in reader.onload()
    if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
      self.push(null);
    }
  };

  // from https://github.com/jhiesey/to-arraybuffer/blob/6502d9850e70ba7935a7df4ad86b358fc216f9f0/index.js
  function toArrayBuffer$2 (buf) {
    // If the buffer is backed by a Uint8Array, a faster version will work
    if (buf instanceof Uint8Array) {
      // If the buffer isn't a subarray, return the underlying ArrayBuffer
      if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
        return buf.buffer
      } else if (typeof buf.buffer.slice === 'function') {
        // Otherwise we need to get a proper copy
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      }
    }

    if (buffer.isBuffer(buf)) {
      // This is the slow version that will work with any Buffer
      // implementation (even in old browsers)
      var arrayCopy = new Uint8Array(buf.length);
      var len = buf.length;
      for (var i = 0; i < len; i++) {
        arrayCopy[i] = buf[i];
      }
      return arrayCopy.buffer
    } else {
      throw new Error('Argument must be a Buffer')
    }
  }

  function decideMode(preferBinary, useFetch) {
    if (hasFetch && useFetch) {
      return 'fetch'
    } else if (mozchunkedarraybuffer) {
      return 'moz-chunked-arraybuffer'
    } else if (msstream) {
      return 'ms-stream'
    } else if (arraybuffer && preferBinary) {
      return 'arraybuffer'
    } else if (vbArray && preferBinary) {
      return 'text:vbarray'
    } else {
      return 'text'
    }
  }

  function ClientRequest(opts) {
    var self = this;
    Writable$1.call(self);

    self._opts = opts;
    self._body = [];
    self._headers = {};
    if (opts.auth)
      self.setHeader('Authorization', 'Basic ' + new Buffer$1(opts.auth).toString('base64'));
    Object.keys(opts.headers).forEach(function(name) {
      self.setHeader(name, opts.headers[name]);
    });

    var preferBinary;
    var useFetch = true;
    if (opts.mode === 'disable-fetch') {
      // If the use of XHR should be preferred and includes preserving the 'content-type' header
      useFetch = false;
      preferBinary = true;
    } else if (opts.mode === 'prefer-streaming') {
      // If streaming is a high priority but binary compatibility and
      // the accuracy of the 'content-type' header aren't
      preferBinary = false;
    } else if (opts.mode === 'allow-wrong-content-type') {
      // If streaming is more important than preserving the 'content-type' header
      preferBinary = !overrideMimeType;
    } else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
      // Use binary if text streaming may corrupt data or the content-type header, or for speed
      preferBinary = true;
    } else {
      throw new Error('Invalid value for opts.mode')
    }
    self._mode = decideMode(preferBinary, useFetch);

    self.on('finish', function() {
      self._onFinish();
    });
  }

  inherits$1(ClientRequest, Writable$1);
  // Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
  var unsafeHeaders = [
    'accept-charset',
    'accept-encoding',
    'access-control-request-headers',
    'access-control-request-method',
    'connection',
    'content-length',
    'cookie',
    'cookie2',
    'date',
    'dnt',
    'expect',
    'host',
    'keep-alive',
    'origin',
    'referer',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade',
    'user-agent',
    'via'
  ];
  ClientRequest.prototype.setHeader = function(name, value) {
    var self = this;
    var lowerName = name.toLowerCase();
      // This check is not necessary, but it prevents warnings from browsers about setting unsafe
      // headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
      // http-browserify did it, so I will too.
    if (unsafeHeaders.indexOf(lowerName) !== -1)
      return

    self._headers[lowerName] = {
      name: name,
      value: value
    };
  };

  ClientRequest.prototype.getHeader = function(name) {
    var self = this;
    return self._headers[name.toLowerCase()].value
  };

  ClientRequest.prototype.removeHeader = function(name) {
    var self = this;
    delete self._headers[name.toLowerCase()];
  };

  ClientRequest.prototype._onFinish = function() {
    var self = this;

    if (self._destroyed)
      return
    var opts = self._opts;

    var headersObj = self._headers;
    var body;
    if (opts.method === 'POST' || opts.method === 'PUT' || opts.method === 'PATCH') {
      if (blobConstructor()) {
        body = new global$1.Blob(self._body.map(function(buffer) {
          return toArrayBuffer$2(buffer)
        }), {
          type: (headersObj['content-type'] || {}).value || ''
        });
      } else {
        // get utf8 string
        body = Buffer$1.concat(self._body).toString();
      }
    }

    if (self._mode === 'fetch') {
      var headers = Object.keys(headersObj).map(function(name) {
        return [headersObj[name].name, headersObj[name].value]
      });

      global$1.fetch(self._opts.url, {
        method: self._opts.method,
        headers: headers,
        body: body,
        mode: 'cors',
        credentials: opts.withCredentials ? 'include' : 'same-origin'
      }).then(function(response) {
        self._fetchResponse = response;
        self._connect();
      }, function(reason) {
        self.emit('error', reason);
      });
    } else {
      var xhr = self._xhr = new global$1.XMLHttpRequest();
      try {
        xhr.open(self._opts.method, self._opts.url, true);
      } catch (err) {
        nextTick(function() {
          self.emit('error', err);
        });
        return
      }

      // Can't set responseType on really old browsers
      if ('responseType' in xhr)
        xhr.responseType = self._mode.split(':')[0];

      if ('withCredentials' in xhr)
        xhr.withCredentials = !!opts.withCredentials;

      if (self._mode === 'text' && 'overrideMimeType' in xhr)
        xhr.overrideMimeType('text/plain; charset=x-user-defined');

      Object.keys(headersObj).forEach(function(name) {
        xhr.setRequestHeader(headersObj[name].name, headersObj[name].value);
      });

      self._response = null;
      xhr.onreadystatechange = function() {
        switch (xhr.readyState) {
        case rStates.LOADING:
        case rStates.DONE:
          self._onXHRProgress();
          break
        }
      };
        // Necessary for streaming in Firefox, since xhr.response is ONLY defined
        // in onprogress, not in onreadystatechange with xhr.readyState = 3
      if (self._mode === 'moz-chunked-arraybuffer') {
        xhr.onprogress = function() {
          self._onXHRProgress();
        };
      }

      xhr.onerror = function() {
        if (self._destroyed)
          return
        self.emit('error', new Error('XHR error'));
      };

      try {
        xhr.send(body);
      } catch (err) {
        nextTick(function() {
          self.emit('error', err);
        });
        return
      }
    }
  };

  /**
   * Checks if xhr.status is readable and non-zero, indicating no error.
   * Even though the spec says it should be available in readyState 3,
   * accessing it throws an exception in IE8
   */
  function statusValid(xhr) {
    try {
      var status = xhr.status;
      return (status !== null && status !== 0)
    } catch (e) {
      return false
    }
  }

  ClientRequest.prototype._onXHRProgress = function() {
    var self = this;

    if (!statusValid(self._xhr) || self._destroyed)
      return

    if (!self._response)
      self._connect();

    self._response._onXHRProgress();
  };

  ClientRequest.prototype._connect = function() {
    var self = this;

    if (self._destroyed)
      return

    self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode);
    self.emit('response', self._response);
  };

  ClientRequest.prototype._write = function(chunk, encoding, cb) {
    var self = this;

    self._body.push(chunk);
    cb();
  };

  ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function() {
    var self = this;
    self._destroyed = true;
    if (self._response)
      self._response._destroyed = true;
    if (self._xhr)
      self._xhr.abort();
      // Currently, there isn't a way to truly abort a fetch.
      // If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
  };

  ClientRequest.prototype.end = function(data, encoding, cb) {
    var self = this;
    if (typeof data === 'function') {
      cb = data;
      data = undefined;
    }

    Writable$1.prototype.end.call(self, data, encoding, cb);
  };

  ClientRequest.prototype.flushHeaders = function() {};
  ClientRequest.prototype.setTimeout = function() {};
  ClientRequest.prototype.setNoDelay = function() {};
  ClientRequest.prototype.setSocketKeepAlive = function() {};

  /** Highest positive signed 32-bit float value */
  const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

  /** Bootstring parameters */
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128; // 0x80
  const delimiter$1 = '-'; // '\x2D'
  const regexNonASCII = /[^\0-\x7E]/; // non-ASCII chars
  const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

  /** Error messages */
  const errors = {
  	'overflow': 'Overflow: input needs wider integers to process',
  	'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
  	'invalid-input': 'Invalid input'
  };

  /** Convenience shortcuts */
  const baseMinusTMin = base - tMin;
  const floor = Math.floor;
  const stringFromCharCode = String.fromCharCode;

  /*--------------------------------------------------------------------------*/

  /**
   * A generic error utility function.
   * @private
   * @param {String} type The error type.
   * @returns {Error} Throws a `RangeError` with the applicable error message.
   */
  function error$1(type) {
  	throw new RangeError(errors[type]);
  }

  /**
   * A generic `Array#map` utility function.
   * @private
   * @param {Array} array The array to iterate over.
   * @param {Function} callback The function that gets called for every array
   * item.
   * @returns {Array} A new array of values returned by the callback function.
   */
  function map$1(array, fn) {
  	const result = [];
  	let length = array.length;
  	while (length--) {
  		result[length] = fn(array[length]);
  	}
  	return result;
  }

  /**
   * A simple `Array#map`-like wrapper to work with domain name strings or email
   * addresses.
   * @private
   * @param {String} domain The domain name or email address.
   * @param {Function} callback The function that gets called for every
   * character.
   * @returns {Array} A new string of characters returned by the callback
   * function.
   */
  function mapDomain(string, fn) {
  	const parts = string.split('@');
  	let result = '';
  	if (parts.length > 1) {
  		// In email addresses, only the domain name should be punycoded. Leave
  		// the local part (i.e. everything up to `@`) intact.
  		result = parts[0] + '@';
  		string = parts[1];
  	}
  	// Avoid `split(regex)` for IE8 compatibility. See #17.
  	string = string.replace(regexSeparators, '\x2E');
  	const labels = string.split('.');
  	const encoded = map$1(labels, fn).join('.');
  	return result + encoded;
  }

  /**
   * Creates an array containing the numeric code points of each Unicode
   * character in the string. While JavaScript uses UCS-2 internally,
   * this function will convert a pair of surrogate halves (each of which
   * UCS-2 exposes as separate characters) into a single code point,
   * matching UTF-16.
   * @see `punycode.ucs2.encode`
   * @see <https://mathiasbynens.be/notes/javascript-encoding>
   * @memberOf punycode.ucs2
   * @name decode
   * @param {String} string The Unicode input string (UCS-2).
   * @returns {Array} The new array of code points.
   */
  function ucs2decode(string) {
  	const output = [];
  	let counter = 0;
  	const length = string.length;
  	while (counter < length) {
  		const value = string.charCodeAt(counter++);
  		if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
  			// It's a high surrogate, and there is a next character.
  			const extra = string.charCodeAt(counter++);
  			if ((extra & 0xFC00) == 0xDC00) { // Low surrogate.
  				output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
  			} else {
  				// It's an unmatched surrogate; only append this code unit, in case the
  				// next code unit is the high surrogate of a surrogate pair.
  				output.push(value);
  				counter--;
  			}
  		} else {
  			output.push(value);
  		}
  	}
  	return output;
  }

  /**
   * Converts a digit/integer into a basic code point.
   * @see `basicToDigit()`
   * @private
   * @param {Number} digit The numeric value of a basic code point.
   * @returns {Number} The basic code point whose value (when used for
   * representing integers) is `digit`, which needs to be in the range
   * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
   * used; else, the lowercase form is used. The behavior is undefined
   * if `flag` is non-zero and `digit` has no uppercase form.
   */
  const digitToBasic = function(digit, flag) {
  	//  0..25 map to ASCII a..z or A..Z
  	// 26..35 map to ASCII 0..9
  	return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
  };

  /**
   * Bias adaptation function as per section 3.4 of RFC 3492.
   * https://tools.ietf.org/html/rfc3492#section-3.4
   * @private
   */
  const adapt = function(delta, numPoints, firstTime) {
  	let k = 0;
  	delta = firstTime ? floor(delta / damp) : delta >> 1;
  	delta += floor(delta / numPoints);
  	for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
  		delta = floor(delta / baseMinusTMin);
  	}
  	return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
  };

  /**
   * Converts a string of Unicode symbols (e.g. a domain name label) to a
   * Punycode string of ASCII-only symbols.
   * @memberOf punycode
   * @param {String} input The string of Unicode symbols.
   * @returns {String} The resulting Punycode string of ASCII-only symbols.
   */
  const encode = function(input) {
  	const output = [];

  	// Convert the input in UCS-2 to an array of Unicode code points.
  	input = ucs2decode(input);

  	// Cache the length.
  	let inputLength = input.length;

  	// Initialize the state.
  	let n = initialN;
  	let delta = 0;
  	let bias = initialBias;

  	// Handle the basic code points.
  	for (const currentValue of input) {
  		if (currentValue < 0x80) {
  			output.push(stringFromCharCode(currentValue));
  		}
  	}

  	let basicLength = output.length;
  	let handledCPCount = basicLength;

  	// `handledCPCount` is the number of code points that have been handled;
  	// `basicLength` is the number of basic code points.

  	// Finish the basic string with a delimiter unless it's empty.
  	if (basicLength) {
  		output.push(delimiter$1);
  	}

  	// Main encoding loop:
  	while (handledCPCount < inputLength) {

  		// All non-basic code points < n have been handled already. Find the next
  		// larger one:
  		let m = maxInt;
  		for (const currentValue of input) {
  			if (currentValue >= n && currentValue < m) {
  				m = currentValue;
  			}
  		}

  		// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
  		// but guard against overflow.
  		const handledCPCountPlusOne = handledCPCount + 1;
  		if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
  			error$1('overflow');
  		}

  		delta += (m - n) * handledCPCountPlusOne;
  		n = m;

  		for (const currentValue of input) {
  			if (currentValue < n && ++delta > maxInt) {
  				error$1('overflow');
  			}
  			if (currentValue == n) {
  				// Represent delta as a generalized variable-length integer.
  				let q = delta;
  				for (let k = base; /* no condition */; k += base) {
  					const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
  					if (q < t) {
  						break;
  					}
  					const qMinusT = q - t;
  					const baseMinusT = base - t;
  					output.push(
  						stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
  					);
  					q = floor(qMinusT / baseMinusT);
  				}

  				output.push(stringFromCharCode(digitToBasic(q, 0)));
  				bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
  				delta = 0;
  				++handledCPCount;
  			}
  		}

  		++delta;
  		++n;

  	}
  	return output.join('');
  };

  /**
   * Converts a Unicode string representing a domain name or an email address to
   * Punycode. Only the non-ASCII parts of the domain name will be converted,
   * i.e. it doesn't matter if you call it with a domain that's already in
   * ASCII.
   * @memberOf punycode
   * @param {String} input The domain name or email address to convert, as a
   * Unicode string.
   * @returns {String} The Punycode representation of the given domain name or
   * email address.
   */
  const toASCII = function(input) {
  	return mapDomain(input, function(string) {
  		return regexNonASCII.test(string)
  			? 'xn--' + encode(string)
  			: string;
  	});
  };

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.


  // If obj.hasOwnProperty has been overridden, then calling
  // obj.hasOwnProperty(prop) will break.
  // See: https://github.com/joyent/node/issues/1707
  function hasOwnProperty(obj, prop) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  }
  var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
  };
  function stringifyPrimitive(v) {
    switch (typeof v) {
      case 'string':
        return v;

      case 'boolean':
        return v ? 'true' : 'false';

      case 'number':
        return isFinite(v) ? v : '';

      default:
        return '';
    }
  }

  function stringify (obj, sep, eq, name) {
    sep = sep || '&';
    eq = eq || '=';
    if (obj === null) {
      obj = undefined;
    }

    if (typeof obj === 'object') {
      return map(objectKeys(obj), function(k) {
        var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
        if (isArray(obj[k])) {
          return map(obj[k], function(v) {
            return ks + encodeURIComponent(stringifyPrimitive(v));
          }).join(sep);
        } else {
          return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
        }
      }).join(sep);

    }

    if (!name) return '';
    return encodeURIComponent(stringifyPrimitive(name)) + eq +
           encodeURIComponent(stringifyPrimitive(obj));
  }
  function map (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
      res.push(f(xs[i], i));
    }
    return res;
  }

  var objectKeys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
  };

  function parse$4(qs, sep, eq, options) {
    sep = sep || '&';
    eq = eq || '=';
    var obj = {};

    if (typeof qs !== 'string' || qs.length === 0) {
      return obj;
    }

    var regexp = /\+/g;
    qs = qs.split(sep);

    var maxKeys = 1000;
    if (options && typeof options.maxKeys === 'number') {
      maxKeys = options.maxKeys;
    }

    var len = qs.length;
    // maxKeys <= 0 means that we should not limit keys count
    if (maxKeys > 0 && len > maxKeys) {
      len = maxKeys;
    }

    for (var i = 0; i < len; ++i) {
      var x = qs[i].replace(regexp, '%20'),
          idx = x.indexOf(eq),
          kstr, vstr, k, v;

      if (idx >= 0) {
        kstr = x.substr(0, idx);
        vstr = x.substr(idx + 1);
      } else {
        kstr = x;
        vstr = '';
      }

      k = decodeURIComponent(kstr);
      v = decodeURIComponent(vstr);

      if (!hasOwnProperty(obj, k)) {
        obj[k] = v;
      } else if (isArray(obj[k])) {
        obj[k].push(v);
      } else {
        obj[k] = [obj[k], v];
      }
    }

    return obj;
  }

  // Copyright Joyent, Inc. and other Node contributors.
  var url = {
    parse: urlParse,
    resolve: urlResolve,
    resolveObject: urlResolveObject,
    format: urlFormat,
    Url: Url
  };
  function Url() {
    this.protocol = null;
    this.slashes = null;
    this.auth = null;
    this.host = null;
    this.port = null;
    this.hostname = null;
    this.hash = null;
    this.search = null;
    this.query = null;
    this.pathname = null;
    this.path = null;
    this.href = null;
  }

  // Reference: RFC 3986, RFC 1808, RFC 2396

  // define these here so at least they only have to be
  // compiled once on the first module load.
  var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    };

  function urlParse(url, parseQueryString, slashesDenoteHost) {
    if (url && isObject(url) && url instanceof Url) return url;

    var u = new Url;
    u.parse(url, parseQueryString, slashesDenoteHost);
    return u;
  }
  Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
    return parse$3(this, url, parseQueryString, slashesDenoteHost);
  };

  function parse$3(self, url, parseQueryString, slashesDenoteHost) {
    if (!isString(url)) {
      throw new TypeError('Parameter \'url\' must be a string, not ' + typeof url);
    }

    // Copy chrome, IE, opera backslash-handling behavior.
    // Back slashes before the query string get converted to forward slashes
    // See: https://code.google.com/p/chromium/issues/detail?id=25916
    var queryIndex = url.indexOf('?'),
      splitter =
      (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
    uSplit[0] = uSplit[0].replace(slashRegex, '/');
    url = uSplit.join(splitter);

    var rest = url;

    // trim before proceeding.
    // This is to support parse stuff like "  http://foo.com  \n"
    rest = rest.trim();

    if (!slashesDenoteHost && url.split('#').length === 1) {
      // Try fast path regexp
      var simplePath = simplePathPattern.exec(rest);
      if (simplePath) {
        self.path = rest;
        self.href = rest;
        self.pathname = simplePath[1];
        if (simplePath[2]) {
          self.search = simplePath[2];
          if (parseQueryString) {
            self.query = parse$4(self.search.substr(1));
          } else {
            self.query = self.search.substr(1);
          }
        } else if (parseQueryString) {
          self.search = '';
          self.query = {};
        }
        return self;
      }
    }

    var proto = protocolPattern.exec(rest);
    if (proto) {
      proto = proto[0];
      var lowerProto = proto.toLowerCase();
      self.protocol = lowerProto;
      rest = rest.substr(proto.length);
    }

    // figure out if it's got a host
    // user@server is *always* interpreted as a hostname, and url
    // resolution will treat //foo/bar as host=foo,path=bar because that's
    // how the browser resolves relative URLs.
    if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
      var slashes = rest.substr(0, 2) === '//';
      if (slashes && !(proto && hostlessProtocol[proto])) {
        rest = rest.substr(2);
        self.slashes = true;
      }
    }
    var i, hec, l, p;
    if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

      // there's a hostname.
      // the first instance of /, ?, ;, or # ends the host.
      //
      // If there is an @ in the hostname, then non-host chars *are* allowed
      // to the left of the last @ sign, unless some host-ending character
      // comes *before* the @-sign.
      // URLs are obnoxious.
      //
      // ex:
      // http://a@b@c/ => user:a@b host:c
      // http://a@b?@c => user:a host:c path:/?@c

      // v0.12 TODO(isaacs): This is not quite how Chrome does things.
      // Review our test case against browsers more comprehensively.

      // find the first instance of any hostEndingChars
      var hostEnd = -1;
      for (i = 0; i < hostEndingChars.length; i++) {
        hec = rest.indexOf(hostEndingChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
          hostEnd = hec;
      }

      // at this point, either we have an explicit point where the
      // auth portion cannot go past, or the last @ char is the decider.
      var auth, atSign;
      if (hostEnd === -1) {
        // atSign can be anywhere.
        atSign = rest.lastIndexOf('@');
      } else {
        // atSign must be in auth portion.
        // http://a@b/c@d => host:b auth:a path:/c@d
        atSign = rest.lastIndexOf('@', hostEnd);
      }

      // Now we have a portion which is definitely the auth.
      // Pull that off.
      if (atSign !== -1) {
        auth = rest.slice(0, atSign);
        rest = rest.slice(atSign + 1);
        self.auth = decodeURIComponent(auth);
      }

      // the host is the remaining to the left of the first non-host char
      hostEnd = -1;
      for (i = 0; i < nonHostChars.length; i++) {
        hec = rest.indexOf(nonHostChars[i]);
        if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
          hostEnd = hec;
      }
      // if we still have not hit it, then the entire thing is a host.
      if (hostEnd === -1)
        hostEnd = rest.length;

      self.host = rest.slice(0, hostEnd);
      rest = rest.slice(hostEnd);

      // pull out port.
      parseHost(self);

      // we've indicated that there is a hostname,
      // so even if it's empty, it has to be present.
      self.hostname = self.hostname || '';

      // if hostname begins with [ and ends with ]
      // assume that it's an IPv6 address.
      var ipv6Hostname = self.hostname[0] === '[' &&
        self.hostname[self.hostname.length - 1] === ']';

      // validate a little.
      if (!ipv6Hostname) {
        var hostparts = self.hostname.split(/\./);
        for (i = 0, l = hostparts.length; i < l; i++) {
          var part = hostparts[i];
          if (!part) continue;
          if (!part.match(hostnamePartPattern)) {
            var newpart = '';
            for (var j = 0, k = part.length; j < k; j++) {
              if (part.charCodeAt(j) > 127) {
                // we replace non-ASCII char with a temporary placeholder
                // we need this to make sure size of hostname is not
                // broken by replacing non-ASCII by nothing
                newpart += 'x';
              } else {
                newpart += part[j];
              }
            }
            // we test again with ASCII char only
            if (!newpart.match(hostnamePartPattern)) {
              var validParts = hostparts.slice(0, i);
              var notHost = hostparts.slice(i + 1);
              var bit = part.match(hostnamePartStart);
              if (bit) {
                validParts.push(bit[1]);
                notHost.unshift(bit[2]);
              }
              if (notHost.length) {
                rest = '/' + notHost.join('.') + rest;
              }
              self.hostname = validParts.join('.');
              break;
            }
          }
        }
      }

      if (self.hostname.length > hostnameMaxLen) {
        self.hostname = '';
      } else {
        // hostnames are always lower case.
        self.hostname = self.hostname.toLowerCase();
      }

      if (!ipv6Hostname) {
        // IDNA Support: Returns a punycoded representation of "domain".
        // It only converts parts of the domain name that
        // have non-ASCII characters, i.e. it doesn't matter if
        // you call it with a domain that already is ASCII-only.
        self.hostname = toASCII(self.hostname);
      }

      p = self.port ? ':' + self.port : '';
      var h = self.hostname || '';
      self.host = h + p;
      self.href += self.host;

      // strip [ and ] from the hostname
      // the host field still retains them, though
      if (ipv6Hostname) {
        self.hostname = self.hostname.substr(1, self.hostname.length - 2);
        if (rest[0] !== '/') {
          rest = '/' + rest;
        }
      }
    }

    // now rest is set to the post-host stuff.
    // chop off any delim chars.
    if (!unsafeProtocol[lowerProto]) {

      // First, make 100% sure that any "autoEscape" chars get
      // escaped, even if encodeURIComponent doesn't think they
      // need to be.
      for (i = 0, l = autoEscape.length; i < l; i++) {
        var ae = autoEscape[i];
        if (rest.indexOf(ae) === -1)
          continue;
        var esc = encodeURIComponent(ae);
        if (esc === ae) {
          esc = escape(ae);
        }
        rest = rest.split(ae).join(esc);
      }
    }


    // chop off from the tail first.
    var hash = rest.indexOf('#');
    if (hash !== -1) {
      // got a fragment string.
      self.hash = rest.substr(hash);
      rest = rest.slice(0, hash);
    }
    var qm = rest.indexOf('?');
    if (qm !== -1) {
      self.search = rest.substr(qm);
      self.query = rest.substr(qm + 1);
      if (parseQueryString) {
        self.query = parse$4(self.query);
      }
      rest = rest.slice(0, qm);
    } else if (parseQueryString) {
      // no query string, but parseQueryString still requested
      self.search = '';
      self.query = {};
    }
    if (rest) self.pathname = rest;
    if (slashedProtocol[lowerProto] &&
      self.hostname && !self.pathname) {
      self.pathname = '/';
    }

    //to support http.request
    if (self.pathname || self.search) {
      p = self.pathname || '';
      var s = self.search || '';
      self.path = p + s;
    }

    // finally, reconstruct the href based on what has been validated.
    self.href = format$2(self);
    return self;
  }

  // format a parsed object into a url string
  function urlFormat(obj) {
    // ensure it's an object, and not a string url.
    // If it's an obj, this is a no-op.
    // this way, you can call url_format() on strings
    // to clean up potentially wonky urls.
    if (isString(obj)) obj = parse$3({}, obj);
    return format$2(obj);
  }

  function format$2(self) {
    var auth = self.auth || '';
    if (auth) {
      auth = encodeURIComponent(auth);
      auth = auth.replace(/%3A/i, ':');
      auth += '@';
    }

    var protocol = self.protocol || '',
      pathname = self.pathname || '',
      hash = self.hash || '',
      host = false,
      query = '';

    if (self.host) {
      host = auth + self.host;
    } else if (self.hostname) {
      host = auth + (self.hostname.indexOf(':') === -1 ?
        self.hostname :
        '[' + this.hostname + ']');
      if (self.port) {
        host += ':' + self.port;
      }
    }

    if (self.query &&
      isObject(self.query) &&
      Object.keys(self.query).length) {
      query = stringify(self.query);
    }

    var search = self.search || (query && ('?' + query)) || '';

    if (protocol && protocol.substr(-1) !== ':') protocol += ':';

    // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
    // unless they had them to begin with.
    if (self.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
      host = '//' + (host || '');
      if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
    } else if (!host) {
      host = '';
    }

    if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
    if (search && search.charAt(0) !== '?') search = '?' + search;

    pathname = pathname.replace(/[?#]/g, function(match) {
      return encodeURIComponent(match);
    });
    search = search.replace('#', '%23');

    return protocol + host + pathname + search + hash;
  }

  Url.prototype.format = function() {
    return format$2(this);
  };

  function urlResolve(source, relative) {
    return urlParse(source, false, true).resolve(relative);
  }

  Url.prototype.resolve = function(relative) {
    return this.resolveObject(urlParse(relative, false, true)).format();
  };

  function urlResolveObject(source, relative) {
    if (!source) return relative;
    return urlParse(source, false, true).resolveObject(relative);
  }

  Url.prototype.resolveObject = function(relative) {
    if (isString(relative)) {
      var rel = new Url();
      rel.parse(relative, false, true);
      relative = rel;
    }

    var result = new Url();
    var tkeys = Object.keys(this);
    for (var tk = 0; tk < tkeys.length; tk++) {
      var tkey = tkeys[tk];
      result[tkey] = this[tkey];
    }

    // hash is always overridden, no matter what.
    // even href="" will remove it.
    result.hash = relative.hash;

    // if the relative url is empty, then there's nothing left to do here.
    if (relative.href === '') {
      result.href = result.format();
      return result;
    }

    // hrefs like //foo/bar always cut to the protocol.
    if (relative.slashes && !relative.protocol) {
      // take everything except the protocol from relative
      var rkeys = Object.keys(relative);
      for (var rk = 0; rk < rkeys.length; rk++) {
        var rkey = rkeys[rk];
        if (rkey !== 'protocol')
          result[rkey] = relative[rkey];
      }

      //urlParse appends trailing / to urls like http://www.example.com
      if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
        result.path = result.pathname = '/';
      }

      result.href = result.format();
      return result;
    }
    var relPath;
    if (relative.protocol && relative.protocol !== result.protocol) {
      // if it's a known url protocol, then changing
      // the protocol does weird things
      // first, if it's not file:, then we MUST have a host,
      // and if there was a path
      // to begin with, then we MUST have a path.
      // if it is file:, then the host is dropped,
      // because that's known to be hostless.
      // anything else is assumed to be absolute.
      if (!slashedProtocol[relative.protocol]) {
        var keys = Object.keys(relative);
        for (var v = 0; v < keys.length; v++) {
          var k = keys[v];
          result[k] = relative[k];
        }
        result.href = result.format();
        return result;
      }

      result.protocol = relative.protocol;
      if (!relative.host && !hostlessProtocol[relative.protocol]) {
        relPath = (relative.pathname || '').split('/');
        while (relPath.length && !(relative.host = relPath.shift()));
        if (!relative.host) relative.host = '';
        if (!relative.hostname) relative.hostname = '';
        if (relPath[0] !== '') relPath.unshift('');
        if (relPath.length < 2) relPath.unshift('');
        result.pathname = relPath.join('/');
      } else {
        result.pathname = relative.pathname;
      }
      result.search = relative.search;
      result.query = relative.query;
      result.host = relative.host || '';
      result.auth = relative.auth;
      result.hostname = relative.hostname || relative.host;
      result.port = relative.port;
      // to support http.request
      if (result.pathname || result.search) {
        var p = result.pathname || '';
        var s = result.search || '';
        result.path = p + s;
      }
      result.slashes = result.slashes || relative.slashes;
      result.href = result.format();
      return result;
    }

    var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
        relative.host ||
        relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
        (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];
    relPath = relative.pathname && relative.pathname.split('/') || [];
    // if the url is a non-slashed url, then relative
    // links like ../.. should be able
    // to crawl up to the hostname, as well.  This is strange.
    // result.protocol has already been set by now.
    // Later on, put the first path part into the host field.
    if (psychotic) {
      result.hostname = '';
      result.port = null;
      if (result.host) {
        if (srcPath[0] === '') srcPath[0] = result.host;
        else srcPath.unshift(result.host);
      }
      result.host = '';
      if (relative.protocol) {
        relative.hostname = null;
        relative.port = null;
        if (relative.host) {
          if (relPath[0] === '') relPath[0] = relative.host;
          else relPath.unshift(relative.host);
        }
        relative.host = null;
      }
      mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
    }
    var authInHost;
    if (isRelAbs) {
      // it's absolute.
      result.host = (relative.host || relative.host === '') ?
        relative.host : result.host;
      result.hostname = (relative.hostname || relative.hostname === '') ?
        relative.hostname : result.hostname;
      result.search = relative.search;
      result.query = relative.query;
      srcPath = relPath;
      // fall through to the dot-handling below.
    } else if (relPath.length) {
      // it's relative
      // throw away the existing file, and take the new path instead.
      if (!srcPath) srcPath = [];
      srcPath.pop();
      srcPath = srcPath.concat(relPath);
      result.search = relative.search;
      result.query = relative.query;
    } else if (!isNullOrUndefined(relative.search)) {
      // just pull out the search.
      // like href='?foo'.
      // Put this after the other two cases because it simplifies the booleans
      if (psychotic) {
        result.hostname = result.host = srcPath.shift();
        //occationaly the auth can get stuck only in host
        //this especially happens in cases like
        //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
        authInHost = result.host && result.host.indexOf('@') > 0 ?
          result.host.split('@') : false;
        if (authInHost) {
          result.auth = authInHost.shift();
          result.host = result.hostname = authInHost.shift();
        }
      }
      result.search = relative.search;
      result.query = relative.query;
      //to support http.request
      if (!isNull(result.pathname) || !isNull(result.search)) {
        result.path = (result.pathname ? result.pathname : '') +
          (result.search ? result.search : '');
      }
      result.href = result.format();
      return result;
    }

    if (!srcPath.length) {
      // no path at all.  easy.
      // we've already handled the other stuff above.
      result.pathname = null;
      //to support http.request
      if (result.search) {
        result.path = '/' + result.search;
      } else {
        result.path = null;
      }
      result.href = result.format();
      return result;
    }

    // if a url ENDs in . or .., then it must get a trailing slash.
    // however, if it ends in anything else non-slashy,
    // then it must NOT get a trailing slash.
    var last = srcPath.slice(-1)[0];
    var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

    // strip single dots, resolve double dots to parent dir
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = srcPath.length; i >= 0; i--) {
      last = srcPath[i];
      if (last === '.') {
        srcPath.splice(i, 1);
      } else if (last === '..') {
        srcPath.splice(i, 1);
        up++;
      } else if (up) {
        srcPath.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (!mustEndAbs && !removeAllDots) {
      for (; up--; up) {
        srcPath.unshift('..');
      }
    }

    if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
      srcPath.unshift('');
    }

    if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
      srcPath.push('');
    }

    var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

    // put the host back
    if (psychotic) {
      result.hostname = result.host = isAbsolute ? '' :
        srcPath.length ? srcPath.shift() : '';
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      authInHost = result.host && result.host.indexOf('@') > 0 ?
        result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }

    mustEndAbs = mustEndAbs || (result.host && srcPath.length);

    if (mustEndAbs && !isAbsolute) {
      srcPath.unshift('');
    }

    if (!srcPath.length) {
      result.pathname = null;
      result.path = null;
    } else {
      result.pathname = srcPath.join('/');
    }

    //to support request.http
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
        (result.search ? result.search : '');
    }
    result.auth = relative.auth || result.auth;
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  };

  Url.prototype.parseHost = function() {
    return parseHost(this);
  };

  function parseHost(self) {
    var host = self.host;
    var port = portPattern.exec(host);
    if (port) {
      port = port[0];
      if (port !== ':') {
        self.port = port.substr(1);
      }
      host = host.substr(0, host.length - port.length);
    }
    if (host) self.hostname = host;
  }

  var url$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    parse: urlParse,
    resolve: urlResolve,
    resolveObject: urlResolveObject,
    format: urlFormat,
    'default': url,
    Url: Url
  });

  function request(opts, cb) {
    if (typeof opts === 'string')
      opts = urlParse(opts);


    // Normally, the page is loaded from http or https, so not specifying a protocol
    // will result in a (valid) protocol-relative url. However, this won't work if
    // the protocol is something else, like 'file:'
    var defaultProtocol = global$1.location.protocol.search(/^https?:$/) === -1 ? 'http:' : '';

    var protocol = opts.protocol || defaultProtocol;
    var host = opts.hostname || opts.host;
    var port = opts.port;
    var path = opts.path || '/';

    // Necessary for IPv6 addresses
    if (host && host.indexOf(':') !== -1)
      host = '[' + host + ']';

    // This may be a relative url. The browser should always be able to interpret it correctly.
    opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path;
    opts.method = (opts.method || 'GET').toUpperCase();
    opts.headers = opts.headers || {};

    // Also valid opts.auth, opts.mode

    var req = new ClientRequest(opts);
    if (cb)
      req.on('response', cb);
    return req
  }

  function get(opts, cb) {
    var req = request(opts, cb);
    req.end();
    return req
  }

  function Agent() {}
  Agent.defaultMaxSockets = 4;

  var METHODS = [
    'CHECKOUT',
    'CONNECT',
    'COPY',
    'DELETE',
    'GET',
    'HEAD',
    'LOCK',
    'M-SEARCH',
    'MERGE',
    'MKACTIVITY',
    'MKCOL',
    'MOVE',
    'NOTIFY',
    'OPTIONS',
    'PATCH',
    'POST',
    'PROPFIND',
    'PROPPATCH',
    'PURGE',
    'PUT',
    'REPORT',
    'SEARCH',
    'SUBSCRIBE',
    'TRACE',
    'UNLOCK',
    'UNSUBSCRIBE'
  ];
  var STATUS_CODES = {
    100: 'Continue',
    101: 'Switching Protocols',
    102: 'Processing', // RFC 2518, obsoleted by RFC 4918
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    203: 'Non-Authoritative Information',
    204: 'No Content',
    205: 'Reset Content',
    206: 'Partial Content',
    207: 'Multi-Status', // RFC 4918
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Moved Temporarily',
    303: 'See Other',
    304: 'Not Modified',
    305: 'Use Proxy',
    307: 'Temporary Redirect',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Time-out',
    409: 'Conflict',
    410: 'Gone',
    411: 'Length Required',
    412: 'Precondition Failed',
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Large',
    415: 'Unsupported Media Type',
    416: 'Requested Range Not Satisfiable',
    417: 'Expectation Failed',
    418: 'I\'m a teapot', // RFC 2324
    422: 'Unprocessable Entity', // RFC 4918
    423: 'Locked', // RFC 4918
    424: 'Failed Dependency', // RFC 4918
    425: 'Unordered Collection', // RFC 4918
    426: 'Upgrade Required', // RFC 2817
    428: 'Precondition Required', // RFC 6585
    429: 'Too Many Requests', // RFC 6585
    431: 'Request Header Fields Too Large', // RFC 6585
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Time-out',
    505: 'HTTP Version Not Supported',
    506: 'Variant Also Negotiates', // RFC 2295
    507: 'Insufficient Storage', // RFC 4918
    509: 'Bandwidth Limit Exceeded',
    510: 'Not Extended', // RFC 2774
    511: 'Network Authentication Required' // RFC 6585
  };

  var http$3 = {
    request,
    get,
    Agent,
    METHODS,
    STATUS_CODES
  };

  var http$4 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    request: request,
    get: get,
    Agent: Agent,
    METHODS: METHODS,
    STATUS_CODES: STATUS_CODES,
    'default': http$3
  });

  var require$$4 = /*@__PURE__*/getAugmentedNamespace(http$4);

  var require$$7 = /*@__PURE__*/getAugmentedNamespace(url$1);

  var msg = {
    2:      'need dictionary',     /* Z_NEED_DICT       2  */
    1:      'stream end',          /* Z_STREAM_END      1  */
    0:      '',                    /* Z_OK              0  */
    '-1':   'file error',          /* Z_ERRNO         (-1) */
    '-2':   'stream error',        /* Z_STREAM_ERROR  (-2) */
    '-3':   'data error',          /* Z_DATA_ERROR    (-3) */
    '-4':   'insufficient memory', /* Z_MEM_ERROR     (-4) */
    '-5':   'buffer error',        /* Z_BUF_ERROR     (-5) */
    '-6':   'incompatible version' /* Z_VERSION_ERROR (-6) */
  };

  function ZStream() {
    /* next input byte */
    this.input = null; // JS specific, because we have no pointers
    this.next_in = 0;
    /* number of bytes available at input */
    this.avail_in = 0;
    /* total number of input bytes read so far */
    this.total_in = 0;
    /* next output byte should be put there */
    this.output = null; // JS specific, because we have no pointers
    this.next_out = 0;
    /* remaining free space at output */
    this.avail_out = 0;
    /* total number of bytes output so far */
    this.total_out = 0;
    /* last error message, NULL if no error */
    this.msg = ''/*Z_NULL*/;
    /* not visible by applications */
    this.state = null;
    /* best guess about the data type: binary or text */
    this.data_type = 2/*Z_UNKNOWN*/;
    /* adler32 value of the uncompressed data */
    this.adler = 0;
  }

  function arraySet(dest, src, src_offs, len, dest_offs) {
    if (src.subarray && dest.subarray) {
      dest.set(src.subarray(src_offs, src_offs + len), dest_offs);
      return;
    }
    // Fallback to ordinary array
    for (var i = 0; i < len; i++) {
      dest[dest_offs + i] = src[src_offs + i];
    }
  }


  var Buf8 = Uint8Array;
  var Buf16 = Uint16Array;
  var Buf32 = Int32Array;
  // Enable/Disable typed arrays use, for testing
  //

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  //var Z_FILTERED          = 1;
  //var Z_HUFFMAN_ONLY      = 2;
  //var Z_RLE               = 3;
  var Z_FIXED$2 = 4;
  //var Z_DEFAULT_STRATEGY  = 0;

  /* Possible values of the data_type field (though see inflate()) */
  var Z_BINARY$1 = 0;
  var Z_TEXT$1 = 1;
  //var Z_ASCII             = 1; // = Z_TEXT
  var Z_UNKNOWN$2 = 2;

  /*============================================================================*/


  function zero$1(buf) {
    var len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }

  // From zutil.h

  var STORED_BLOCK = 0;
  var STATIC_TREES = 1;
  var DYN_TREES = 2;
  /* The three kinds of block type */

  var MIN_MATCH$1 = 3;
  var MAX_MATCH$1 = 258;
  /* The minimum and maximum match lengths */

  // From deflate.h
  /* ===========================================================================
   * Internal compression state.
   */

  var LENGTH_CODES$1 = 29;
  /* number of length codes, not counting the special END_BLOCK code */

  var LITERALS$1 = 256;
  /* number of literal bytes 0..255 */

  var L_CODES$1 = LITERALS$1 + 1 + LENGTH_CODES$1;
  /* number of Literal or Length codes, including the END_BLOCK code */

  var D_CODES$1 = 30;
  /* number of distance codes */

  var BL_CODES$1 = 19;
  /* number of codes used to transfer the bit lengths */

  var HEAP_SIZE$1 = 2 * L_CODES$1 + 1;
  /* maximum heap size */

  var MAX_BITS$1 = 15;
  /* All codes must not exceed MAX_BITS bits */

  var Buf_size = 16;
  /* size of bit buffer in bi_buf */


  /* ===========================================================================
   * Constants
   */

  var MAX_BL_BITS = 7;
  /* Bit length codes must not exceed MAX_BL_BITS bits */

  var END_BLOCK = 256;
  /* end of block literal code */

  var REP_3_6 = 16;
  /* repeat previous bit length 3-6 times (2 bits of repeat count) */

  var REPZ_3_10 = 17;
  /* repeat a zero length 3-10 times  (3 bits of repeat count) */

  var REPZ_11_138 = 18;
  /* repeat a zero length 11-138 times  (7 bits of repeat count) */

  /* eslint-disable comma-spacing,array-bracket-spacing */
  var extra_lbits = /* extra bits for each length code */ [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];

  var extra_dbits = /* extra bits for each distance code */ [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];

  var extra_blbits = /* extra bits for each bit length code */ [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7];

  var bl_order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  /* eslint-enable comma-spacing,array-bracket-spacing */

  /* The lengths of the bit length codes are sent in order of decreasing
   * probability, to avoid transmitting the lengths for unused bit length codes.
   */

  /* ===========================================================================
   * Local data. These are initialized only once.
   */

  // We pre-fill arrays with 0 to avoid uninitialized gaps

  var DIST_CODE_LEN = 512; /* see definition of array dist_code below */

  // !!!! Use flat array insdead of structure, Freq = i*2, Len = i*2+1
  var static_ltree = new Array((L_CODES$1 + 2) * 2);
  zero$1(static_ltree);
  /* The static literal tree. Since the bit lengths are imposed, there is no
   * need for the L_CODES extra codes used during heap construction. However
   * The codes 286 and 287 are needed to build a canonical tree (see _tr_init
   * below).
   */

  var static_dtree = new Array(D_CODES$1 * 2);
  zero$1(static_dtree);
  /* The static distance tree. (Actually a trivial tree since all codes use
   * 5 bits.)
   */

  var _dist_code = new Array(DIST_CODE_LEN);
  zero$1(_dist_code);
  /* Distance codes. The first 256 values correspond to the distances
   * 3 .. 258, the last 256 values correspond to the top 8 bits of
   * the 15 bit distances.
   */

  var _length_code = new Array(MAX_MATCH$1 - MIN_MATCH$1 + 1);
  zero$1(_length_code);
  /* length code for each normalized match length (0 == MIN_MATCH) */

  var base_length = new Array(LENGTH_CODES$1);
  zero$1(base_length);
  /* First normalized length for each code (0 = MIN_MATCH) */

  var base_dist = new Array(D_CODES$1);
  zero$1(base_dist);
  /* First normalized distance for each code (0 = distance of 1) */


  function StaticTreeDesc(static_tree, extra_bits, extra_base, elems, max_length) {

    this.static_tree = static_tree; /* static tree or NULL */
    this.extra_bits = extra_bits; /* extra bits for each code or NULL */
    this.extra_base = extra_base; /* base index for extra_bits */
    this.elems = elems; /* max number of elements in the tree */
    this.max_length = max_length; /* max bit length for the codes */

    // show if `static_tree` has data or dummy - needed for monomorphic objects
    this.has_stree = static_tree && static_tree.length;
  }


  var static_l_desc;
  var static_d_desc;
  var static_bl_desc;


  function TreeDesc(dyn_tree, stat_desc) {
    this.dyn_tree = dyn_tree; /* the dynamic tree */
    this.max_code = 0; /* largest code with non zero frequency */
    this.stat_desc = stat_desc; /* the corresponding static tree */
  }



  function d_code(dist) {
    return dist < 256 ? _dist_code[dist] : _dist_code[256 + (dist >>> 7)];
  }


  /* ===========================================================================
   * Output a short LSB first on the stream.
   * IN assertion: there is enough room in pendingBuf.
   */
  function put_short(s, w) {
    //    put_byte(s, (uch)((w) & 0xff));
    //    put_byte(s, (uch)((ush)(w) >> 8));
    s.pending_buf[s.pending++] = (w) & 0xff;
    s.pending_buf[s.pending++] = (w >>> 8) & 0xff;
  }


  /* ===========================================================================
   * Send a value on a given number of bits.
   * IN assertion: length <= 16 and value fits in length bits.
   */
  function send_bits(s, value, length) {
    if (s.bi_valid > (Buf_size - length)) {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      put_short(s, s.bi_buf);
      s.bi_buf = value >> (Buf_size - s.bi_valid);
      s.bi_valid += length - Buf_size;
    } else {
      s.bi_buf |= (value << s.bi_valid) & 0xffff;
      s.bi_valid += length;
    }
  }


  function send_code(s, c, tree) {
    send_bits(s, tree[c * 2] /*.Code*/ , tree[c * 2 + 1] /*.Len*/ );
  }


  /* ===========================================================================
   * Reverse the first len bits of a code, using straightforward code (a faster
   * method would use a table)
   * IN assertion: 1 <= len <= 15
   */
  function bi_reverse(code, len) {
    var res = 0;
    do {
      res |= code & 1;
      code >>>= 1;
      res <<= 1;
    } while (--len > 0);
    return res >>> 1;
  }


  /* ===========================================================================
   * Flush the bit buffer, keeping at most 7 bits in it.
   */
  function bi_flush(s) {
    if (s.bi_valid === 16) {
      put_short(s, s.bi_buf);
      s.bi_buf = 0;
      s.bi_valid = 0;

    } else if (s.bi_valid >= 8) {
      s.pending_buf[s.pending++] = s.bi_buf & 0xff;
      s.bi_buf >>= 8;
      s.bi_valid -= 8;
    }
  }


  /* ===========================================================================
   * Compute the optimal bit lengths for a tree and update the total bit length
   * for the current block.
   * IN assertion: the fields freq and dad are set, heap[heap_max] and
   *    above are the tree nodes sorted by increasing frequency.
   * OUT assertions: the field len is set to the optimal bit length, the
   *     array bl_count contains the frequencies for each bit length.
   *     The length opt_len is updated; static_len is also updated if stree is
   *     not null.
   */
  function gen_bitlen(s, desc) {
  //    deflate_state *s;
  //    tree_desc *desc;    /* the tree descriptor */
    var tree = desc.dyn_tree;
    var max_code = desc.max_code;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var extra = desc.stat_desc.extra_bits;
    var base = desc.stat_desc.extra_base;
    var max_length = desc.stat_desc.max_length;
    var h; /* heap index */
    var n, m; /* iterate over the tree elements */
    var bits; /* bit length */
    var xbits; /* extra bits */
    var f; /* frequency */
    var overflow = 0; /* number of elements with bit length too large */

    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      s.bl_count[bits] = 0;
    }

    /* In a first pass, compute the optimal bit lengths (which may
     * overflow in the case of the bit length tree).
     */
    tree[s.heap[s.heap_max] * 2 + 1] /*.Len*/ = 0; /* root of the heap */

    for (h = s.heap_max + 1; h < HEAP_SIZE$1; h++) {
      n = s.heap[h];
      bits = tree[tree[n * 2 + 1] /*.Dad*/ * 2 + 1] /*.Len*/ + 1;
      if (bits > max_length) {
        bits = max_length;
        overflow++;
      }
      tree[n * 2 + 1] /*.Len*/ = bits;
      /* We overwrite tree[n].Dad which is no longer needed */

      if (n > max_code) {
        continue;
      } /* not a leaf node */

      s.bl_count[bits]++;
      xbits = 0;
      if (n >= base) {
        xbits = extra[n - base];
      }
      f = tree[n * 2] /*.Freq*/ ;
      s.opt_len += f * (bits + xbits);
      if (has_stree) {
        s.static_len += f * (stree[n * 2 + 1] /*.Len*/ + xbits);
      }
    }
    if (overflow === 0) {
      return;
    }

    // Trace((stderr,"\nbit length overflow\n"));
    /* This happens for example on obj2 and pic of the Calgary corpus */

    /* Find the first bit length which could increase: */
    do {
      bits = max_length - 1;
      while (s.bl_count[bits] === 0) {
        bits--;
      }
      s.bl_count[bits]--; /* move one leaf down the tree */
      s.bl_count[bits + 1] += 2; /* move one overflow item as its brother */
      s.bl_count[max_length]--;
      /* The brother of the overflow item also moves one step up,
       * but this does not affect bl_count[max_length]
       */
      overflow -= 2;
    } while (overflow > 0);

    /* Now recompute all bit lengths, scanning in increasing frequency.
     * h is still equal to HEAP_SIZE. (It is simpler to reconstruct all
     * lengths instead of fixing only the wrong ones. This idea is taken
     * from 'ar' written by Haruhiko Okumura.)
     */
    for (bits = max_length; bits !== 0; bits--) {
      n = s.bl_count[bits];
      while (n !== 0) {
        m = s.heap[--h];
        if (m > max_code) {
          continue;
        }
        if (tree[m * 2 + 1] /*.Len*/ !== bits) {
          // Trace((stderr,"code %d bits %d->%d\n", m, tree[m].Len, bits));
          s.opt_len += (bits - tree[m * 2 + 1] /*.Len*/ ) * tree[m * 2] /*.Freq*/ ;
          tree[m * 2 + 1] /*.Len*/ = bits;
        }
        n--;
      }
    }
  }


  /* ===========================================================================
   * Generate the codes for a given tree and bit counts (which need not be
   * optimal).
   * IN assertion: the array bl_count contains the bit length statistics for
   * the given tree and the field len is set for all tree elements.
   * OUT assertion: the field code is set for all tree elements of non
   *     zero code length.
   */
  function gen_codes(tree, max_code, bl_count) {
  //    ct_data *tree;             /* the tree to decorate */
  //    int max_code;              /* largest code with non zero frequency */
  //    ushf *bl_count;            /* number of codes at each bit length */

    var next_code = new Array(MAX_BITS$1 + 1); /* next code value for each bit length */
    var code = 0; /* running code value */
    var bits; /* bit index */
    var n; /* code index */

    /* The distribution counts are first used to generate the code values
     * without bit reversal.
     */
    for (bits = 1; bits <= MAX_BITS$1; bits++) {
      next_code[bits] = code = (code + bl_count[bits - 1]) << 1;
    }
    /* Check that the bit counts in bl_count are consistent. The last code
     * must be all ones.
     */
    //Assert (code + bl_count[MAX_BITS]-1 == (1<<MAX_BITS)-1,
    //        "inconsistent bit counts");
    //Tracev((stderr,"\ngen_codes: max_code %d ", max_code));

    for (n = 0; n <= max_code; n++) {
      var len = tree[n * 2 + 1] /*.Len*/ ;
      if (len === 0) {
        continue;
      }
      /* Now reverse the bits */
      tree[n * 2] /*.Code*/ = bi_reverse(next_code[len]++, len);

      //Tracecv(tree != static_ltree, (stderr,"\nn %3d %c l %2d c %4x (%x) ",
      //     n, (isgraph(n) ? n : ' '), len, tree[n].Code, next_code[len]-1));
    }
  }


  /* ===========================================================================
   * Initialize the various 'constant' tables.
   */
  function tr_static_init() {
    var n; /* iterates over tree elements */
    var bits; /* bit counter */
    var length; /* length value */
    var code; /* code value */
    var dist; /* distance index */
    var bl_count = new Array(MAX_BITS$1 + 1);
    /* number of codes at each bit length for an optimal tree */

    // do check in _tr_init()
    //if (static_init_done) return;

    /* For some embedded targets, global variables are not initialized: */
    /*#ifdef NO_INIT_GLOBAL_POINTERS
      static_l_desc.static_tree = static_ltree;
      static_l_desc.extra_bits = extra_lbits;
      static_d_desc.static_tree = static_dtree;
      static_d_desc.extra_bits = extra_dbits;
      static_bl_desc.extra_bits = extra_blbits;
    #endif*/

    /* Initialize the mapping length (0..255) -> length code (0..28) */
    length = 0;
    for (code = 0; code < LENGTH_CODES$1 - 1; code++) {
      base_length[code] = length;
      for (n = 0; n < (1 << extra_lbits[code]); n++) {
        _length_code[length++] = code;
      }
    }
    //Assert (length == 256, "tr_static_init: length != 256");
    /* Note that the length 255 (match length 258) can be represented
     * in two different ways: code 284 + 5 bits or code 285, so we
     * overwrite length_code[255] to use the best encoding:
     */
    _length_code[length - 1] = code;

    /* Initialize the mapping dist (0..32K) -> dist code (0..29) */
    dist = 0;
    for (code = 0; code < 16; code++) {
      base_dist[code] = dist;
      for (n = 0; n < (1 << extra_dbits[code]); n++) {
        _dist_code[dist++] = code;
      }
    }
    //Assert (dist == 256, "tr_static_init: dist != 256");
    dist >>= 7; /* from now on, all distances are divided by 128 */
    for (; code < D_CODES$1; code++) {
      base_dist[code] = dist << 7;
      for (n = 0; n < (1 << (extra_dbits[code] - 7)); n++) {
        _dist_code[256 + dist++] = code;
      }
    }
    //Assert (dist == 256, "tr_static_init: 256+dist != 512");

    /* Construct the codes of the static literal tree */
    for (bits = 0; bits <= MAX_BITS$1; bits++) {
      bl_count[bits] = 0;
    }

    n = 0;
    while (n <= 143) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    while (n <= 255) {
      static_ltree[n * 2 + 1] /*.Len*/ = 9;
      n++;
      bl_count[9]++;
    }
    while (n <= 279) {
      static_ltree[n * 2 + 1] /*.Len*/ = 7;
      n++;
      bl_count[7]++;
    }
    while (n <= 287) {
      static_ltree[n * 2 + 1] /*.Len*/ = 8;
      n++;
      bl_count[8]++;
    }
    /* Codes 286 and 287 do not exist, but we must include them in the
     * tree construction to get a canonical Huffman tree (longest code
     * all ones)
     */
    gen_codes(static_ltree, L_CODES$1 + 1, bl_count);

    /* The static distance tree is trivial: */
    for (n = 0; n < D_CODES$1; n++) {
      static_dtree[n * 2 + 1] /*.Len*/ = 5;
      static_dtree[n * 2] /*.Code*/ = bi_reverse(n, 5);
    }

    // Now data ready and we can init static trees
    static_l_desc = new StaticTreeDesc(static_ltree, extra_lbits, LITERALS$1 + 1, L_CODES$1, MAX_BITS$1);
    static_d_desc = new StaticTreeDesc(static_dtree, extra_dbits, 0, D_CODES$1, MAX_BITS$1);
    static_bl_desc = new StaticTreeDesc(new Array(0), extra_blbits, 0, BL_CODES$1, MAX_BL_BITS);

    //static_init_done = true;
  }


  /* ===========================================================================
   * Initialize a new block.
   */
  function init_block(s) {
    var n; /* iterates over tree elements */

    /* Initialize the trees. */
    for (n = 0; n < L_CODES$1; n++) {
      s.dyn_ltree[n * 2] /*.Freq*/ = 0;
    }
    for (n = 0; n < D_CODES$1; n++) {
      s.dyn_dtree[n * 2] /*.Freq*/ = 0;
    }
    for (n = 0; n < BL_CODES$1; n++) {
      s.bl_tree[n * 2] /*.Freq*/ = 0;
    }

    s.dyn_ltree[END_BLOCK * 2] /*.Freq*/ = 1;
    s.opt_len = s.static_len = 0;
    s.last_lit = s.matches = 0;
  }


  /* ===========================================================================
   * Flush the bit buffer and align the output on a byte boundary
   */
  function bi_windup(s) {
    if (s.bi_valid > 8) {
      put_short(s, s.bi_buf);
    } else if (s.bi_valid > 0) {
      //put_byte(s, (Byte)s->bi_buf);
      s.pending_buf[s.pending++] = s.bi_buf;
    }
    s.bi_buf = 0;
    s.bi_valid = 0;
  }

  /* ===========================================================================
   * Copy a stored block, storing first the length and its
   * one's complement if requested.
   */
  function copy_block(s, buf, len, header) {
  //DeflateState *s;
  //charf    *buf;    /* the input data */
  //unsigned len;     /* its length */
  //int      header;  /* true if block header must be written */

    bi_windup(s); /* align on byte boundary */

    if (header) {
      put_short(s, len);
      put_short(s, ~len);
    }
    //  while (len--) {
    //    put_byte(s, *buf++);
    //  }
    arraySet(s.pending_buf, s.window, buf, len, s.pending);
    s.pending += len;
  }

  /* ===========================================================================
   * Compares to subtrees, using the tree depth as tie breaker when
   * the subtrees have equal frequency. This minimizes the worst case length.
   */
  function smaller(tree, n, m, depth) {
    var _n2 = n * 2;
    var _m2 = m * 2;
    return (tree[_n2] /*.Freq*/ < tree[_m2] /*.Freq*/ ||
      (tree[_n2] /*.Freq*/ === tree[_m2] /*.Freq*/ && depth[n] <= depth[m]));
  }

  /* ===========================================================================
   * Restore the heap property by moving down the tree starting at node k,
   * exchanging a node with the smallest of its two sons if necessary, stopping
   * when the heap property is re-established (each father smaller than its
   * two sons).
   */
  function pqdownheap(s, tree, k)
  //    deflate_state *s;
  //    ct_data *tree;  /* the tree to restore */
  //    int k;               /* node to move down */
  {
    var v = s.heap[k];
    var j = k << 1; /* left son of k */
    while (j <= s.heap_len) {
      /* Set j to the smallest of the two sons: */
      if (j < s.heap_len &&
        smaller(tree, s.heap[j + 1], s.heap[j], s.depth)) {
        j++;
      }
      /* Exit if v is smaller than both sons */
      if (smaller(tree, v, s.heap[j], s.depth)) {
        break;
      }

      /* Exchange v with the smallest son */
      s.heap[k] = s.heap[j];
      k = j;

      /* And continue down the tree, setting j to the left son of k */
      j <<= 1;
    }
    s.heap[k] = v;
  }


  // inlined manually
  // var SMALLEST = 1;

  /* ===========================================================================
   * Send the block data compressed using the given Huffman trees
   */
  function compress_block(s, ltree, dtree)
  //    deflate_state *s;
  //    const ct_data *ltree; /* literal tree */
  //    const ct_data *dtree; /* distance tree */
  {
    var dist; /* distance of matched string */
    var lc; /* match length or unmatched char (if dist == 0) */
    var lx = 0; /* running index in l_buf */
    var code; /* the code to send */
    var extra; /* number of extra bits to send */

    if (s.last_lit !== 0) {
      do {
        dist = (s.pending_buf[s.d_buf + lx * 2] << 8) | (s.pending_buf[s.d_buf + lx * 2 + 1]);
        lc = s.pending_buf[s.l_buf + lx];
        lx++;

        if (dist === 0) {
          send_code(s, lc, ltree); /* send a literal byte */
          //Tracecv(isgraph(lc), (stderr," '%c' ", lc));
        } else {
          /* Here, lc is the match length - MIN_MATCH */
          code = _length_code[lc];
          send_code(s, code + LITERALS$1 + 1, ltree); /* send the length code */
          extra = extra_lbits[code];
          if (extra !== 0) {
            lc -= base_length[code];
            send_bits(s, lc, extra); /* send the extra length bits */
          }
          dist--; /* dist is now the match distance - 1 */
          code = d_code(dist);
          //Assert (code < D_CODES, "bad d_code");

          send_code(s, code, dtree); /* send the distance code */
          extra = extra_dbits[code];
          if (extra !== 0) {
            dist -= base_dist[code];
            send_bits(s, dist, extra); /* send the extra distance bits */
          }
        } /* literal or match pair ? */

        /* Check that the overlay between pending_buf and d_buf+l_buf is ok: */
        //Assert((uInt)(s->pending) < s->lit_bufsize + 2*lx,
        //       "pendingBuf overflow");

      } while (lx < s.last_lit);
    }

    send_code(s, END_BLOCK, ltree);
  }


  /* ===========================================================================
   * Construct one Huffman tree and assigns the code bit strings and lengths.
   * Update the total bit length for the current block.
   * IN assertion: the field freq is set for all tree elements.
   * OUT assertions: the fields len and code are set to the optimal bit length
   *     and corresponding code. The length opt_len is updated; static_len is
   *     also updated if stree is not null. The field max_code is set.
   */
  function build_tree(s, desc)
  //    deflate_state *s;
  //    tree_desc *desc; /* the tree descriptor */
  {
    var tree = desc.dyn_tree;
    var stree = desc.stat_desc.static_tree;
    var has_stree = desc.stat_desc.has_stree;
    var elems = desc.stat_desc.elems;
    var n, m; /* iterate over heap elements */
    var max_code = -1; /* largest code with non zero frequency */
    var node; /* new node being created */

    /* Construct the initial heap, with least frequent element in
     * heap[SMALLEST]. The sons of heap[n] are heap[2*n] and heap[2*n+1].
     * heap[0] is not used.
     */
    s.heap_len = 0;
    s.heap_max = HEAP_SIZE$1;

    for (n = 0; n < elems; n++) {
      if (tree[n * 2] /*.Freq*/ !== 0) {
        s.heap[++s.heap_len] = max_code = n;
        s.depth[n] = 0;

      } else {
        tree[n * 2 + 1] /*.Len*/ = 0;
      }
    }

    /* The pkzip format requires that at least one distance code exists,
     * and that at least one bit should be sent even if there is only one
     * possible code. So to avoid special checks later on we force at least
     * two codes of non zero frequency.
     */
    while (s.heap_len < 2) {
      node = s.heap[++s.heap_len] = (max_code < 2 ? ++max_code : 0);
      tree[node * 2] /*.Freq*/ = 1;
      s.depth[node] = 0;
      s.opt_len--;

      if (has_stree) {
        s.static_len -= stree[node * 2 + 1] /*.Len*/ ;
      }
      /* node is 0 or 1 so it does not have extra bits */
    }
    desc.max_code = max_code;

    /* The elements heap[heap_len/2+1 .. heap_len] are leaves of the tree,
     * establish sub-heaps of increasing lengths:
     */
    for (n = (s.heap_len >> 1 /*int /2*/ ); n >= 1; n--) {
      pqdownheap(s, tree, n);
    }

    /* Construct the Huffman tree by repeatedly combining the least two
     * frequent nodes.
     */
    node = elems; /* next internal node of the tree */
    do {
      //pqremove(s, tree, n);  /* n = node of least frequency */
      /*** pqremove ***/
      n = s.heap[1 /*SMALLEST*/ ];
      s.heap[1 /*SMALLEST*/ ] = s.heap[s.heap_len--];
      pqdownheap(s, tree, 1 /*SMALLEST*/ );
      /***/

      m = s.heap[1 /*SMALLEST*/ ]; /* m = node of next least frequency */

      s.heap[--s.heap_max] = n; /* keep the nodes sorted by frequency */
      s.heap[--s.heap_max] = m;

      /* Create a new node father of n and m */
      tree[node * 2] /*.Freq*/ = tree[n * 2] /*.Freq*/ + tree[m * 2] /*.Freq*/ ;
      s.depth[node] = (s.depth[n] >= s.depth[m] ? s.depth[n] : s.depth[m]) + 1;
      tree[n * 2 + 1] /*.Dad*/ = tree[m * 2 + 1] /*.Dad*/ = node;

      /* and insert the new node in the heap */
      s.heap[1 /*SMALLEST*/ ] = node++;
      pqdownheap(s, tree, 1 /*SMALLEST*/ );

    } while (s.heap_len >= 2);

    s.heap[--s.heap_max] = s.heap[1 /*SMALLEST*/ ];

    /* At this point, the fields freq and dad are set. We can now
     * generate the bit lengths.
     */
    gen_bitlen(s, desc);

    /* The field len is now set, we can generate the bit codes */
    gen_codes(tree, max_code, s.bl_count);
  }


  /* ===========================================================================
   * Scan a literal or distance tree to determine the frequencies of the codes
   * in the bit length tree.
   */
  function scan_tree(s, tree, max_code)
  //    deflate_state *s;
  //    ct_data *tree;   /* the tree to be scanned */
  //    int max_code;    /* and its largest code of non zero frequency */
  {
    var n; /* iterates over all tree elements */
    var prevlen = -1; /* last emitted length */
    var curlen; /* length of current code */

    var nextlen = tree[0 * 2 + 1] /*.Len*/ ; /* length of next code */

    var count = 0; /* repeat count of the current code */
    var max_count = 7; /* max repeat count */
    var min_count = 4; /* min repeat count */

    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }
    tree[(max_code + 1) * 2 + 1] /*.Len*/ = 0xffff; /* guard */

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/ ;

      if (++count < max_count && curlen === nextlen) {
        continue;

      } else if (count < min_count) {
        s.bl_tree[curlen * 2] /*.Freq*/ += count;

      } else if (curlen !== 0) {

        if (curlen !== prevlen) {
          s.bl_tree[curlen * 2] /*.Freq*/ ++;
        }
        s.bl_tree[REP_3_6 * 2] /*.Freq*/ ++;

      } else if (count <= 10) {
        s.bl_tree[REPZ_3_10 * 2] /*.Freq*/ ++;

      } else {
        s.bl_tree[REPZ_11_138 * 2] /*.Freq*/ ++;
      }

      count = 0;
      prevlen = curlen;

      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;

      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;

      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }


  /* ===========================================================================
   * Send a literal or distance tree in compressed form, using the codes in
   * bl_tree.
   */
  function send_tree(s, tree, max_code)
  //    deflate_state *s;
  //    ct_data *tree; /* the tree to be scanned */
  //    int max_code;       /* and its largest code of non zero frequency */
  {
    var n; /* iterates over all tree elements */
    var prevlen = -1; /* last emitted length */
    var curlen; /* length of current code */

    var nextlen = tree[0 * 2 + 1] /*.Len*/ ; /* length of next code */

    var count = 0; /* repeat count of the current code */
    var max_count = 7; /* max repeat count */
    var min_count = 4; /* min repeat count */

    /* tree[max_code+1].Len = -1; */
    /* guard already set */
    if (nextlen === 0) {
      max_count = 138;
      min_count = 3;
    }

    for (n = 0; n <= max_code; n++) {
      curlen = nextlen;
      nextlen = tree[(n + 1) * 2 + 1] /*.Len*/ ;

      if (++count < max_count && curlen === nextlen) {
        continue;

      } else if (count < min_count) {
        do {
          send_code(s, curlen, s.bl_tree);
        } while (--count !== 0);

      } else if (curlen !== 0) {
        if (curlen !== prevlen) {
          send_code(s, curlen, s.bl_tree);
          count--;
        }
        //Assert(count >= 3 && count <= 6, " 3_6?");
        send_code(s, REP_3_6, s.bl_tree);
        send_bits(s, count - 3, 2);

      } else if (count <= 10) {
        send_code(s, REPZ_3_10, s.bl_tree);
        send_bits(s, count - 3, 3);

      } else {
        send_code(s, REPZ_11_138, s.bl_tree);
        send_bits(s, count - 11, 7);
      }

      count = 0;
      prevlen = curlen;
      if (nextlen === 0) {
        max_count = 138;
        min_count = 3;

      } else if (curlen === nextlen) {
        max_count = 6;
        min_count = 3;

      } else {
        max_count = 7;
        min_count = 4;
      }
    }
  }


  /* ===========================================================================
   * Construct the Huffman tree for the bit lengths and return the index in
   * bl_order of the last bit length code to send.
   */
  function build_bl_tree(s) {
    var max_blindex; /* index of last bit length code of non zero freq */

    /* Determine the bit length frequencies for literal and distance trees */
    scan_tree(s, s.dyn_ltree, s.l_desc.max_code);
    scan_tree(s, s.dyn_dtree, s.d_desc.max_code);

    /* Build the bit length tree: */
    build_tree(s, s.bl_desc);
    /* opt_len now includes the length of the tree representations, except
     * the lengths of the bit lengths codes and the 5+5+4 bits for the counts.
     */

    /* Determine the number of bit length codes to send. The pkzip format
     * requires that at least 4 bit length codes be sent. (appnote.txt says
     * 3 but the actual value used is 4.)
     */
    for (max_blindex = BL_CODES$1 - 1; max_blindex >= 3; max_blindex--) {
      if (s.bl_tree[bl_order[max_blindex] * 2 + 1] /*.Len*/ !== 0) {
        break;
      }
    }
    /* Update opt_len to include the bit length tree and counts */
    s.opt_len += 3 * (max_blindex + 1) + 5 + 5 + 4;
    //Tracev((stderr, "\ndyn trees: dyn %ld, stat %ld",
    //        s->opt_len, s->static_len));

    return max_blindex;
  }


  /* ===========================================================================
   * Send the header for a block using dynamic Huffman trees: the counts, the
   * lengths of the bit length codes, the literal tree and the distance tree.
   * IN assertion: lcodes >= 257, dcodes >= 1, blcodes >= 4.
   */
  function send_all_trees(s, lcodes, dcodes, blcodes)
  //    deflate_state *s;
  //    int lcodes, dcodes, blcodes; /* number of codes for each tree */
  {
    var rank; /* index in bl_order */

    //Assert (lcodes >= 257 && dcodes >= 1 && blcodes >= 4, "not enough codes");
    //Assert (lcodes <= L_CODES && dcodes <= D_CODES && blcodes <= BL_CODES,
    //        "too many codes");
    //Tracev((stderr, "\nbl counts: "));
    send_bits(s, lcodes - 257, 5); /* not +255 as stated in appnote.txt */
    send_bits(s, dcodes - 1, 5);
    send_bits(s, blcodes - 4, 4); /* not -3 as stated in appnote.txt */
    for (rank = 0; rank < blcodes; rank++) {
      //Tracev((stderr, "\nbl code %2d ", bl_order[rank]));
      send_bits(s, s.bl_tree[bl_order[rank] * 2 + 1] /*.Len*/ , 3);
    }
    //Tracev((stderr, "\nbl tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_ltree, lcodes - 1); /* literal tree */
    //Tracev((stderr, "\nlit tree: sent %ld", s->bits_sent));

    send_tree(s, s.dyn_dtree, dcodes - 1); /* distance tree */
    //Tracev((stderr, "\ndist tree: sent %ld", s->bits_sent));
  }


  /* ===========================================================================
   * Check if the data type is TEXT or BINARY, using the following algorithm:
   * - TEXT if the two conditions below are satisfied:
   *    a) There are no non-portable control characters belonging to the
   *       "black list" (0..6, 14..25, 28..31).
   *    b) There is at least one printable character belonging to the
   *       "white list" (9 {TAB}, 10 {LF}, 13 {CR}, 32..255).
   * - BINARY otherwise.
   * - The following partially-portable control characters form a
   *   "gray list" that is ignored in this detection algorithm:
   *   (7 {BEL}, 8 {BS}, 11 {VT}, 12 {FF}, 26 {SUB}, 27 {ESC}).
   * IN assertion: the fields Freq of dyn_ltree are set.
   */
  function detect_data_type(s) {
    /* black_mask is the bit mask of black-listed bytes
     * set bits 0..6, 14..25, and 28..31
     * 0xf3ffc07f = binary 11110011111111111100000001111111
     */
    var black_mask = 0xf3ffc07f;
    var n;

    /* Check for non-textual ("black-listed") bytes. */
    for (n = 0; n <= 31; n++, black_mask >>>= 1) {
      if ((black_mask & 1) && (s.dyn_ltree[n * 2] /*.Freq*/ !== 0)) {
        return Z_BINARY$1;
      }
    }

    /* Check for textual ("white-listed") bytes. */
    if (s.dyn_ltree[9 * 2] /*.Freq*/ !== 0 || s.dyn_ltree[10 * 2] /*.Freq*/ !== 0 ||
      s.dyn_ltree[13 * 2] /*.Freq*/ !== 0) {
      return Z_TEXT$1;
    }
    for (n = 32; n < LITERALS$1; n++) {
      if (s.dyn_ltree[n * 2] /*.Freq*/ !== 0) {
        return Z_TEXT$1;
      }
    }

    /* There are no "black-listed" or "white-listed" bytes:
     * this stream either is empty or has tolerated ("gray-listed") bytes only.
     */
    return Z_BINARY$1;
  }


  var static_init_done = false;

  /* ===========================================================================
   * Initialize the tree data structures for a new zlib stream.
   */
  function _tr_init(s) {

    if (!static_init_done) {
      tr_static_init();
      static_init_done = true;
    }

    s.l_desc = new TreeDesc(s.dyn_ltree, static_l_desc);
    s.d_desc = new TreeDesc(s.dyn_dtree, static_d_desc);
    s.bl_desc = new TreeDesc(s.bl_tree, static_bl_desc);

    s.bi_buf = 0;
    s.bi_valid = 0;

    /* Initialize the first block of the first file: */
    init_block(s);
  }


  /* ===========================================================================
   * Send a stored block
   */
  function _tr_stored_block(s, buf, stored_len, last)
  //DeflateState *s;
  //charf *buf;       /* input block */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */
  {
    send_bits(s, (STORED_BLOCK << 1) + (last ? 1 : 0), 3); /* send block type */
    copy_block(s, buf, stored_len, true); /* with header */
  }


  /* ===========================================================================
   * Send one empty static block to give enough lookahead for inflate.
   * This takes 10 bits, of which 7 may remain in the bit buffer.
   */
  function _tr_align(s) {
    send_bits(s, STATIC_TREES << 1, 3);
    send_code(s, END_BLOCK, static_ltree);
    bi_flush(s);
  }


  /* ===========================================================================
   * Determine the best encoding for the current block: dynamic trees, static
   * trees or store, and output the encoded block to the zip file.
   */
  function _tr_flush_block(s, buf, stored_len, last)
  //DeflateState *s;
  //charf *buf;       /* input block, or NULL if too old */
  //ulg stored_len;   /* length of input block */
  //int last;         /* one if this is the last block for a file */
  {
    var opt_lenb, static_lenb; /* opt_len and static_len in bytes */
    var max_blindex = 0; /* index of last bit length code of non zero freq */

    /* Build the Huffman trees unless a stored block is forced */
    if (s.level > 0) {

      /* Check if the file is binary or text */
      if (s.strm.data_type === Z_UNKNOWN$2) {
        s.strm.data_type = detect_data_type(s);
      }

      /* Construct the literal and distance trees */
      build_tree(s, s.l_desc);
      // Tracev((stderr, "\nlit data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));

      build_tree(s, s.d_desc);
      // Tracev((stderr, "\ndist data: dyn %ld, stat %ld", s->opt_len,
      //        s->static_len));
      /* At this point, opt_len and static_len are the total bit lengths of
       * the compressed block data, excluding the tree representations.
       */

      /* Build the bit length tree for the above two trees, and get the index
       * in bl_order of the last bit length code to send.
       */
      max_blindex = build_bl_tree(s);

      /* Determine the best encoding. Compute the block lengths in bytes. */
      opt_lenb = (s.opt_len + 3 + 7) >>> 3;
      static_lenb = (s.static_len + 3 + 7) >>> 3;

      // Tracev((stderr, "\nopt %lu(%lu) stat %lu(%lu) stored %lu lit %u ",
      //        opt_lenb, s->opt_len, static_lenb, s->static_len, stored_len,
      //        s->last_lit));

      if (static_lenb <= opt_lenb) {
        opt_lenb = static_lenb;
      }

    } else {
      // Assert(buf != (char*)0, "lost buf");
      opt_lenb = static_lenb = stored_len + 5; /* force a stored block */
    }

    if ((stored_len + 4 <= opt_lenb) && (buf !== -1)) {
      /* 4: two words for the lengths */

      /* The test buf != NULL is only necessary if LIT_BUFSIZE > WSIZE.
       * Otherwise we can't have processed more than WSIZE input bytes since
       * the last block flush, because compression would have been
       * successful. If LIT_BUFSIZE <= WSIZE, it is never too late to
       * transform a block into a stored block.
       */
      _tr_stored_block(s, buf, stored_len, last);

    } else if (s.strategy === Z_FIXED$2 || static_lenb === opt_lenb) {

      send_bits(s, (STATIC_TREES << 1) + (last ? 1 : 0), 3);
      compress_block(s, static_ltree, static_dtree);

    } else {
      send_bits(s, (DYN_TREES << 1) + (last ? 1 : 0), 3);
      send_all_trees(s, s.l_desc.max_code + 1, s.d_desc.max_code + 1, max_blindex + 1);
      compress_block(s, s.dyn_ltree, s.dyn_dtree);
    }
    // Assert (s->compressed_len == s->bits_sent, "bad compressed size");
    /* The above check is made mod 2^32, for files larger than 512 MB
     * and uLong implemented on 32 bits.
     */
    init_block(s);

    if (last) {
      bi_windup(s);
    }
    // Tracev((stderr,"\ncomprlen %lu(%lu) ", s->compressed_len>>3,
    //       s->compressed_len-7*last));
  }

  /* ===========================================================================
   * Save the match info and tally the frequency counts. Return true if
   * the current block must be flushed.
   */
  function _tr_tally(s, dist, lc)
  //    deflate_state *s;
  //    unsigned dist;  /* distance of matched string */
  //    unsigned lc;    /* match length-MIN_MATCH or unmatched char (if dist==0) */
  {
    //var out_length, in_length, dcode;

    s.pending_buf[s.d_buf + s.last_lit * 2] = (dist >>> 8) & 0xff;
    s.pending_buf[s.d_buf + s.last_lit * 2 + 1] = dist & 0xff;

    s.pending_buf[s.l_buf + s.last_lit] = lc & 0xff;
    s.last_lit++;

    if (dist === 0) {
      /* lc is the unmatched char */
      s.dyn_ltree[lc * 2] /*.Freq*/ ++;
    } else {
      s.matches++;
      /* Here, lc is the match length - MIN_MATCH */
      dist--; /* dist = match distance - 1 */
      //Assert((ush)dist < (ush)MAX_DIST(s) &&
      //       (ush)lc <= (ush)(MAX_MATCH-MIN_MATCH) &&
      //       (ush)d_code(dist) < (ush)D_CODES,  "_tr_tally: bad match");

      s.dyn_ltree[(_length_code[lc] + LITERALS$1 + 1) * 2] /*.Freq*/ ++;
      s.dyn_dtree[d_code(dist) * 2] /*.Freq*/ ++;
    }

    // (!) This block is disabled in zlib defailts,
    // don't enable it for binary compatibility

    //#ifdef TRUNCATE_BLOCK
    //  /* Try to guess if it is profitable to stop the current block here */
    //  if ((s.last_lit & 0x1fff) === 0 && s.level > 2) {
    //    /* Compute an upper bound for the compressed length */
    //    out_length = s.last_lit*8;
    //    in_length = s.strstart - s.block_start;
    //
    //    for (dcode = 0; dcode < D_CODES; dcode++) {
    //      out_length += s.dyn_dtree[dcode*2]/*.Freq*/ * (5 + extra_dbits[dcode]);
    //    }
    //    out_length >>>= 3;
    //    //Tracev((stderr,"\nlast_lit %u, in %ld, out ~%ld(%ld%%) ",
    //    //       s->last_lit, in_length, out_length,
    //    //       100L - out_length*100L/in_length));
    //    if (s.matches < (s.last_lit>>1)/*int /2*/ && out_length < (in_length>>1)/*int /2*/) {
    //      return true;
    //    }
    //  }
    //#endif

    return (s.last_lit === s.lit_bufsize - 1);
    /* We avoid equality with lit_bufsize because of wraparound at 64K
     * on 16 bit machines and because stored blocks are restricted to
     * 64K-1 bytes.
     */
  }

  // Note: adler32 takes 12% for level 0 and 2% for level 6.
  // It doesn't worth to make additional optimizationa as in original.
  // Small size is preferable.

  function adler32(adler, buf, len, pos) {
    var s1 = (adler & 0xffff) |0,
        s2 = ((adler >>> 16) & 0xffff) |0,
        n = 0;

    while (len !== 0) {
      // Set limit ~ twice less than 5552, to keep
      // s2 in 31-bits, because we force signed ints.
      // in other case %= will fail.
      n = len > 2000 ? 2000 : len;
      len -= n;

      do {
        s1 = (s1 + buf[pos++]) |0;
        s2 = (s2 + s1) |0;
      } while (--n);

      s1 %= 65521;
      s2 %= 65521;
    }

    return (s1 | (s2 << 16)) |0;
  }

  // Note: we can't get significant speed boost here.
  // So write code to minimize size - no pregenerated tables
  // and array tools dependencies.


  // Use ordinary array, since untyped makes no boost here
  function makeTable() {
    var c, table = [];

    for (var n = 0; n < 256; n++) {
      c = n;
      for (var k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c;
    }

    return table;
  }

  // Create table on load. Just 255 signed longs. Not a problem.
  var crcTable = makeTable();


  function crc32(crc, buf, len, pos) {
    var t = crcTable,
        end = pos + len;

    crc ^= -1;

    for (var i = pos; i < end; i++) {
      crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    }

    return (crc ^ (-1)); // >>> 0;
  }

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  /* Allowed flush values; see deflate() and inflate() below for details */
  var Z_NO_FLUSH$1 = 0;
  var Z_PARTIAL_FLUSH$1 = 1;
  //var Z_SYNC_FLUSH    = 2;
  var Z_FULL_FLUSH$1 = 3;
  var Z_FINISH$2 = 4;
  var Z_BLOCK$2 = 5;
  //var Z_TREES         = 6;


  /* Return codes for the compression/decompression functions. Negative values
   * are errors, positive values are used for special but normal events.
   */
  var Z_OK$2 = 0;
  var Z_STREAM_END$2 = 1;
  //var Z_NEED_DICT     = 2;
  //var Z_ERRNO         = -1;
  var Z_STREAM_ERROR$2 = -2;
  var Z_DATA_ERROR$2 = -3;
  //var Z_MEM_ERROR     = -4;
  var Z_BUF_ERROR$2 = -5;
  //var Z_VERSION_ERROR = -6;


  /* compression levels */
  //var Z_NO_COMPRESSION      = 0;
  //var Z_BEST_SPEED          = 1;
  //var Z_BEST_COMPRESSION    = 9;
  var Z_DEFAULT_COMPRESSION$1 = -1;


  var Z_FILTERED$1 = 1;
  var Z_HUFFMAN_ONLY$1 = 2;
  var Z_RLE$1 = 3;
  var Z_FIXED$1 = 4;

  /* Possible values of the data_type field (though see inflate()) */
  //var Z_BINARY              = 0;
  //var Z_TEXT                = 1;
  //var Z_ASCII               = 1; // = Z_TEXT
  var Z_UNKNOWN$1 = 2;


  /* The deflate compression method */
  var Z_DEFLATED$2 = 8;

  /*============================================================================*/


  var MAX_MEM_LEVEL = 9;


  var LENGTH_CODES = 29;
  /* number of length codes, not counting the special END_BLOCK code */
  var LITERALS = 256;
  /* number of literal bytes 0..255 */
  var L_CODES = LITERALS + 1 + LENGTH_CODES;
  /* number of Literal or Length codes, including the END_BLOCK code */
  var D_CODES = 30;
  /* number of distance codes */
  var BL_CODES = 19;
  /* number of codes used to transfer the bit lengths */
  var HEAP_SIZE = 2 * L_CODES + 1;
  /* maximum heap size */
  var MAX_BITS = 15;
  /* All codes must not exceed MAX_BITS bits */

  var MIN_MATCH = 3;
  var MAX_MATCH = 258;
  var MIN_LOOKAHEAD = (MAX_MATCH + MIN_MATCH + 1);

  var PRESET_DICT = 0x20;

  var INIT_STATE = 42;
  var EXTRA_STATE = 69;
  var NAME_STATE = 73;
  var COMMENT_STATE = 91;
  var HCRC_STATE = 103;
  var BUSY_STATE = 113;
  var FINISH_STATE = 666;

  var BS_NEED_MORE = 1; /* block not completed, need more input or more output */
  var BS_BLOCK_DONE = 2; /* block flush performed */
  var BS_FINISH_STARTED = 3; /* finish started, need only more output at next deflate */
  var BS_FINISH_DONE = 4; /* finish done, accept no more input or output */

  var OS_CODE = 0x03; // Unix :) . Don't detect, use this default.

  function err(strm, errorCode) {
    strm.msg = msg[errorCode];
    return errorCode;
  }

  function rank(f) {
    return ((f) << 1) - ((f) > 4 ? 9 : 0);
  }

  function zero(buf) {
    var len = buf.length;
    while (--len >= 0) {
      buf[len] = 0;
    }
  }


  /* =========================================================================
   * Flush as much pending output as possible. All deflate() output goes
   * through this function so some applications may wish to modify it
   * to avoid allocating a large strm->output buffer and copying into it.
   * (See also read_buf()).
   */
  function flush_pending(strm) {
    var s = strm.state;

    //_tr_flush_bits(s);
    var len = s.pending;
    if (len > strm.avail_out) {
      len = strm.avail_out;
    }
    if (len === 0) {
      return;
    }

    arraySet(strm.output, s.pending_buf, s.pending_out, len, strm.next_out);
    strm.next_out += len;
    s.pending_out += len;
    strm.total_out += len;
    strm.avail_out -= len;
    s.pending -= len;
    if (s.pending === 0) {
      s.pending_out = 0;
    }
  }


  function flush_block_only(s, last) {
    _tr_flush_block(s, (s.block_start >= 0 ? s.block_start : -1), s.strstart - s.block_start, last);
    s.block_start = s.strstart;
    flush_pending(s.strm);
  }


  function put_byte(s, b) {
    s.pending_buf[s.pending++] = b;
  }


  /* =========================================================================
   * Put a short in the pending buffer. The 16-bit value is put in MSB order.
   * IN assertion: the stream state is correct and there is enough room in
   * pending_buf.
   */
  function putShortMSB(s, b) {
    //  put_byte(s, (Byte)(b >> 8));
    //  put_byte(s, (Byte)(b & 0xff));
    s.pending_buf[s.pending++] = (b >>> 8) & 0xff;
    s.pending_buf[s.pending++] = b & 0xff;
  }


  /* ===========================================================================
   * Read a new buffer from the current input stream, update the adler32
   * and total number of bytes read.  All deflate() input goes through
   * this function so some applications may wish to modify it to avoid
   * allocating a large strm->input buffer and copying from it.
   * (See also flush_pending()).
   */
  function read_buf(strm, buf, start, size) {
    var len = strm.avail_in;

    if (len > size) {
      len = size;
    }
    if (len === 0) {
      return 0;
    }

    strm.avail_in -= len;

    // zmemcpy(buf, strm->next_in, len);
    arraySet(buf, strm.input, strm.next_in, len, start);
    if (strm.state.wrap === 1) {
      strm.adler = adler32(strm.adler, buf, len, start);
    } else if (strm.state.wrap === 2) {
      strm.adler = crc32(strm.adler, buf, len, start);
    }

    strm.next_in += len;
    strm.total_in += len;

    return len;
  }


  /* ===========================================================================
   * Set match_start to the longest match starting at the given string and
   * return its length. Matches shorter or equal to prev_length are discarded,
   * in which case the result is equal to prev_length and match_start is
   * garbage.
   * IN assertions: cur_match is the head of the hash chain for the current
   *   string (strstart) and its distance is <= MAX_DIST, and prev_length >= 1
   * OUT assertion: the match length is not greater than s->lookahead.
   */
  function longest_match(s, cur_match) {
    var chain_length = s.max_chain_length; /* max hash chain length */
    var scan = s.strstart; /* current string */
    var match; /* matched string */
    var len; /* length of current match */
    var best_len = s.prev_length; /* best match length so far */
    var nice_match = s.nice_match; /* stop if match long enough */
    var limit = (s.strstart > (s.w_size - MIN_LOOKAHEAD)) ?
      s.strstart - (s.w_size - MIN_LOOKAHEAD) : 0 /*NIL*/ ;

    var _win = s.window; // shortcut

    var wmask = s.w_mask;
    var prev = s.prev;

    /* Stop when cur_match becomes <= limit. To simplify the code,
     * we prevent matches with the string of window index 0.
     */

    var strend = s.strstart + MAX_MATCH;
    var scan_end1 = _win[scan + best_len - 1];
    var scan_end = _win[scan + best_len];

    /* The code is optimized for HASH_BITS >= 8 and MAX_MATCH-2 multiple of 16.
     * It is easy to get rid of this optimization if necessary.
     */
    // Assert(s->hash_bits >= 8 && MAX_MATCH == 258, "Code too clever");

    /* Do not waste too much time if we already have a good match: */
    if (s.prev_length >= s.good_match) {
      chain_length >>= 2;
    }
    /* Do not look for matches beyond the end of the input. This is necessary
     * to make deflate deterministic.
     */
    if (nice_match > s.lookahead) {
      nice_match = s.lookahead;
    }

    // Assert((ulg)s->strstart <= s->window_size-MIN_LOOKAHEAD, "need lookahead");

    do {
      // Assert(cur_match < s->strstart, "no future");
      match = cur_match;

      /* Skip to next match if the match length cannot increase
       * or if the match length is less than 2.  Note that the checks below
       * for insufficient lookahead only occur occasionally for performance
       * reasons.  Therefore uninitialized memory will be accessed, and
       * conditional jumps will be made that depend on those values.
       * However the length of the match is limited to the lookahead, so
       * the output of deflate is not affected by the uninitialized values.
       */

      if (_win[match + best_len] !== scan_end ||
        _win[match + best_len - 1] !== scan_end1 ||
        _win[match] !== _win[scan] ||
        _win[++match] !== _win[scan + 1]) {
        continue;
      }

      /* The check at best_len-1 can be removed because it will be made
       * again later. (This heuristic is not always a win.)
       * It is not necessary to compare scan[2] and match[2] since they
       * are always equal when the other bytes match, given that
       * the hash keys are equal and that HASH_BITS >= 8.
       */
      scan += 2;
      match++;
      // Assert(*scan == *match, "match[2]?");

      /* We check for insufficient lookahead only every 8th comparison;
       * the 256th check will be made at strstart+258.
       */
      do {
        /*jshint noempty:false*/
      } while (_win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        _win[++scan] === _win[++match] && _win[++scan] === _win[++match] &&
        scan < strend);

      // Assert(scan <= s->window+(unsigned)(s->window_size-1), "wild scan");

      len = MAX_MATCH - (strend - scan);
      scan = strend - MAX_MATCH;

      if (len > best_len) {
        s.match_start = cur_match;
        best_len = len;
        if (len >= nice_match) {
          break;
        }
        scan_end1 = _win[scan + best_len - 1];
        scan_end = _win[scan + best_len];
      }
    } while ((cur_match = prev[cur_match & wmask]) > limit && --chain_length !== 0);

    if (best_len <= s.lookahead) {
      return best_len;
    }
    return s.lookahead;
  }


  /* ===========================================================================
   * Fill the window when the lookahead becomes insufficient.
   * Updates strstart and lookahead.
   *
   * IN assertion: lookahead < MIN_LOOKAHEAD
   * OUT assertions: strstart <= window_size-MIN_LOOKAHEAD
   *    At least one byte has been read, or avail_in == 0; reads are
   *    performed for at least two bytes (required for the zip translate_eol
   *    option -- not supported here).
   */
  function fill_window(s) {
    var _w_size = s.w_size;
    var p, n, m, more, str;

    //Assert(s->lookahead < MIN_LOOKAHEAD, "already enough lookahead");

    do {
      more = s.window_size - s.lookahead - s.strstart;

      // JS ints have 32 bit, block below not needed
      /* Deal with !@#$% 64K limit: */
      //if (sizeof(int) <= 2) {
      //    if (more == 0 && s->strstart == 0 && s->lookahead == 0) {
      //        more = wsize;
      //
      //  } else if (more == (unsigned)(-1)) {
      //        /* Very unlikely, but possible on 16 bit machine if
      //         * strstart == 0 && lookahead == 1 (input done a byte at time)
      //         */
      //        more--;
      //    }
      //}


      /* If the window is almost full and there is insufficient lookahead,
       * move the upper half to the lower one to make room in the upper half.
       */
      if (s.strstart >= _w_size + (_w_size - MIN_LOOKAHEAD)) {

        arraySet(s.window, s.window, _w_size, _w_size, 0);
        s.match_start -= _w_size;
        s.strstart -= _w_size;
        /* we now have strstart >= MAX_DIST */
        s.block_start -= _w_size;

        /* Slide the hash table (could be avoided with 32 bit values
         at the expense of memory usage). We slide even when level == 0
         to keep the hash table consistent if we switch back to level > 0
         later. (Using level 0 permanently is not an optimal usage of
         zlib, so we don't care about this pathological case.)
         */

        n = s.hash_size;
        p = n;
        do {
          m = s.head[--p];
          s.head[p] = (m >= _w_size ? m - _w_size : 0);
        } while (--n);

        n = _w_size;
        p = n;
        do {
          m = s.prev[--p];
          s.prev[p] = (m >= _w_size ? m - _w_size : 0);
          /* If n is not on any hash chain, prev[n] is garbage but
           * its value will never be used.
           */
        } while (--n);

        more += _w_size;
      }
      if (s.strm.avail_in === 0) {
        break;
      }

      /* If there was no sliding:
       *    strstart <= WSIZE+MAX_DIST-1 && lookahead <= MIN_LOOKAHEAD - 1 &&
       *    more == window_size - lookahead - strstart
       * => more >= window_size - (MIN_LOOKAHEAD-1 + WSIZE + MAX_DIST-1)
       * => more >= window_size - 2*WSIZE + 2
       * In the BIG_MEM or MMAP case (not yet supported),
       *   window_size == input_size + MIN_LOOKAHEAD  &&
       *   strstart + s->lookahead <= input_size => more >= MIN_LOOKAHEAD.
       * Otherwise, window_size == 2*WSIZE so more >= 2.
       * If there was sliding, more >= WSIZE. So in all cases, more >= 2.
       */
      //Assert(more >= 2, "more < 2");
      n = read_buf(s.strm, s.window, s.strstart + s.lookahead, more);
      s.lookahead += n;

      /* Initialize the hash value now that we have some input: */
      if (s.lookahead + s.insert >= MIN_MATCH) {
        str = s.strstart - s.insert;
        s.ins_h = s.window[str];

        /* UPDATE_HASH(s, s->ins_h, s->window[str + 1]); */
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + 1]) & s.hash_mask;
        //#if MIN_MATCH != 3
        //        Call update_hash() MIN_MATCH-3 more times
        //#endif
        while (s.insert) {
          /* UPDATE_HASH(s, s->ins_h, s->window[str + MIN_MATCH-1]); */
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[str + MIN_MATCH - 1]) & s.hash_mask;

          s.prev[str & s.w_mask] = s.head[s.ins_h];
          s.head[s.ins_h] = str;
          str++;
          s.insert--;
          if (s.lookahead + s.insert < MIN_MATCH) {
            break;
          }
        }
      }
      /* If the whole input has less than MIN_MATCH bytes, ins_h is garbage,
       * but this is not important since only literal bytes will be emitted.
       */

    } while (s.lookahead < MIN_LOOKAHEAD && s.strm.avail_in !== 0);

    /* If the WIN_INIT bytes after the end of the current data have never been
     * written, then zero those bytes in order to avoid memory check reports of
     * the use of uninitialized (or uninitialised as Julian writes) bytes by
     * the longest match routines.  Update the high water mark for the next
     * time through here.  WIN_INIT is set to MAX_MATCH since the longest match
     * routines allow scanning to strstart + MAX_MATCH, ignoring lookahead.
     */
    //  if (s.high_water < s.window_size) {
    //    var curr = s.strstart + s.lookahead;
    //    var init = 0;
    //
    //    if (s.high_water < curr) {
    //      /* Previous high water mark below current data -- zero WIN_INIT
    //       * bytes or up to end of window, whichever is less.
    //       */
    //      init = s.window_size - curr;
    //      if (init > WIN_INIT)
    //        init = WIN_INIT;
    //      zmemzero(s->window + curr, (unsigned)init);
    //      s->high_water = curr + init;
    //    }
    //    else if (s->high_water < (ulg)curr + WIN_INIT) {
    //      /* High water mark at or above current data, but below current data
    //       * plus WIN_INIT -- zero out to current data plus WIN_INIT, or up
    //       * to end of window, whichever is less.
    //       */
    //      init = (ulg)curr + WIN_INIT - s->high_water;
    //      if (init > s->window_size - s->high_water)
    //        init = s->window_size - s->high_water;
    //      zmemzero(s->window + s->high_water, (unsigned)init);
    //      s->high_water += init;
    //    }
    //  }
    //
    //  Assert((ulg)s->strstart <= s->window_size - MIN_LOOKAHEAD,
    //    "not enough room for search");
  }

  /* ===========================================================================
   * Copy without compression as much as possible from the input stream, return
   * the current block state.
   * This function does not insert new strings in the dictionary since
   * uncompressible data is probably not useful. This function is used
   * only for the level=0 compression option.
   * NOTE: this function should be optimized to avoid extra copying from
   * window to pending_buf.
   */
  function deflate_stored(s, flush) {
    /* Stored blocks are limited to 0xffff bytes, pending_buf is limited
     * to pending_buf_size, and each stored block has a 5 byte header:
     */
    var max_block_size = 0xffff;

    if (max_block_size > s.pending_buf_size - 5) {
      max_block_size = s.pending_buf_size - 5;
    }

    /* Copy as much as possible from input to output: */
    for (;;) {
      /* Fill the window as much as possible: */
      if (s.lookahead <= 1) {

        //Assert(s->strstart < s->w_size+MAX_DIST(s) ||
        //  s->block_start >= (long)s->w_size, "slide too late");
        //      if (!(s.strstart < s.w_size + (s.w_size - MIN_LOOKAHEAD) ||
        //        s.block_start >= s.w_size)) {
        //        throw  new Error("slide too late");
        //      }

        fill_window(s);
        if (s.lookahead === 0 && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }

        if (s.lookahead === 0) {
          break;
        }
        /* flush the current block */
      }
      //Assert(s->block_start >= 0L, "block gone");
      //    if (s.block_start < 0) throw new Error("block gone");

      s.strstart += s.lookahead;
      s.lookahead = 0;

      /* Emit a stored block if pending_buf will be full: */
      var max_start = s.block_start + max_block_size;

      if (s.strstart === 0 || s.strstart >= max_start) {
        /* strstart == 0 is possible when wraparound on 16-bit machine */
        s.lookahead = s.strstart - max_start;
        s.strstart = max_start;
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/


      }
      /* Flush if we may have to slide, otherwise block_start may become
       * negative and the data will be gone:
       */
      if (s.strstart - s.block_start >= (s.w_size - MIN_LOOKAHEAD)) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }

    s.insert = 0;

    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }

    if (s.strstart > s.block_start) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }

    return BS_NEED_MORE;
  }

  /* ===========================================================================
   * Compress as much as possible from the input stream, return the current
   * block state.
   * This function does not perform lazy evaluation of matches and inserts
   * new strings in the dictionary only for unmatched strings or for short
   * matches. It is used only for the fast compression options.
   */
  function deflate_fast(s, flush) {
    var hash_head; /* head of the hash chain */
    var bflush; /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break; /* flush the current block */
        }
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/ ;
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       * At this point we have always match_length < MIN_MATCH
       */
      if (hash_head !== 0 /*NIL*/ && ((s.strstart - hash_head) <= (s.w_size - MIN_LOOKAHEAD))) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head);
        /* longest_match() sets match_start */
      }
      if (s.match_length >= MIN_MATCH) {
        // check_match(s, s.strstart, s.match_start, s.match_length); // for debug only

        /*** _tr_tally_dist(s, s.strstart - s.match_start,
                       s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(s, s.strstart - s.match_start, s.match_length - MIN_MATCH);

        s.lookahead -= s.match_length;

        /* Insert new strings in the hash table only if the match length
         * is not too large. This saves time but degrades compression.
         */
        if (s.match_length <= s.max_lazy_match /*max_insert_length*/ && s.lookahead >= MIN_MATCH) {
          s.match_length--; /* string at strstart already in table */
          do {
            s.strstart++;
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
            /***/
            /* strstart never exceeds WSIZE-MAX_MATCH, so there are
             * always MIN_MATCH bytes ahead.
             */
          } while (--s.match_length !== 0);
          s.strstart++;
        } else {
          s.strstart += s.match_length;
          s.match_length = 0;
          s.ins_h = s.window[s.strstart];
          /* UPDATE_HASH(s, s.ins_h, s.window[s.strstart+1]); */
          s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + 1]) & s.hash_mask;

          //#if MIN_MATCH != 3
          //                Call UPDATE_HASH() MIN_MATCH-3 more times
          //#endif
          /* If lookahead < MIN_MATCH, ins_h is garbage, but it does not
           * matter since it will be recomputed at next deflate call.
           */
        }
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s.window[s.strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart]);

        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = ((s.strstart < (MIN_MATCH - 1)) ? s.strstart : MIN_MATCH - 1);
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* ===========================================================================
   * Same as above, but achieves better compression. We use a lazy
   * evaluation for matches: a match is finally adopted only if there is
   * no better match at the next window position.
   */
  function deflate_slow(s, flush) {
    var hash_head; /* head of hash chain */
    var bflush; /* set if current block must be flushed */

    var max_insert;

    /* Process the input block. */
    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the next match, plus MIN_MATCH bytes to insert the
       * string following the next match.
       */
      if (s.lookahead < MIN_LOOKAHEAD) {
        fill_window(s);
        if (s.lookahead < MIN_LOOKAHEAD && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        } /* flush the current block */
      }

      /* Insert the string window[strstart .. strstart+2] in the
       * dictionary, and set hash_head to the head of the hash chain:
       */
      hash_head = 0 /*NIL*/ ;
      if (s.lookahead >= MIN_MATCH) {
        /*** INSERT_STRING(s, s.strstart, hash_head); ***/
        s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
        hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
        s.head[s.ins_h] = s.strstart;
        /***/
      }

      /* Find the longest match, discarding those <= prev_length.
       */
      s.prev_length = s.match_length;
      s.prev_match = s.match_start;
      s.match_length = MIN_MATCH - 1;

      if (hash_head !== 0 /*NIL*/ && s.prev_length < s.max_lazy_match &&
        s.strstart - hash_head <= (s.w_size - MIN_LOOKAHEAD) /*MAX_DIST(s)*/ ) {
        /* To simplify the code, we prevent matches with the string
         * of window index 0 (in particular we have to avoid a match
         * of the string with itself at the start of the input file).
         */
        s.match_length = longest_match(s, hash_head);
        /* longest_match() sets match_start */

        if (s.match_length <= 5 &&
          (s.strategy === Z_FILTERED$1 || (s.match_length === MIN_MATCH && s.strstart - s.match_start > 4096 /*TOO_FAR*/ ))) {

          /* If prev_match is also MIN_MATCH, match_start is garbage
           * but we will ignore the current match anyway.
           */
          s.match_length = MIN_MATCH - 1;
        }
      }
      /* If there was a match at the previous step and the current
       * match is not better, output the previous match:
       */
      if (s.prev_length >= MIN_MATCH && s.match_length <= s.prev_length) {
        max_insert = s.strstart + s.lookahead - MIN_MATCH;
        /* Do not insert strings in hash table beyond this. */

        //check_match(s, s.strstart-1, s.prev_match, s.prev_length);

        /***_tr_tally_dist(s, s.strstart - 1 - s.prev_match,
                       s.prev_length - MIN_MATCH, bflush);***/
        bflush = _tr_tally(s, s.strstart - 1 - s.prev_match, s.prev_length - MIN_MATCH);
        /* Insert in hash table all strings up to the end of the match.
         * strstart-1 and strstart are already inserted. If there is not
         * enough lookahead, the last two strings are not inserted in
         * the hash table.
         */
        s.lookahead -= s.prev_length - 1;
        s.prev_length -= 2;
        do {
          if (++s.strstart <= max_insert) {
            /*** INSERT_STRING(s, s.strstart, hash_head); ***/
            s.ins_h = ((s.ins_h << s.hash_shift) ^ s.window[s.strstart + MIN_MATCH - 1]) & s.hash_mask;
            hash_head = s.prev[s.strstart & s.w_mask] = s.head[s.ins_h];
            s.head[s.ins_h] = s.strstart;
            /***/
          }
        } while (--s.prev_length !== 0);
        s.match_available = 0;
        s.match_length = MIN_MATCH - 1;
        s.strstart++;

        if (bflush) {
          /*** FLUSH_BLOCK(s, 0); ***/
          flush_block_only(s, false);
          if (s.strm.avail_out === 0) {
            return BS_NEED_MORE;
          }
          /***/
        }

      } else if (s.match_available) {
        /* If there was no match at the previous position, output a
         * single literal. If there was a match but the current match
         * is longer, truncate the previous match to a single literal.
         */
        //Tracevv((stderr,"%c", s->window[s->strstart-1]));
        /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

        if (bflush) {
          /*** FLUSH_BLOCK_ONLY(s, 0) ***/
          flush_block_only(s, false);
          /***/
        }
        s.strstart++;
        s.lookahead--;
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
      } else {
        /* There is no previous match to compare with, wait for
         * the next step to decide.
         */
        s.match_available = 1;
        s.strstart++;
        s.lookahead--;
      }
    }
    //Assert (flush != Z_NO_FLUSH, "no flush?");
    if (s.match_available) {
      //Tracevv((stderr,"%c", s->window[s->strstart-1]));
      /*** _tr_tally_lit(s, s.window[s.strstart-1], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart - 1]);

      s.match_available = 0;
    }
    s.insert = s.strstart < MIN_MATCH - 1 ? s.strstart : MIN_MATCH - 1;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }

    return BS_BLOCK_DONE;
  }


  /* ===========================================================================
   * For Z_RLE, simply look for runs of bytes, generate matches only of distance
   * one.  Do not maintain a hash table.  (It will be regenerated if this run of
   * deflate switches away from Z_RLE.)
   */
  function deflate_rle(s, flush) {
    var bflush; /* set if current block must be flushed */
    var prev; /* byte at distance one to match */
    var scan, strend; /* scan goes up to strend for length of run */

    var _win = s.window;

    for (;;) {
      /* Make sure that we always have enough lookahead, except
       * at the end of the input file. We need MAX_MATCH bytes
       * for the longest run, plus one for the unrolled loop.
       */
      if (s.lookahead <= MAX_MATCH) {
        fill_window(s);
        if (s.lookahead <= MAX_MATCH && flush === Z_NO_FLUSH$1) {
          return BS_NEED_MORE;
        }
        if (s.lookahead === 0) {
          break;
        } /* flush the current block */
      }

      /* See how many times the previous byte repeats */
      s.match_length = 0;
      if (s.lookahead >= MIN_MATCH && s.strstart > 0) {
        scan = s.strstart - 1;
        prev = _win[scan];
        if (prev === _win[++scan] && prev === _win[++scan] && prev === _win[++scan]) {
          strend = s.strstart + MAX_MATCH;
          do {
            /*jshint noempty:false*/
          } while (prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            prev === _win[++scan] && prev === _win[++scan] &&
            scan < strend);
          s.match_length = MAX_MATCH - (strend - scan);
          if (s.match_length > s.lookahead) {
            s.match_length = s.lookahead;
          }
        }
        //Assert(scan <= s->window+(uInt)(s->window_size-1), "wild scan");
      }

      /* Emit match if have run of MIN_MATCH or longer, else emit literal */
      if (s.match_length >= MIN_MATCH) {
        //check_match(s, s.strstart, s.strstart - 1, s.match_length);

        /*** _tr_tally_dist(s, 1, s.match_length - MIN_MATCH, bflush); ***/
        bflush = _tr_tally(s, 1, s.match_length - MIN_MATCH);

        s.lookahead -= s.match_length;
        s.strstart += s.match_length;
        s.match_length = 0;
      } else {
        /* No match, output a literal byte */
        //Tracevv((stderr,"%c", s->window[s->strstart]));
        /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
        bflush = _tr_tally(s, 0, s.window[s.strstart]);

        s.lookahead--;
        s.strstart++;
      }
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* ===========================================================================
   * For Z_HUFFMAN_ONLY, do not look for matches.  Do not maintain a hash table.
   * (It will be regenerated if this run of deflate switches away from Huffman.)
   */
  function deflate_huff(s, flush) {
    var bflush; /* set if current block must be flushed */

    for (;;) {
      /* Make sure that we have a literal to write. */
      if (s.lookahead === 0) {
        fill_window(s);
        if (s.lookahead === 0) {
          if (flush === Z_NO_FLUSH$1) {
            return BS_NEED_MORE;
          }
          break; /* flush the current block */
        }
      }

      /* Output a literal byte */
      s.match_length = 0;
      //Tracevv((stderr,"%c", s->window[s->strstart]));
      /*** _tr_tally_lit(s, s.window[s.strstart], bflush); ***/
      bflush = _tr_tally(s, 0, s.window[s.strstart]);
      s.lookahead--;
      s.strstart++;
      if (bflush) {
        /*** FLUSH_BLOCK(s, 0); ***/
        flush_block_only(s, false);
        if (s.strm.avail_out === 0) {
          return BS_NEED_MORE;
        }
        /***/
      }
    }
    s.insert = 0;
    if (flush === Z_FINISH$2) {
      /*** FLUSH_BLOCK(s, 1); ***/
      flush_block_only(s, true);
      if (s.strm.avail_out === 0) {
        return BS_FINISH_STARTED;
      }
      /***/
      return BS_FINISH_DONE;
    }
    if (s.last_lit) {
      /*** FLUSH_BLOCK(s, 0); ***/
      flush_block_only(s, false);
      if (s.strm.avail_out === 0) {
        return BS_NEED_MORE;
      }
      /***/
    }
    return BS_BLOCK_DONE;
  }

  /* Values for max_lazy_match, good_match and max_chain_length, depending on
   * the desired pack level (0..9). The values given below have been tuned to
   * exclude worst case performance for pathological files. Better values may be
   * found for specific files.
   */
  function Config(good_length, max_lazy, nice_length, max_chain, func) {
    this.good_length = good_length;
    this.max_lazy = max_lazy;
    this.nice_length = nice_length;
    this.max_chain = max_chain;
    this.func = func;
  }

  var configuration_table;

  configuration_table = [
    /*      good lazy nice chain */
    new Config(0, 0, 0, 0, deflate_stored), /* 0 store only */
    new Config(4, 4, 8, 4, deflate_fast), /* 1 max speed, no lazy matches */
    new Config(4, 5, 16, 8, deflate_fast), /* 2 */
    new Config(4, 6, 32, 32, deflate_fast), /* 3 */

    new Config(4, 4, 16, 16, deflate_slow), /* 4 lazy matches */
    new Config(8, 16, 32, 32, deflate_slow), /* 5 */
    new Config(8, 16, 128, 128, deflate_slow), /* 6 */
    new Config(8, 32, 128, 256, deflate_slow), /* 7 */
    new Config(32, 128, 258, 1024, deflate_slow), /* 8 */
    new Config(32, 258, 258, 4096, deflate_slow) /* 9 max compression */
  ];


  /* ===========================================================================
   * Initialize the "longest match" routines for a new zlib stream
   */
  function lm_init(s) {
    s.window_size = 2 * s.w_size;

    /*** CLEAR_HASH(s); ***/
    zero(s.head); // Fill with NIL (= 0);

    /* Set the default configuration parameters:
     */
    s.max_lazy_match = configuration_table[s.level].max_lazy;
    s.good_match = configuration_table[s.level].good_length;
    s.nice_match = configuration_table[s.level].nice_length;
    s.max_chain_length = configuration_table[s.level].max_chain;

    s.strstart = 0;
    s.block_start = 0;
    s.lookahead = 0;
    s.insert = 0;
    s.match_length = s.prev_length = MIN_MATCH - 1;
    s.match_available = 0;
    s.ins_h = 0;
  }


  function DeflateState() {
    this.strm = null; /* pointer back to this zlib stream */
    this.status = 0; /* as the name implies */
    this.pending_buf = null; /* output still pending */
    this.pending_buf_size = 0; /* size of pending_buf */
    this.pending_out = 0; /* next pending byte to output to the stream */
    this.pending = 0; /* nb of bytes in the pending buffer */
    this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
    this.gzhead = null; /* gzip header information to write */
    this.gzindex = 0; /* where in extra, name, or comment */
    this.method = Z_DEFLATED$2; /* can only be DEFLATED */
    this.last_flush = -1; /* value of flush param for previous deflate call */

    this.w_size = 0; /* LZ77 window size (32K by default) */
    this.w_bits = 0; /* log2(w_size)  (8..16) */
    this.w_mask = 0; /* w_size - 1 */

    this.window = null;
    /* Sliding window. Input bytes are read into the second half of the window,
     * and move to the first half later to keep a dictionary of at least wSize
     * bytes. With this organization, matches are limited to a distance of
     * wSize-MAX_MATCH bytes, but this ensures that IO is always
     * performed with a length multiple of the block size.
     */

    this.window_size = 0;
    /* Actual size of window: 2*wSize, except when the user input buffer
     * is directly used as sliding window.
     */

    this.prev = null;
    /* Link to older string with same hash index. To limit the size of this
     * array to 64K, this link is maintained only for the last 32K strings.
     * An index in this array is thus a window index modulo 32K.
     */

    this.head = null; /* Heads of the hash chains or NIL. */

    this.ins_h = 0; /* hash index of string to be inserted */
    this.hash_size = 0; /* number of elements in hash table */
    this.hash_bits = 0; /* log2(hash_size) */
    this.hash_mask = 0; /* hash_size-1 */

    this.hash_shift = 0;
    /* Number of bits by which ins_h must be shifted at each input
     * step. It must be such that after MIN_MATCH steps, the oldest
     * byte no longer takes part in the hash key, that is:
     *   hash_shift * MIN_MATCH >= hash_bits
     */

    this.block_start = 0;
    /* Window position at the beginning of the current output block. Gets
     * negative when the window is moved backwards.
     */

    this.match_length = 0; /* length of best match */
    this.prev_match = 0; /* previous match */
    this.match_available = 0; /* set if previous match exists */
    this.strstart = 0; /* start of string to insert */
    this.match_start = 0; /* start of matching string */
    this.lookahead = 0; /* number of valid bytes ahead in window */

    this.prev_length = 0;
    /* Length of the best match at previous step. Matches not greater than this
     * are discarded. This is used in the lazy match evaluation.
     */

    this.max_chain_length = 0;
    /* To speed up deflation, hash chains are never searched beyond this
     * length.  A higher limit improves compression ratio but degrades the
     * speed.
     */

    this.max_lazy_match = 0;
    /* Attempt to find a better match only when the current match is strictly
     * smaller than this value. This mechanism is used only for compression
     * levels >= 4.
     */
    // That's alias to max_lazy_match, don't use directly
    //this.max_insert_length = 0;
    /* Insert new strings in the hash table only if the match length is not
     * greater than this length. This saves time but degrades compression.
     * max_insert_length is used only for compression levels <= 3.
     */

    this.level = 0; /* compression level (1..9) */
    this.strategy = 0; /* favor or force Huffman coding*/

    this.good_match = 0;
    /* Use a faster search when the previous match is longer than this */

    this.nice_match = 0; /* Stop searching when current match exceeds this */

    /* used by c: */

    /* Didn't use ct_data typedef below to suppress compiler warning */

    // struct ct_data_s dyn_ltree[HEAP_SIZE];   /* literal and length tree */
    // struct ct_data_s dyn_dtree[2*D_CODES+1]; /* distance tree */
    // struct ct_data_s bl_tree[2*BL_CODES+1];  /* Huffman tree for bit lengths */

    // Use flat array of DOUBLE size, with interleaved fata,
    // because JS does not support effective
    this.dyn_ltree = new Buf16(HEAP_SIZE * 2);
    this.dyn_dtree = new Buf16((2 * D_CODES + 1) * 2);
    this.bl_tree = new Buf16((2 * BL_CODES + 1) * 2);
    zero(this.dyn_ltree);
    zero(this.dyn_dtree);
    zero(this.bl_tree);

    this.l_desc = null; /* desc. for literal tree */
    this.d_desc = null; /* desc. for distance tree */
    this.bl_desc = null; /* desc. for bit length tree */

    //ush bl_count[MAX_BITS+1];
    this.bl_count = new Buf16(MAX_BITS + 1);
    /* number of codes at each bit length for an optimal tree */

    //int heap[2*L_CODES+1];      /* heap used to build the Huffman trees */
    this.heap = new Buf16(2 * L_CODES + 1); /* heap used to build the Huffman trees */
    zero(this.heap);

    this.heap_len = 0; /* number of elements in the heap */
    this.heap_max = 0; /* element of largest frequency */
    /* The sons of heap[n] are heap[2*n] and heap[2*n+1]. heap[0] is not used.
     * The same heap array is used to build all
     */

    this.depth = new Buf16(2 * L_CODES + 1); //uch depth[2*L_CODES+1];
    zero(this.depth);
    /* Depth of each subtree used as tie breaker for trees of equal frequency
     */

    this.l_buf = 0; /* buffer index for literals or lengths */

    this.lit_bufsize = 0;
    /* Size of match buffer for literals/lengths.  There are 4 reasons for
     * limiting lit_bufsize to 64K:
     *   - frequencies can be kept in 16 bit counters
     *   - if compression is not successful for the first block, all input
     *     data is still in the window so we can still emit a stored block even
     *     when input comes from standard input.  (This can also be done for
     *     all blocks if lit_bufsize is not greater than 32K.)
     *   - if compression is not successful for a file smaller than 64K, we can
     *     even emit a stored file instead of a stored block (saving 5 bytes).
     *     This is applicable only for zip (not gzip or zlib).
     *   - creating new Huffman trees less frequently may not provide fast
     *     adaptation to changes in the input data statistics. (Take for
     *     example a binary file with poorly compressible code followed by
     *     a highly compressible string table.) Smaller buffer sizes give
     *     fast adaptation but have of course the overhead of transmitting
     *     trees more frequently.
     *   - I can't count above 4
     */

    this.last_lit = 0; /* running index in l_buf */

    this.d_buf = 0;
    /* Buffer index for distances. To simplify the code, d_buf and l_buf have
     * the same number of elements. To use different lengths, an extra flag
     * array would be necessary.
     */

    this.opt_len = 0; /* bit length of current block with optimal trees */
    this.static_len = 0; /* bit length of current block with static trees */
    this.matches = 0; /* number of string matches in current block */
    this.insert = 0; /* bytes at end of window left to insert */


    this.bi_buf = 0;
    /* Output buffer. bits are inserted starting at the bottom (least
     * significant bits).
     */
    this.bi_valid = 0;
    /* Number of valid bits in bi_buf.  All bits above the last valid bit
     * are always zero.
     */

    // Used for window memory init. We safely ignore it for JS. That makes
    // sense only for pointers and memory check tools.
    //this.high_water = 0;
    /* High water mark offset in window for initialized bytes -- bytes above
     * this are set to zero in order to avoid memory check warnings when
     * longest match routines access bytes past the input.  This is then
     * updated to the new high water mark.
     */
  }


  function deflateResetKeep(strm) {
    var s;

    if (!strm || !strm.state) {
      return err(strm, Z_STREAM_ERROR$2);
    }

    strm.total_in = strm.total_out = 0;
    strm.data_type = Z_UNKNOWN$1;

    s = strm.state;
    s.pending = 0;
    s.pending_out = 0;

    if (s.wrap < 0) {
      s.wrap = -s.wrap;
      /* was made negative by deflate(..., Z_FINISH); */
    }
    s.status = (s.wrap ? INIT_STATE : BUSY_STATE);
    strm.adler = (s.wrap === 2) ?
      0 // crc32(0, Z_NULL, 0)
      :
      1; // adler32(0, Z_NULL, 0)
    s.last_flush = Z_NO_FLUSH$1;
    _tr_init(s);
    return Z_OK$2;
  }


  function deflateReset(strm) {
    var ret = deflateResetKeep(strm);
    if (ret === Z_OK$2) {
      lm_init(strm.state);
    }
    return ret;
  }


  function deflateInit2(strm, level, method, windowBits, memLevel, strategy) {
    if (!strm) { // === Z_NULL
      return Z_STREAM_ERROR$2;
    }
    var wrap = 1;

    if (level === Z_DEFAULT_COMPRESSION$1) {
      level = 6;
    }

    if (windowBits < 0) { /* suppress zlib wrapper */
      wrap = 0;
      windowBits = -windowBits;
    } else if (windowBits > 15) {
      wrap = 2; /* write gzip wrapper instead */
      windowBits -= 16;
    }


    if (memLevel < 1 || memLevel > MAX_MEM_LEVEL || method !== Z_DEFLATED$2 ||
      windowBits < 8 || windowBits > 15 || level < 0 || level > 9 ||
      strategy < 0 || strategy > Z_FIXED$1) {
      return err(strm, Z_STREAM_ERROR$2);
    }


    if (windowBits === 8) {
      windowBits = 9;
    }
    /* until 256-byte window bug fixed */

    var s = new DeflateState();

    strm.state = s;
    s.strm = strm;

    s.wrap = wrap;
    s.gzhead = null;
    s.w_bits = windowBits;
    s.w_size = 1 << s.w_bits;
    s.w_mask = s.w_size - 1;

    s.hash_bits = memLevel + 7;
    s.hash_size = 1 << s.hash_bits;
    s.hash_mask = s.hash_size - 1;
    s.hash_shift = ~~((s.hash_bits + MIN_MATCH - 1) / MIN_MATCH);

    s.window = new Buf8(s.w_size * 2);
    s.head = new Buf16(s.hash_size);
    s.prev = new Buf16(s.w_size);

    // Don't need mem init magic for JS.
    //s.high_water = 0;  /* nothing written to s->window yet */

    s.lit_bufsize = 1 << (memLevel + 6); /* 16K elements by default */

    s.pending_buf_size = s.lit_bufsize * 4;

    //overlay = (ushf *) ZALLOC(strm, s->lit_bufsize, sizeof(ush)+2);
    //s->pending_buf = (uchf *) overlay;
    s.pending_buf = new Buf8(s.pending_buf_size);

    // It is offset from `s.pending_buf` (size is `s.lit_bufsize * 2`)
    //s->d_buf = overlay + s->lit_bufsize/sizeof(ush);
    s.d_buf = 1 * s.lit_bufsize;

    //s->l_buf = s->pending_buf + (1+sizeof(ush))*s->lit_bufsize;
    s.l_buf = (1 + 2) * s.lit_bufsize;

    s.level = level;
    s.strategy = strategy;
    s.method = method;

    return deflateReset(strm);
  }


  function deflate$1(strm, flush) {
    var old_flush, s;
    var beg, val; // for gzip header write only

    if (!strm || !strm.state ||
      flush > Z_BLOCK$2 || flush < 0) {
      return strm ? err(strm, Z_STREAM_ERROR$2) : Z_STREAM_ERROR$2;
    }

    s = strm.state;

    if (!strm.output ||
      (!strm.input && strm.avail_in !== 0) ||
      (s.status === FINISH_STATE && flush !== Z_FINISH$2)) {
      return err(strm, (strm.avail_out === 0) ? Z_BUF_ERROR$2 : Z_STREAM_ERROR$2);
    }

    s.strm = strm; /* just in case */
    old_flush = s.last_flush;
    s.last_flush = flush;

    /* Write the header */
    if (s.status === INIT_STATE) {
      if (s.wrap === 2) {
        // GZIP header
        strm.adler = 0; //crc32(0L, Z_NULL, 0);
        put_byte(s, 31);
        put_byte(s, 139);
        put_byte(s, 8);
        if (!s.gzhead) { // s->gzhead == Z_NULL
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, 0);
          put_byte(s, s.level === 9 ? 2 :
            (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2 ?
              4 : 0));
          put_byte(s, OS_CODE);
          s.status = BUSY_STATE;
        } else {
          put_byte(s, (s.gzhead.text ? 1 : 0) +
            (s.gzhead.hcrc ? 2 : 0) +
            (!s.gzhead.extra ? 0 : 4) +
            (!s.gzhead.name ? 0 : 8) +
            (!s.gzhead.comment ? 0 : 16)
          );
          put_byte(s, s.gzhead.time & 0xff);
          put_byte(s, (s.gzhead.time >> 8) & 0xff);
          put_byte(s, (s.gzhead.time >> 16) & 0xff);
          put_byte(s, (s.gzhead.time >> 24) & 0xff);
          put_byte(s, s.level === 9 ? 2 :
            (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2 ?
              4 : 0));
          put_byte(s, s.gzhead.os & 0xff);
          if (s.gzhead.extra && s.gzhead.extra.length) {
            put_byte(s, s.gzhead.extra.length & 0xff);
            put_byte(s, (s.gzhead.extra.length >> 8) & 0xff);
          }
          if (s.gzhead.hcrc) {
            strm.adler = crc32(strm.adler, s.pending_buf, s.pending, 0);
          }
          s.gzindex = 0;
          s.status = EXTRA_STATE;
        }
      } else // DEFLATE header
      {
        var header = (Z_DEFLATED$2 + ((s.w_bits - 8) << 4)) << 8;
        var level_flags = -1;

        if (s.strategy >= Z_HUFFMAN_ONLY$1 || s.level < 2) {
          level_flags = 0;
        } else if (s.level < 6) {
          level_flags = 1;
        } else if (s.level === 6) {
          level_flags = 2;
        } else {
          level_flags = 3;
        }
        header |= (level_flags << 6);
        if (s.strstart !== 0) {
          header |= PRESET_DICT;
        }
        header += 31 - (header % 31);

        s.status = BUSY_STATE;
        putShortMSB(s, header);

        /* Save the adler32 of the preset dictionary: */
        if (s.strstart !== 0) {
          putShortMSB(s, strm.adler >>> 16);
          putShortMSB(s, strm.adler & 0xffff);
        }
        strm.adler = 1; // adler32(0L, Z_NULL, 0);
      }
    }

    //#ifdef GZIP
    if (s.status === EXTRA_STATE) {
      if (s.gzhead.extra /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */

        while (s.gzindex < (s.gzhead.extra.length & 0xffff)) {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              break;
            }
          }
          put_byte(s, s.gzhead.extra[s.gzindex] & 0xff);
          s.gzindex++;
        }
        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (s.gzindex === s.gzhead.extra.length) {
          s.gzindex = 0;
          s.status = NAME_STATE;
        }
      } else {
        s.status = NAME_STATE;
      }
    }
    if (s.status === NAME_STATE) {
      if (s.gzhead.name /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.name.length) {
            val = s.gzhead.name.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.gzindex = 0;
          s.status = COMMENT_STATE;
        }
      } else {
        s.status = COMMENT_STATE;
      }
    }
    if (s.status === COMMENT_STATE) {
      if (s.gzhead.comment /* != Z_NULL*/ ) {
        beg = s.pending; /* start of bytes to update crc */
        //int val;

        do {
          if (s.pending === s.pending_buf_size) {
            if (s.gzhead.hcrc && s.pending > beg) {
              strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
            }
            flush_pending(strm);
            beg = s.pending;
            if (s.pending === s.pending_buf_size) {
              val = 1;
              break;
            }
          }
          // JS specific: little magic to add zero terminator to end of string
          if (s.gzindex < s.gzhead.comment.length) {
            val = s.gzhead.comment.charCodeAt(s.gzindex++) & 0xff;
          } else {
            val = 0;
          }
          put_byte(s, val);
        } while (val !== 0);

        if (s.gzhead.hcrc && s.pending > beg) {
          strm.adler = crc32(strm.adler, s.pending_buf, s.pending - beg, beg);
        }
        if (val === 0) {
          s.status = HCRC_STATE;
        }
      } else {
        s.status = HCRC_STATE;
      }
    }
    if (s.status === HCRC_STATE) {
      if (s.gzhead.hcrc) {
        if (s.pending + 2 > s.pending_buf_size) {
          flush_pending(strm);
        }
        if (s.pending + 2 <= s.pending_buf_size) {
          put_byte(s, strm.adler & 0xff);
          put_byte(s, (strm.adler >> 8) & 0xff);
          strm.adler = 0; //crc32(0L, Z_NULL, 0);
          s.status = BUSY_STATE;
        }
      } else {
        s.status = BUSY_STATE;
      }
    }
    //#endif

    /* Flush as much pending output as possible */
    if (s.pending !== 0) {
      flush_pending(strm);
      if (strm.avail_out === 0) {
        /* Since avail_out is 0, deflate will be called again with
         * more output space, but possibly with both pending and
         * avail_in equal to zero. There won't be anything to do,
         * but this is not an error situation so make sure we
         * return OK instead of BUF_ERROR at next call of deflate:
         */
        s.last_flush = -1;
        return Z_OK$2;
      }

      /* Make sure there is something to do and avoid duplicate consecutive
       * flushes. For repeated and useless calls with Z_FINISH, we keep
       * returning Z_STREAM_END instead of Z_BUF_ERROR.
       */
    } else if (strm.avail_in === 0 && rank(flush) <= rank(old_flush) &&
      flush !== Z_FINISH$2) {
      return err(strm, Z_BUF_ERROR$2);
    }

    /* User must not provide more input after the first FINISH: */
    if (s.status === FINISH_STATE && strm.avail_in !== 0) {
      return err(strm, Z_BUF_ERROR$2);
    }

    /* Start a new block or continue the current one.
     */
    if (strm.avail_in !== 0 || s.lookahead !== 0 ||
      (flush !== Z_NO_FLUSH$1 && s.status !== FINISH_STATE)) {
      var bstate = (s.strategy === Z_HUFFMAN_ONLY$1) ? deflate_huff(s, flush) :
        (s.strategy === Z_RLE$1 ? deflate_rle(s, flush) :
          configuration_table[s.level].func(s, flush));

      if (bstate === BS_FINISH_STARTED || bstate === BS_FINISH_DONE) {
        s.status = FINISH_STATE;
      }
      if (bstate === BS_NEED_MORE || bstate === BS_FINISH_STARTED) {
        if (strm.avail_out === 0) {
          s.last_flush = -1;
          /* avoid BUF_ERROR next call, see above */
        }
        return Z_OK$2;
        /* If flush != Z_NO_FLUSH && avail_out == 0, the next call
         * of deflate should use the same flush parameter to make sure
         * that the flush is complete. So we don't have to output an
         * empty block here, this will be done at next call. This also
         * ensures that for a very small output buffer, we emit at most
         * one empty block.
         */
      }
      if (bstate === BS_BLOCK_DONE) {
        if (flush === Z_PARTIAL_FLUSH$1) {
          _tr_align(s);
        } else if (flush !== Z_BLOCK$2) { /* FULL_FLUSH or SYNC_FLUSH */

          _tr_stored_block(s, 0, 0, false);
          /* For a full flush, this empty block will be recognized
           * as a special marker by inflate_sync().
           */
          if (flush === Z_FULL_FLUSH$1) {
            /*** CLEAR_HASH(s); ***/
            /* forget history */
            zero(s.head); // Fill with NIL (= 0);

            if (s.lookahead === 0) {
              s.strstart = 0;
              s.block_start = 0;
              s.insert = 0;
            }
          }
        }
        flush_pending(strm);
        if (strm.avail_out === 0) {
          s.last_flush = -1; /* avoid BUF_ERROR at next call, see above */
          return Z_OK$2;
        }
      }
    }
    //Assert(strm->avail_out > 0, "bug2");
    //if (strm.avail_out <= 0) { throw new Error("bug2");}

    if (flush !== Z_FINISH$2) {
      return Z_OK$2;
    }
    if (s.wrap <= 0) {
      return Z_STREAM_END$2;
    }

    /* Write the trailer */
    if (s.wrap === 2) {
      put_byte(s, strm.adler & 0xff);
      put_byte(s, (strm.adler >> 8) & 0xff);
      put_byte(s, (strm.adler >> 16) & 0xff);
      put_byte(s, (strm.adler >> 24) & 0xff);
      put_byte(s, strm.total_in & 0xff);
      put_byte(s, (strm.total_in >> 8) & 0xff);
      put_byte(s, (strm.total_in >> 16) & 0xff);
      put_byte(s, (strm.total_in >> 24) & 0xff);
    } else {
      putShortMSB(s, strm.adler >>> 16);
      putShortMSB(s, strm.adler & 0xffff);
    }

    flush_pending(strm);
    /* If avail_out is zero, the application will call deflate again
     * to flush the rest.
     */
    if (s.wrap > 0) {
      s.wrap = -s.wrap;
    }
    /* write the trailer only once! */
    return s.pending !== 0 ? Z_OK$2 : Z_STREAM_END$2;
  }

  function deflateEnd(strm) {
    var status;

    if (!strm /*== Z_NULL*/ || !strm.state /*== Z_NULL*/ ) {
      return Z_STREAM_ERROR$2;
    }

    status = strm.state.status;
    if (status !== INIT_STATE &&
      status !== EXTRA_STATE &&
      status !== NAME_STATE &&
      status !== COMMENT_STATE &&
      status !== HCRC_STATE &&
      status !== BUSY_STATE &&
      status !== FINISH_STATE
    ) {
      return err(strm, Z_STREAM_ERROR$2);
    }

    strm.state = null;

    return status === BUSY_STATE ? err(strm, Z_DATA_ERROR$2) : Z_OK$2;
  }

  /* Not implemented
  exports.deflateBound = deflateBound;
  exports.deflateCopy = deflateCopy;
  exports.deflateParams = deflateParams;
  exports.deflatePending = deflatePending;
  exports.deflatePrime = deflatePrime;
  exports.deflateTune = deflateTune;
  */

  // See state defs from inflate.js
  var BAD$1 = 30;       /* got a data error -- remain here until reset */
  var TYPE$1 = 12;      /* i: waiting for type bits, including last-flag bit */

  /*
     Decode literal, length, and distance codes and write out the resulting
     literal and match bytes until either not enough input or output is
     available, an end-of-block is encountered, or a data error is encountered.
     When large enough input and output buffers are supplied to inflate(), for
     example, a 16K input buffer and a 64K output buffer, more than 95% of the
     inflate execution time is spent in this routine.

     Entry assumptions:

          state.mode === LEN
          strm.avail_in >= 6
          strm.avail_out >= 258
          start >= strm.avail_out
          state.bits < 8

     On return, state.mode is one of:

          LEN -- ran out of enough output space or enough available input
          TYPE -- reached end of block code, inflate() to interpret next block
          BAD -- error in block data

     Notes:

      - The maximum input bits used by a length/distance pair is 15 bits for the
        length code, 5 bits for the length extra, 15 bits for the distance code,
        and 13 bits for the distance extra.  This totals 48 bits, or six bytes.
        Therefore if strm.avail_in >= 6, then there is enough input to avoid
        checking for available input while decoding.

      - The maximum bytes that a single length/distance pair can output is 258
        bytes, which is the maximum length that can be coded.  inflate_fast()
        requires strm.avail_out >= 258 for each loop to avoid checking for
        output space.
   */
  function inflate_fast(strm, start) {
    var state;
    var _in;                    /* local strm.input */
    var last;                   /* have enough input while in < last */
    var _out;                   /* local strm.output */
    var beg;                    /* inflate()'s initial strm.output */
    var end;                    /* while out < end, enough space available */
  //#ifdef INFLATE_STRICT
    var dmax;                   /* maximum distance from zlib header */
  //#endif
    var wsize;                  /* window size or zero if not using window */
    var whave;                  /* valid bytes in the window */
    var wnext;                  /* window write index */
    // Use `s_window` instead `window`, avoid conflict with instrumentation tools
    var s_window;               /* allocated sliding window, if wsize != 0 */
    var hold;                   /* local strm.hold */
    var bits;                   /* local strm.bits */
    var lcode;                  /* local strm.lencode */
    var dcode;                  /* local strm.distcode */
    var lmask;                  /* mask for first level of length codes */
    var dmask;                  /* mask for first level of distance codes */
    var here;                   /* retrieved table entry */
    var op;                     /* code bits, operation, extra bits, or */
                                /*  window position, window bytes to copy */
    var len;                    /* match length, unused bytes */
    var dist;                   /* match distance */
    var from;                   /* where to copy match from */
    var from_source;


    var input, output; // JS specific, because we have no pointers

    /* copy state to local variables */
    state = strm.state;
    //here = state.here;
    _in = strm.next_in;
    input = strm.input;
    last = _in + (strm.avail_in - 5);
    _out = strm.next_out;
    output = strm.output;
    beg = _out - (start - strm.avail_out);
    end = _out + (strm.avail_out - 257);
  //#ifdef INFLATE_STRICT
    dmax = state.dmax;
  //#endif
    wsize = state.wsize;
    whave = state.whave;
    wnext = state.wnext;
    s_window = state.window;
    hold = state.hold;
    bits = state.bits;
    lcode = state.lencode;
    dcode = state.distcode;
    lmask = (1 << state.lenbits) - 1;
    dmask = (1 << state.distbits) - 1;


    /* decode literals and length/distances until end-of-block or not enough
       input data or output space */

    top:
    do {
      if (bits < 15) {
        hold += input[_in++] << bits;
        bits += 8;
        hold += input[_in++] << bits;
        bits += 8;
      }

      here = lcode[hold & lmask];

      dolen:
      for (;;) { // Goto emulation
        op = here >>> 24/*here.bits*/;
        hold >>>= op;
        bits -= op;
        op = (here >>> 16) & 0xff/*here.op*/;
        if (op === 0) {                          /* literal */
          //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
          //        "inflate:         literal '%c'\n" :
          //        "inflate:         literal 0x%02x\n", here.val));
          output[_out++] = here & 0xffff/*here.val*/;
        }
        else if (op & 16) {                     /* length base */
          len = here & 0xffff/*here.val*/;
          op &= 15;                           /* number of extra bits */
          if (op) {
            if (bits < op) {
              hold += input[_in++] << bits;
              bits += 8;
            }
            len += hold & ((1 << op) - 1);
            hold >>>= op;
            bits -= op;
          }
          //Tracevv((stderr, "inflate:         length %u\n", len));
          if (bits < 15) {
            hold += input[_in++] << bits;
            bits += 8;
            hold += input[_in++] << bits;
            bits += 8;
          }
          here = dcode[hold & dmask];

          dodist:
          for (;;) { // goto emulation
            op = here >>> 24/*here.bits*/;
            hold >>>= op;
            bits -= op;
            op = (here >>> 16) & 0xff/*here.op*/;

            if (op & 16) {                      /* distance base */
              dist = here & 0xffff/*here.val*/;
              op &= 15;                       /* number of extra bits */
              if (bits < op) {
                hold += input[_in++] << bits;
                bits += 8;
                if (bits < op) {
                  hold += input[_in++] << bits;
                  bits += 8;
                }
              }
              dist += hold & ((1 << op) - 1);
  //#ifdef INFLATE_STRICT
              if (dist > dmax) {
                strm.msg = 'invalid distance too far back';
                state.mode = BAD$1;
                break top;
              }
  //#endif
              hold >>>= op;
              bits -= op;
              //Tracevv((stderr, "inflate:         distance %u\n", dist));
              op = _out - beg;                /* max distance in output */
              if (dist > op) {                /* see if copy from window */
                op = dist - op;               /* distance back in window */
                if (op > whave) {
                  if (state.sane) {
                    strm.msg = 'invalid distance too far back';
                    state.mode = BAD$1;
                    break top;
                  }

  // (!) This block is disabled in zlib defailts,
  // don't enable it for binary compatibility
  //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
  //                if (len <= op - whave) {
  //                  do {
  //                    output[_out++] = 0;
  //                  } while (--len);
  //                  continue top;
  //                }
  //                len -= op - whave;
  //                do {
  //                  output[_out++] = 0;
  //                } while (--op > whave);
  //                if (op === 0) {
  //                  from = _out - dist;
  //                  do {
  //                    output[_out++] = output[from++];
  //                  } while (--len);
  //                  continue top;
  //                }
  //#endif
                }
                from = 0; // window index
                from_source = s_window;
                if (wnext === 0) {           /* very common case */
                  from += wsize - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                else if (wnext < op) {      /* wrap around window */
                  from += wsize + wnext - op;
                  op -= wnext;
                  if (op < len) {         /* some from end of window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = 0;
                    if (wnext < len) {  /* some from start of window */
                      op = wnext;
                      len -= op;
                      do {
                        output[_out++] = s_window[from++];
                      } while (--op);
                      from = _out - dist;      /* rest from output */
                      from_source = output;
                    }
                  }
                }
                else {                      /* contiguous in window */
                  from += wnext - op;
                  if (op < len) {         /* some from window */
                    len -= op;
                    do {
                      output[_out++] = s_window[from++];
                    } while (--op);
                    from = _out - dist;  /* rest from output */
                    from_source = output;
                  }
                }
                while (len > 2) {
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  output[_out++] = from_source[from++];
                  len -= 3;
                }
                if (len) {
                  output[_out++] = from_source[from++];
                  if (len > 1) {
                    output[_out++] = from_source[from++];
                  }
                }
              }
              else {
                from = _out - dist;          /* copy direct from output */
                do {                        /* minimum length is three */
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  output[_out++] = output[from++];
                  len -= 3;
                } while (len > 2);
                if (len) {
                  output[_out++] = output[from++];
                  if (len > 1) {
                    output[_out++] = output[from++];
                  }
                }
              }
            }
            else if ((op & 64) === 0) {          /* 2nd level distance code */
              here = dcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
              continue dodist;
            }
            else {
              strm.msg = 'invalid distance code';
              state.mode = BAD$1;
              break top;
            }

            break; // need to emulate goto via "continue"
          }
        }
        else if ((op & 64) === 0) {              /* 2nd level length code */
          here = lcode[(here & 0xffff)/*here.val*/ + (hold & ((1 << op) - 1))];
          continue dolen;
        }
        else if (op & 32) {                     /* end-of-block */
          //Tracevv((stderr, "inflate:         end of block\n"));
          state.mode = TYPE$1;
          break top;
        }
        else {
          strm.msg = 'invalid literal/length code';
          state.mode = BAD$1;
          break top;
        }

        break; // need to emulate goto via "continue"
      }
    } while (_in < last && _out < end);

    /* return unused bytes (on entry, bits < 8, so in won't go too far back) */
    len = bits >> 3;
    _in -= len;
    bits -= len << 3;
    hold &= (1 << bits) - 1;

    /* update state and return */
    strm.next_in = _in;
    strm.next_out = _out;
    strm.avail_in = (_in < last ? 5 + (last - _in) : 5 - (_in - last));
    strm.avail_out = (_out < end ? 257 + (end - _out) : 257 - (_out - end));
    state.hold = hold;
    state.bits = bits;
    return;
  }

  var MAXBITS = 15;
  var ENOUGH_LENS$1 = 852;
  var ENOUGH_DISTS$1 = 592;
  //var ENOUGH = (ENOUGH_LENS+ENOUGH_DISTS);

  var CODES$1 = 0;
  var LENS$1 = 1;
  var DISTS$1 = 2;

  var lbase = [ /* Length codes 257..285 base */
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31,
    35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0
  ];

  var lext = [ /* Length codes 257..285 extra */
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18,
    19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78
  ];

  var dbase = [ /* Distance codes 0..29 base */
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193,
    257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145,
    8193, 12289, 16385, 24577, 0, 0
  ];

  var dext = [ /* Distance codes 0..29 extra */
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22,
    23, 23, 24, 24, 25, 25, 26, 26, 27, 27,
    28, 28, 29, 29, 64, 64
  ];

  function inflate_table(type, lens, lens_index, codes, table, table_index, work, opts) {
    var bits = opts.bits;
    //here = opts.here; /* table entry for duplication */

    var len = 0; /* a code's length in bits */
    var sym = 0; /* index of code symbols */
    var min = 0,
      max = 0; /* minimum and maximum code lengths */
    var root = 0; /* number of index bits for root table */
    var curr = 0; /* number of index bits for current table */
    var drop = 0; /* code bits to drop for sub-table */
    var left = 0; /* number of prefix codes available */
    var used = 0; /* code entries in table used */
    var huff = 0; /* Huffman code */
    var incr; /* for incrementing code, index */
    var fill; /* index for replicating entries */
    var low; /* low bits for current root entry */
    var mask; /* mask for low root bits */
    var next; /* next available space in table */
    var base = null; /* base value table to use */
    var base_index = 0;
    //  var shoextra;    /* extra bits table to use */
    var end; /* use base and extra for symbol > end */
    var count = new Buf16(MAXBITS + 1); //[MAXBITS+1];    /* number of codes of each length */
    var offs = new Buf16(MAXBITS + 1); //[MAXBITS+1];     /* offsets in table for each length */
    var extra = null;
    var extra_index = 0;

    var here_bits, here_op, here_val;

    /*
     Process a set of code lengths to create a canonical Huffman code.  The
     code lengths are lens[0..codes-1].  Each length corresponds to the
     symbols 0..codes-1.  The Huffman code is generated by first sorting the
     symbols by length from short to long, and retaining the symbol order
     for codes with equal lengths.  Then the code starts with all zero bits
     for the first code of the shortest length, and the codes are integer
     increments for the same length, and zeros are appended as the length
     increases.  For the deflate format, these bits are stored backwards
     from their more natural integer increment ordering, and so when the
     decoding tables are built in the large loop below, the integer codes
     are incremented backwards.

     This routine assumes, but does not check, that all of the entries in
     lens[] are in the range 0..MAXBITS.  The caller must assure this.
     1..MAXBITS is interpreted as that code length.  zero means that that
     symbol does not occur in this code.

     The codes are sorted by computing a count of codes for each length,
     creating from that a table of starting indices for each length in the
     sorted table, and then entering the symbols in order in the sorted
     table.  The sorted table is work[], with that space being provided by
     the caller.

     The length counts are used for other purposes as well, i.e. finding
     the minimum and maximum length codes, determining if there are any
     codes at all, checking for a valid set of lengths, and looking ahead
     at length counts to determine sub-table sizes when building the
     decoding tables.
     */

    /* accumulate lengths for codes (assumes lens[] all in 0..MAXBITS) */
    for (len = 0; len <= MAXBITS; len++) {
      count[len] = 0;
    }
    for (sym = 0; sym < codes; sym++) {
      count[lens[lens_index + sym]]++;
    }

    /* bound code lengths, force root to be within code lengths */
    root = bits;
    for (max = MAXBITS; max >= 1; max--) {
      if (count[max] !== 0) {
        break;
      }
    }
    if (root > max) {
      root = max;
    }
    if (max === 0) { /* no symbols to code at all */
      //table.op[opts.table_index] = 64;  //here.op = (var char)64;    /* invalid code marker */
      //table.bits[opts.table_index] = 1;   //here.bits = (var char)1;
      //table.val[opts.table_index++] = 0;   //here.val = (var short)0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;


      //table.op[opts.table_index] = 64;
      //table.bits[opts.table_index] = 1;
      //table.val[opts.table_index++] = 0;
      table[table_index++] = (1 << 24) | (64 << 16) | 0;

      opts.bits = 1;
      return 0; /* no symbols, but wait for decoding to report error */
    }
    for (min = 1; min < max; min++) {
      if (count[min] !== 0) {
        break;
      }
    }
    if (root < min) {
      root = min;
    }

    /* check for an over-subscribed or incomplete set of lengths */
    left = 1;
    for (len = 1; len <= MAXBITS; len++) {
      left <<= 1;
      left -= count[len];
      if (left < 0) {
        return -1;
      } /* over-subscribed */
    }
    if (left > 0 && (type === CODES$1 || max !== 1)) {
      return -1; /* incomplete set */
    }

    /* generate offsets into symbol table for each length for sorting */
    offs[1] = 0;
    for (len = 1; len < MAXBITS; len++) {
      offs[len + 1] = offs[len] + count[len];
    }

    /* sort symbols by length, by symbol order within each length */
    for (sym = 0; sym < codes; sym++) {
      if (lens[lens_index + sym] !== 0) {
        work[offs[lens[lens_index + sym]]++] = sym;
      }
    }

    /*
     Create and fill in decoding tables.  In this loop, the table being
     filled is at next and has curr index bits.  The code being used is huff
     with length len.  That code is converted to an index by dropping drop
     bits off of the bottom.  For codes where len is less than drop + curr,
     those top drop + curr - len bits are incremented through all values to
     fill the table with replicated entries.

     root is the number of index bits for the root table.  When len exceeds
     root, sub-tables are created pointed to by the root entry with an index
     of the low root bits of huff.  This is saved in low to check for when a
     new sub-table should be started.  drop is zero when the root table is
     being filled, and drop is root when sub-tables are being filled.

     When a new sub-table is needed, it is necessary to look ahead in the
     code lengths to determine what size sub-table is needed.  The length
     counts are used for this, and so count[] is decremented as codes are
     entered in the tables.

     used keeps track of how many table entries have been allocated from the
     provided *table space.  It is checked for LENS and DIST tables against
     the constants ENOUGH_LENS and ENOUGH_DISTS to guard against changes in
     the initial root table size constants.  See the comments in inftrees.h
     for more information.

     sym increments through all symbols, and the loop terminates when
     all codes of length max, i.e. all codes, have been processed.  This
     routine permits incomplete codes, so another loop after this one fills
     in the rest of the decoding tables with invalid code markers.
     */

    /* set up for code type */
    // poor man optimization - use if-else instead of switch,
    // to avoid deopts in old v8
    if (type === CODES$1) {
      base = extra = work; /* dummy value--not used */
      end = 19;

    } else if (type === LENS$1) {
      base = lbase;
      base_index -= 257;
      extra = lext;
      extra_index -= 257;
      end = 256;

    } else { /* DISTS */
      base = dbase;
      extra = dext;
      end = -1;
    }

    /* initialize opts for loop */
    huff = 0; /* starting code */
    sym = 0; /* starting code symbol */
    len = min; /* starting code length */
    next = table_index; /* current table to fill in */
    curr = root; /* current table index bits */
    drop = 0; /* current bits to drop from code for index */
    low = -1; /* trigger new sub-table when len > root */
    used = 1 << root; /* use root table entries */
    mask = used - 1; /* mask for comparing low */

    /* check available table space */
    if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
      (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
      return 1;
    }
    /* process all codes and make table entries */
    for (;;) {
      /* create table entry */
      here_bits = len - drop;
      if (work[sym] < end) {
        here_op = 0;
        here_val = work[sym];
      } else if (work[sym] > end) {
        here_op = extra[extra_index + work[sym]];
        here_val = base[base_index + work[sym]];
      } else {
        here_op = 32 + 64; /* end of block */
        here_val = 0;
      }

      /* replicate for those indices with low len bits equal to huff */
      incr = 1 << (len - drop);
      fill = 1 << curr;
      min = fill; /* save offset to next table */
      do {
        fill -= incr;
        table[next + (huff >> drop) + fill] = (here_bits << 24) | (here_op << 16) | here_val | 0;
      } while (fill !== 0);

      /* backwards increment the len-bit code huff */
      incr = 1 << (len - 1);
      while (huff & incr) {
        incr >>= 1;
      }
      if (incr !== 0) {
        huff &= incr - 1;
        huff += incr;
      } else {
        huff = 0;
      }

      /* go to next symbol, update count, len */
      sym++;
      if (--count[len] === 0) {
        if (len === max) {
          break;
        }
        len = lens[lens_index + work[sym]];
      }

      /* create new sub-table if needed */
      if (len > root && (huff & mask) !== low) {
        /* if first time, transition to sub-tables */
        if (drop === 0) {
          drop = root;
        }

        /* increment past last table */
        next += min; /* here min is 1 << curr */

        /* determine length of next table */
        curr = len - drop;
        left = 1 << curr;
        while (curr + drop < max) {
          left -= count[curr + drop];
          if (left <= 0) {
            break;
          }
          curr++;
          left <<= 1;
        }

        /* check for enough space */
        used += 1 << curr;
        if ((type === LENS$1 && used > ENOUGH_LENS$1) ||
          (type === DISTS$1 && used > ENOUGH_DISTS$1)) {
          return 1;
        }

        /* point entry in root table to sub-table */
        low = huff & mask;
        /*table.op[low] = curr;
        table.bits[low] = root;
        table.val[low] = next - opts.table_index;*/
        table[low] = (root << 24) | (curr << 16) | (next - table_index) | 0;
      }
    }

    /* fill in remaining table entry if code is incomplete (guaranteed to have
     at most one remaining entry, since if the code is incomplete, the
     maximum code length that was allowed to get this far is one bit) */
    if (huff !== 0) {
      //table.op[next + huff] = 64;            /* invalid code marker */
      //table.bits[next + huff] = len - drop;
      //table.val[next + huff] = 0;
      table[next + huff] = ((len - drop) << 24) | (64 << 16) | 0;
    }

    /* set return parameters */
    //opts.table_index += used;
    opts.bits = root;
    return 0;
  }

  var CODES = 0;
  var LENS = 1;
  var DISTS = 2;

  /* Public constants ==========================================================*/
  /* ===========================================================================*/


  /* Allowed flush values; see deflate() and inflate() below for details */
  //var Z_NO_FLUSH      = 0;
  //var Z_PARTIAL_FLUSH = 1;
  //var Z_SYNC_FLUSH    = 2;
  //var Z_FULL_FLUSH    = 3;
  var Z_FINISH$1 = 4;
  var Z_BLOCK$1 = 5;
  var Z_TREES$1 = 6;


  /* Return codes for the compression/decompression functions. Negative values
   * are errors, positive values are used for special but normal events.
   */
  var Z_OK$1 = 0;
  var Z_STREAM_END$1 = 1;
  var Z_NEED_DICT$1 = 2;
  //var Z_ERRNO         = -1;
  var Z_STREAM_ERROR$1 = -2;
  var Z_DATA_ERROR$1 = -3;
  var Z_MEM_ERROR = -4;
  var Z_BUF_ERROR$1 = -5;
  //var Z_VERSION_ERROR = -6;

  /* The deflate compression method */
  var Z_DEFLATED$1 = 8;


  /* STATES ====================================================================*/
  /* ===========================================================================*/


  var HEAD = 1; /* i: waiting for magic header */
  var FLAGS = 2; /* i: waiting for method and flags (gzip) */
  var TIME = 3; /* i: waiting for modification time (gzip) */
  var OS = 4; /* i: waiting for extra flags and operating system (gzip) */
  var EXLEN = 5; /* i: waiting for extra length (gzip) */
  var EXTRA = 6; /* i: waiting for extra bytes (gzip) */
  var NAME = 7; /* i: waiting for end of file name (gzip) */
  var COMMENT = 8; /* i: waiting for end of comment (gzip) */
  var HCRC = 9; /* i: waiting for header crc (gzip) */
  var DICTID = 10; /* i: waiting for dictionary check value */
  var DICT = 11; /* waiting for inflateSetDictionary() call */
  var TYPE = 12; /* i: waiting for type bits, including last-flag bit */
  var TYPEDO = 13; /* i: same, but skip check to exit inflate on new block */
  var STORED = 14; /* i: waiting for stored size (length and complement) */
  var COPY_ = 15; /* i/o: same as COPY below, but only first time in */
  var COPY = 16; /* i/o: waiting for input or output to copy stored block */
  var TABLE = 17; /* i: waiting for dynamic block table lengths */
  var LENLENS = 18; /* i: waiting for code length code lengths */
  var CODELENS = 19; /* i: waiting for length/lit and distance code lengths */
  var LEN_ = 20; /* i: same as LEN below, but only first time in */
  var LEN = 21; /* i: waiting for length/lit/eob code */
  var LENEXT = 22; /* i: waiting for length extra bits */
  var DIST = 23; /* i: waiting for distance code */
  var DISTEXT = 24; /* i: waiting for distance extra bits */
  var MATCH = 25; /* o: waiting for output space to copy string */
  var LIT = 26; /* o: waiting for output space to write literal */
  var CHECK = 27; /* i: waiting for 32-bit check value */
  var LENGTH = 28; /* i: waiting for 32-bit length (gzip) */
  var DONE = 29; /* finished check, done -- remain here until reset */
  var BAD = 30; /* got a data error -- remain here until reset */
  var MEM = 31; /* got an inflate() memory error -- remain here until reset */
  var SYNC = 32; /* looking for synchronization bytes to restart inflate() */

  /* ===========================================================================*/



  var ENOUGH_LENS = 852;
  var ENOUGH_DISTS = 592;


  function zswap32(q) {
    return (((q >>> 24) & 0xff) +
      ((q >>> 8) & 0xff00) +
      ((q & 0xff00) << 8) +
      ((q & 0xff) << 24));
  }


  function InflateState() {
    this.mode = 0; /* current inflate mode */
    this.last = false; /* true if processing last block */
    this.wrap = 0; /* bit 0 true for zlib, bit 1 true for gzip */
    this.havedict = false; /* true if dictionary provided */
    this.flags = 0; /* gzip header method and flags (0 if zlib) */
    this.dmax = 0; /* zlib header max distance (INFLATE_STRICT) */
    this.check = 0; /* protected copy of check value */
    this.total = 0; /* protected copy of output count */
    // TODO: may be {}
    this.head = null; /* where to save gzip header information */

    /* sliding window */
    this.wbits = 0; /* log base 2 of requested window size */
    this.wsize = 0; /* window size or zero if not using window */
    this.whave = 0; /* valid bytes in the window */
    this.wnext = 0; /* window write index */
    this.window = null; /* allocated sliding window, if needed */

    /* bit accumulator */
    this.hold = 0; /* input bit accumulator */
    this.bits = 0; /* number of bits in "in" */

    /* for string and stored block copying */
    this.length = 0; /* literal or length of data to copy */
    this.offset = 0; /* distance back to copy string from */

    /* for table and code decoding */
    this.extra = 0; /* extra bits needed */

    /* fixed and dynamic code tables */
    this.lencode = null; /* starting table for length/literal codes */
    this.distcode = null; /* starting table for distance codes */
    this.lenbits = 0; /* index bits for lencode */
    this.distbits = 0; /* index bits for distcode */

    /* dynamic table building */
    this.ncode = 0; /* number of code length code lengths */
    this.nlen = 0; /* number of length code lengths */
    this.ndist = 0; /* number of distance code lengths */
    this.have = 0; /* number of code lengths in lens[] */
    this.next = null; /* next available space in codes[] */

    this.lens = new Buf16(320); /* temporary storage for code lengths */
    this.work = new Buf16(288); /* work area for code table building */

    /*
     because we don't have pointers in js, we use lencode and distcode directly
     as buffers so we don't need codes
    */
    //this.codes = new Buf32(ENOUGH);       /* space for code tables */
    this.lendyn = null; /* dynamic table for length/literal codes (JS specific) */
    this.distdyn = null; /* dynamic table for distance codes (JS specific) */
    this.sane = 0; /* if false, allow invalid distance too far */
    this.back = 0; /* bits back of last unprocessed length/lit */
    this.was = 0; /* initial length of match */
  }

  function inflateResetKeep(strm) {
    var state;

    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    strm.total_in = strm.total_out = state.total = 0;
    strm.msg = ''; /*Z_NULL*/
    if (state.wrap) { /* to support ill-conceived Java test suite */
      strm.adler = state.wrap & 1;
    }
    state.mode = HEAD;
    state.last = 0;
    state.havedict = 0;
    state.dmax = 32768;
    state.head = null /*Z_NULL*/ ;
    state.hold = 0;
    state.bits = 0;
    //state.lencode = state.distcode = state.next = state.codes;
    state.lencode = state.lendyn = new Buf32(ENOUGH_LENS);
    state.distcode = state.distdyn = new Buf32(ENOUGH_DISTS);

    state.sane = 1;
    state.back = -1;
    //Tracev((stderr, "inflate: reset\n"));
    return Z_OK$1;
  }

  function inflateReset(strm) {
    var state;

    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;
    state.wsize = 0;
    state.whave = 0;
    state.wnext = 0;
    return inflateResetKeep(strm);

  }

  function inflateReset2(strm, windowBits) {
    var wrap;
    var state;

    /* get the state */
    if (!strm || !strm.state) {
      return Z_STREAM_ERROR$1;
    }
    state = strm.state;

    /* extract wrap request from windowBits parameter */
    if (windowBits < 0) {
      wrap = 0;
      windowBits = -windowBits;
    } else {
      wrap = (windowBits >> 4) + 1;
      if (windowBits < 48) {
        windowBits &= 15;
      }
    }

    /* set number of window bits, free window if different */
    if (windowBits && (windowBits < 8 || windowBits > 15)) {
      return Z_STREAM_ERROR$1;
    }
    if (state.window !== null && state.wbits !== windowBits) {
      state.window = null;
    }

    /* update state and reset the rest of it */
    state.wrap = wrap;
    state.wbits = windowBits;
    return inflateReset(strm);
  }

  function inflateInit2(strm, windowBits) {
    var ret;
    var state;

    if (!strm) {
      return Z_STREAM_ERROR$1;
    }
    //strm.msg = Z_NULL;                 /* in case we return an error */

    state = new InflateState();

    //if (state === Z_NULL) return Z_MEM_ERROR;
    //Tracev((stderr, "inflate: allocated\n"));
    strm.state = state;
    state.window = null /*Z_NULL*/ ;
    ret = inflateReset2(strm, windowBits);
    if (ret !== Z_OK$1) {
      strm.state = null /*Z_NULL*/ ;
    }
    return ret;
  }


  /*
   Return state with length and distance decoding tables and index sizes set to
   fixed code decoding.  Normally this returns fixed tables from inffixed.h.
   If BUILDFIXED is defined, then instead this routine builds the tables the
   first time it's called, and returns those tables the first time and
   thereafter.  This reduces the size of the code by about 2K bytes, in
   exchange for a little execution time.  However, BUILDFIXED should not be
   used for threaded applications, since the rewriting of the tables and virgin
   may not be thread-safe.
   */
  var virgin = true;

  var lenfix, distfix; // We have no pointers in JS, so keep tables separate

  function fixedtables(state) {
    /* build fixed huffman tables if first call (may not be thread safe) */
    if (virgin) {
      var sym;

      lenfix = new Buf32(512);
      distfix = new Buf32(32);

      /* literal/length table */
      sym = 0;
      while (sym < 144) {
        state.lens[sym++] = 8;
      }
      while (sym < 256) {
        state.lens[sym++] = 9;
      }
      while (sym < 280) {
        state.lens[sym++] = 7;
      }
      while (sym < 288) {
        state.lens[sym++] = 8;
      }

      inflate_table(LENS, state.lens, 0, 288, lenfix, 0, state.work, {
        bits: 9
      });

      /* distance table */
      sym = 0;
      while (sym < 32) {
        state.lens[sym++] = 5;
      }

      inflate_table(DISTS, state.lens, 0, 32, distfix, 0, state.work, {
        bits: 5
      });

      /* do this just once */
      virgin = false;
    }

    state.lencode = lenfix;
    state.lenbits = 9;
    state.distcode = distfix;
    state.distbits = 5;
  }


  /*
   Update the window with the last wsize (normally 32K) bytes written before
   returning.  If window does not exist yet, create it.  This is only called
   when a window is already in use, or when output has been written during this
   inflate call, but the end of the deflate stream has not been reached yet.
   It is also called to create a window for dictionary data when a dictionary
   is loaded.

   Providing output buffers larger than 32K to inflate() should provide a speed
   advantage, since only the last 32K of output is copied to the sliding window
   upon return from inflate(), and since all distances after the first 32K of
   output will fall in the output data, making match copies simpler and faster.
   The advantage may be dependent on the size of the processor's data caches.
   */
  function updatewindow(strm, src, end, copy) {
    var dist;
    var state = strm.state;

    /* if it hasn't been done already, allocate space for the window */
    if (state.window === null) {
      state.wsize = 1 << state.wbits;
      state.wnext = 0;
      state.whave = 0;

      state.window = new Buf8(state.wsize);
    }

    /* copy state->wsize or less output bytes into the circular window */
    if (copy >= state.wsize) {
      arraySet(state.window, src, end - state.wsize, state.wsize, 0);
      state.wnext = 0;
      state.whave = state.wsize;
    } else {
      dist = state.wsize - state.wnext;
      if (dist > copy) {
        dist = copy;
      }
      //zmemcpy(state->window + state->wnext, end - copy, dist);
      arraySet(state.window, src, end - copy, dist, state.wnext);
      copy -= dist;
      if (copy) {
        //zmemcpy(state->window, end - copy, copy);
        arraySet(state.window, src, end - copy, copy, 0);
        state.wnext = copy;
        state.whave = state.wsize;
      } else {
        state.wnext += dist;
        if (state.wnext === state.wsize) {
          state.wnext = 0;
        }
        if (state.whave < state.wsize) {
          state.whave += dist;
        }
      }
    }
    return 0;
  }

  function inflate$1(strm, flush) {
    var state;
    var input, output; // input/output buffers
    var next; /* next input INDEX */
    var put; /* next output INDEX */
    var have, left; /* available input and output */
    var hold; /* bit buffer */
    var bits; /* bits in bit buffer */
    var _in, _out; /* save starting available input and output */
    var copy; /* number of stored or match bytes to copy */
    var from; /* where to copy match bytes from */
    var from_source;
    var here = 0; /* current decoding table entry */
    var here_bits, here_op, here_val; // paked "here" denormalized (JS specific)
    //var last;                   /* parent table entry */
    var last_bits, last_op, last_val; // paked "last" denormalized (JS specific)
    var len; /* length to copy for repeats, bits to drop */
    var ret; /* return code */
    var hbuf = new Buf8(4); /* buffer for gzip header crc calculation */
    var opts;

    var n; // temporary var for NEED_BITS

    var order = /* permutation of code lengths */ [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];


    if (!strm || !strm.state || !strm.output ||
      (!strm.input && strm.avail_in !== 0)) {
      return Z_STREAM_ERROR$1;
    }

    state = strm.state;
    if (state.mode === TYPE) {
      state.mode = TYPEDO;
    } /* skip check */


    //--- LOAD() ---
    put = strm.next_out;
    output = strm.output;
    left = strm.avail_out;
    next = strm.next_in;
    input = strm.input;
    have = strm.avail_in;
    hold = state.hold;
    bits = state.bits;
    //---

    _in = have;
    _out = left;
    ret = Z_OK$1;

    inf_leave: // goto emulation
      for (;;) {
        switch (state.mode) {
        case HEAD:
          if (state.wrap === 0) {
            state.mode = TYPEDO;
            break;
          }
          //=== NEEDBITS(16);
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((state.wrap & 2) && hold === 0x8b1f) { /* gzip header */
            state.check = 0 /*crc32(0L, Z_NULL, 0)*/ ;
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//

            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            state.mode = FLAGS;
            break;
          }
          state.flags = 0; /* expect zlib header */
          if (state.head) {
            state.head.done = false;
          }
          if (!(state.wrap & 1) || /* check if zlib header allowed */
            (((hold & 0xff) /*BITS(8)*/ << 8) + (hold >> 8)) % 31) {
            strm.msg = 'incorrect header check';
            state.mode = BAD;
            break;
          }
          if ((hold & 0x0f) /*BITS(4)*/ !== Z_DEFLATED$1) {
            strm.msg = 'unknown compression method';
            state.mode = BAD;
            break;
          }
          //--- DROPBITS(4) ---//
          hold >>>= 4;
          bits -= 4;
          //---//
          len = (hold & 0x0f) /*BITS(4)*/ + 8;
          if (state.wbits === 0) {
            state.wbits = len;
          } else if (len > state.wbits) {
            strm.msg = 'invalid window size';
            state.mode = BAD;
            break;
          }
          state.dmax = 1 << len;
          //Tracev((stderr, "inflate:   zlib header ok\n"));
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/ ;
          state.mode = hold & 0x200 ? DICTID : TYPE;
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          break;
        case FLAGS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.flags = hold;
          if ((state.flags & 0xff) !== Z_DEFLATED$1) {
            strm.msg = 'unknown compression method';
            state.mode = BAD;
            break;
          }
          if (state.flags & 0xe000) {
            strm.msg = 'unknown header flags set';
            state.mode = BAD;
            break;
          }
          if (state.head) {
            state.head.text = ((hold >> 8) & 1);
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = TIME;
          /* falls through */
        case TIME:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (state.head) {
            state.head.time = hold;
          }
          if (state.flags & 0x0200) {
            //=== CRC4(state.check, hold)
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            hbuf[2] = (hold >>> 16) & 0xff;
            hbuf[3] = (hold >>> 24) & 0xff;
            state.check = crc32(state.check, hbuf, 4, 0);
            //===
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = OS;
          /* falls through */
        case OS:
          //=== NEEDBITS(16); */
          while (bits < 16) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if (state.head) {
            state.head.xflags = (hold & 0xff);
            state.head.os = (hold >> 8);
          }
          if (state.flags & 0x0200) {
            //=== CRC2(state.check, hold);
            hbuf[0] = hold & 0xff;
            hbuf[1] = (hold >>> 8) & 0xff;
            state.check = crc32(state.check, hbuf, 2, 0);
            //===//
          }
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = EXLEN;
          /* falls through */
        case EXLEN:
          if (state.flags & 0x0400) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.length = hold;
            if (state.head) {
              state.head.extra_len = hold;
            }
            if (state.flags & 0x0200) {
              //=== CRC2(state.check, hold);
              hbuf[0] = hold & 0xff;
              hbuf[1] = (hold >>> 8) & 0xff;
              state.check = crc32(state.check, hbuf, 2, 0);
              //===//
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
          } else if (state.head) {
            state.head.extra = null /*Z_NULL*/ ;
          }
          state.mode = EXTRA;
          /* falls through */
        case EXTRA:
          if (state.flags & 0x0400) {
            copy = state.length;
            if (copy > have) {
              copy = have;
            }
            if (copy) {
              if (state.head) {
                len = state.head.extra_len - state.length;
                if (!state.head.extra) {
                  // Use untyped array for more conveniend processing later
                  state.head.extra = new Array(state.head.extra_len);
                }
                arraySet(
                  state.head.extra,
                  input,
                  next,
                  // extra field is limited to 65536 bytes
                  // - no need for additional size check
                  copy,
                  /*len + copy > state.head.extra_max - len ? state.head.extra_max : copy,*/
                  len
                );
                //zmemcpy(state.head.extra + len, next,
                //        len + copy > state.head.extra_max ?
                //        state.head.extra_max - len : copy);
              }
              if (state.flags & 0x0200) {
                state.check = crc32(state.check, input, copy, next);
              }
              have -= copy;
              next += copy;
              state.length -= copy;
            }
            if (state.length) {
              break inf_leave;
            }
          }
          state.length = 0;
          state.mode = NAME;
          /* falls through */
        case NAME:
          if (state.flags & 0x0800) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              // TODO: 2 or 1 bytes?
              len = input[next + copy++];
              /* use constant limit because in js we should not preallocate memory */
              if (state.head && len &&
                (state.length < 65536 /*state.head.name_max*/ )) {
                state.head.name += String.fromCharCode(len);
              }
            } while (len && copy < have);

            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.name = null;
          }
          state.length = 0;
          state.mode = COMMENT;
          /* falls through */
        case COMMENT:
          if (state.flags & 0x1000) {
            if (have === 0) {
              break inf_leave;
            }
            copy = 0;
            do {
              len = input[next + copy++];
              /* use constant limit because in js we should not preallocate memory */
              if (state.head && len &&
                (state.length < 65536 /*state.head.comm_max*/ )) {
                state.head.comment += String.fromCharCode(len);
              }
            } while (len && copy < have);
            if (state.flags & 0x0200) {
              state.check = crc32(state.check, input, copy, next);
            }
            have -= copy;
            next += copy;
            if (len) {
              break inf_leave;
            }
          } else if (state.head) {
            state.head.comment = null;
          }
          state.mode = HCRC;
          /* falls through */
        case HCRC:
          if (state.flags & 0x0200) {
            //=== NEEDBITS(16); */
            while (bits < 16) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            if (hold !== (state.check & 0xffff)) {
              strm.msg = 'header crc mismatch';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
          }
          if (state.head) {
            state.head.hcrc = ((state.flags >> 9) & 1);
            state.head.done = true;
          }
          strm.adler = state.check = 0;
          state.mode = TYPE;
          break;
        case DICTID:
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          strm.adler = state.check = zswap32(hold);
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = DICT;
          /* falls through */
        case DICT:
          if (state.havedict === 0) {
            //--- RESTORE() ---
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            //---
            return Z_NEED_DICT$1;
          }
          strm.adler = state.check = 1 /*adler32(0L, Z_NULL, 0)*/ ;
          state.mode = TYPE;
          /* falls through */
        case TYPE:
          if (flush === Z_BLOCK$1 || flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case TYPEDO:
          if (state.last) {
            //--- BYTEBITS() ---//
            hold >>>= bits & 7;
            bits -= bits & 7;
            //---//
            state.mode = CHECK;
            break;
          }
          //=== NEEDBITS(3); */
          while (bits < 3) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.last = (hold & 0x01) /*BITS(1)*/ ;
          //--- DROPBITS(1) ---//
          hold >>>= 1;
          bits -= 1;
          //---//

          switch ((hold & 0x03) /*BITS(2)*/ ) {
          case 0:
            /* stored block */
            //Tracev((stderr, "inflate:     stored block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = STORED;
            break;
          case 1:
            /* fixed block */
            fixedtables(state);
            //Tracev((stderr, "inflate:     fixed codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = LEN_; /* decode codes */
            if (flush === Z_TREES$1) {
              //--- DROPBITS(2) ---//
              hold >>>= 2;
              bits -= 2;
              //---//
              break inf_leave;
            }
            break;
          case 2:
            /* dynamic block */
            //Tracev((stderr, "inflate:     dynamic codes block%s\n",
            //        state.last ? " (last)" : ""));
            state.mode = TABLE;
            break;
          case 3:
            strm.msg = 'invalid block type';
            state.mode = BAD;
          }
          //--- DROPBITS(2) ---//
          hold >>>= 2;
          bits -= 2;
          //---//
          break;
        case STORED:
          //--- BYTEBITS() ---// /* go to byte boundary */
          hold >>>= bits & 7;
          bits -= bits & 7;
          //---//
          //=== NEEDBITS(32); */
          while (bits < 32) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          if ((hold & 0xffff) !== ((hold >>> 16) ^ 0xffff)) {
            strm.msg = 'invalid stored block lengths';
            state.mode = BAD;
            break;
          }
          state.length = hold & 0xffff;
          //Tracev((stderr, "inflate:       stored length %u\n",
          //        state.length));
          //=== INITBITS();
          hold = 0;
          bits = 0;
          //===//
          state.mode = COPY_;
          if (flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case COPY_:
          state.mode = COPY;
          /* falls through */
        case COPY:
          copy = state.length;
          if (copy) {
            if (copy > have) {
              copy = have;
            }
            if (copy > left) {
              copy = left;
            }
            if (copy === 0) {
              break inf_leave;
            }
            //--- zmemcpy(put, next, copy); ---
            arraySet(output, input, next, copy, put);
            //---//
            have -= copy;
            next += copy;
            left -= copy;
            put += copy;
            state.length -= copy;
            break;
          }
          //Tracev((stderr, "inflate:       stored end\n"));
          state.mode = TYPE;
          break;
        case TABLE:
          //=== NEEDBITS(14); */
          while (bits < 14) {
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
          }
          //===//
          state.nlen = (hold & 0x1f) /*BITS(5)*/ + 257;
          //--- DROPBITS(5) ---//
          hold >>>= 5;
          bits -= 5;
          //---//
          state.ndist = (hold & 0x1f) /*BITS(5)*/ + 1;
          //--- DROPBITS(5) ---//
          hold >>>= 5;
          bits -= 5;
          //---//
          state.ncode = (hold & 0x0f) /*BITS(4)*/ + 4;
          //--- DROPBITS(4) ---//
          hold >>>= 4;
          bits -= 4;
          //---//
          //#ifndef PKZIP_BUG_WORKAROUND
          if (state.nlen > 286 || state.ndist > 30) {
            strm.msg = 'too many length or distance symbols';
            state.mode = BAD;
            break;
          }
          //#endif
          //Tracev((stderr, "inflate:       table sizes ok\n"));
          state.have = 0;
          state.mode = LENLENS;
          /* falls through */
        case LENLENS:
          while (state.have < state.ncode) {
            //=== NEEDBITS(3);
            while (bits < 3) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.lens[order[state.have++]] = (hold & 0x07); //BITS(3);
            //--- DROPBITS(3) ---//
            hold >>>= 3;
            bits -= 3;
            //---//
          }
          while (state.have < 19) {
            state.lens[order[state.have++]] = 0;
          }
          // We have separate tables & no pointers. 2 commented lines below not needed.
          //state.next = state.codes;
          //state.lencode = state.next;
          // Switch to use dynamic table
          state.lencode = state.lendyn;
          state.lenbits = 7;

          opts = {
            bits: state.lenbits
          };
          ret = inflate_table(CODES, state.lens, 0, 19, state.lencode, 0, state.work, opts);
          state.lenbits = opts.bits;

          if (ret) {
            strm.msg = 'invalid code lengths set';
            state.mode = BAD;
            break;
          }
          //Tracev((stderr, "inflate:       code lengths ok\n"));
          state.have = 0;
          state.mode = CODELENS;
          /* falls through */
        case CODELENS:
          while (state.have < state.nlen + state.ndist) {
            for (;;) {
              here = state.lencode[hold & ((1 << state.lenbits) - 1)]; /*BITS(state.lenbits)*/
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            if (here_val < 16) {
              //--- DROPBITS(here.bits) ---//
              hold >>>= here_bits;
              bits -= here_bits;
              //---//
              state.lens[state.have++] = here_val;
            } else {
              if (here_val === 16) {
                //=== NEEDBITS(here.bits + 2);
                n = here_bits + 2;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                if (state.have === 0) {
                  strm.msg = 'invalid bit length repeat';
                  state.mode = BAD;
                  break;
                }
                len = state.lens[state.have - 1];
                copy = 3 + (hold & 0x03); //BITS(2);
                //--- DROPBITS(2) ---//
                hold >>>= 2;
                bits -= 2;
                //---//
              } else if (here_val === 17) {
                //=== NEEDBITS(here.bits + 3);
                n = here_bits + 3;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                len = 0;
                copy = 3 + (hold & 0x07); //BITS(3);
                //--- DROPBITS(3) ---//
                hold >>>= 3;
                bits -= 3;
                //---//
              } else {
                //=== NEEDBITS(here.bits + 7);
                n = here_bits + 7;
                while (bits < n) {
                  if (have === 0) {
                    break inf_leave;
                  }
                  have--;
                  hold += input[next++] << bits;
                  bits += 8;
                }
                //===//
                //--- DROPBITS(here.bits) ---//
                hold >>>= here_bits;
                bits -= here_bits;
                //---//
                len = 0;
                copy = 11 + (hold & 0x7f); //BITS(7);
                //--- DROPBITS(7) ---//
                hold >>>= 7;
                bits -= 7;
                //---//
              }
              if (state.have + copy > state.nlen + state.ndist) {
                strm.msg = 'invalid bit length repeat';
                state.mode = BAD;
                break;
              }
              while (copy--) {
                state.lens[state.have++] = len;
              }
            }
          }

          /* handle error breaks in while */
          if (state.mode === BAD) {
            break;
          }

          /* check for end-of-block code (better have one) */
          if (state.lens[256] === 0) {
            strm.msg = 'invalid code -- missing end-of-block';
            state.mode = BAD;
            break;
          }

          /* build code tables -- note: do not change the lenbits or distbits
             values here (9 and 6) without reading the comments in inftrees.h
             concerning the ENOUGH constants, which depend on those values */
          state.lenbits = 9;

          opts = {
            bits: state.lenbits
          };
          ret = inflate_table(LENS, state.lens, 0, state.nlen, state.lencode, 0, state.work, opts);
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.lenbits = opts.bits;
          // state.lencode = state.next;

          if (ret) {
            strm.msg = 'invalid literal/lengths set';
            state.mode = BAD;
            break;
          }

          state.distbits = 6;
          //state.distcode.copy(state.codes);
          // Switch to use dynamic table
          state.distcode = state.distdyn;
          opts = {
            bits: state.distbits
          };
          ret = inflate_table(DISTS, state.lens, state.nlen, state.ndist, state.distcode, 0, state.work, opts);
          // We have separate tables & no pointers. 2 commented lines below not needed.
          // state.next_index = opts.table_index;
          state.distbits = opts.bits;
          // state.distcode = state.next;

          if (ret) {
            strm.msg = 'invalid distances set';
            state.mode = BAD;
            break;
          }
          //Tracev((stderr, 'inflate:       codes ok\n'));
          state.mode = LEN_;
          if (flush === Z_TREES$1) {
            break inf_leave;
          }
          /* falls through */
        case LEN_:
          state.mode = LEN;
          /* falls through */
        case LEN:
          if (have >= 6 && left >= 258) {
            //--- RESTORE() ---
            strm.next_out = put;
            strm.avail_out = left;
            strm.next_in = next;
            strm.avail_in = have;
            state.hold = hold;
            state.bits = bits;
            //---
            inflate_fast(strm, _out);
            //--- LOAD() ---
            put = strm.next_out;
            output = strm.output;
            left = strm.avail_out;
            next = strm.next_in;
            input = strm.input;
            have = strm.avail_in;
            hold = state.hold;
            bits = state.bits;
            //---

            if (state.mode === TYPE) {
              state.back = -1;
            }
            break;
          }
          state.back = 0;
          for (;;) {
            here = state.lencode[hold & ((1 << state.lenbits) - 1)]; /*BITS(state.lenbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if (here_bits <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if (here_op && (here_op & 0xf0) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;;) {
              here = state.lencode[last_val +
                ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)];
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((last_bits + here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits;
            bits -= last_bits;
            //---//
            state.back += last_bits;
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.back += here_bits;
          state.length = here_val;
          if (here_op === 0) {
            //Tracevv((stderr, here.val >= 0x20 && here.val < 0x7f ?
            //        "inflate:         literal '%c'\n" :
            //        "inflate:         literal 0x%02x\n", here.val));
            state.mode = LIT;
            break;
          }
          if (here_op & 32) {
            //Tracevv((stderr, "inflate:         end of block\n"));
            state.back = -1;
            state.mode = TYPE;
            break;
          }
          if (here_op & 64) {
            strm.msg = 'invalid literal/length code';
            state.mode = BAD;
            break;
          }
          state.extra = here_op & 15;
          state.mode = LENEXT;
          /* falls through */
        case LENEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.length += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/ ;
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra;
            bits -= state.extra;
            //---//
            state.back += state.extra;
          }
          //Tracevv((stderr, "inflate:         length %u\n", state.length));
          state.was = state.length;
          state.mode = DIST;
          /* falls through */
        case DIST:
          for (;;) {
            here = state.distcode[hold & ((1 << state.distbits) - 1)]; /*BITS(state.distbits)*/
            here_bits = here >>> 24;
            here_op = (here >>> 16) & 0xff;
            here_val = here & 0xffff;

            if ((here_bits) <= bits) {
              break;
            }
            //--- PULLBYTE() ---//
            if (have === 0) {
              break inf_leave;
            }
            have--;
            hold += input[next++] << bits;
            bits += 8;
            //---//
          }
          if ((here_op & 0xf0) === 0) {
            last_bits = here_bits;
            last_op = here_op;
            last_val = here_val;
            for (;;) {
              here = state.distcode[last_val +
                ((hold & ((1 << (last_bits + last_op)) - 1)) /*BITS(last.bits + last.op)*/ >> last_bits)];
              here_bits = here >>> 24;
              here_op = (here >>> 16) & 0xff;
              here_val = here & 0xffff;

              if ((last_bits + here_bits) <= bits) {
                break;
              }
              //--- PULLBYTE() ---//
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
              //---//
            }
            //--- DROPBITS(last.bits) ---//
            hold >>>= last_bits;
            bits -= last_bits;
            //---//
            state.back += last_bits;
          }
          //--- DROPBITS(here.bits) ---//
          hold >>>= here_bits;
          bits -= here_bits;
          //---//
          state.back += here_bits;
          if (here_op & 64) {
            strm.msg = 'invalid distance code';
            state.mode = BAD;
            break;
          }
          state.offset = here_val;
          state.extra = (here_op) & 15;
          state.mode = DISTEXT;
          /* falls through */
        case DISTEXT:
          if (state.extra) {
            //=== NEEDBITS(state.extra);
            n = state.extra;
            while (bits < n) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            state.offset += hold & ((1 << state.extra) - 1) /*BITS(state.extra)*/ ;
            //--- DROPBITS(state.extra) ---//
            hold >>>= state.extra;
            bits -= state.extra;
            //---//
            state.back += state.extra;
          }
          //#ifdef INFLATE_STRICT
          if (state.offset > state.dmax) {
            strm.msg = 'invalid distance too far back';
            state.mode = BAD;
            break;
          }
          //#endif
          //Tracevv((stderr, "inflate:         distance %u\n", state.offset));
          state.mode = MATCH;
          /* falls through */
        case MATCH:
          if (left === 0) {
            break inf_leave;
          }
          copy = _out - left;
          if (state.offset > copy) { /* copy from window */
            copy = state.offset - copy;
            if (copy > state.whave) {
              if (state.sane) {
                strm.msg = 'invalid distance too far back';
                state.mode = BAD;
                break;
              }
              // (!) This block is disabled in zlib defailts,
              // don't enable it for binary compatibility
              //#ifdef INFLATE_ALLOW_INVALID_DISTANCE_TOOFAR_ARRR
              //          Trace((stderr, "inflate.c too far\n"));
              //          copy -= state.whave;
              //          if (copy > state.length) { copy = state.length; }
              //          if (copy > left) { copy = left; }
              //          left -= copy;
              //          state.length -= copy;
              //          do {
              //            output[put++] = 0;
              //          } while (--copy);
              //          if (state.length === 0) { state.mode = LEN; }
              //          break;
              //#endif
            }
            if (copy > state.wnext) {
              copy -= state.wnext;
              from = state.wsize - copy;
            } else {
              from = state.wnext - copy;
            }
            if (copy > state.length) {
              copy = state.length;
            }
            from_source = state.window;
          } else { /* copy from output */
            from_source = output;
            from = put - state.offset;
            copy = state.length;
          }
          if (copy > left) {
            copy = left;
          }
          left -= copy;
          state.length -= copy;
          do {
            output[put++] = from_source[from++];
          } while (--copy);
          if (state.length === 0) {
            state.mode = LEN;
          }
          break;
        case LIT:
          if (left === 0) {
            break inf_leave;
          }
          output[put++] = state.length;
          left--;
          state.mode = LEN;
          break;
        case CHECK:
          if (state.wrap) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              // Use '|' insdead of '+' to make sure that result is signed
              hold |= input[next++] << bits;
              bits += 8;
            }
            //===//
            _out -= left;
            strm.total_out += _out;
            state.total += _out;
            if (_out) {
              strm.adler = state.check =
                /*UPDATE(state.check, put - _out, _out);*/
                (state.flags ? crc32(state.check, output, _out, put - _out) : adler32(state.check, output, _out, put - _out));

            }
            _out = left;
            // NB: crc32 stored as signed 32-bit int, zswap32 returns signed too
            if ((state.flags ? hold : zswap32(hold)) !== state.check) {
              strm.msg = 'incorrect data check';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            //Tracev((stderr, "inflate:   check matches trailer\n"));
          }
          state.mode = LENGTH;
          /* falls through */
        case LENGTH:
          if (state.wrap && state.flags) {
            //=== NEEDBITS(32);
            while (bits < 32) {
              if (have === 0) {
                break inf_leave;
              }
              have--;
              hold += input[next++] << bits;
              bits += 8;
            }
            //===//
            if (hold !== (state.total & 0xffffffff)) {
              strm.msg = 'incorrect length check';
              state.mode = BAD;
              break;
            }
            //=== INITBITS();
            hold = 0;
            bits = 0;
            //===//
            //Tracev((stderr, "inflate:   length matches trailer\n"));
          }
          state.mode = DONE;
          /* falls through */
        case DONE:
          ret = Z_STREAM_END$1;
          break inf_leave;
        case BAD:
          ret = Z_DATA_ERROR$1;
          break inf_leave;
        case MEM:
          return Z_MEM_ERROR;
        case SYNC:
          /* falls through */
        default:
          return Z_STREAM_ERROR$1;
        }
      }

    // inf_leave <- here is real place for "goto inf_leave", emulated via "break inf_leave"

    /*
       Return from inflate(), updating the total counts and the check value.
       If there was no progress during the inflate() call, return a buffer
       error.  Call updatewindow() to create and/or update the window state.
       Note: a memory error from inflate() is non-recoverable.
     */

    //--- RESTORE() ---
    strm.next_out = put;
    strm.avail_out = left;
    strm.next_in = next;
    strm.avail_in = have;
    state.hold = hold;
    state.bits = bits;
    //---

    if (state.wsize || (_out !== strm.avail_out && state.mode < BAD &&
        (state.mode < CHECK || flush !== Z_FINISH$1))) {
      if (updatewindow(strm, strm.output, strm.next_out, _out - strm.avail_out)) ;
    }
    _in -= strm.avail_in;
    _out -= strm.avail_out;
    strm.total_in += _in;
    strm.total_out += _out;
    state.total += _out;
    if (state.wrap && _out) {
      strm.adler = state.check = /*UPDATE(state.check, strm.next_out - _out, _out);*/
        (state.flags ? crc32(state.check, output, _out, strm.next_out - _out) : adler32(state.check, output, _out, strm.next_out - _out));
    }
    strm.data_type = state.bits + (state.last ? 64 : 0) +
      (state.mode === TYPE ? 128 : 0) +
      (state.mode === LEN_ || state.mode === COPY_ ? 256 : 0);
    if (((_in === 0 && _out === 0) || flush === Z_FINISH$1) && ret === Z_OK$1) {
      ret = Z_BUF_ERROR$1;
    }
    return ret;
  }

  function inflateEnd(strm) {

    if (!strm || !strm.state /*|| strm->zfree == (free_func)0*/ ) {
      return Z_STREAM_ERROR$1;
    }

    var state = strm.state;
    if (state.window) {
      state.window = null;
    }
    strm.state = null;
    return Z_OK$1;
  }

  /* Not implemented
  exports.inflateCopy = inflateCopy;
  exports.inflateGetDictionary = inflateGetDictionary;
  exports.inflateMark = inflateMark;
  exports.inflatePrime = inflatePrime;
  exports.inflateSync = inflateSync;
  exports.inflateSyncPoint = inflateSyncPoint;
  exports.inflateUndermine = inflateUndermine;
  */

  // import constants from './constants';


  // zlib modes
  var NONE = 0;
  var DEFLATE = 1;
  var INFLATE = 2;
  var GZIP = 3;
  var GUNZIP = 4;
  var DEFLATERAW = 5;
  var INFLATERAW = 6;
  var UNZIP = 7;
  var Z_NO_FLUSH=         0,
    Z_PARTIAL_FLUSH=    1,
    Z_SYNC_FLUSH=    2,
    Z_FULL_FLUSH=       3,
    Z_FINISH=       4,
    Z_BLOCK=           5,
    Z_TREES=            6,

    /* Return codes for the compression/decompression functions. Negative values
    * are errors, positive values are used for special but normal events.
    */
    Z_OK=               0,
    Z_STREAM_END=       1,
    Z_NEED_DICT=      2,
    Z_ERRNO=       -1,
    Z_STREAM_ERROR=   -2,
    Z_DATA_ERROR=    -3,
    //Z_MEM_ERROR:     -4,
    Z_BUF_ERROR=    -5,
    //Z_VERSION_ERROR: -6,

    /* compression levels */
    Z_NO_COMPRESSION=         0,
    Z_BEST_SPEED=             1,
    Z_BEST_COMPRESSION=       9,
    Z_DEFAULT_COMPRESSION=   -1,


    Z_FILTERED=               1,
    Z_HUFFMAN_ONLY=           2,
    Z_RLE=                    3,
    Z_FIXED=                  4,
    Z_DEFAULT_STRATEGY=       0,

    /* Possible values of the data_type field (though see inflate()) */
    Z_BINARY=                 0,
    Z_TEXT=                   1,
    //Z_ASCII:                1, // = Z_TEXT (deprecated)
    Z_UNKNOWN=                2,

    /* The deflate compression method */
    Z_DEFLATED=               8;
  function Zlib$1(mode) {
    if (mode < DEFLATE || mode > UNZIP)
      throw new TypeError('Bad argument');

    this.mode = mode;
    this.init_done = false;
    this.write_in_progress = false;
    this.pending_close = false;
    this.windowBits = 0;
    this.level = 0;
    this.memLevel = 0;
    this.strategy = 0;
    this.dictionary = null;
  }

  Zlib$1.prototype.init = function(windowBits, level, memLevel, strategy, dictionary) {
    this.windowBits = windowBits;
    this.level = level;
    this.memLevel = memLevel;
    this.strategy = strategy;
    // dictionary not supported.

    if (this.mode === GZIP || this.mode === GUNZIP)
      this.windowBits += 16;

    if (this.mode === UNZIP)
      this.windowBits += 32;

    if (this.mode === DEFLATERAW || this.mode === INFLATERAW)
      this.windowBits = -this.windowBits;

    this.strm = new ZStream();
    var status;
    switch (this.mode) {
    case DEFLATE:
    case GZIP:
    case DEFLATERAW:
      status = deflateInit2(
        this.strm,
        this.level,
        Z_DEFLATED,
        this.windowBits,
        this.memLevel,
        this.strategy
      );
      break;
    case INFLATE:
    case GUNZIP:
    case INFLATERAW:
    case UNZIP:
      status  = inflateInit2(
        this.strm,
        this.windowBits
      );
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
    }

    if (status !== Z_OK) {
      this._error(status);
      return;
    }

    this.write_in_progress = false;
    this.init_done = true;
  };

  Zlib$1.prototype.params = function() {
    throw new Error('deflateParams Not supported');
  };

  Zlib$1.prototype._writeCheck = function() {
    if (!this.init_done)
      throw new Error('write before init');

    if (this.mode === NONE)
      throw new Error('already finalized');

    if (this.write_in_progress)
      throw new Error('write already in progress');

    if (this.pending_close)
      throw new Error('close is pending');
  };

  Zlib$1.prototype.write = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this._writeCheck();
    this.write_in_progress = true;

    var self = this;
    nextTick(function() {
      self.write_in_progress = false;
      var res = self._write(flush, input, in_off, in_len, out, out_off, out_len);
      self.callback(res[0], res[1]);

      if (self.pending_close)
        self.close();
    });

    return this;
  };

  // set method for Node buffers, used by pako
  function bufferSet(data, offset) {
    for (var i = 0; i < data.length; i++) {
      this[offset + i] = data[i];
    }
  }

  Zlib$1.prototype.writeSync = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this._writeCheck();
    return this._write(flush, input, in_off, in_len, out, out_off, out_len);
  };

  Zlib$1.prototype._write = function(flush, input, in_off, in_len, out, out_off, out_len) {
    this.write_in_progress = true;

    if (flush !== Z_NO_FLUSH &&
        flush !== Z_PARTIAL_FLUSH &&
        flush !== Z_SYNC_FLUSH &&
        flush !== Z_FULL_FLUSH &&
        flush !== Z_FINISH &&
        flush !== Z_BLOCK) {
      throw new Error('Invalid flush value');
    }

    if (input == null) {
      input = new Buffer$1(0);
      in_len = 0;
      in_off = 0;
    }

    if (out._set)
      out.set = out._set;
    else
      out.set = bufferSet;

    var strm = this.strm;
    strm.avail_in = in_len;
    strm.input = input;
    strm.next_in = in_off;
    strm.avail_out = out_len;
    strm.output = out;
    strm.next_out = out_off;
    var status;
    switch (this.mode) {
    case DEFLATE:
    case GZIP:
    case DEFLATERAW:
      status = deflate$1(strm, flush);
      break;
    case UNZIP:
    case INFLATE:
    case GUNZIP:
    case INFLATERAW:
      status = inflate$1(strm, flush);
      break;
    default:
      throw new Error('Unknown mode ' + this.mode);
    }

    if (status !== Z_STREAM_END && status !== Z_OK) {
      this._error(status);
    }

    this.write_in_progress = false;
    return [strm.avail_in, strm.avail_out];
  };

  Zlib$1.prototype.close = function() {
    if (this.write_in_progress) {
      this.pending_close = true;
      return;
    }

    this.pending_close = false;

    if (this.mode === DEFLATE || this.mode === GZIP || this.mode === DEFLATERAW) {
      deflateEnd(this.strm);
    } else {
      inflateEnd(this.strm);
    }

    this.mode = NONE;
  };
  var status;
  Zlib$1.prototype.reset = function() {
    switch (this.mode) {
    case DEFLATE:
    case DEFLATERAW:
      status = deflateReset(this.strm);
      break;
    case INFLATE:
    case INFLATERAW:
      status = inflateReset(this.strm);
      break;
    }

    if (status !== Z_OK) {
      this._error(status);
    }
  };

  Zlib$1.prototype._error = function(status) {
    this.onerror(msg[status] + ': ' + this.strm.msg, status);

    this.write_in_progress = false;
    if (this.pending_close)
      this.close();
  };

  var _binding = /*#__PURE__*/Object.freeze({
    __proto__: null,
    NONE: NONE,
    DEFLATE: DEFLATE,
    INFLATE: INFLATE,
    GZIP: GZIP,
    GUNZIP: GUNZIP,
    DEFLATERAW: DEFLATERAW,
    INFLATERAW: INFLATERAW,
    UNZIP: UNZIP,
    Z_NO_FLUSH: Z_NO_FLUSH,
    Z_PARTIAL_FLUSH: Z_PARTIAL_FLUSH,
    Z_SYNC_FLUSH: Z_SYNC_FLUSH,
    Z_FULL_FLUSH: Z_FULL_FLUSH,
    Z_FINISH: Z_FINISH,
    Z_BLOCK: Z_BLOCK,
    Z_TREES: Z_TREES,
    Z_OK: Z_OK,
    Z_STREAM_END: Z_STREAM_END,
    Z_NEED_DICT: Z_NEED_DICT,
    Z_ERRNO: Z_ERRNO,
    Z_STREAM_ERROR: Z_STREAM_ERROR,
    Z_DATA_ERROR: Z_DATA_ERROR,
    Z_BUF_ERROR: Z_BUF_ERROR,
    Z_NO_COMPRESSION: Z_NO_COMPRESSION,
    Z_BEST_SPEED: Z_BEST_SPEED,
    Z_BEST_COMPRESSION: Z_BEST_COMPRESSION,
    Z_DEFAULT_COMPRESSION: Z_DEFAULT_COMPRESSION,
    Z_FILTERED: Z_FILTERED,
    Z_HUFFMAN_ONLY: Z_HUFFMAN_ONLY,
    Z_RLE: Z_RLE,
    Z_FIXED: Z_FIXED,
    Z_DEFAULT_STRATEGY: Z_DEFAULT_STRATEGY,
    Z_BINARY: Z_BINARY,
    Z_TEXT: Z_TEXT,
    Z_UNKNOWN: Z_UNKNOWN,
    Z_DEFLATED: Z_DEFLATED,
    Zlib: Zlib$1
  });

  function assert (a, msg) {
    if (!a) {
      throw new Error(msg);
    }
  }
  var binding = {};
  Object.keys(_binding).forEach(function (key) {
    binding[key] = _binding[key];
  });
  // zlib doesn't provide these, so kludge them in following the same
  // const naming scheme zlib uses.
  binding.Z_MIN_WINDOWBITS = 8;
  binding.Z_MAX_WINDOWBITS = 15;
  binding.Z_DEFAULT_WINDOWBITS = 15;

  // fewer than 64 bytes per chunk is stupid.
  // technically it could work with as few as 8, but even 64 bytes
  // is absurdly low.  Usually a MB or more is best.
  binding.Z_MIN_CHUNK = 64;
  binding.Z_MAX_CHUNK = Infinity;
  binding.Z_DEFAULT_CHUNK = (16 * 1024);

  binding.Z_MIN_MEMLEVEL = 1;
  binding.Z_MAX_MEMLEVEL = 9;
  binding.Z_DEFAULT_MEMLEVEL = 8;

  binding.Z_MIN_LEVEL = -1;
  binding.Z_MAX_LEVEL = 9;
  binding.Z_DEFAULT_LEVEL = binding.Z_DEFAULT_COMPRESSION;


  // translation table for return codes.
  var codes = {
    Z_OK: binding.Z_OK,
    Z_STREAM_END: binding.Z_STREAM_END,
    Z_NEED_DICT: binding.Z_NEED_DICT,
    Z_ERRNO: binding.Z_ERRNO,
    Z_STREAM_ERROR: binding.Z_STREAM_ERROR,
    Z_DATA_ERROR: binding.Z_DATA_ERROR,
    Z_MEM_ERROR: binding.Z_MEM_ERROR,
    Z_BUF_ERROR: binding.Z_BUF_ERROR,
    Z_VERSION_ERROR: binding.Z_VERSION_ERROR
  };

  Object.keys(codes).forEach(function(k) {
    codes[codes[k]] = k;
  });

  function createDeflate(o) {
    return new Deflate(o);
  }

  function createInflate(o) {
    return new Inflate(o);
  }

  function createDeflateRaw(o) {
    return new DeflateRaw(o);
  }

  function createInflateRaw(o) {
    return new InflateRaw(o);
  }

  function createGzip(o) {
    return new Gzip(o);
  }

  function createGunzip(o) {
    return new Gunzip(o);
  }

  function createUnzip(o) {
    return new Unzip(o);
  }


  // Convenience methods.
  // compress/decompress a string or buffer in one step.
  function deflate(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Deflate(opts), buffer, callback);
  }

  function deflateSync(buffer, opts) {
    return zlibBufferSync(new Deflate(opts), buffer);
  }

  function gzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gzip(opts), buffer, callback);
  }

  function gzipSync(buffer, opts) {
    return zlibBufferSync(new Gzip(opts), buffer);
  }

  function deflateRaw(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new DeflateRaw(opts), buffer, callback);
  }

  function deflateRawSync(buffer, opts) {
    return zlibBufferSync(new DeflateRaw(opts), buffer);
  }

  function unzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Unzip(opts), buffer, callback);
  }

  function unzipSync(buffer, opts) {
    return zlibBufferSync(new Unzip(opts), buffer);
  }

  function inflate(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Inflate(opts), buffer, callback);
  }

  function inflateSync(buffer, opts) {
    return zlibBufferSync(new Inflate(opts), buffer);
  }

  function gunzip(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gunzip(opts), buffer, callback);
  }

  function gunzipSync(buffer, opts) {
    return zlibBufferSync(new Gunzip(opts), buffer);
  }

  function inflateRaw(buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new InflateRaw(opts), buffer, callback);
  }

  function inflateRawSync(buffer, opts) {
    return zlibBufferSync(new InflateRaw(opts), buffer);
  }

  function zlibBuffer(engine, buffer, callback) {
    var buffers = [];
    var nread = 0;

    engine.on('error', onError);
    engine.on('end', onEnd);

    engine.end(buffer);
    flow();

    function flow() {
      var chunk;
      while (null !== (chunk = engine.read())) {
        buffers.push(chunk);
        nread += chunk.length;
      }
      engine.once('readable', flow);
    }

    function onError(err) {
      engine.removeListener('end', onEnd);
      engine.removeListener('readable', flow);
      callback(err);
    }

    function onEnd() {
      var buf = Buffer$1.concat(buffers, nread);
      buffers = [];
      callback(null, buf);
      engine.close();
    }
  }

  function zlibBufferSync(engine, buffer) {
    if (typeof buffer === 'string')
      buffer = new Buffer$1(buffer);
    if (!isBuffer(buffer))
      throw new TypeError('Not a string or buffer');

    var flushFlag = binding.Z_FINISH;

    return engine._processChunk(buffer, flushFlag);
  }

  // generic zlib
  // minimal 2-byte header
  function Deflate(opts) {
    if (!(this instanceof Deflate)) return new Deflate(opts);
    Zlib.call(this, opts, binding.DEFLATE);
  }

  function Inflate(opts) {
    if (!(this instanceof Inflate)) return new Inflate(opts);
    Zlib.call(this, opts, binding.INFLATE);
  }



  // gzip - bigger header, same deflate compression
  function Gzip(opts) {
    if (!(this instanceof Gzip)) return new Gzip(opts);
    Zlib.call(this, opts, binding.GZIP);
  }

  function Gunzip(opts) {
    if (!(this instanceof Gunzip)) return new Gunzip(opts);
    Zlib.call(this, opts, binding.GUNZIP);
  }



  // raw - no header
  function DeflateRaw(opts) {
    if (!(this instanceof DeflateRaw)) return new DeflateRaw(opts);
    Zlib.call(this, opts, binding.DEFLATERAW);
  }

  function InflateRaw(opts) {
    if (!(this instanceof InflateRaw)) return new InflateRaw(opts);
    Zlib.call(this, opts, binding.INFLATERAW);
  }


  // auto-detect header.
  function Unzip(opts) {
    if (!(this instanceof Unzip)) return new Unzip(opts);
    Zlib.call(this, opts, binding.UNZIP);
  }


  // the Zlib class they all inherit from
  // This thing manages the queue of requests, and returns
  // true or false if there is anything in the queue when
  // you call the .write() method.

  function Zlib(opts, mode) {
    this._opts = opts = opts || {};
    this._chunkSize = opts.chunkSize || binding.Z_DEFAULT_CHUNK;

    Transform.call(this, opts);

    if (opts.flush) {
      if (opts.flush !== binding.Z_NO_FLUSH &&
          opts.flush !== binding.Z_PARTIAL_FLUSH &&
          opts.flush !== binding.Z_SYNC_FLUSH &&
          opts.flush !== binding.Z_FULL_FLUSH &&
          opts.flush !== binding.Z_FINISH &&
          opts.flush !== binding.Z_BLOCK) {
        throw new Error('Invalid flush flag: ' + opts.flush);
      }
    }
    this._flushFlag = opts.flush || binding.Z_NO_FLUSH;

    if (opts.chunkSize) {
      if (opts.chunkSize < binding.Z_MIN_CHUNK ||
          opts.chunkSize > binding.Z_MAX_CHUNK) {
        throw new Error('Invalid chunk size: ' + opts.chunkSize);
      }
    }

    if (opts.windowBits) {
      if (opts.windowBits < binding.Z_MIN_WINDOWBITS ||
          opts.windowBits > binding.Z_MAX_WINDOWBITS) {
        throw new Error('Invalid windowBits: ' + opts.windowBits);
      }
    }

    if (opts.level) {
      if (opts.level < binding.Z_MIN_LEVEL ||
          opts.level > binding.Z_MAX_LEVEL) {
        throw new Error('Invalid compression level: ' + opts.level);
      }
    }

    if (opts.memLevel) {
      if (opts.memLevel < binding.Z_MIN_MEMLEVEL ||
          opts.memLevel > binding.Z_MAX_MEMLEVEL) {
        throw new Error('Invalid memLevel: ' + opts.memLevel);
      }
    }

    if (opts.strategy) {
      if (opts.strategy != binding.Z_FILTERED &&
          opts.strategy != binding.Z_HUFFMAN_ONLY &&
          opts.strategy != binding.Z_RLE &&
          opts.strategy != binding.Z_FIXED &&
          opts.strategy != binding.Z_DEFAULT_STRATEGY) {
        throw new Error('Invalid strategy: ' + opts.strategy);
      }
    }

    if (opts.dictionary) {
      if (!isBuffer(opts.dictionary)) {
        throw new Error('Invalid dictionary: it should be a Buffer instance');
      }
    }

    this._binding = new binding.Zlib(mode);

    var self = this;
    this._hadError = false;
    this._binding.onerror = function(message, errno) {
      // there is no way to cleanly recover.
      // continuing only obscures problems.
      self._binding = null;
      self._hadError = true;

      var error = new Error(message);
      error.errno = errno;
      error.code = binding.codes[errno];
      self.emit('error', error);
    };

    var level = binding.Z_DEFAULT_COMPRESSION;
    if (typeof opts.level === 'number') level = opts.level;

    var strategy = binding.Z_DEFAULT_STRATEGY;
    if (typeof opts.strategy === 'number') strategy = opts.strategy;

    this._binding.init(opts.windowBits || binding.Z_DEFAULT_WINDOWBITS,
                       level,
                       opts.memLevel || binding.Z_DEFAULT_MEMLEVEL,
                       strategy,
                       opts.dictionary);

    this._buffer = new Buffer$1(this._chunkSize);
    this._offset = 0;
    this._closed = false;
    this._level = level;
    this._strategy = strategy;

    this.once('end', this.close);
  }

  inherits$1(Zlib, Transform);

  Zlib.prototype.params = function(level, strategy, callback) {
    if (level < binding.Z_MIN_LEVEL ||
        level > binding.Z_MAX_LEVEL) {
      throw new RangeError('Invalid compression level: ' + level);
    }
    if (strategy != binding.Z_FILTERED &&
        strategy != binding.Z_HUFFMAN_ONLY &&
        strategy != binding.Z_RLE &&
        strategy != binding.Z_FIXED &&
        strategy != binding.Z_DEFAULT_STRATEGY) {
      throw new TypeError('Invalid strategy: ' + strategy);
    }

    if (this._level !== level || this._strategy !== strategy) {
      var self = this;
      this.flush(binding.Z_SYNC_FLUSH, function() {
        self._binding.params(level, strategy);
        if (!self._hadError) {
          self._level = level;
          self._strategy = strategy;
          if (callback) callback();
        }
      });
    } else {
      nextTick(callback);
    }
  };

  Zlib.prototype.reset = function() {
    return this._binding.reset();
  };

  // This is the _flush function called by the transform class,
  // internally, when the last chunk has been written.
  Zlib.prototype._flush = function(callback) {
    this._transform(new Buffer$1(0), '', callback);
  };

  Zlib.prototype.flush = function(kind, callback) {
    var ws = this._writableState;

    if (typeof kind === 'function' || (kind === void 0 && !callback)) {
      callback = kind;
      kind = binding.Z_FULL_FLUSH;
    }

    if (ws.ended) {
      if (callback)
        nextTick(callback);
    } else if (ws.ending) {
      if (callback)
        this.once('end', callback);
    } else if (ws.needDrain) {
      var self = this;
      this.once('drain', function() {
        self.flush(callback);
      });
    } else {
      this._flushFlag = kind;
      this.write(new Buffer$1(0), '', callback);
    }
  };

  Zlib.prototype.close = function(callback) {
    if (callback)
      nextTick(callback);

    if (this._closed)
      return;

    this._closed = true;

    this._binding.close();

    var self = this;
    nextTick(function() {
      self.emit('close');
    });
  };

  Zlib.prototype._transform = function(chunk, encoding, cb) {
    var flushFlag;
    var ws = this._writableState;
    var ending = ws.ending || ws.ended;
    var last = ending && (!chunk || ws.length === chunk.length);

    if (!chunk === null && !isBuffer(chunk))
      return cb(new Error('invalid input'));

    // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag.
    // If it's explicitly flushing at some other time, then we use
    // Z_FULL_FLUSH. Otherwise, use Z_NO_FLUSH for maximum compression
    // goodness.
    if (last)
      flushFlag = binding.Z_FINISH;
    else {
      flushFlag = this._flushFlag;
      // once we've flushed the last of the queue, stop flushing and
      // go back to the normal behavior.
      if (chunk.length >= ws.length) {
        this._flushFlag = this._opts.flush || binding.Z_NO_FLUSH;
      }
    }

    this._processChunk(chunk, flushFlag, cb);
  };

  Zlib.prototype._processChunk = function(chunk, flushFlag, cb) {
    var availInBefore = chunk && chunk.length;
    var availOutBefore = this._chunkSize - this._offset;
    var inOff = 0;

    var self = this;

    var async = typeof cb === 'function';

    if (!async) {
      var buffers = [];
      var nread = 0;

      var error;
      this.on('error', function(er) {
        error = er;
      });

      do {
        var res = this._binding.writeSync(flushFlag,
                                          chunk, // in
                                          inOff, // in_off
                                          availInBefore, // in_len
                                          this._buffer, // out
                                          this._offset, //out_off
                                          availOutBefore); // out_len
      } while (!this._hadError && callback(res[0], res[1]));

      if (this._hadError) {
        throw error;
      }

      var buf = Buffer$1.concat(buffers, nread);
      this.close();

      return buf;
    }

    var req = this._binding.write(flushFlag,
                                  chunk, // in
                                  inOff, // in_off
                                  availInBefore, // in_len
                                  this._buffer, // out
                                  this._offset, //out_off
                                  availOutBefore); // out_len

    req.buffer = chunk;
    req.callback = callback;

    function callback(availInAfter, availOutAfter) {
      if (self._hadError)
        return;

      var have = availOutBefore - availOutAfter;
      assert(have >= 0, 'have should not go down');

      if (have > 0) {
        var out = self._buffer.slice(self._offset, self._offset + have);
        self._offset += have;
        // serve some output to the consumer.
        if (async) {
          self.push(out);
        } else {
          buffers.push(out);
          nread += out.length;
        }
      }

      // exhausted the output buffer, or used all the input create a new one.
      if (availOutAfter === 0 || self._offset >= self._chunkSize) {
        availOutBefore = self._chunkSize;
        self._offset = 0;
        self._buffer = new Buffer$1(self._chunkSize);
      }

      if (availOutAfter === 0) {
        // Not actually done.  Need to reprocess.
        // Also, update the availInBefore to the availInAfter value,
        // so that if we have to hit it a third (fourth, etc.) time,
        // it'll have the correct byte counts.
        inOff += (availInBefore - availInAfter);
        availInBefore = availInAfter;

        if (!async)
          return true;

        var newReq = self._binding.write(flushFlag,
                                         chunk,
                                         inOff,
                                         availInBefore,
                                         self._buffer,
                                         self._offset,
                                         self._chunkSize);
        newReq.callback = callback; // this same function
        newReq.buffer = chunk;
        return;
      }

      if (!async)
        return false;

      // finished with the chunk.
      cb();
    }
  };

  inherits$1(Deflate, Zlib);
  inherits$1(Inflate, Zlib);
  inherits$1(Gzip, Zlib);
  inherits$1(Gunzip, Zlib);
  inherits$1(DeflateRaw, Zlib);
  inherits$1(InflateRaw, Zlib);
  inherits$1(Unzip, Zlib);
  var zlib$1 = {
    codes: codes,
    createDeflate: createDeflate,
    createInflate: createInflate,
    createDeflateRaw: createDeflateRaw,
    createInflateRaw: createInflateRaw,
    createGzip: createGzip,
    createGunzip: createGunzip,
    createUnzip: createUnzip,
    deflate: deflate,
    deflateSync: deflateSync,
    gzip: gzip,
    gzipSync: gzipSync,
    deflateRaw: deflateRaw,
    deflateRawSync: deflateRawSync,
    unzip: unzip,
    unzipSync: unzipSync,
    inflate: inflate,
    inflateSync: inflateSync,
    gunzip: gunzip,
    gunzipSync: gunzipSync,
    inflateRaw: inflateRaw,
    inflateRawSync: inflateRawSync,
    Deflate: Deflate,
    Inflate: Inflate,
    Gzip: Gzip,
    Gunzip: Gunzip,
    DeflateRaw: DeflateRaw,
    InflateRaw: InflateRaw,
    Unzip: Unzip,
    Zlib: Zlib
  };

  var zlib$2 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    codes: codes,
    createDeflate: createDeflate,
    createInflate: createInflate,
    createDeflateRaw: createDeflateRaw,
    createInflateRaw: createInflateRaw,
    createGzip: createGzip,
    createGunzip: createGunzip,
    createUnzip: createUnzip,
    deflate: deflate,
    deflateSync: deflateSync,
    gzip: gzip,
    gzipSync: gzipSync,
    deflateRaw: deflateRaw,
    deflateRawSync: deflateRawSync,
    unzip: unzip,
    unzipSync: unzipSync,
    inflate: inflate,
    inflateSync: inflateSync,
    gunzip: gunzip,
    gunzipSync: gunzipSync,
    inflateRaw: inflateRaw,
    inflateRawSync: inflateRawSync,
    Deflate: Deflate,
    Inflate: Inflate,
    Gzip: Gzip,
    Gunzip: Gunzip,
    DeflateRaw: DeflateRaw,
    InflateRaw: InflateRaw,
    Unzip: Unzip,
    Zlib: Zlib,
    'default': zlib$1
  });

  var require$$0$1 = /*@__PURE__*/getAugmentedNamespace(zlib$2);

  var bufferUtil$1 = {exports: {}};

  var constants = {
    BINARY_TYPES: ['nodebuffer', 'arraybuffer', 'fragments'],
    EMPTY_BUFFER: Buffer$1.alloc(0),
    GUID: '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
    kForOnEventAttribute: Symbol('kIsForOnEventAttribute'),
    kListener: Symbol('kListener'),
    kStatusCode: Symbol('status-code'),
    kWebSocket: Symbol('websocket'),
    NOOP: () => {}
  };

  const { EMPTY_BUFFER: EMPTY_BUFFER$3 } = constants;

  /**
   * Merges an array of buffers into a new buffer.
   *
   * @param {Buffer[]} list The array of buffers to concat
   * @param {Number} totalLength The total length of buffers in the list
   * @return {Buffer} The resulting buffer
   * @public
   */
  function concat$1(list, totalLength) {
    if (list.length === 0) return EMPTY_BUFFER$3;
    if (list.length === 1) return list[0];

    const target = Buffer$1.allocUnsafe(totalLength);
    let offset = 0;

    for (let i = 0; i < list.length; i++) {
      const buf = list[i];
      target.set(buf, offset);
      offset += buf.length;
    }

    if (offset < totalLength) return target.slice(0, offset);

    return target;
  }

  /**
   * Masks a buffer using the given mask.
   *
   * @param {Buffer} source The buffer to mask
   * @param {Buffer} mask The mask to use
   * @param {Buffer} output The buffer where to store the result
   * @param {Number} offset The offset at which to start writing
   * @param {Number} length The number of bytes to mask.
   * @public
   */
  function _mask(source, mask, output, offset, length) {
    for (let i = 0; i < length; i++) {
      output[offset + i] = source[i] ^ mask[i & 3];
    }
  }

  /**
   * Unmasks a buffer using the given mask.
   *
   * @param {Buffer} buffer The buffer to unmask
   * @param {Buffer} mask The mask to use
   * @public
   */
  function _unmask(buffer, mask) {
    for (let i = 0; i < buffer.length; i++) {
      buffer[i] ^= mask[i & 3];
    }
  }

  /**
   * Converts a buffer to an `ArrayBuffer`.
   *
   * @param {Buffer} buf The buffer to convert
   * @return {ArrayBuffer} Converted buffer
   * @public
   */
  function toArrayBuffer$1(buf) {
    if (buf.byteLength === buf.buffer.byteLength) {
      return buf.buffer;
    }

    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  /**
   * Converts `data` to a `Buffer`.
   *
   * @param {*} data The data to convert
   * @return {Buffer} The buffer
   * @throws {TypeError}
   * @public
   */
  function toBuffer$2(data) {
    toBuffer$2.readOnly = true;

    if (isBuffer(data)) return data;

    let buf;

    if (data instanceof ArrayBuffer) {
      buf = Buffer$1.from(data);
    } else if (ArrayBuffer.isView(data)) {
      buf = Buffer$1.from(data.buffer, data.byteOffset, data.byteLength);
    } else {
      buf = Buffer$1.from(data);
      toBuffer$2.readOnly = false;
    }

    return buf;
  }

  try {
    const bufferUtil = require('bufferutil');

    bufferUtil$1.exports = {
      concat: concat$1,
      mask(source, mask, output, offset, length) {
        if (length < 48) _mask(source, mask, output, offset, length);
        else bufferUtil.mask(source, mask, output, offset, length);
      },
      toArrayBuffer: toArrayBuffer$1,
      toBuffer: toBuffer$2,
      unmask(buffer, mask) {
        if (buffer.length < 32) _unmask(buffer, mask);
        else bufferUtil.unmask(buffer, mask);
      }
    };
  } catch (e) /* istanbul ignore next */ {
    bufferUtil$1.exports = {
      concat: concat$1,
      mask: _mask,
      toArrayBuffer: toArrayBuffer$1,
      toBuffer: toBuffer$2,
      unmask: _unmask
    };
  }

  const kDone = Symbol('kDone');
  const kRun = Symbol('kRun');

  /**
   * A very simple job queue with adjustable concurrency. Adapted from
   * https://github.com/STRML/async-limiter
   */
  class Limiter$1 {
    /**
     * Creates a new `Limiter`.
     *
     * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
     *     to run concurrently
     */
    constructor(concurrency) {
      this[kDone] = () => {
        this.pending--;
        this[kRun]();
      };
      this.concurrency = concurrency || Infinity;
      this.jobs = [];
      this.pending = 0;
    }

    /**
     * Adds a job to the queue.
     *
     * @param {Function} job The job to run
     * @public
     */
    add(job) {
      this.jobs.push(job);
      this[kRun]();
    }

    /**
     * Removes a job from the queue and runs it if possible.
     *
     * @private
     */
    [kRun]() {
      if (this.pending === this.concurrency) return;

      if (this.jobs.length) {
        const job = this.jobs.shift();

        this.pending++;
        job(this[kDone]);
      }
    }
  }

  var limiter = Limiter$1;

  const zlib = require$$0$1;

  const bufferUtil = bufferUtil$1.exports;
  const Limiter = limiter;
  const { kStatusCode: kStatusCode$2 } = constants;

  const TRAILER = Buffer$1.from([0x00, 0x00, 0xff, 0xff]);
  const kPerMessageDeflate = Symbol('permessage-deflate');
  const kTotalLength = Symbol('total-length');
  const kCallback = Symbol('callback');
  const kBuffers = Symbol('buffers');
  const kError$1 = Symbol('error');

  //
  // We limit zlib concurrency, which prevents severe memory fragmentation
  // as documented in https://github.com/nodejs/node/issues/8871#issuecomment-250915913
  // and https://github.com/websockets/ws/issues/1202
  //
  // Intentionally global; it's the global thread pool that's an issue.
  //
  let zlibLimiter;

  /**
   * permessage-deflate implementation.
   */
  class PerMessageDeflate$4 {
    /**
     * Creates a PerMessageDeflate instance.
     *
     * @param {Object} [options] Configuration options
     * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
     *     for, or request, a custom client window size
     * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
     *     acknowledge disabling of client context takeover
     * @param {Number} [options.concurrencyLimit=10] The number of concurrent
     *     calls to zlib
     * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
     *     use of a custom server window size
     * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
     *     disabling of server context takeover
     * @param {Number} [options.threshold=1024] Size (in bytes) below which
     *     messages should not be compressed if context takeover is disabled
     * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
     *     deflate
     * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
     *     inflate
     * @param {Boolean} [isServer=false] Create the instance in either server or
     *     client mode
     * @param {Number} [maxPayload=0] The maximum allowed message length
     */
    constructor(options, isServer, maxPayload) {
      this._maxPayload = maxPayload | 0;
      this._options = options || {};
      this._threshold =
        this._options.threshold !== undefined ? this._options.threshold : 1024;
      this._isServer = !!isServer;
      this._deflate = null;
      this._inflate = null;

      this.params = null;

      if (!zlibLimiter) {
        const concurrency =
          this._options.concurrencyLimit !== undefined
            ? this._options.concurrencyLimit
            : 10;
        zlibLimiter = new Limiter(concurrency);
      }
    }

    /**
     * @type {String}
     */
    static get extensionName() {
      return 'permessage-deflate';
    }

    /**
     * Create an extension negotiation offer.
     *
     * @return {Object} Extension parameters
     * @public
     */
    offer() {
      const params = {};

      if (this._options.serverNoContextTakeover) {
        params.server_no_context_takeover = true;
      }
      if (this._options.clientNoContextTakeover) {
        params.client_no_context_takeover = true;
      }
      if (this._options.serverMaxWindowBits) {
        params.server_max_window_bits = this._options.serverMaxWindowBits;
      }
      if (this._options.clientMaxWindowBits) {
        params.client_max_window_bits = this._options.clientMaxWindowBits;
      } else if (this._options.clientMaxWindowBits == null) {
        params.client_max_window_bits = true;
      }

      return params;
    }

    /**
     * Accept an extension negotiation offer/response.
     *
     * @param {Array} configurations The extension negotiation offers/reponse
     * @return {Object} Accepted configuration
     * @public
     */
    accept(configurations) {
      configurations = this.normalizeParams(configurations);

      this.params = this._isServer
        ? this.acceptAsServer(configurations)
        : this.acceptAsClient(configurations);

      return this.params;
    }

    /**
     * Releases all resources used by the extension.
     *
     * @public
     */
    cleanup() {
      if (this._inflate) {
        this._inflate.close();
        this._inflate = null;
      }

      if (this._deflate) {
        const callback = this._deflate[kCallback];

        this._deflate.close();
        this._deflate = null;

        if (callback) {
          callback(
            new Error(
              'The deflate stream was closed while data was being processed'
            )
          );
        }
      }
    }

    /**
     *  Accept an extension negotiation offer.
     *
     * @param {Array} offers The extension negotiation offers
     * @return {Object} Accepted configuration
     * @private
     */
    acceptAsServer(offers) {
      const opts = this._options;
      const accepted = offers.find((params) => {
        if (
          (opts.serverNoContextTakeover === false &&
            params.server_no_context_takeover) ||
          (params.server_max_window_bits &&
            (opts.serverMaxWindowBits === false ||
              (typeof opts.serverMaxWindowBits === 'number' &&
                opts.serverMaxWindowBits > params.server_max_window_bits))) ||
          (typeof opts.clientMaxWindowBits === 'number' &&
            !params.client_max_window_bits)
        ) {
          return false;
        }

        return true;
      });

      if (!accepted) {
        throw new Error('None of the extension offers can be accepted');
      }

      if (opts.serverNoContextTakeover) {
        accepted.server_no_context_takeover = true;
      }
      if (opts.clientNoContextTakeover) {
        accepted.client_no_context_takeover = true;
      }
      if (typeof opts.serverMaxWindowBits === 'number') {
        accepted.server_max_window_bits = opts.serverMaxWindowBits;
      }
      if (typeof opts.clientMaxWindowBits === 'number') {
        accepted.client_max_window_bits = opts.clientMaxWindowBits;
      } else if (
        accepted.client_max_window_bits === true ||
        opts.clientMaxWindowBits === false
      ) {
        delete accepted.client_max_window_bits;
      }

      return accepted;
    }

    /**
     * Accept the extension negotiation response.
     *
     * @param {Array} response The extension negotiation response
     * @return {Object} Accepted configuration
     * @private
     */
    acceptAsClient(response) {
      const params = response[0];

      if (
        this._options.clientNoContextTakeover === false &&
        params.client_no_context_takeover
      ) {
        throw new Error('Unexpected parameter "client_no_context_takeover"');
      }

      if (!params.client_max_window_bits) {
        if (typeof this._options.clientMaxWindowBits === 'number') {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        }
      } else if (
        this._options.clientMaxWindowBits === false ||
        (typeof this._options.clientMaxWindowBits === 'number' &&
          params.client_max_window_bits > this._options.clientMaxWindowBits)
      ) {
        throw new Error(
          'Unexpected or invalid parameter "client_max_window_bits"'
        );
      }

      return params;
    }

    /**
     * Normalize parameters.
     *
     * @param {Array} configurations The extension negotiation offers/reponse
     * @return {Array} The offers/response with normalized parameters
     * @private
     */
    normalizeParams(configurations) {
      configurations.forEach((params) => {
        Object.keys(params).forEach((key) => {
          let value = params[key];

          if (value.length > 1) {
            throw new Error(`Parameter "${key}" must have only a single value`);
          }

          value = value[0];

          if (key === 'client_max_window_bits') {
            if (value !== true) {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (!this._isServer) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
          } else if (key === 'server_max_window_bits') {
            const num = +value;
            if (!Number.isInteger(num) || num < 8 || num > 15) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
            value = num;
          } else if (
            key === 'client_no_context_takeover' ||
            key === 'server_no_context_takeover'
          ) {
            if (value !== true) {
              throw new TypeError(
                `Invalid value for parameter "${key}": ${value}`
              );
            }
          } else {
            throw new Error(`Unknown parameter "${key}"`);
          }

          params[key] = value;
        });
      });

      return configurations;
    }

    /**
     * Decompress data. Concurrency limited.
     *
     * @param {Buffer} data Compressed data
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @public
     */
    decompress(data, fin, callback) {
      zlibLimiter.add((done) => {
        this._decompress(data, fin, (err, result) => {
          done();
          callback(err, result);
        });
      });
    }

    /**
     * Compress data. Concurrency limited.
     *
     * @param {(Buffer|String)} data Data to compress
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @public
     */
    compress(data, fin, callback) {
      zlibLimiter.add((done) => {
        this._compress(data, fin, (err, result) => {
          done();
          callback(err, result);
        });
      });
    }

    /**
     * Decompress data.
     *
     * @param {Buffer} data Compressed data
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @private
     */
    _decompress(data, fin, callback) {
      const endpoint = this._isServer ? 'client' : 'server';

      if (!this._inflate) {
        const key = `${endpoint}_max_window_bits`;
        const windowBits =
          typeof this.params[key] !== 'number'
            ? zlib.Z_DEFAULT_WINDOWBITS
            : this.params[key];

        this._inflate = zlib.createInflateRaw({
          ...this._options.zlibInflateOptions,
          windowBits
        });
        this._inflate[kPerMessageDeflate] = this;
        this._inflate[kTotalLength] = 0;
        this._inflate[kBuffers] = [];
        this._inflate.on('error', inflateOnError);
        this._inflate.on('data', inflateOnData);
      }

      this._inflate[kCallback] = callback;

      this._inflate.write(data);
      if (fin) this._inflate.write(TRAILER);

      this._inflate.flush(() => {
        const err = this._inflate[kError$1];

        if (err) {
          this._inflate.close();
          this._inflate = null;
          callback(err);
          return;
        }

        const data = bufferUtil.concat(
          this._inflate[kBuffers],
          this._inflate[kTotalLength]
        );

        if (this._inflate._readableState.endEmitted) {
          this._inflate.close();
          this._inflate = null;
        } else {
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];

          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._inflate.reset();
          }
        }

        callback(null, data);
      });
    }

    /**
     * Compress data.
     *
     * @param {(Buffer|String)} data Data to compress
     * @param {Boolean} fin Specifies whether or not this is the last fragment
     * @param {Function} callback Callback
     * @private
     */
    _compress(data, fin, callback) {
      const endpoint = this._isServer ? 'server' : 'client';

      if (!this._deflate) {
        const key = `${endpoint}_max_window_bits`;
        const windowBits =
          typeof this.params[key] !== 'number'
            ? zlib.Z_DEFAULT_WINDOWBITS
            : this.params[key];

        this._deflate = zlib.createDeflateRaw({
          ...this._options.zlibDeflateOptions,
          windowBits
        });

        this._deflate[kTotalLength] = 0;
        this._deflate[kBuffers] = [];

        this._deflate.on('data', deflateOnData);
      }

      this._deflate[kCallback] = callback;

      this._deflate.write(data);
      this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
        if (!this._deflate) {
          //
          // The deflate stream was closed while data was being processed.
          //
          return;
        }

        let data = bufferUtil.concat(
          this._deflate[kBuffers],
          this._deflate[kTotalLength]
        );

        if (fin) data = data.slice(0, data.length - 4);

        //
        // Ensure that the callback will not be called again in
        // `PerMessageDeflate#cleanup()`.
        //
        this._deflate[kCallback] = null;

        this._deflate[kTotalLength] = 0;
        this._deflate[kBuffers] = [];

        if (fin && this.params[`${endpoint}_no_context_takeover`]) {
          this._deflate.reset();
        }

        callback(null, data);
      });
    }
  }

  var permessageDeflate = PerMessageDeflate$4;

  /**
   * The listener of the `zlib.DeflateRaw` stream `'data'` event.
   *
   * @param {Buffer} chunk A chunk of data
   * @private
   */
  function deflateOnData(chunk) {
    this[kBuffers].push(chunk);
    this[kTotalLength] += chunk.length;
  }

  /**
   * The listener of the `zlib.InflateRaw` stream `'data'` event.
   *
   * @param {Buffer} chunk A chunk of data
   * @private
   */
  function inflateOnData(chunk) {
    this[kTotalLength] += chunk.length;

    if (
      this[kPerMessageDeflate]._maxPayload < 1 ||
      this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload
    ) {
      this[kBuffers].push(chunk);
      return;
    }

    this[kError$1] = new RangeError('Max payload size exceeded');
    this[kError$1].code = 'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH';
    this[kError$1][kStatusCode$2] = 1009;
    this.removeListener('data', inflateOnData);
    this.reset();
  }

  /**
   * The listener of the `zlib.InflateRaw` stream `'error'` event.
   *
   * @param {Error} err The emitted error
   * @private
   */
  function inflateOnError(err) {
    //
    // There is no need to call `Zlib#close()` as the handle is automatically
    // closed when an error is emitted.
    //
    this[kPerMessageDeflate]._inflate = null;
    err[kStatusCode$2] = 1007;
    this[kCallback](err);
  }

  var validation = {exports: {}};

  //
  // Allowed token characters:
  //
  // '!', '#', '$', '%', '&', ''', '*', '+', '-',
  // '.', 0-9, A-Z, '^', '_', '`', a-z, '|', '~'
  //
  // tokenChars[32] === 0 // ' '
  // tokenChars[33] === 1 // '!'
  // tokenChars[34] === 0 // '"'
  // ...
  //
  // prettier-ignore
  const tokenChars$2 = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 0 - 15
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 16 - 31
    0, 1, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, // 32 - 47
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, // 48 - 63
    0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 64 - 79
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, // 80 - 95
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 96 - 111
    1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0 // 112 - 127
  ];

  /**
   * Checks if a status code is allowed in a close frame.
   *
   * @param {Number} code The status code
   * @return {Boolean} `true` if the status code is valid, else `false`
   * @public
   */
  function isValidStatusCode$2(code) {
    return (
      (code >= 1000 &&
        code <= 1014 &&
        code !== 1004 &&
        code !== 1005 &&
        code !== 1006) ||
      (code >= 3000 && code <= 4999)
    );
  }

  /**
   * Checks if a given buffer contains only correct UTF-8.
   * Ported from https://www.cl.cam.ac.uk/%7Emgk25/ucs/utf8_check.c by
   * Markus Kuhn.
   *
   * @param {Buffer} buf The buffer to check
   * @return {Boolean} `true` if `buf` contains only correct UTF-8, else `false`
   * @public
   */
  function _isValidUTF8(buf) {
    const len = buf.length;
    let i = 0;

    while (i < len) {
      if ((buf[i] & 0x80) === 0) {
        // 0xxxxxxx
        i++;
      } else if ((buf[i] & 0xe0) === 0xc0) {
        // 110xxxxx 10xxxxxx
        if (
          i + 1 === len ||
          (buf[i + 1] & 0xc0) !== 0x80 ||
          (buf[i] & 0xfe) === 0xc0 // Overlong
        ) {
          return false;
        }

        i += 2;
      } else if ((buf[i] & 0xf0) === 0xe0) {
        // 1110xxxx 10xxxxxx 10xxxxxx
        if (
          i + 2 >= len ||
          (buf[i + 1] & 0xc0) !== 0x80 ||
          (buf[i + 2] & 0xc0) !== 0x80 ||
          (buf[i] === 0xe0 && (buf[i + 1] & 0xe0) === 0x80) || // Overlong
          (buf[i] === 0xed && (buf[i + 1] & 0xe0) === 0xa0) // Surrogate (U+D800 - U+DFFF)
        ) {
          return false;
        }

        i += 3;
      } else if ((buf[i] & 0xf8) === 0xf0) {
        // 11110xxx 10xxxxxx 10xxxxxx 10xxxxxx
        if (
          i + 3 >= len ||
          (buf[i + 1] & 0xc0) !== 0x80 ||
          (buf[i + 2] & 0xc0) !== 0x80 ||
          (buf[i + 3] & 0xc0) !== 0x80 ||
          (buf[i] === 0xf0 && (buf[i + 1] & 0xf0) === 0x80) || // Overlong
          (buf[i] === 0xf4 && buf[i + 1] > 0x8f) ||
          buf[i] > 0xf4 // > U+10FFFF
        ) {
          return false;
        }

        i += 4;
      } else {
        return false;
      }
    }

    return true;
  }

  try {
    const isValidUTF8 = require('utf-8-validate');

    validation.exports = {
      isValidStatusCode: isValidStatusCode$2,
      isValidUTF8(buf) {
        return buf.length < 150 ? _isValidUTF8(buf) : isValidUTF8(buf);
      },
      tokenChars: tokenChars$2
    };
  } catch (e) /* istanbul ignore next */ {
    validation.exports = {
      isValidStatusCode: isValidStatusCode$2,
      isValidUTF8: _isValidUTF8,
      tokenChars: tokenChars$2
    };
  }

  const { Writable } = require$$0$2;

  const PerMessageDeflate$3 = permessageDeflate;
  const {
    BINARY_TYPES: BINARY_TYPES$1,
    EMPTY_BUFFER: EMPTY_BUFFER$2,
    kStatusCode: kStatusCode$1,
    kWebSocket: kWebSocket$2
  } = constants;
  const { concat, toArrayBuffer, unmask } = bufferUtil$1.exports;
  const { isValidStatusCode: isValidStatusCode$1, isValidUTF8 } = validation.exports;

  const GET_INFO = 0;
  const GET_PAYLOAD_LENGTH_16 = 1;
  const GET_PAYLOAD_LENGTH_64 = 2;
  const GET_MASK = 3;
  const GET_DATA = 4;
  const INFLATING = 5;

  /**
   * HyBi Receiver implementation.
   *
   * @extends Writable
   */
  class Receiver$1 extends Writable {
    /**
     * Creates a Receiver instance.
     *
     * @param {Object} [options] Options object
     * @param {String} [options.binaryType=nodebuffer] The type for binary data
     * @param {Object} [options.extensions] An object containing the negotiated
     *     extensions
     * @param {Boolean} [options.isServer=false] Specifies whether to operate in
     *     client or server mode
     * @param {Number} [options.maxPayload=0] The maximum allowed message length
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     */
    constructor(options = {}) {
      super();

      this._binaryType = options.binaryType || BINARY_TYPES$1[0];
      this._extensions = options.extensions || {};
      this._isServer = !!options.isServer;
      this._maxPayload = options.maxPayload | 0;
      this._skipUTF8Validation = !!options.skipUTF8Validation;
      this[kWebSocket$2] = undefined;

      this._bufferedBytes = 0;
      this._buffers = [];

      this._compressed = false;
      this._payloadLength = 0;
      this._mask = undefined;
      this._fragmented = 0;
      this._masked = false;
      this._fin = false;
      this._opcode = 0;

      this._totalPayloadLength = 0;
      this._messageLength = 0;
      this._fragments = [];

      this._state = GET_INFO;
      this._loop = false;
    }

    /**
     * Implements `Writable.prototype._write()`.
     *
     * @param {Buffer} chunk The chunk of data to write
     * @param {String} encoding The character encoding of `chunk`
     * @param {Function} cb Callback
     * @private
     */
    _write(chunk, encoding, cb) {
      if (this._opcode === 0x08 && this._state == GET_INFO) return cb();

      this._bufferedBytes += chunk.length;
      this._buffers.push(chunk);
      this.startLoop(cb);
    }

    /**
     * Consumes `n` bytes from the buffered data.
     *
     * @param {Number} n The number of bytes to consume
     * @return {Buffer} The consumed bytes
     * @private
     */
    consume(n) {
      this._bufferedBytes -= n;

      if (n === this._buffers[0].length) return this._buffers.shift();

      if (n < this._buffers[0].length) {
        const buf = this._buffers[0];
        this._buffers[0] = buf.slice(n);
        return buf.slice(0, n);
      }

      const dst = Buffer$1.allocUnsafe(n);

      do {
        const buf = this._buffers[0];
        const offset = dst.length - n;

        if (n >= buf.length) {
          dst.set(this._buffers.shift(), offset);
        } else {
          dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
          this._buffers[0] = buf.slice(n);
        }

        n -= buf.length;
      } while (n > 0);

      return dst;
    }

    /**
     * Starts the parsing loop.
     *
     * @param {Function} cb Callback
     * @private
     */
    startLoop(cb) {
      let err;
      this._loop = true;

      do {
        switch (this._state) {
          case GET_INFO:
            err = this.getInfo();
            break;
          case GET_PAYLOAD_LENGTH_16:
            err = this.getPayloadLength16();
            break;
          case GET_PAYLOAD_LENGTH_64:
            err = this.getPayloadLength64();
            break;
          case GET_MASK:
            this.getMask();
            break;
          case GET_DATA:
            err = this.getData(cb);
            break;
          default:
            // `INFLATING`
            this._loop = false;
            return;
        }
      } while (this._loop);

      cb(err);
    }

    /**
     * Reads the first two bytes of a frame.
     *
     * @return {(RangeError|undefined)} A possible error
     * @private
     */
    getInfo() {
      if (this._bufferedBytes < 2) {
        this._loop = false;
        return;
      }

      const buf = this.consume(2);

      if ((buf[0] & 0x30) !== 0x00) {
        this._loop = false;
        return error(
          RangeError,
          'RSV2 and RSV3 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_2_3'
        );
      }

      const compressed = (buf[0] & 0x40) === 0x40;

      if (compressed && !this._extensions[PerMessageDeflate$3.extensionName]) {
        this._loop = false;
        return error(
          RangeError,
          'RSV1 must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_RSV_1'
        );
      }

      this._fin = (buf[0] & 0x80) === 0x80;
      this._opcode = buf[0] & 0x0f;
      this._payloadLength = buf[1] & 0x7f;

      if (this._opcode === 0x00) {
        if (compressed) {
          this._loop = false;
          return error(
            RangeError,
            'RSV1 must be clear',
            true,
            1002,
            'WS_ERR_UNEXPECTED_RSV_1'
          );
        }

        if (!this._fragmented) {
          this._loop = false;
          return error(
            RangeError,
            'invalid opcode 0',
            true,
            1002,
            'WS_ERR_INVALID_OPCODE'
          );
        }

        this._opcode = this._fragmented;
      } else if (this._opcode === 0x01 || this._opcode === 0x02) {
        if (this._fragmented) {
          this._loop = false;
          return error(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            'WS_ERR_INVALID_OPCODE'
          );
        }

        this._compressed = compressed;
      } else if (this._opcode > 0x07 && this._opcode < 0x0b) {
        if (!this._fin) {
          this._loop = false;
          return error(
            RangeError,
            'FIN must be set',
            true,
            1002,
            'WS_ERR_EXPECTED_FIN'
          );
        }

        if (compressed) {
          this._loop = false;
          return error(
            RangeError,
            'RSV1 must be clear',
            true,
            1002,
            'WS_ERR_UNEXPECTED_RSV_1'
          );
        }

        if (this._payloadLength > 0x7d) {
          this._loop = false;
          return error(
            RangeError,
            `invalid payload length ${this._payloadLength}`,
            true,
            1002,
            'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
          );
        }
      } else {
        this._loop = false;
        return error(
          RangeError,
          `invalid opcode ${this._opcode}`,
          true,
          1002,
          'WS_ERR_INVALID_OPCODE'
        );
      }

      if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
      this._masked = (buf[1] & 0x80) === 0x80;

      if (this._isServer) {
        if (!this._masked) {
          this._loop = false;
          return error(
            RangeError,
            'MASK must be set',
            true,
            1002,
            'WS_ERR_EXPECTED_MASK'
          );
        }
      } else if (this._masked) {
        this._loop = false;
        return error(
          RangeError,
          'MASK must be clear',
          true,
          1002,
          'WS_ERR_UNEXPECTED_MASK'
        );
      }

      if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
      else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
      else return this.haveLength();
    }

    /**
     * Gets extended payload length (7+16).
     *
     * @return {(RangeError|undefined)} A possible error
     * @private
     */
    getPayloadLength16() {
      if (this._bufferedBytes < 2) {
        this._loop = false;
        return;
      }

      this._payloadLength = this.consume(2).readUInt16BE(0);
      return this.haveLength();
    }

    /**
     * Gets extended payload length (7+64).
     *
     * @return {(RangeError|undefined)} A possible error
     * @private
     */
    getPayloadLength64() {
      if (this._bufferedBytes < 8) {
        this._loop = false;
        return;
      }

      const buf = this.consume(8);
      const num = buf.readUInt32BE(0);

      //
      // The maximum safe integer in JavaScript is 2^53 - 1. An error is returned
      // if payload length is greater than this number.
      //
      if (num > Math.pow(2, 53 - 32) - 1) {
        this._loop = false;
        return error(
          RangeError,
          'Unsupported WebSocket frame: payload length > 2^53 - 1',
          false,
          1009,
          'WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH'
        );
      }

      this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
      return this.haveLength();
    }

    /**
     * Payload length has been read.
     *
     * @return {(RangeError|undefined)} A possible error
     * @private
     */
    haveLength() {
      if (this._payloadLength && this._opcode < 0x08) {
        this._totalPayloadLength += this._payloadLength;
        if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
          this._loop = false;
          return error(
            RangeError,
            'Max payload size exceeded',
            false,
            1009,
            'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
          );
        }
      }

      if (this._masked) this._state = GET_MASK;
      else this._state = GET_DATA;
    }

    /**
     * Reads mask bytes.
     *
     * @private
     */
    getMask() {
      if (this._bufferedBytes < 4) {
        this._loop = false;
        return;
      }

      this._mask = this.consume(4);
      this._state = GET_DATA;
    }

    /**
     * Reads data bytes.
     *
     * @param {Function} cb Callback
     * @return {(Error|RangeError|undefined)} A possible error
     * @private
     */
    getData(cb) {
      let data = EMPTY_BUFFER$2;

      if (this._payloadLength) {
        if (this._bufferedBytes < this._payloadLength) {
          this._loop = false;
          return;
        }

        data = this.consume(this._payloadLength);

        if (
          this._masked &&
          (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0
        ) {
          unmask(data, this._mask);
        }
      }

      if (this._opcode > 0x07) return this.controlMessage(data);

      if (this._compressed) {
        this._state = INFLATING;
        this.decompress(data, cb);
        return;
      }

      if (data.length) {
        //
        // This message is not compressed so its length is the sum of the payload
        // length of all fragments.
        //
        this._messageLength = this._totalPayloadLength;
        this._fragments.push(data);
      }

      return this.dataMessage();
    }

    /**
     * Decompresses data.
     *
     * @param {Buffer} data Compressed data
     * @param {Function} cb Callback
     * @private
     */
    decompress(data, cb) {
      const perMessageDeflate = this._extensions[PerMessageDeflate$3.extensionName];

      perMessageDeflate.decompress(data, this._fin, (err, buf) => {
        if (err) return cb(err);

        if (buf.length) {
          this._messageLength += buf.length;
          if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
            return cb(
              error(
                RangeError,
                'Max payload size exceeded',
                false,
                1009,
                'WS_ERR_UNSUPPORTED_MESSAGE_LENGTH'
              )
            );
          }

          this._fragments.push(buf);
        }

        const er = this.dataMessage();
        if (er) return cb(er);

        this.startLoop(cb);
      });
    }

    /**
     * Handles a data message.
     *
     * @return {(Error|undefined)} A possible error
     * @private
     */
    dataMessage() {
      if (this._fin) {
        const messageLength = this._messageLength;
        const fragments = this._fragments;

        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];

        if (this._opcode === 2) {
          let data;

          if (this._binaryType === 'nodebuffer') {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === 'arraybuffer') {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else {
            data = fragments;
          }

          this.emit('message', data, true);
        } else {
          const buf = concat(fragments, messageLength);

          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            this._loop = false;
            return error(
              Error,
              'invalid UTF-8 sequence',
              true,
              1007,
              'WS_ERR_INVALID_UTF8'
            );
          }

          this.emit('message', buf, false);
        }
      }

      this._state = GET_INFO;
    }

    /**
     * Handles a control message.
     *
     * @param {Buffer} data Data to handle
     * @return {(Error|RangeError|undefined)} A possible error
     * @private
     */
    controlMessage(data) {
      if (this._opcode === 0x08) {
        this._loop = false;

        if (data.length === 0) {
          this.emit('conclude', 1005, EMPTY_BUFFER$2);
          this.end();
        } else if (data.length === 1) {
          return error(
            RangeError,
            'invalid payload length 1',
            true,
            1002,
            'WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH'
          );
        } else {
          const code = data.readUInt16BE(0);

          if (!isValidStatusCode$1(code)) {
            return error(
              RangeError,
              `invalid status code ${code}`,
              true,
              1002,
              'WS_ERR_INVALID_CLOSE_CODE'
            );
          }

          const buf = data.slice(2);

          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            return error(
              Error,
              'invalid UTF-8 sequence',
              true,
              1007,
              'WS_ERR_INVALID_UTF8'
            );
          }

          this.emit('conclude', code, buf);
          this.end();
        }
      } else if (this._opcode === 0x09) {
        this.emit('ping', data);
      } else {
        this.emit('pong', data);
      }

      this._state = GET_INFO;
    }
  }

  var receiver = Receiver$1;

  /**
   * Builds an error object.
   *
   * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
   * @param {String} message The error message
   * @param {Boolean} prefix Specifies whether or not to add a default prefix to
   *     `message`
   * @param {Number} statusCode The status code
   * @param {String} errorCode The exposed error code
   * @return {(Error|RangeError)} The error
   * @private
   */
  function error(ErrorCtor, message, prefix, statusCode, errorCode) {
    const err = new ErrorCtor(
      prefix ? `Invalid WebSocket frame: ${message}` : message
    );

    Error.captureStackTrace(err, error);
    err.code = errorCode;
    err[kStatusCode$1] = statusCode;
    return err;
  }

  const { randomFillSync } = require$$2;

  const PerMessageDeflate$2 = permessageDeflate;
  const { EMPTY_BUFFER: EMPTY_BUFFER$1 } = constants;
  const { isValidStatusCode } = validation.exports;
  const { mask: applyMask, toBuffer: toBuffer$1 } = bufferUtil$1.exports;

  const kByteLength = Symbol('kByteLength');
  const maskBuffer = Buffer$1.alloc(4);

  /**
   * HyBi Sender implementation.
   */
  class Sender$1 {
    /**
     * Creates a Sender instance.
     *
     * @param {(net.Socket|tls.Socket)} socket The connection socket
     * @param {Object} [extensions] An object containing the negotiated extensions
     * @param {Function} [generateMask] The function used to generate the masking
     *     key
     */
    constructor(socket, extensions, generateMask) {
      this._extensions = extensions || {};

      if (generateMask) {
        this._generateMask = generateMask;
        this._maskBuffer = Buffer$1.alloc(4);
      }

      this._socket = socket;

      this._firstFragment = true;
      this._compress = false;

      this._bufferedBytes = 0;
      this._deflating = false;
      this._queue = [];
    }

    /**
     * Frames a piece of data according to the HyBi WebSocket protocol.
     *
     * @param {(Buffer|String)} data The data to frame
     * @param {Object} options Options object
     * @param {Boolean} [options.fin=false] Specifies whether or not to set the
     *     FIN bit
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
     *     key
     * @param {Number} options.opcode The opcode
     * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
     *     modified
     * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
     *     RSV1 bit
     * @return {(Buffer|String)[]} The framed data
     * @public
     */
    static frame(data, options) {
      let mask;
      let merge = false;
      let offset = 2;
      let skipMasking = false;

      if (options.mask) {
        mask = options.maskBuffer || maskBuffer;

        if (options.generateMask) {
          options.generateMask(mask);
        } else {
          randomFillSync(mask, 0, 4);
        }

        skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
        offset = 6;
      }

      let dataLength;

      if (typeof data === 'string') {
        if (
          (!options.mask || skipMasking) &&
          options[kByteLength] !== undefined
        ) {
          dataLength = options[kByteLength];
        } else {
          data = Buffer$1.from(data);
          dataLength = data.length;
        }
      } else {
        dataLength = data.length;
        merge = options.mask && options.readOnly && !skipMasking;
      }

      let payloadLength = dataLength;

      if (dataLength >= 65536) {
        offset += 8;
        payloadLength = 127;
      } else if (dataLength > 125) {
        offset += 2;
        payloadLength = 126;
      }

      const target = Buffer$1.allocUnsafe(merge ? dataLength + offset : offset);

      target[0] = options.fin ? options.opcode | 0x80 : options.opcode;
      if (options.rsv1) target[0] |= 0x40;

      target[1] = payloadLength;

      if (payloadLength === 126) {
        target.writeUInt16BE(dataLength, 2);
      } else if (payloadLength === 127) {
        target[2] = target[3] = 0;
        target.writeUIntBE(dataLength, 4, 6);
      }

      if (!options.mask) return [target, data];

      target[1] |= 0x80;
      target[offset - 4] = mask[0];
      target[offset - 3] = mask[1];
      target[offset - 2] = mask[2];
      target[offset - 1] = mask[3];

      if (skipMasking) return [target, data];

      if (merge) {
        applyMask(data, mask, target, offset, dataLength);
        return [target];
      }

      applyMask(data, mask, data, 0, dataLength);
      return [target, data];
    }

    /**
     * Sends a close message to the other peer.
     *
     * @param {Number} [code] The status code component of the body
     * @param {(String|Buffer)} [data] The message component of the body
     * @param {Boolean} [mask=false] Specifies whether or not to mask the message
     * @param {Function} [cb] Callback
     * @public
     */
    close(code, data, mask, cb) {
      let buf;

      if (code === undefined) {
        buf = EMPTY_BUFFER$1;
      } else if (typeof code !== 'number' || !isValidStatusCode(code)) {
        throw new TypeError('First argument must be a valid error code number');
      } else if (data === undefined || !data.length) {
        buf = Buffer$1.allocUnsafe(2);
        buf.writeUInt16BE(code, 0);
      } else {
        const length = Buffer$1.byteLength(data);

        if (length > 123) {
          throw new RangeError('The message must not be greater than 123 bytes');
        }

        buf = Buffer$1.allocUnsafe(2 + length);
        buf.writeUInt16BE(code, 0);

        if (typeof data === 'string') {
          buf.write(data, 2);
        } else {
          buf.set(data, 2);
        }
      }

      const options = {
        [kByteLength]: buf.length,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 0x08,
        readOnly: false,
        rsv1: false
      };

      if (this._deflating) {
        this.enqueue([this.dispatch, buf, false, options, cb]);
      } else {
        this.sendFrame(Sender$1.frame(buf, options), cb);
      }
    }

    /**
     * Sends a ping message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback
     * @public
     */
    ping(data, mask, cb) {
      let byteLength;
      let readOnly;

      if (typeof data === 'string') {
        byteLength = Buffer$1.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer$1(data);
        byteLength = data.length;
        readOnly = toBuffer$1.readOnly;
      }

      if (byteLength > 125) {
        throw new RangeError('The data size must not be greater than 125 bytes');
      }

      const options = {
        [kByteLength]: byteLength,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 0x09,
        readOnly,
        rsv1: false
      };

      if (this._deflating) {
        this.enqueue([this.dispatch, data, false, options, cb]);
      } else {
        this.sendFrame(Sender$1.frame(data, options), cb);
      }
    }

    /**
     * Sends a pong message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback
     * @public
     */
    pong(data, mask, cb) {
      let byteLength;
      let readOnly;

      if (typeof data === 'string') {
        byteLength = Buffer$1.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer$1(data);
        byteLength = data.length;
        readOnly = toBuffer$1.readOnly;
      }

      if (byteLength > 125) {
        throw new RangeError('The data size must not be greater than 125 bytes');
      }

      const options = {
        [kByteLength]: byteLength,
        fin: true,
        generateMask: this._generateMask,
        mask,
        maskBuffer: this._maskBuffer,
        opcode: 0x0a,
        readOnly,
        rsv1: false
      };

      if (this._deflating) {
        this.enqueue([this.dispatch, data, false, options, cb]);
      } else {
        this.sendFrame(Sender$1.frame(data, options), cb);
      }
    }

    /**
     * Sends a data message to the other peer.
     *
     * @param {*} data The message to send
     * @param {Object} options Options object
     * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
     *     or text
     * @param {Boolean} [options.compress=false] Specifies whether or not to
     *     compress `data`
     * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
     *     last one
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Function} [cb] Callback
     * @public
     */
    send(data, options, cb) {
      const perMessageDeflate = this._extensions[PerMessageDeflate$2.extensionName];
      let opcode = options.binary ? 2 : 1;
      let rsv1 = options.compress;

      let byteLength;
      let readOnly;

      if (typeof data === 'string') {
        byteLength = Buffer$1.byteLength(data);
        readOnly = false;
      } else {
        data = toBuffer$1(data);
        byteLength = data.length;
        readOnly = toBuffer$1.readOnly;
      }

      if (this._firstFragment) {
        this._firstFragment = false;
        if (
          rsv1 &&
          perMessageDeflate &&
          perMessageDeflate.params[
            perMessageDeflate._isServer
              ? 'server_no_context_takeover'
              : 'client_no_context_takeover'
          ]
        ) {
          rsv1 = byteLength >= perMessageDeflate._threshold;
        }
        this._compress = rsv1;
      } else {
        rsv1 = false;
        opcode = 0;
      }

      if (options.fin) this._firstFragment = true;

      if (perMessageDeflate) {
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };

        if (this._deflating) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      } else {
        this.sendFrame(
          Sender$1.frame(data, {
            [kByteLength]: byteLength,
            fin: options.fin,
            generateMask: this._generateMask,
            mask: options.mask,
            maskBuffer: this._maskBuffer,
            opcode,
            readOnly,
            rsv1: false
          }),
          cb
        );
      }
    }

    /**
     * Dispatches a message.
     *
     * @param {(Buffer|String)} data The message to send
     * @param {Boolean} [compress=false] Specifies whether or not to compress
     *     `data`
     * @param {Object} options Options object
     * @param {Boolean} [options.fin=false] Specifies whether or not to set the
     *     FIN bit
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Boolean} [options.mask=false] Specifies whether or not to mask
     *     `data`
     * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
     *     key
     * @param {Number} options.opcode The opcode
     * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
     *     modified
     * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
     *     RSV1 bit
     * @param {Function} [cb] Callback
     * @private
     */
    dispatch(data, compress, options, cb) {
      if (!compress) {
        this.sendFrame(Sender$1.frame(data, options), cb);
        return;
      }

      const perMessageDeflate = this._extensions[PerMessageDeflate$2.extensionName];

      this._bufferedBytes += options[kByteLength];
      this._deflating = true;
      perMessageDeflate.compress(data, options.fin, (_, buf) => {
        if (this._socket.destroyed) {
          const err = new Error(
            'The socket was closed while data was being compressed'
          );

          if (typeof cb === 'function') cb(err);

          for (let i = 0; i < this._queue.length; i++) {
            const params = this._queue[i];
            const callback = params[params.length - 1];

            if (typeof callback === 'function') callback(err);
          }

          return;
        }

        this._bufferedBytes -= options[kByteLength];
        this._deflating = false;
        options.readOnly = false;
        this.sendFrame(Sender$1.frame(buf, options), cb);
        this.dequeue();
      });
    }

    /**
     * Executes queued send operations.
     *
     * @private
     */
    dequeue() {
      while (!this._deflating && this._queue.length) {
        const params = this._queue.shift();

        this._bufferedBytes -= params[3][kByteLength];
        Reflect.apply(params[0], this, params.slice(1));
      }
    }

    /**
     * Enqueues a send operation.
     *
     * @param {Array} params Send operation parameters.
     * @private
     */
    enqueue(params) {
      this._bufferedBytes += params[3][kByteLength];
      this._queue.push(params);
    }

    /**
     * Sends a frame.
     *
     * @param {Buffer[]} list The frame to send
     * @param {Function} [cb] Callback
     * @private
     */
    sendFrame(list, cb) {
      if (list.length === 2) {
        this._socket.cork();
        this._socket.write(list[0]);
        this._socket.write(list[1], cb);
        this._socket.uncork();
      } else {
        this._socket.write(list[0], cb);
      }
    }
  }

  var sender = Sender$1;

  const { kForOnEventAttribute: kForOnEventAttribute$1, kListener: kListener$1 } = constants;

  const kCode = Symbol('kCode');
  const kData = Symbol('kData');
  const kError = Symbol('kError');
  const kMessage = Symbol('kMessage');
  const kReason = Symbol('kReason');
  const kTarget = Symbol('kTarget');
  const kType = Symbol('kType');
  const kWasClean = Symbol('kWasClean');

  /**
   * Class representing an event.
   */
  class Event$1 {
    /**
     * Create a new `Event`.
     *
     * @param {String} type The name of the event
     * @throws {TypeError} If the `type` argument is not specified
     */
    constructor(type) {
      this[kTarget] = null;
      this[kType] = type;
    }

    /**
     * @type {*}
     */
    get target() {
      return this[kTarget];
    }

    /**
     * @type {String}
     */
    get type() {
      return this[kType];
    }
  }

  Object.defineProperty(Event$1.prototype, 'target', { enumerable: true });
  Object.defineProperty(Event$1.prototype, 'type', { enumerable: true });

  /**
   * Class representing a close event.
   *
   * @extends Event
   */
  class CloseEvent extends Event$1 {
    /**
     * Create a new `CloseEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {Number} [options.code=0] The status code explaining why the
     *     connection was closed
     * @param {String} [options.reason=''] A human-readable string explaining why
     *     the connection was closed
     * @param {Boolean} [options.wasClean=false] Indicates whether or not the
     *     connection was cleanly closed
     */
    constructor(type, options = {}) {
      super(type);

      this[kCode] = options.code === undefined ? 0 : options.code;
      this[kReason] = options.reason === undefined ? '' : options.reason;
      this[kWasClean] = options.wasClean === undefined ? false : options.wasClean;
    }

    /**
     * @type {Number}
     */
    get code() {
      return this[kCode];
    }

    /**
     * @type {String}
     */
    get reason() {
      return this[kReason];
    }

    /**
     * @type {Boolean}
     */
    get wasClean() {
      return this[kWasClean];
    }
  }

  Object.defineProperty(CloseEvent.prototype, 'code', { enumerable: true });
  Object.defineProperty(CloseEvent.prototype, 'reason', { enumerable: true });
  Object.defineProperty(CloseEvent.prototype, 'wasClean', { enumerable: true });

  /**
   * Class representing an error event.
   *
   * @extends Event
   */
  class ErrorEvent extends Event$1 {
    /**
     * Create a new `ErrorEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {*} [options.error=null] The error that generated this event
     * @param {String} [options.message=''] The error message
     */
    constructor(type, options = {}) {
      super(type);

      this[kError] = options.error === undefined ? null : options.error;
      this[kMessage] = options.message === undefined ? '' : options.message;
    }

    /**
     * @type {*}
     */
    get error() {
      return this[kError];
    }

    /**
     * @type {String}
     */
    get message() {
      return this[kMessage];
    }
  }

  Object.defineProperty(ErrorEvent.prototype, 'error', { enumerable: true });
  Object.defineProperty(ErrorEvent.prototype, 'message', { enumerable: true });

  /**
   * Class representing a message event.
   *
   * @extends Event
   */
  class MessageEvent extends Event$1 {
    /**
     * Create a new `MessageEvent`.
     *
     * @param {String} type The name of the event
     * @param {Object} [options] A dictionary object that allows for setting
     *     attributes via object members of the same name
     * @param {*} [options.data=null] The message content
     */
    constructor(type, options = {}) {
      super(type);

      this[kData] = options.data === undefined ? null : options.data;
    }

    /**
     * @type {*}
     */
    get data() {
      return this[kData];
    }
  }

  Object.defineProperty(MessageEvent.prototype, 'data', { enumerable: true });

  /**
   * This provides methods for emulating the `EventTarget` interface. It's not
   * meant to be used directly.
   *
   * @mixin
   */
  const EventTarget = {
    /**
     * Register an event listener.
     *
     * @param {String} type A string representing the event type to listen for
     * @param {Function} listener The listener to add
     * @param {Object} [options] An options object specifies characteristics about
     *     the event listener
     * @param {Boolean} [options.once=false] A `Boolean` indicating that the
     *     listener should be invoked at most once after being added. If `true`,
     *     the listener would be automatically removed when invoked.
     * @public
     */
    addEventListener(type, listener, options = {}) {
      let wrapper;

      if (type === 'message') {
        wrapper = function onMessage(data, isBinary) {
          const event = new MessageEvent('message', {
            data: isBinary ? data : data.toString()
          });

          event[kTarget] = this;
          listener.call(this, event);
        };
      } else if (type === 'close') {
        wrapper = function onClose(code, message) {
          const event = new CloseEvent('close', {
            code,
            reason: message.toString(),
            wasClean: this._closeFrameReceived && this._closeFrameSent
          });

          event[kTarget] = this;
          listener.call(this, event);
        };
      } else if (type === 'error') {
        wrapper = function onError(error) {
          const event = new ErrorEvent('error', {
            error,
            message: error.message
          });

          event[kTarget] = this;
          listener.call(this, event);
        };
      } else if (type === 'open') {
        wrapper = function onOpen() {
          const event = new Event$1('open');

          event[kTarget] = this;
          listener.call(this, event);
        };
      } else {
        return;
      }

      wrapper[kForOnEventAttribute$1] = !!options[kForOnEventAttribute$1];
      wrapper[kListener$1] = listener;

      if (options.once) {
        this.once(type, wrapper);
      } else {
        this.on(type, wrapper);
      }
    },

    /**
     * Remove an event listener.
     *
     * @param {String} type A string representing the event type to remove
     * @param {Function} handler The listener to remove
     * @public
     */
    removeEventListener(type, handler) {
      for (const listener of this.listeners(type)) {
        if (listener[kListener$1] === handler && !listener[kForOnEventAttribute$1]) {
          this.removeListener(type, listener);
          break;
        }
      }
    }
  };

  var eventTarget = {
    CloseEvent,
    ErrorEvent,
    Event: Event$1,
    EventTarget,
    MessageEvent
  };

  const { tokenChars: tokenChars$1 } = validation.exports;

  /**
   * Adds an offer to the map of extension offers or a parameter to the map of
   * parameters.
   *
   * @param {Object} dest The map of extension offers or parameters
   * @param {String} name The extension or parameter name
   * @param {(Object|Boolean|String)} elem The extension parameters or the
   *     parameter value
   * @private
   */
  function push(dest, name, elem) {
    if (dest[name] === undefined) dest[name] = [elem];
    else dest[name].push(elem);
  }

  /**
   * Parses the `Sec-WebSocket-Extensions` header into an object.
   *
   * @param {String} header The field value of the header
   * @return {Object} The parsed object
   * @public
   */
  function parse$2(header) {
    const offers = Object.create(null);
    let params = Object.create(null);
    let mustUnescape = false;
    let isEscaping = false;
    let inQuotes = false;
    let extensionName;
    let paramName;
    let start = -1;
    let code = -1;
    let end = -1;
    let i = 0;

    for (; i < header.length; i++) {
      code = header.charCodeAt(i);

      if (extensionName === undefined) {
        if (end === -1 && tokenChars$1[code] === 1) {
          if (start === -1) start = i;
        } else if (
          i !== 0 &&
          (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
        ) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 0x3b /* ';' */ || code === 0x2c /* ',' */) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }

          if (end === -1) end = i;
          const name = header.slice(start, end);
          if (code === 0x2c) {
            push(offers, name, params);
            params = Object.create(null);
          } else {
            extensionName = name;
          }

          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else if (paramName === undefined) {
        if (end === -1 && tokenChars$1[code] === 1) {
          if (start === -1) start = i;
        } else if (code === 0x20 || code === 0x09) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 0x3b || code === 0x2c) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }

          if (end === -1) end = i;
          push(params, header.slice(start, end), true);
          if (code === 0x2c) {
            push(offers, extensionName, params);
            params = Object.create(null);
            extensionName = undefined;
          }

          start = end = -1;
        } else if (code === 0x3d /* '=' */ && start !== -1 && end === -1) {
          paramName = header.slice(start, i);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      } else {
        //
        // The value of a quoted-string after unescaping must conform to the
        // token ABNF, so only token characters are valid.
        // Ref: https://tools.ietf.org/html/rfc6455#section-9.1
        //
        if (isEscaping) {
          if (tokenChars$1[code] !== 1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (start === -1) start = i;
          else if (!mustUnescape) mustUnescape = true;
          isEscaping = false;
        } else if (inQuotes) {
          if (tokenChars$1[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 0x22 /* '"' */ && start !== -1) {
            inQuotes = false;
            end = i;
          } else if (code === 0x5c /* '\' */) {
            isEscaping = true;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (code === 0x22 && header.charCodeAt(i - 1) === 0x3d) {
          inQuotes = true;
        } else if (end === -1 && tokenChars$1[code] === 1) {
          if (start === -1) start = i;
        } else if (start !== -1 && (code === 0x20 || code === 0x09)) {
          if (end === -1) end = i;
        } else if (code === 0x3b || code === 0x2c) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }

          if (end === -1) end = i;
          let value = header.slice(start, end);
          if (mustUnescape) {
            value = value.replace(/\\/g, '');
            mustUnescape = false;
          }
          push(params, paramName, value);
          if (code === 0x2c) {
            push(offers, extensionName, params);
            params = Object.create(null);
            extensionName = undefined;
          }

          paramName = undefined;
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
    }

    if (start === -1 || inQuotes || code === 0x20 || code === 0x09) {
      throw new SyntaxError('Unexpected end of input');
    }

    if (end === -1) end = i;
    const token = header.slice(start, end);
    if (extensionName === undefined) {
      push(offers, token, params);
    } else {
      if (paramName === undefined) {
        push(params, token, true);
      } else if (mustUnescape) {
        push(params, paramName, token.replace(/\\/g, ''));
      } else {
        push(params, paramName, token);
      }
      push(offers, extensionName, params);
    }

    return offers;
  }

  /**
   * Builds the `Sec-WebSocket-Extensions` header field value.
   *
   * @param {Object} extensions The map of extensions and parameters to format
   * @return {String} A string representing the given object
   * @public
   */
  function format$1(extensions) {
    return Object.keys(extensions)
      .map((extension) => {
        let configurations = extensions[extension];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations
          .map((params) => {
            return [extension]
              .concat(
                Object.keys(params).map((k) => {
                  let values = params[k];
                  if (!Array.isArray(values)) values = [values];
                  return values
                    .map((v) => (v === true ? k : `${k}=${v}`))
                    .join('; ');
                })
              )
              .join('; ');
          })
          .join(', ');
      })
      .join(', ');
  }

  var extension$1 = { format: format$1, parse: parse$2 };

  const EventEmitter$1 = events;
  const https$1 = require$$4;
  const http$2 = require$$4;
  const net = require$$2;
  const tls = require$$2;
  const { randomBytes: randomBytes$1, createHash: createHash$1 } = require$$2;
  const { URL: URL$1 } = require$$7;

  const PerMessageDeflate$1 = permessageDeflate;
  const Receiver = receiver;
  const Sender = sender;
  const {
    BINARY_TYPES,
    EMPTY_BUFFER,
    GUID: GUID$1,
    kForOnEventAttribute,
    kListener,
    kStatusCode,
    kWebSocket: kWebSocket$1,
    NOOP
  } = constants;
  const {
    EventTarget: { addEventListener, removeEventListener }
  } = eventTarget;
  const { format, parse: parse$1 } = extension$1;
  const { toBuffer } = bufferUtil$1.exports;

  const closeTimeout = 30 * 1000;
  const kAborted = Symbol('kAborted');
  const protocolVersions = [8, 13];
  const readyStates = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
  const subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;

  /**
   * Class representing a WebSocket.
   *
   * @extends EventEmitter
   */
  class WebSocket$4 extends EventEmitter$1 {
    /**
     * Create a new `WebSocket`.
     *
     * @param {(String|URL)} address The URL to which to connect
     * @param {(String|String[])} [protocols] The subprotocols
     * @param {Object} [options] Connection options
     */
    constructor(address, protocols, options) {
      super();

      this._binaryType = BINARY_TYPES[0];
      this._closeCode = 1006;
      this._closeFrameReceived = false;
      this._closeFrameSent = false;
      this._closeMessage = EMPTY_BUFFER;
      this._closeTimer = null;
      this._extensions = {};
      this._paused = false;
      this._protocol = '';
      this._readyState = WebSocket$4.CONNECTING;
      this._receiver = null;
      this._sender = null;
      this._socket = null;

      if (address !== null) {
        this._bufferedAmount = 0;
        this._isServer = false;
        this._redirects = 0;

        if (protocols === undefined) {
          protocols = [];
        } else if (!Array.isArray(protocols)) {
          if (typeof protocols === 'object' && protocols !== null) {
            options = protocols;
            protocols = [];
          } else {
            protocols = [protocols];
          }
        }

        initAsClient(this, address, protocols, options);
      } else {
        this._isServer = true;
      }
    }

    /**
     * This deviates from the WHATWG interface since ws doesn't support the
     * required default "blob" type (instead we define a custom "nodebuffer"
     * type).
     *
     * @type {String}
     */
    get binaryType() {
      return this._binaryType;
    }

    set binaryType(type) {
      if (!BINARY_TYPES.includes(type)) return;

      this._binaryType = type;

      //
      // Allow to change `binaryType` on the fly.
      //
      if (this._receiver) this._receiver._binaryType = type;
    }

    /**
     * @type {Number}
     */
    get bufferedAmount() {
      if (!this._socket) return this._bufferedAmount;

      return this._socket._writableState.length + this._sender._bufferedBytes;
    }

    /**
     * @type {String}
     */
    get extensions() {
      return Object.keys(this._extensions).join();
    }

    /**
     * @type {Boolean}
     */
    get isPaused() {
      return this._paused;
    }

    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onclose() {
      return null;
    }

    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onerror() {
      return null;
    }

    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onopen() {
      return null;
    }

    /**
     * @type {Function}
     */
    /* istanbul ignore next */
    get onmessage() {
      return null;
    }

    /**
     * @type {String}
     */
    get protocol() {
      return this._protocol;
    }

    /**
     * @type {Number}
     */
    get readyState() {
      return this._readyState;
    }

    /**
     * @type {String}
     */
    get url() {
      return this._url;
    }

    /**
     * Set up the socket and the internal resources.
     *
     * @param {(net.Socket|tls.Socket)} socket The network socket between the
     *     server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Object} options Options object
     * @param {Function} [options.generateMask] The function used to generate the
     *     masking key
     * @param {Number} [options.maxPayload=0] The maximum allowed message size
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     * @private
     */
    setSocket(socket, head, options) {
      const receiver = new Receiver({
        binaryType: this.binaryType,
        extensions: this._extensions,
        isServer: this._isServer,
        maxPayload: options.maxPayload,
        skipUTF8Validation: options.skipUTF8Validation
      });

      this._sender = new Sender(socket, this._extensions, options.generateMask);
      this._receiver = receiver;
      this._socket = socket;

      receiver[kWebSocket$1] = this;
      socket[kWebSocket$1] = this;

      receiver.on('conclude', receiverOnConclude);
      receiver.on('drain', receiverOnDrain);
      receiver.on('error', receiverOnError);
      receiver.on('message', receiverOnMessage);
      receiver.on('ping', receiverOnPing);
      receiver.on('pong', receiverOnPong);

      socket.setTimeout(0);
      socket.setNoDelay();

      if (head.length > 0) socket.unshift(head);

      socket.on('close', socketOnClose);
      socket.on('data', socketOnData);
      socket.on('end', socketOnEnd);
      socket.on('error', socketOnError$1);

      this._readyState = WebSocket$4.OPEN;
      this.emit('open');
    }

    /**
     * Emit the `'close'` event.
     *
     * @private
     */
    emitClose() {
      if (!this._socket) {
        this._readyState = WebSocket$4.CLOSED;
        this.emit('close', this._closeCode, this._closeMessage);
        return;
      }

      if (this._extensions[PerMessageDeflate$1.extensionName]) {
        this._extensions[PerMessageDeflate$1.extensionName].cleanup();
      }

      this._receiver.removeAllListeners();
      this._readyState = WebSocket$4.CLOSED;
      this.emit('close', this._closeCode, this._closeMessage);
    }

    /**
     * Start a closing handshake.
     *
     *          +----------+   +-----------+   +----------+
     *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
     *    |     +----------+   +-----------+   +----------+     |
     *          +----------+   +-----------+         |
     * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
     *          +----------+   +-----------+   |
     *    |           |                        |   +---+        |
     *                +------------------------+-->|fin| - - - -
     *    |         +---+                      |   +---+
     *     - - - - -|fin|<---------------------+
     *              +---+
     *
     * @param {Number} [code] Status code explaining why the connection is closing
     * @param {(String|Buffer)} [data] The reason why the connection is
     *     closing
     * @public
     */
    close(code, data) {
      if (this.readyState === WebSocket$4.CLOSED) return;
      if (this.readyState === WebSocket$4.CONNECTING) {
        const msg = 'WebSocket was closed before the connection was established';
        return abortHandshake$1(this, this._req, msg);
      }

      if (this.readyState === WebSocket$4.CLOSING) {
        if (
          this._closeFrameSent &&
          (this._closeFrameReceived || this._receiver._writableState.errorEmitted)
        ) {
          this._socket.end();
        }

        return;
      }

      this._readyState = WebSocket$4.CLOSING;
      this._sender.close(code, data, !this._isServer, (err) => {
        //
        // This error is handled by the `'error'` listener on the socket. We only
        // want to know if the close frame has been sent here.
        //
        if (err) return;

        this._closeFrameSent = true;

        if (
          this._closeFrameReceived ||
          this._receiver._writableState.errorEmitted
        ) {
          this._socket.end();
        }
      });

      //
      // Specify a timeout for the closing handshake to complete.
      //
      this._closeTimer = setTimeout(
        this._socket.destroy.bind(this._socket),
        closeTimeout
      );
    }

    /**
     * Pause the socket.
     *
     * @public
     */
    pause() {
      if (
        this.readyState === WebSocket$4.CONNECTING ||
        this.readyState === WebSocket$4.CLOSED
      ) {
        return;
      }

      this._paused = true;
      this._socket.pause();
    }

    /**
     * Send a ping.
     *
     * @param {*} [data] The data to send
     * @param {Boolean} [mask] Indicates whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when the ping is sent
     * @public
     */
    ping(data, mask, cb) {
      if (this.readyState === WebSocket$4.CONNECTING) {
        throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
      }

      if (typeof data === 'function') {
        cb = data;
        data = mask = undefined;
      } else if (typeof mask === 'function') {
        cb = mask;
        mask = undefined;
      }

      if (typeof data === 'number') data = data.toString();

      if (this.readyState !== WebSocket$4.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }

      if (mask === undefined) mask = !this._isServer;
      this._sender.ping(data || EMPTY_BUFFER, mask, cb);
    }

    /**
     * Send a pong.
     *
     * @param {*} [data] The data to send
     * @param {Boolean} [mask] Indicates whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when the pong is sent
     * @public
     */
    pong(data, mask, cb) {
      if (this.readyState === WebSocket$4.CONNECTING) {
        throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
      }

      if (typeof data === 'function') {
        cb = data;
        data = mask = undefined;
      } else if (typeof mask === 'function') {
        cb = mask;
        mask = undefined;
      }

      if (typeof data === 'number') data = data.toString();

      if (this.readyState !== WebSocket$4.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }

      if (mask === undefined) mask = !this._isServer;
      this._sender.pong(data || EMPTY_BUFFER, mask, cb);
    }

    /**
     * Resume the socket.
     *
     * @public
     */
    resume() {
      if (
        this.readyState === WebSocket$4.CONNECTING ||
        this.readyState === WebSocket$4.CLOSED
      ) {
        return;
      }

      this._paused = false;
      if (!this._receiver._writableState.needDrain) this._socket.resume();
    }

    /**
     * Send a data message.
     *
     * @param {*} data The message to send
     * @param {Object} [options] Options object
     * @param {Boolean} [options.binary] Specifies whether `data` is binary or
     *     text
     * @param {Boolean} [options.compress] Specifies whether or not to compress
     *     `data`
     * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
     *     last one
     * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
     * @param {Function} [cb] Callback which is executed when data is written out
     * @public
     */
    send(data, options, cb) {
      if (this.readyState === WebSocket$4.CONNECTING) {
        throw new Error('WebSocket is not open: readyState 0 (CONNECTING)');
      }

      if (typeof options === 'function') {
        cb = options;
        options = {};
      }

      if (typeof data === 'number') data = data.toString();

      if (this.readyState !== WebSocket$4.OPEN) {
        sendAfterClose(this, data, cb);
        return;
      }

      const opts = {
        binary: typeof data !== 'string',
        mask: !this._isServer,
        compress: true,
        fin: true,
        ...options
      };

      if (!this._extensions[PerMessageDeflate$1.extensionName]) {
        opts.compress = false;
      }

      this._sender.send(data || EMPTY_BUFFER, opts, cb);
    }

    /**
     * Forcibly close the connection.
     *
     * @public
     */
    terminate() {
      if (this.readyState === WebSocket$4.CLOSED) return;
      if (this.readyState === WebSocket$4.CONNECTING) {
        const msg = 'WebSocket was closed before the connection was established';
        return abortHandshake$1(this, this._req, msg);
      }

      if (this._socket) {
        this._readyState = WebSocket$4.CLOSING;
        this._socket.destroy();
      }
    }
  }

  /**
   * @constant {Number} CONNECTING
   * @memberof WebSocket
   */
  Object.defineProperty(WebSocket$4, 'CONNECTING', {
    enumerable: true,
    value: readyStates.indexOf('CONNECTING')
  });

  /**
   * @constant {Number} CONNECTING
   * @memberof WebSocket.prototype
   */
  Object.defineProperty(WebSocket$4.prototype, 'CONNECTING', {
    enumerable: true,
    value: readyStates.indexOf('CONNECTING')
  });

  /**
   * @constant {Number} OPEN
   * @memberof WebSocket
   */
  Object.defineProperty(WebSocket$4, 'OPEN', {
    enumerable: true,
    value: readyStates.indexOf('OPEN')
  });

  /**
   * @constant {Number} OPEN
   * @memberof WebSocket.prototype
   */
  Object.defineProperty(WebSocket$4.prototype, 'OPEN', {
    enumerable: true,
    value: readyStates.indexOf('OPEN')
  });

  /**
   * @constant {Number} CLOSING
   * @memberof WebSocket
   */
  Object.defineProperty(WebSocket$4, 'CLOSING', {
    enumerable: true,
    value: readyStates.indexOf('CLOSING')
  });

  /**
   * @constant {Number} CLOSING
   * @memberof WebSocket.prototype
   */
  Object.defineProperty(WebSocket$4.prototype, 'CLOSING', {
    enumerable: true,
    value: readyStates.indexOf('CLOSING')
  });

  /**
   * @constant {Number} CLOSED
   * @memberof WebSocket
   */
  Object.defineProperty(WebSocket$4, 'CLOSED', {
    enumerable: true,
    value: readyStates.indexOf('CLOSED')
  });

  /**
   * @constant {Number} CLOSED
   * @memberof WebSocket.prototype
   */
  Object.defineProperty(WebSocket$4.prototype, 'CLOSED', {
    enumerable: true,
    value: readyStates.indexOf('CLOSED')
  });

  [
    'binaryType',
    'bufferedAmount',
    'extensions',
    'isPaused',
    'protocol',
    'readyState',
    'url'
  ].forEach((property) => {
    Object.defineProperty(WebSocket$4.prototype, property, { enumerable: true });
  });

  //
  // Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
  // See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
  //
  ['open', 'error', 'close', 'message'].forEach((method) => {
    Object.defineProperty(WebSocket$4.prototype, `on${method}`, {
      enumerable: true,
      get() {
        for (const listener of this.listeners(method)) {
          if (listener[kForOnEventAttribute]) return listener[kListener];
        }

        return null;
      },
      set(handler) {
        for (const listener of this.listeners(method)) {
          if (listener[kForOnEventAttribute]) {
            this.removeListener(method, listener);
            break;
          }
        }

        if (typeof handler !== 'function') return;

        this.addEventListener(method, handler, {
          [kForOnEventAttribute]: true
        });
      }
    });
  });

  WebSocket$4.prototype.addEventListener = addEventListener;
  WebSocket$4.prototype.removeEventListener = removeEventListener;

  var websocket = WebSocket$4;

  /**
   * Initialize a WebSocket client.
   *
   * @param {WebSocket} websocket The client to initialize
   * @param {(String|URL)} address The URL to which to connect
   * @param {Array} protocols The subprotocols
   * @param {Object} [options] Connection options
   * @param {Boolean} [options.followRedirects=false] Whether or not to follow
   *     redirects
   * @param {Function} [options.generateMask] The function used to generate the
   *     masking key
   * @param {Number} [options.handshakeTimeout] Timeout in milliseconds for the
   *     handshake request
   * @param {Number} [options.maxPayload=104857600] The maximum allowed message
   *     size
   * @param {Number} [options.maxRedirects=10] The maximum number of redirects
   *     allowed
   * @param {String} [options.origin] Value of the `Origin` or
   *     `Sec-WebSocket-Origin` header
   * @param {(Boolean|Object)} [options.perMessageDeflate=true] Enable/disable
   *     permessage-deflate
   * @param {Number} [options.protocolVersion=13] Value of the
   *     `Sec-WebSocket-Version` header
   * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
   *     not to skip UTF-8 validation for text and close messages
   * @private
   */
  function initAsClient(websocket, address, protocols, options) {
    const opts = {
      protocolVersion: protocolVersions[1],
      maxPayload: 100 * 1024 * 1024,
      skipUTF8Validation: false,
      perMessageDeflate: true,
      followRedirects: false,
      maxRedirects: 10,
      ...options,
      createConnection: undefined,
      socketPath: undefined,
      hostname: undefined,
      protocol: undefined,
      timeout: undefined,
      method: 'GET',
      host: undefined,
      path: undefined,
      port: undefined
    };

    if (!protocolVersions.includes(opts.protocolVersion)) {
      throw new RangeError(
        `Unsupported protocol version: ${opts.protocolVersion} ` +
          `(supported versions: ${protocolVersions.join(', ')})`
      );
    }

    let parsedUrl;

    if (address instanceof URL$1) {
      parsedUrl = address;
      websocket._url = address.href;
    } else {
      try {
        parsedUrl = new URL$1(address);
      } catch (e) {
        throw new SyntaxError(`Invalid URL: ${address}`);
      }

      websocket._url = address;
    }

    const isSecure = parsedUrl.protocol === 'wss:';
    const isUnixSocket = parsedUrl.protocol === 'ws+unix:';
    let invalidURLMessage;

    if (parsedUrl.protocol !== 'ws:' && !isSecure && !isUnixSocket) {
      invalidURLMessage =
        'The URL\'s protocol must be one of "ws:", "wss:", or "ws+unix:"';
    } else if (isUnixSocket && !parsedUrl.pathname) {
      invalidURLMessage = "The URL's pathname is empty";
    } else if (parsedUrl.hash) {
      invalidURLMessage = 'The URL contains a fragment identifier';
    }

    if (invalidURLMessage) {
      const err = new SyntaxError(invalidURLMessage);

      if (websocket._redirects === 0) {
        throw err;
      } else {
        emitErrorAndClose(websocket, err);
        return;
      }
    }

    const defaultPort = isSecure ? 443 : 80;
    const key = randomBytes$1(16).toString('base64');
    const request = isSecure ? https$1.request : http$2.request;
    const protocolSet = new Set();
    let perMessageDeflate;

    opts.createConnection = isSecure ? tlsConnect : netConnect;
    opts.defaultPort = opts.defaultPort || defaultPort;
    opts.port = parsedUrl.port || defaultPort;
    opts.host = parsedUrl.hostname.startsWith('[')
      ? parsedUrl.hostname.slice(1, -1)
      : parsedUrl.hostname;
    opts.headers = {
      'Sec-WebSocket-Version': opts.protocolVersion,
      'Sec-WebSocket-Key': key,
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      ...opts.headers
    };
    opts.path = parsedUrl.pathname + parsedUrl.search;
    opts.timeout = opts.handshakeTimeout;

    if (opts.perMessageDeflate) {
      perMessageDeflate = new PerMessageDeflate$1(
        opts.perMessageDeflate !== true ? opts.perMessageDeflate : {},
        false,
        opts.maxPayload
      );
      opts.headers['Sec-WebSocket-Extensions'] = format({
        [PerMessageDeflate$1.extensionName]: perMessageDeflate.offer()
      });
    }
    if (protocols.length) {
      for (const protocol of protocols) {
        if (
          typeof protocol !== 'string' ||
          !subprotocolRegex.test(protocol) ||
          protocolSet.has(protocol)
        ) {
          throw new SyntaxError(
            'An invalid or duplicated subprotocol was specified'
          );
        }

        protocolSet.add(protocol);
      }

      opts.headers['Sec-WebSocket-Protocol'] = protocols.join(',');
    }
    if (opts.origin) {
      if (opts.protocolVersion < 13) {
        opts.headers['Sec-WebSocket-Origin'] = opts.origin;
      } else {
        opts.headers.Origin = opts.origin;
      }
    }
    if (parsedUrl.username || parsedUrl.password) {
      opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
    }

    if (isUnixSocket) {
      const parts = opts.path.split(':');

      opts.socketPath = parts[0];
      opts.path = parts[1];
    }

    let req;

    if (opts.followRedirects) {
      if (websocket._redirects === 0) {
        websocket._originalSecure = isSecure;
        websocket._originalHost = parsedUrl.host;

        const headers = options && options.headers;

        //
        // Shallow copy the user provided options so that headers can be changed
        // without mutating the original object.
        //
        options = { ...options, headers: {} };

        if (headers) {
          for (const [key, value] of Object.entries(headers)) {
            options.headers[key.toLowerCase()] = value;
          }
        }
      } else if (websocket.listenerCount('redirect') === 0) {
        const isSameHost = parsedUrl.host === websocket._originalHost;

        if (!isSameHost || (websocket._originalSecure && !isSecure)) {
          //
          // Match curl 7.77.0 behavior and drop the following headers. These
          // headers are also dropped when following a redirect to a subdomain.
          //
          delete opts.headers.authorization;
          delete opts.headers.cookie;

          if (!isSameHost) delete opts.headers.host;

          opts.auth = undefined;
        }
      }

      //
      // Match curl 7.77.0 behavior and make the first `Authorization` header win.
      // If the `Authorization` header is set, then there is nothing to do as it
      // will take precedence.
      //
      if (opts.auth && !options.headers.authorization) {
        options.headers.authorization =
          'Basic ' + Buffer$1.from(opts.auth).toString('base64');
      }

      req = websocket._req = request(opts);

      if (websocket._redirects) {
        //
        // Unlike what is done for the `'upgrade'` event, no early exit is
        // triggered here if the user calls `websocket.close()` or
        // `websocket.terminate()` from a listener of the `'redirect'` event. This
        // is because the user can also call `request.destroy()` with an error
        // before calling `websocket.close()` or `websocket.terminate()` and this
        // would result in an error being emitted on the `request` object with no
        // `'error'` event listeners attached.
        //
        websocket.emit('redirect', websocket.url, req);
      }
    } else {
      req = websocket._req = request(opts);
    }

    if (opts.timeout) {
      req.on('timeout', () => {
        abortHandshake$1(websocket, req, 'Opening handshake has timed out');
      });
    }

    req.on('error', (err) => {
      if (req === null || req[kAborted]) return;

      req = websocket._req = null;
      emitErrorAndClose(websocket, err);
    });

    req.on('response', (res) => {
      const location = res.headers.location;
      const statusCode = res.statusCode;

      if (
        location &&
        opts.followRedirects &&
        statusCode >= 300 &&
        statusCode < 400
      ) {
        if (++websocket._redirects > opts.maxRedirects) {
          abortHandshake$1(websocket, req, 'Maximum redirects exceeded');
          return;
        }

        req.abort();

        let addr;

        try {
          addr = new URL$1(location, address);
        } catch (e) {
          const err = new SyntaxError(`Invalid URL: ${location}`);
          emitErrorAndClose(websocket, err);
          return;
        }

        initAsClient(websocket, addr, protocols, options);
      } else if (!websocket.emit('unexpected-response', req, res)) {
        abortHandshake$1(
          websocket,
          req,
          `Unexpected server response: ${res.statusCode}`
        );
      }
    });

    req.on('upgrade', (res, socket, head) => {
      websocket.emit('upgrade', res);

      //
      // The user may have closed the connection from a listener of the
      // `'upgrade'` event.
      //
      if (websocket.readyState !== WebSocket$4.CONNECTING) return;

      req = websocket._req = null;

      if (res.headers.upgrade.toLowerCase() !== 'websocket') {
        abortHandshake$1(websocket, socket, 'Invalid Upgrade header');
        return;
      }

      const digest = createHash$1('sha1')
        .update(key + GUID$1)
        .digest('base64');

      if (res.headers['sec-websocket-accept'] !== digest) {
        abortHandshake$1(websocket, socket, 'Invalid Sec-WebSocket-Accept header');
        return;
      }

      const serverProt = res.headers['sec-websocket-protocol'];
      let protError;

      if (serverProt !== undefined) {
        if (!protocolSet.size) {
          protError = 'Server sent a subprotocol but none was requested';
        } else if (!protocolSet.has(serverProt)) {
          protError = 'Server sent an invalid subprotocol';
        }
      } else if (protocolSet.size) {
        protError = 'Server sent no subprotocol';
      }

      if (protError) {
        abortHandshake$1(websocket, socket, protError);
        return;
      }

      if (serverProt) websocket._protocol = serverProt;

      const secWebSocketExtensions = res.headers['sec-websocket-extensions'];

      if (secWebSocketExtensions !== undefined) {
        if (!perMessageDeflate) {
          const message =
            'Server sent a Sec-WebSocket-Extensions header but no extension ' +
            'was requested';
          abortHandshake$1(websocket, socket, message);
          return;
        }

        let extensions;

        try {
          extensions = parse$1(secWebSocketExtensions);
        } catch (err) {
          const message = 'Invalid Sec-WebSocket-Extensions header';
          abortHandshake$1(websocket, socket, message);
          return;
        }

        const extensionNames = Object.keys(extensions);

        if (
          extensionNames.length !== 1 ||
          extensionNames[0] !== PerMessageDeflate$1.extensionName
        ) {
          const message = 'Server indicated an extension that was not requested';
          abortHandshake$1(websocket, socket, message);
          return;
        }

        try {
          perMessageDeflate.accept(extensions[PerMessageDeflate$1.extensionName]);
        } catch (err) {
          const message = 'Invalid Sec-WebSocket-Extensions header';
          abortHandshake$1(websocket, socket, message);
          return;
        }

        websocket._extensions[PerMessageDeflate$1.extensionName] =
          perMessageDeflate;
      }

      websocket.setSocket(socket, head, {
        generateMask: opts.generateMask,
        maxPayload: opts.maxPayload,
        skipUTF8Validation: opts.skipUTF8Validation
      });
    });

    req.end();
  }

  /**
   * Emit the `'error'` and `'close'` events.
   *
   * @param {WebSocket} websocket The WebSocket instance
   * @param {Error} The error to emit
   * @private
   */
  function emitErrorAndClose(websocket, err) {
    websocket._readyState = WebSocket$4.CLOSING;
    websocket.emit('error', err);
    websocket.emitClose();
  }

  /**
   * Create a `net.Socket` and initiate a connection.
   *
   * @param {Object} options Connection options
   * @return {net.Socket} The newly created socket used to start the connection
   * @private
   */
  function netConnect(options) {
    options.path = options.socketPath;
    return net.connect(options);
  }

  /**
   * Create a `tls.TLSSocket` and initiate a connection.
   *
   * @param {Object} options Connection options
   * @return {tls.TLSSocket} The newly created socket used to start the connection
   * @private
   */
  function tlsConnect(options) {
    options.path = undefined;

    if (!options.servername && options.servername !== '') {
      options.servername = net.isIP(options.host) ? '' : options.host;
    }

    return tls.connect(options);
  }

  /**
   * Abort the handshake and emit an error.
   *
   * @param {WebSocket} websocket The WebSocket instance
   * @param {(http.ClientRequest|net.Socket|tls.Socket)} stream The request to
   *     abort or the socket to destroy
   * @param {String} message The error message
   * @private
   */
  function abortHandshake$1(websocket, stream, message) {
    websocket._readyState = WebSocket$4.CLOSING;

    const err = new Error(message);
    Error.captureStackTrace(err, abortHandshake$1);

    if (stream.setHeader) {
      stream[kAborted] = true;
      stream.abort();

      if (stream.socket && !stream.socket.destroyed) {
        //
        // On Node.js >= 14.3.0 `request.abort()` does not destroy the socket if
        // called after the request completed. See
        // https://github.com/websockets/ws/issues/1869.
        //
        stream.socket.destroy();
      }

      nextTick(emitErrorAndClose, websocket, err);
    } else {
      stream.destroy(err);
      stream.once('error', websocket.emit.bind(websocket, 'error'));
      stream.once('close', websocket.emitClose.bind(websocket));
    }
  }

  /**
   * Handle cases where the `ping()`, `pong()`, or `send()` methods are called
   * when the `readyState` attribute is `CLOSING` or `CLOSED`.
   *
   * @param {WebSocket} websocket The WebSocket instance
   * @param {*} [data] The data to send
   * @param {Function} [cb] Callback
   * @private
   */
  function sendAfterClose(websocket, data, cb) {
    if (data) {
      const length = toBuffer(data).length;

      //
      // The `_bufferedAmount` property is used only when the peer is a client and
      // the opening handshake fails. Under these circumstances, in fact, the
      // `setSocket()` method is not called, so the `_socket` and `_sender`
      // properties are set to `null`.
      //
      if (websocket._socket) websocket._sender._bufferedBytes += length;
      else websocket._bufferedAmount += length;
    }

    if (cb) {
      const err = new Error(
        `WebSocket is not open: readyState ${websocket.readyState} ` +
          `(${readyStates[websocket.readyState]})`
      );
      cb(err);
    }
  }

  /**
   * The listener of the `Receiver` `'conclude'` event.
   *
   * @param {Number} code The status code
   * @param {Buffer} reason The reason for closing
   * @private
   */
  function receiverOnConclude(code, reason) {
    const websocket = this[kWebSocket$1];

    websocket._closeFrameReceived = true;
    websocket._closeMessage = reason;
    websocket._closeCode = code;

    if (websocket._socket[kWebSocket$1] === undefined) return;

    websocket._socket.removeListener('data', socketOnData);
    nextTick(resume, websocket._socket);

    if (code === 1005) websocket.close();
    else websocket.close(code, reason);
  }

  /**
   * The listener of the `Receiver` `'drain'` event.
   *
   * @private
   */
  function receiverOnDrain() {
    const websocket = this[kWebSocket$1];

    if (!websocket.isPaused) websocket._socket.resume();
  }

  /**
   * The listener of the `Receiver` `'error'` event.
   *
   * @param {(RangeError|Error)} err The emitted error
   * @private
   */
  function receiverOnError(err) {
    const websocket = this[kWebSocket$1];

    if (websocket._socket[kWebSocket$1] !== undefined) {
      websocket._socket.removeListener('data', socketOnData);

      //
      // On Node.js < 14.0.0 the `'error'` event is emitted synchronously. See
      // https://github.com/websockets/ws/issues/1940.
      //
      nextTick(resume, websocket._socket);

      websocket.close(err[kStatusCode]);
    }

    websocket.emit('error', err);
  }

  /**
   * The listener of the `Receiver` `'finish'` event.
   *
   * @private
   */
  function receiverOnFinish() {
    this[kWebSocket$1].emitClose();
  }

  /**
   * The listener of the `Receiver` `'message'` event.
   *
   * @param {Buffer|ArrayBuffer|Buffer[])} data The message
   * @param {Boolean} isBinary Specifies whether the message is binary or not
   * @private
   */
  function receiverOnMessage(data, isBinary) {
    this[kWebSocket$1].emit('message', data, isBinary);
  }

  /**
   * The listener of the `Receiver` `'ping'` event.
   *
   * @param {Buffer} data The data included in the ping frame
   * @private
   */
  function receiverOnPing(data) {
    const websocket = this[kWebSocket$1];

    websocket.pong(data, !websocket._isServer, NOOP);
    websocket.emit('ping', data);
  }

  /**
   * The listener of the `Receiver` `'pong'` event.
   *
   * @param {Buffer} data The data included in the pong frame
   * @private
   */
  function receiverOnPong(data) {
    this[kWebSocket$1].emit('pong', data);
  }

  /**
   * Resume a readable stream
   *
   * @param {Readable} stream The readable stream
   * @private
   */
  function resume(stream) {
    stream.resume();
  }

  /**
   * The listener of the `net.Socket` `'close'` event.
   *
   * @private
   */
  function socketOnClose() {
    const websocket = this[kWebSocket$1];

    this.removeListener('close', socketOnClose);
    this.removeListener('data', socketOnData);
    this.removeListener('end', socketOnEnd);

    websocket._readyState = WebSocket$4.CLOSING;

    let chunk;

    //
    // The close frame might not have been received or the `'end'` event emitted,
    // for example, if the socket was destroyed due to an error. Ensure that the
    // `receiver` stream is closed after writing any remaining buffered data to
    // it. If the readable side of the socket is in flowing mode then there is no
    // buffered data as everything has been already written and `readable.read()`
    // will return `null`. If instead, the socket is paused, any possible buffered
    // data will be read as a single chunk.
    //
    if (
      !this._readableState.endEmitted &&
      !websocket._closeFrameReceived &&
      !websocket._receiver._writableState.errorEmitted &&
      (chunk = websocket._socket.read()) !== null
    ) {
      websocket._receiver.write(chunk);
    }

    websocket._receiver.end();

    this[kWebSocket$1] = undefined;

    clearTimeout(websocket._closeTimer);

    if (
      websocket._receiver._writableState.finished ||
      websocket._receiver._writableState.errorEmitted
    ) {
      websocket.emitClose();
    } else {
      websocket._receiver.on('error', receiverOnFinish);
      websocket._receiver.on('finish', receiverOnFinish);
    }
  }

  /**
   * The listener of the `net.Socket` `'data'` event.
   *
   * @param {Buffer} chunk A chunk of data
   * @private
   */
  function socketOnData(chunk) {
    if (!this[kWebSocket$1]._receiver.write(chunk)) {
      this.pause();
    }
  }

  /**
   * The listener of the `net.Socket` `'end'` event.
   *
   * @private
   */
  function socketOnEnd() {
    const websocket = this[kWebSocket$1];

    websocket._readyState = WebSocket$4.CLOSING;
    websocket._receiver.end();
    this.end();
  }

  /**
   * The listener of the `net.Socket` `'error'` event.
   *
   * @private
   */
  function socketOnError$1() {
    const websocket = this[kWebSocket$1];

    this.removeListener('error', socketOnError$1);
    this.on('error', NOOP);

    if (websocket) {
      websocket._readyState = WebSocket$4.CLOSING;
      this.destroy();
    }
  }

  const { Duplex } = require$$0$2;

  /**
   * Emits the `'close'` event on a stream.
   *
   * @param {Duplex} stream The stream.
   * @private
   */
  function emitClose$1(stream) {
    stream.emit('close');
  }

  /**
   * The listener of the `'end'` event.
   *
   * @private
   */
  function duplexOnEnd() {
    if (!this.destroyed && this._writableState.finished) {
      this.destroy();
    }
  }

  /**
   * The listener of the `'error'` event.
   *
   * @param {Error} err The error
   * @private
   */
  function duplexOnError(err) {
    this.removeListener('error', duplexOnError);
    this.destroy();
    if (this.listenerCount('error') === 0) {
      // Do not suppress the throwing behavior.
      this.emit('error', err);
    }
  }

  /**
   * Wraps a `WebSocket` in a duplex stream.
   *
   * @param {WebSocket} ws The `WebSocket` to wrap
   * @param {Object} [options] The options for the `Duplex` constructor
   * @return {Duplex} The duplex stream
   * @public
   */
  function createWebSocketStream(ws, options) {
    let terminateOnDestroy = true;

    const duplex = new Duplex({
      ...options,
      autoDestroy: false,
      emitClose: false,
      objectMode: false,
      writableObjectMode: false
    });

    ws.on('message', function message(msg, isBinary) {
      const data =
        !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;

      if (!duplex.push(data)) ws.pause();
    });

    ws.once('error', function error(err) {
      if (duplex.destroyed) return;

      // Prevent `ws.terminate()` from being called by `duplex._destroy()`.
      //
      // - If the `'error'` event is emitted before the `'open'` event, then
      //   `ws.terminate()` is a noop as no socket is assigned.
      // - Otherwise, the error is re-emitted by the listener of the `'error'`
      //   event of the `Receiver` object. The listener already closes the
      //   connection by calling `ws.close()`. This allows a close frame to be
      //   sent to the other peer. If `ws.terminate()` is called right after this,
      //   then the close frame might not be sent.
      terminateOnDestroy = false;
      duplex.destroy(err);
    });

    ws.once('close', function close() {
      if (duplex.destroyed) return;

      duplex.push(null);
    });

    duplex._destroy = function (err, callback) {
      if (ws.readyState === ws.CLOSED) {
        callback(err);
        nextTick(emitClose$1, duplex);
        return;
      }

      let called = false;

      ws.once('error', function error(err) {
        called = true;
        callback(err);
      });

      ws.once('close', function close() {
        if (!called) callback(err);
        nextTick(emitClose$1, duplex);
      });

      if (terminateOnDestroy) ws.terminate();
    };

    duplex._final = function (callback) {
      if (ws.readyState === ws.CONNECTING) {
        ws.once('open', function open() {
          duplex._final(callback);
        });
        return;
      }

      // If the value of the `_socket` property is `null` it means that `ws` is a
      // client websocket and the handshake failed. In fact, when this happens, a
      // socket is never assigned to the websocket. Wait for the `'error'` event
      // that will be emitted by the websocket.
      if (ws._socket === null) return;

      if (ws._socket._writableState.finished) {
        callback();
        if (duplex._readableState.endEmitted) duplex.destroy();
      } else {
        ws._socket.once('finish', function finish() {
          // `duplex` is not destroyed here because the `'end'` event will be
          // emitted on `duplex` after this `'finish'` event. The EOF signaling
          // `null` chunk is, in fact, pushed when the websocket emits `'close'`.
          callback();
        });
        ws.close();
      }
    };

    duplex._read = function () {
      if (ws.isPaused) ws.resume();
    };

    duplex._write = function (chunk, encoding, callback) {
      if (ws.readyState === ws.CONNECTING) {
        ws.once('open', function open() {
          duplex._write(chunk, encoding, callback);
        });
        return;
      }

      ws.send(chunk, callback);
    };

    duplex.on('end', duplexOnEnd);
    duplex.on('error', duplexOnError);
    return duplex;
  }

  var stream = createWebSocketStream;

  const { tokenChars } = validation.exports;

  /**
   * Parses the `Sec-WebSocket-Protocol` header into a set of subprotocol names.
   *
   * @param {String} header The field value of the header
   * @return {Set} The subprotocol names
   * @public
   */
  function parse(header) {
    const protocols = new Set();
    let start = -1;
    let end = -1;
    let i = 0;

    for (i; i < header.length; i++) {
      const code = header.charCodeAt(i);

      if (end === -1 && tokenChars[code] === 1) {
        if (start === -1) start = i;
      } else if (
        i !== 0 &&
        (code === 0x20 /* ' ' */ || code === 0x09) /* '\t' */
      ) {
        if (end === -1 && start !== -1) end = i;
      } else if (code === 0x2c /* ',' */) {
        if (start === -1) {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }

        if (end === -1) end = i;

        const protocol = header.slice(start, end);

        if (protocols.has(protocol)) {
          throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
        }

        protocols.add(protocol);
        start = end = -1;
      } else {
        throw new SyntaxError(`Unexpected character at index ${i}`);
      }
    }

    if (start === -1 || end !== -1) {
      throw new SyntaxError('Unexpected end of input');
    }

    const protocol = header.slice(start, i);

    if (protocols.has(protocol)) {
      throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
    }

    protocols.add(protocol);
    return protocols;
  }

  var subprotocol$1 = { parse };

  const EventEmitter = events;
  const http$1 = require$$4;
  const { createHash } = require$$2;

  const extension = extension$1;
  const PerMessageDeflate = permessageDeflate;
  const subprotocol = subprotocol$1;
  const WebSocket$3 = websocket;
  const { GUID, kWebSocket } = constants;

  const keyRegex = /^[+/0-9A-Za-z]{22}==$/;

  const RUNNING = 0;
  const CLOSING = 1;
  const CLOSED = 2;

  /**
   * Class representing a WebSocket server.
   *
   * @extends EventEmitter
   */
  class WebSocketServer extends EventEmitter {
    /**
     * Create a `WebSocketServer` instance.
     *
     * @param {Object} options Configuration options
     * @param {Number} [options.backlog=511] The maximum length of the queue of
     *     pending connections
     * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
     *     track clients
     * @param {Function} [options.handleProtocols] A hook to handle protocols
     * @param {String} [options.host] The hostname where to bind the server
     * @param {Number} [options.maxPayload=104857600] The maximum allowed message
     *     size
     * @param {Boolean} [options.noServer=false] Enable no server mode
     * @param {String} [options.path] Accept only connections matching this path
     * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
     *     permessage-deflate
     * @param {Number} [options.port] The port where to bind the server
     * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
     *     server to use
     * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
     *     not to skip UTF-8 validation for text and close messages
     * @param {Function} [options.verifyClient] A hook to reject connections
     * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
     *     class to use. It must be the `WebSocket` class or class that extends it
     * @param {Function} [callback] A listener for the `listening` event
     */
    constructor(options, callback) {
      super();

      options = {
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: false,
        handleProtocols: null,
        clientTracking: true,
        verifyClient: null,
        noServer: false,
        backlog: null, // use default (511 as implemented in net.js)
        server: null,
        host: null,
        path: null,
        port: null,
        WebSocket: WebSocket$3,
        ...options
      };

      if (
        (options.port == null && !options.server && !options.noServer) ||
        (options.port != null && (options.server || options.noServer)) ||
        (options.server && options.noServer)
      ) {
        throw new TypeError(
          'One and only one of the "port", "server", or "noServer" options ' +
            'must be specified'
        );
      }

      if (options.port != null) {
        this._server = http$1.createServer((req, res) => {
          const body = http$1.STATUS_CODES[426];

          res.writeHead(426, {
            'Content-Length': body.length,
            'Content-Type': 'text/plain'
          });
          res.end(body);
        });
        this._server.listen(
          options.port,
          options.host,
          options.backlog,
          callback
        );
      } else if (options.server) {
        this._server = options.server;
      }

      if (this._server) {
        const emitConnection = this.emit.bind(this, 'connection');

        this._removeListeners = addListeners(this._server, {
          listening: this.emit.bind(this, 'listening'),
          error: this.emit.bind(this, 'error'),
          upgrade: (req, socket, head) => {
            this.handleUpgrade(req, socket, head, emitConnection);
          }
        });
      }

      if (options.perMessageDeflate === true) options.perMessageDeflate = {};
      if (options.clientTracking) {
        this.clients = new Set();
        this._shouldEmitClose = false;
      }

      this.options = options;
      this._state = RUNNING;
    }

    /**
     * Returns the bound address, the address family name, and port of the server
     * as reported by the operating system if listening on an IP socket.
     * If the server is listening on a pipe or UNIX domain socket, the name is
     * returned as a string.
     *
     * @return {(Object|String|null)} The address of the server
     * @public
     */
    address() {
      if (this.options.noServer) {
        throw new Error('The server is operating in "noServer" mode');
      }

      if (!this._server) return null;
      return this._server.address();
    }

    /**
     * Stop the server from accepting new connections and emit the `'close'` event
     * when all existing connections are closed.
     *
     * @param {Function} [cb] A one-time listener for the `'close'` event
     * @public
     */
    close(cb) {
      if (this._state === CLOSED) {
        if (cb) {
          this.once('close', () => {
            cb(new Error('The server is not running'));
          });
        }

        nextTick(emitClose, this);
        return;
      }

      if (cb) this.once('close', cb);

      if (this._state === CLOSING) return;
      this._state = CLOSING;

      if (this.options.noServer || this.options.server) {
        if (this._server) {
          this._removeListeners();
          this._removeListeners = this._server = null;
        }

        if (this.clients) {
          if (!this.clients.size) {
            nextTick(emitClose, this);
          } else {
            this._shouldEmitClose = true;
          }
        } else {
          nextTick(emitClose, this);
        }
      } else {
        const server = this._server;

        this._removeListeners();
        this._removeListeners = this._server = null;

        //
        // The HTTP/S server was created internally. Close it, and rely on its
        // `'close'` event.
        //
        server.close(() => {
          emitClose(this);
        });
      }
    }

    /**
     * See if a given request should be handled by this server instance.
     *
     * @param {http.IncomingMessage} req Request object to inspect
     * @return {Boolean} `true` if the request is valid, else `false`
     * @public
     */
    shouldHandle(req) {
      if (this.options.path) {
        const index = req.url.indexOf('?');
        const pathname = index !== -1 ? req.url.slice(0, index) : req.url;

        if (pathname !== this.options.path) return false;
      }

      return true;
    }

    /**
     * Handle a HTTP Upgrade request.
     *
     * @param {http.IncomingMessage} req The request object
     * @param {(net.Socket|tls.Socket)} socket The network socket between the
     *     server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Function} cb Callback
     * @public
     */
    handleUpgrade(req, socket, head, cb) {
      socket.on('error', socketOnError);

      const key = req.headers['sec-websocket-key'];
      const version = +req.headers['sec-websocket-version'];

      if (req.method !== 'GET') {
        const message = 'Invalid HTTP method';
        abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
        return;
      }

      if (req.headers.upgrade.toLowerCase() !== 'websocket') {
        const message = 'Invalid Upgrade header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }

      if (!key || !keyRegex.test(key)) {
        const message = 'Missing or invalid Sec-WebSocket-Key header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }

      if (version !== 8 && version !== 13) {
        const message = 'Missing or invalid Sec-WebSocket-Version header';
        abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
        return;
      }

      if (!this.shouldHandle(req)) {
        abortHandshake(socket, 400);
        return;
      }

      const secWebSocketProtocol = req.headers['sec-websocket-protocol'];
      let protocols = new Set();

      if (secWebSocketProtocol !== undefined) {
        try {
          protocols = subprotocol.parse(secWebSocketProtocol);
        } catch (err) {
          const message = 'Invalid Sec-WebSocket-Protocol header';
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
      }

      const secWebSocketExtensions = req.headers['sec-websocket-extensions'];
      const extensions = {};

      if (
        this.options.perMessageDeflate &&
        secWebSocketExtensions !== undefined
      ) {
        const perMessageDeflate = new PerMessageDeflate(
          this.options.perMessageDeflate,
          true,
          this.options.maxPayload
        );

        try {
          const offers = extension.parse(secWebSocketExtensions);

          if (offers[PerMessageDeflate.extensionName]) {
            perMessageDeflate.accept(offers[PerMessageDeflate.extensionName]);
            extensions[PerMessageDeflate.extensionName] = perMessageDeflate;
          }
        } catch (err) {
          const message =
            'Invalid or unacceptable Sec-WebSocket-Extensions header';
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
      }

      //
      // Optionally call external client verification handler.
      //
      if (this.options.verifyClient) {
        const info = {
          origin:
            req.headers[`${version === 8 ? 'sec-websocket-origin' : 'origin'}`],
          secure: !!(req.socket.authorized || req.socket.encrypted),
          req
        };

        if (this.options.verifyClient.length === 2) {
          this.options.verifyClient(info, (verified, code, message, headers) => {
            if (!verified) {
              return abortHandshake(socket, code || 401, message, headers);
            }

            this.completeUpgrade(
              extensions,
              key,
              protocols,
              req,
              socket,
              head,
              cb
            );
          });
          return;
        }

        if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
      }

      this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
    }

    /**
     * Upgrade the connection to WebSocket.
     *
     * @param {Object} extensions The accepted extensions
     * @param {String} key The value of the `Sec-WebSocket-Key` header
     * @param {Set} protocols The subprotocols
     * @param {http.IncomingMessage} req The request object
     * @param {(net.Socket|tls.Socket)} socket The network socket between the
     *     server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @param {Function} cb Callback
     * @throws {Error} If called more than once with the same socket
     * @private
     */
    completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
      //
      // Destroy the socket if the client has already sent a FIN packet.
      //
      if (!socket.readable || !socket.writable) return socket.destroy();

      if (socket[kWebSocket]) {
        throw new Error(
          'server.handleUpgrade() was called more than once with the same ' +
            'socket, possibly due to a misconfiguration'
        );
      }

      if (this._state > RUNNING) return abortHandshake(socket, 503);

      const digest = createHash('sha1')
        .update(key + GUID)
        .digest('base64');

      const headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${digest}`
      ];

      const ws = new this.options.WebSocket(null);

      if (protocols.size) {
        //
        // Optionally call external protocol selection handler.
        //
        const protocol = this.options.handleProtocols
          ? this.options.handleProtocols(protocols, req)
          : protocols.values().next().value;

        if (protocol) {
          headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
          ws._protocol = protocol;
        }
      }

      if (extensions[PerMessageDeflate.extensionName]) {
        const params = extensions[PerMessageDeflate.extensionName].params;
        const value = extension.format({
          [PerMessageDeflate.extensionName]: [params]
        });
        headers.push(`Sec-WebSocket-Extensions: ${value}`);
        ws._extensions = extensions;
      }

      //
      // Allow external modification/inspection of handshake headers.
      //
      this.emit('headers', headers, req);

      socket.write(headers.concat('\r\n').join('\r\n'));
      socket.removeListener('error', socketOnError);

      ws.setSocket(socket, head, {
        maxPayload: this.options.maxPayload,
        skipUTF8Validation: this.options.skipUTF8Validation
      });

      if (this.clients) {
        this.clients.add(ws);
        ws.on('close', () => {
          this.clients.delete(ws);

          if (this._shouldEmitClose && !this.clients.size) {
            nextTick(emitClose, this);
          }
        });
      }

      cb(ws, req);
    }
  }

  var websocketServer = WebSocketServer;

  /**
   * Add event listeners on an `EventEmitter` using a map of <event, listener>
   * pairs.
   *
   * @param {EventEmitter} server The event emitter
   * @param {Object.<String, Function>} map The listeners to add
   * @return {Function} A function that will remove the added listeners when
   *     called
   * @private
   */
  function addListeners(server, map) {
    for (const event of Object.keys(map)) server.on(event, map[event]);

    return function removeListeners() {
      for (const event of Object.keys(map)) {
        server.removeListener(event, map[event]);
      }
    };
  }

  /**
   * Emit a `'close'` event on an `EventEmitter`.
   *
   * @param {EventEmitter} server The event emitter
   * @private
   */
  function emitClose(server) {
    server._state = CLOSED;
    server.emit('close');
  }

  /**
   * Handle socket errors.
   *
   * @private
   */
  function socketOnError() {
    this.destroy();
  }

  /**
   * Close the connection when preconditions are not fulfilled.
   *
   * @param {(net.Socket|tls.Socket)} socket The socket of the upgrade request
   * @param {Number} code The HTTP response status code
   * @param {String} [message] The HTTP response body
   * @param {Object} [headers] Additional HTTP response headers
   * @private
   */
  function abortHandshake(socket, code, message, headers) {
    //
    // The socket is writable unless the user destroyed or ended it before calling
    // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
    // error. Handling this does not make much sense as the worst that can happen
    // is that some of the data written by the user might be discarded due to the
    // call to `socket.end()` below, which triggers an `'error'` event that in
    // turn causes the socket to be destroyed.
    //
    message = message || http$1.STATUS_CODES[code];
    headers = {
      Connection: 'close',
      'Content-Type': 'text/html',
      'Content-Length': Buffer$1.byteLength(message),
      ...headers
    };

    socket.once('finish', socket.destroy);

    socket.end(
      `HTTP/1.1 ${code} ${http$1.STATUS_CODES[code]}\r\n` +
        Object.keys(headers)
          .map((h) => `${h}: ${headers[h]}`)
          .join('\r\n') +
        '\r\n\r\n' +
        message
    );
  }

  /**
   * Emit a `'wsClientError'` event on a `WebSocketServer` if there is at least
   * one listener for it, otherwise call `abortHandshake()`.
   *
   * @param {WebSocketServer} server The WebSocket server
   * @param {http.IncomingMessage} req The request object
   * @param {(net.Socket|tls.Socket)} socket The socket of the upgrade request
   * @param {Number} code The HTTP response status code
   * @param {String} message The HTTP response body
   * @private
   */
  function abortHandshakeOrEmitwsClientError(server, req, socket, code, message) {
    if (server.listenerCount('wsClientError')) {
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);

      server.emit('wsClientError', err, socket, req);
    } else {
      abortHandshake(socket, code, message);
    }
  }

  const WebSocket$2 = websocket;

  WebSocket$2.createWebSocketStream = stream;
  WebSocket$2.Server = websocketServer;
  WebSocket$2.Receiver = receiver;
  WebSocket$2.Sender = sender;

  WebSocket$2.WebSocket = WebSocket$2;
  WebSocket$2.WebSocketServer = WebSocket$2.Server;

  var ws$1 = WebSocket$2;

  var __createBinding$1 = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  }) : (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      o[k2] = m[k];
  }));
  var __setModuleDefault$1 = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
  }) : function(o, v) {
      o["default"] = v;
  });
  var __importStar$1 = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding$1(result, mod, k);
      __setModuleDefault$1(result, mod);
      return result;
  };
  Object.defineProperty(WSClient$1, "__esModule", { value: true });
  WSClient$1.WSClient = void 0;
  const Client_1 = Client$1;
  const ws = __importStar$1(ws$1);
  let isBrowser;
  let WebSocketClass = null;
  // @ts-ignore
  if (typeof WebSocket !== "undefined") {
      isBrowser = true;
      // @ts-ignore
      WebSocketClass = WebSocket;
      // @ts-ignore
  }
  else if (typeof MozWebSocket !== "undefined") {
      isBrowser = true;
      // @ts-ignore
      WebSocketClass = MozWebSocket;
      // @ts-ignore
  }
  else if (typeof window !== "undefined") {
      isBrowser = true;
      // @ts-ignore
      WebSocketClass = window.WebSocket || window.MozWebSocket;
  }
  else {
      isBrowser = false;
      // @ts-ignore
      WebSocketClass = ws.WebSocket;
  }
  /**
   * WebSocket client implementation.
   */
  class WSClient extends Client_1.Client {
      constructor(clientOptions, socket) {
          super(clientOptions);
          this.error = (error) => {
              this.socketError(Buffer$1.from(error.message));
          };
          this.socket = socket;
          if (this.socket) {
              this.socketHook();
          }
      }
      /**
       * Specifies how the socket gets initialized and created, then establishes a connection.
       */
      socketConnect() {
          if (this.socket) {
              throw "Socket already created.";
          }
          if (!this.clientOptions) {
              throw "clientOptions is required to create socket.";
          }
          const host = this.clientOptions.host ? this.clientOptions.host : "localhost";
          const USE_TLS = this.clientOptions.secure ? true : false;
          let address;
          if (USE_TLS) {
              address = `wss://${host}:${this.clientOptions.port}`;
          }
          else {
              address = `ws://${host}:${this.clientOptions.port}`;
          }
          if (isBrowser) {
              this.socket = new WebSocketClass(address);
              // Make sure binary type is set to ArrayBuffer instead of Blob
              if (this.socket) {
                  this.socket.binaryType = "arraybuffer";
              }
          }
          else {
              this.socket = new WebSocketClass(address, {
                  cert: this.clientOptions.cert,
                  key: this.clientOptions.key,
                  rejectUnauthorized: this.clientOptions.rejectUnauthorized,
                  ca: this.clientOptions.ca,
                  perMessageDeflate: false,
                  maxPayload: 100 * 1024 * 1024,
              });
          }
          if (this.socket) {
              this.socket.onopen = this.socketConnected;
          }
          else {
              throw "Could not create socket.";
          }
      }
      /**
       * Specifies hooks to be called as part of the connect procedure.
       */
      socketHook() {
          if (!this.socket) {
              return;
          }
          this.socket.onmessage = (msg) => {
              let data = msg.data;
              // Under Browser settings, convert message data from ArrayBuffer to Buffer.
              if (isBrowser) {
                  const bytes = new Uint8Array(data);
                  data = Buffer$1.from(bytes);
              }
              this.socketData(data);
          };
          this.socket.onerror = this.error; // Error connecting
          this.socket.onclose = (closeEvent) => this.socketClosed(closeEvent && closeEvent.code === 1000); // Socket closed
      }
      /**
       * Defines how data gets written to the socket.
       * @param {Buffer} buffer - data to be sent
       */
      socketSend(buffer) {
          if (this.socket) {
              this.socket.send(buffer, { binary: true, compress: false });
          }
      }
      /**
       * Defines the steps to be performed during close.
       */
      socketClose() {
          if (this.socket) {
              this.socket.close();
          }
      }
  }
  WSClient$1.WSClient = WSClient;

  var WSServer$1 = {};

  var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  }) : (function(o, m, k, k2) {
      if (k2 === undefined) k2 = k;
      o[k2] = m[k];
  }));
  var __setModuleDefault = (commonjsGlobal && commonjsGlobal.__setModuleDefault) || (Object.create ? (function(o, v) {
      Object.defineProperty(o, "default", { enumerable: true, value: v });
  }) : function(o, v) {
      o["default"] = v;
  });
  var __importStar = (commonjsGlobal && commonjsGlobal.__importStar) || function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
      __setModuleDefault(result, mod);
      return result;
  };
  Object.defineProperty(WSServer$1, "__esModule", { value: true });
  WSServer$1.WSServer = void 0;
  const Server_1 = Server$1;
  const WSClient_1 = WSClient$1;
  const WebSocket$1 = __importStar(ws$1);
  const http = __importStar(require$$4);
  const https = __importStar(require$$4);
  /**
   * WebSocket server implementation.
   */
  class WSServer extends Server_1.Server {
      constructor(serverOptions) {
          super(serverOptions);
          this.clientConnected = (socket) => {
              const client = new WSClient_1.WSClient({ bufferData: this.serverOptions.bufferData, port: this.serverOptions.port }, socket);
              this.addClient(client);
          };
          this.error = (error) => {
              this.serverError(Buffer$1.from(error.message));
          };
          this.serverCreate();
      }
      /**
       * Specifies how the server gets initialized, then creates the server with the specified options.
       */
      serverCreate() {
          const USE_TLS = this.serverOptions.cert != null;
          if (USE_TLS) {
              const tlsOptions = {
                  cert: this.serverOptions.cert,
                  key: this.serverOptions.key,
                  requestCert: this.serverOptions.requestCert,
                  rejectUnauthorized: this.serverOptions.rejectUnauthorized,
                  ca: this.serverOptions.ca,
                  handshakeTimeout: 30000,
              };
              this.server = https.createServer(tlsOptions);
              if (this.server) {
                  this.server.on("tlsClientError", this.error);
              }
          }
          else {
              this.server = http.createServer();
          }
      }
      /**
       * Starts a previously created server listening for connections.
       * Assumes the server is instantiated during object creation.
       */
      serverListen() {
          var _a;
          this.wsServer = new WebSocket$1.Server({
              path: "/",
              server: this.server,
              clientTracking: true,
              perMessageDeflate: false,
              maxPayload: 100 * 1024 * 1024,
          });
          this.wsServer.on("connection", this.clientConnected);
          this.wsServer.on("error", this.error);
          this.wsServer.on("close", this.serverClosed);
          (_a = this.server) === null || _a === void 0 ? void 0 : _a.listen({
              host: this.serverOptions.host,
              port: this.serverOptions.port,
              ipv6Only: this.serverOptions.ipv6Only,
          });
      }
      /**
       * Overrides server close procedure.
       */
      serverClose() {
          if (this.wsServer) {
              this.wsServer.close();
          }
          if (this.server) {
              this.server.close();
          }
      }
  }
  WSServer$1.WSServer = WSServer;

  var ByteSize$1 = {};

  Object.defineProperty(ByteSize$1, "__esModule", { value: true });
  ByteSize$1.ByteSize = void 0;
  class ByteSize {
      constructor(client) {
          this.onClose = () => {
              if (this.reject) {
                  const reject = this.reject;
                  this.end();
                  reject("Socket closed");
              }
          };
          this.onData = (buf) => {
              var _a;
              if (this.ended) {
                  return;
              }
              this.data = Buffer$1.concat([this.data, buf]);
              if (!this.resolve) {
                  return;
              }
              const nrBytes = (_a = this.nrBytes) !== null && _a !== void 0 ? _a : 0;
              if (this.data.length >= nrBytes) {
                  const bite = this.data.slice(0, nrBytes);
                  this.data = this.data.slice(nrBytes);
                  const resolve = this.resolve;
                  this.end();
                  resolve(bite);
              }
          };
          this.client = client;
          this.data = Buffer$1.alloc(0);
          this.client.onData(this.onData);
          this.client.onClose(this.onClose);
          this.ended = false;
      }
      async read(nrBytes, timeout = 3000) {
          if (this.ended || this.timeoutId) {
              throw "Cannot reuse a ByteSize";
          }
          this.nrBytes = nrBytes;
          if (timeout) {
              this.timeoutId = setTimeout(() => {
                  delete this.timeoutId;
                  if (this.reject) {
                      const reject = this.reject;
                      this.end();
                      reject("Timeout");
                  }
              }, timeout);
          }
          return new Promise((resolve, reject) => {
              this.resolve = resolve;
              this.reject = reject;
              this.onData(Buffer$1.alloc(0));
          });
      }
      end() {
          if (this.ended) {
              return;
          }
          this.ended = true;
          if (this.timeoutId) {
              clearTimeout(this.timeoutId);
          }
          this.client.offData(this.onData);
          this.client.offClose(this.onClose);
          delete this.reject;
          delete this.resolve;
          this.client.unRead(this.data);
      }
  }
  ByteSize$1.ByteSize = ByteSize;

  (function (exports) {
  	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  	}) : (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    o[k2] = m[k];
  	}));
  	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
  	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
  	};
  	Object.defineProperty(exports, "__esModule", { value: true });
  	__exportStar(TCPClient$1, exports);
  	__exportStar(TCPServer$1, exports);
  	__exportStar(VirtualClient$1, exports);
  	__exportStar(WSClient$1, exports);
  	__exportStar(WSServer$1, exports);
  	__exportStar(Client$1, exports);
  	__exportStar(Server$1, exports);
  	__exportStar(ByteSize$1, exports);
  } (build$1));

  var build = {};

  var src = {};

  var Messaging$1 = {};

  var eventemitter3 = {exports: {}};

  (function (module) {

  	var has = Object.prototype.hasOwnProperty
  	  , prefix = '~';

  	/**
  	 * Constructor to create a storage for our `EE` objects.
  	 * An `Events` instance is a plain object whose properties are event names.
  	 *
  	 * @constructor
  	 * @private
  	 */
  	function Events() {}

  	//
  	// We try to not inherit from `Object.prototype`. In some engines creating an
  	// instance in this way is faster than calling `Object.create(null)` directly.
  	// If `Object.create(null)` is not supported we prefix the event names with a
  	// character to make sure that the built-in object properties are not
  	// overridden or used as an attack vector.
  	//
  	if (Object.create) {
  	  Events.prototype = Object.create(null);

  	  //
  	  // This hack is needed because the `__proto__` property is still inherited in
  	  // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
  	  //
  	  if (!new Events().__proto__) prefix = false;
  	}

  	/**
  	 * Representation of a single event listener.
  	 *
  	 * @param {Function} fn The listener function.
  	 * @param {*} context The context to invoke the listener with.
  	 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
  	 * @constructor
  	 * @private
  	 */
  	function EE(fn, context, once) {
  	  this.fn = fn;
  	  this.context = context;
  	  this.once = once || false;
  	}

  	/**
  	 * Add a listener for a given event.
  	 *
  	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
  	 * @param {(String|Symbol)} event The event name.
  	 * @param {Function} fn The listener function.
  	 * @param {*} context The context to invoke the listener with.
  	 * @param {Boolean} once Specify if the listener is a one-time listener.
  	 * @returns {EventEmitter}
  	 * @private
  	 */
  	function addListener(emitter, event, fn, context, once) {
  	  if (typeof fn !== 'function') {
  	    throw new TypeError('The listener must be a function');
  	  }

  	  var listener = new EE(fn, context || emitter, once)
  	    , evt = prefix ? prefix + event : event;

  	  if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
  	  else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
  	  else emitter._events[evt] = [emitter._events[evt], listener];

  	  return emitter;
  	}

  	/**
  	 * Clear event by name.
  	 *
  	 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
  	 * @param {(String|Symbol)} evt The Event name.
  	 * @private
  	 */
  	function clearEvent(emitter, evt) {
  	  if (--emitter._eventsCount === 0) emitter._events = new Events();
  	  else delete emitter._events[evt];
  	}

  	/**
  	 * Minimal `EventEmitter` interface that is molded against the Node.js
  	 * `EventEmitter` interface.
  	 *
  	 * @constructor
  	 * @public
  	 */
  	function EventEmitter() {
  	  this._events = new Events();
  	  this._eventsCount = 0;
  	}

  	/**
  	 * Return an array listing the events for which the emitter has registered
  	 * listeners.
  	 *
  	 * @returns {Array}
  	 * @public
  	 */
  	EventEmitter.prototype.eventNames = function eventNames() {
  	  var names = []
  	    , events
  	    , name;

  	  if (this._eventsCount === 0) return names;

  	  for (name in (events = this._events)) {
  	    if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
  	  }

  	  if (Object.getOwnPropertySymbols) {
  	    return names.concat(Object.getOwnPropertySymbols(events));
  	  }

  	  return names;
  	};

  	/**
  	 * Return the listeners registered for a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @returns {Array} The registered listeners.
  	 * @public
  	 */
  	EventEmitter.prototype.listeners = function listeners(event) {
  	  var evt = prefix ? prefix + event : event
  	    , handlers = this._events[evt];

  	  if (!handlers) return [];
  	  if (handlers.fn) return [handlers.fn];

  	  for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) {
  	    ee[i] = handlers[i].fn;
  	  }

  	  return ee;
  	};

  	/**
  	 * Return the number of listeners listening to a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @returns {Number} The number of listeners.
  	 * @public
  	 */
  	EventEmitter.prototype.listenerCount = function listenerCount(event) {
  	  var evt = prefix ? prefix + event : event
  	    , listeners = this._events[evt];

  	  if (!listeners) return 0;
  	  if (listeners.fn) return 1;
  	  return listeners.length;
  	};

  	/**
  	 * Calls each of the listeners registered for a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @returns {Boolean} `true` if the event had listeners, else `false`.
  	 * @public
  	 */
  	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
  	  var evt = prefix ? prefix + event : event;

  	  if (!this._events[evt]) return false;

  	  var listeners = this._events[evt]
  	    , len = arguments.length
  	    , args
  	    , i;

  	  if (listeners.fn) {
  	    if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);

  	    switch (len) {
  	      case 1: return listeners.fn.call(listeners.context), true;
  	      case 2: return listeners.fn.call(listeners.context, a1), true;
  	      case 3: return listeners.fn.call(listeners.context, a1, a2), true;
  	      case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
  	      case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
  	      case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
  	    }

  	    for (i = 1, args = new Array(len -1); i < len; i++) {
  	      args[i - 1] = arguments[i];
  	    }

  	    listeners.fn.apply(listeners.context, args);
  	  } else {
  	    var length = listeners.length
  	      , j;

  	    for (i = 0; i < length; i++) {
  	      if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);

  	      switch (len) {
  	        case 1: listeners[i].fn.call(listeners[i].context); break;
  	        case 2: listeners[i].fn.call(listeners[i].context, a1); break;
  	        case 3: listeners[i].fn.call(listeners[i].context, a1, a2); break;
  	        case 4: listeners[i].fn.call(listeners[i].context, a1, a2, a3); break;
  	        default:
  	          if (!args) for (j = 1, args = new Array(len -1); j < len; j++) {
  	            args[j - 1] = arguments[j];
  	          }

  	          listeners[i].fn.apply(listeners[i].context, args);
  	      }
  	    }
  	  }

  	  return true;
  	};

  	/**
  	 * Add a listener for a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @param {Function} fn The listener function.
  	 * @param {*} [context=this] The context to invoke the listener with.
  	 * @returns {EventEmitter} `this`.
  	 * @public
  	 */
  	EventEmitter.prototype.on = function on(event, fn, context) {
  	  return addListener(this, event, fn, context, false);
  	};

  	/**
  	 * Add a one-time listener for a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @param {Function} fn The listener function.
  	 * @param {*} [context=this] The context to invoke the listener with.
  	 * @returns {EventEmitter} `this`.
  	 * @public
  	 */
  	EventEmitter.prototype.once = function once(event, fn, context) {
  	  return addListener(this, event, fn, context, true);
  	};

  	/**
  	 * Remove the listeners of a given event.
  	 *
  	 * @param {(String|Symbol)} event The event name.
  	 * @param {Function} fn Only remove the listeners that match this function.
  	 * @param {*} context Only remove the listeners that have this context.
  	 * @param {Boolean} once Only remove one-time listeners.
  	 * @returns {EventEmitter} `this`.
  	 * @public
  	 */
  	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
  	  var evt = prefix ? prefix + event : event;

  	  if (!this._events[evt]) return this;
  	  if (!fn) {
  	    clearEvent(this, evt);
  	    return this;
  	  }

  	  var listeners = this._events[evt];

  	  if (listeners.fn) {
  	    if (
  	      listeners.fn === fn &&
  	      (!once || listeners.once) &&
  	      (!context || listeners.context === context)
  	    ) {
  	      clearEvent(this, evt);
  	    }
  	  } else {
  	    for (var i = 0, events = [], length = listeners.length; i < length; i++) {
  	      if (
  	        listeners[i].fn !== fn ||
  	        (once && !listeners[i].once) ||
  	        (context && listeners[i].context !== context)
  	      ) {
  	        events.push(listeners[i]);
  	      }
  	    }

  	    //
  	    // Reset the array, or remove it completely if we have no more listeners.
  	    //
  	    if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
  	    else clearEvent(this, evt);
  	  }

  	  return this;
  	};

  	/**
  	 * Remove all listeners, or those of the specified event.
  	 *
  	 * @param {(String|Symbol)} [event] The event name.
  	 * @returns {EventEmitter} `this`.
  	 * @public
  	 */
  	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
  	  var evt;

  	  if (event) {
  	    evt = prefix ? prefix + event : event;
  	    if (this._events[evt]) clearEvent(this, evt);
  	  } else {
  	    this._events = new Events();
  	    this._eventsCount = 0;
  	  }

  	  return this;
  	};

  	//
  	// Alias methods names because people roll like that.
  	//
  	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
  	EventEmitter.prototype.addListener = EventEmitter.prototype.on;

  	//
  	// Expose the prefix.
  	//
  	EventEmitter.prefixed = prefix;

  	//
  	// Allow `EventEmitter` to be imported as module namespace.
  	//
  	EventEmitter.EventEmitter = EventEmitter;

  	//
  	// Expose the module.
  	//
  	{
  	  module.exports = EventEmitter;
  	}
  } (eventemitter3));

  var Crypto = {};

  var libsodiumWrappers = {};

  var __dirname = '/home/ryan/work/roanext/lib/node_modules/libsodium/dist/modules';

  var libsodium = {exports: {}};

  // Copyright Joyent, Inc. and other Node contributors.
  //
  // Permission is hereby granted, free of charge, to any person obtaining a
  // copy of this software and associated documentation files (the
  // "Software"), to deal in the Software without restriction, including
  // without limitation the rights to use, copy, modify, merge, publish,
  // distribute, sublicense, and/or sell copies of the Software, and to permit
  // persons to whom the Software is furnished to do so, subject to the
  // following conditions:
  //
  // The above copyright notice and this permission notice shall be included
  // in all copies or substantial portions of the Software.
  //
  // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
  // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
  // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
  // USE OR OTHER DEALINGS IN THE SOFTWARE.

  // resolves . and .. elements in a path array with directory names there
  // must be no slashes, empty elements, or device names (c:\) in the array
  // (so also no leading and trailing slashes - it does not distinguish
  // relative and absolute paths)
  function normalizeArray(parts, allowAboveRoot) {
    // if the path tries to go above the root, `up` ends up > 0
    var up = 0;
    for (var i = parts.length - 1; i >= 0; i--) {
      var last = parts[i];
      if (last === '.') {
        parts.splice(i, 1);
      } else if (last === '..') {
        parts.splice(i, 1);
        up++;
      } else if (up) {
        parts.splice(i, 1);
        up--;
      }
    }

    // if the path is allowed to go above the root, restore leading ..s
    if (allowAboveRoot) {
      for (; up--; up) {
        parts.unshift('..');
      }
    }

    return parts;
  }

  // Split a filename into [root, dir, basename, ext], unix version
  // 'root' is just a slash, or nothing.
  var splitPathRe =
      /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
  var splitPath = function(filename) {
    return splitPathRe.exec(filename).slice(1);
  };

  // path.resolve([from ...], to)
  // posix version
  function resolve() {
    var resolvedPath = '',
        resolvedAbsolute = false;

    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      var path = (i >= 0) ? arguments[i] : '/';

      // Skip empty and invalid entries
      if (typeof path !== 'string') {
        throw new TypeError('Arguments to path.resolve must be strings');
      } else if (!path) {
        continue;
      }

      resolvedPath = path + '/' + resolvedPath;
      resolvedAbsolute = path.charAt(0) === '/';
    }

    // At this point the path should be resolved to a full absolute path, but
    // handle relative paths to be safe (might happen when process.cwd() fails)

    // Normalize the path
    resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
      return !!p;
    }), !resolvedAbsolute).join('/');

    return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
  }
  // path.normalize(path)
  // posix version
  function normalize(path) {
    var isPathAbsolute = isAbsolute(path),
        trailingSlash = substr(path, -1) === '/';

    // Normalize the path
    path = normalizeArray(filter(path.split('/'), function(p) {
      return !!p;
    }), !isPathAbsolute).join('/');

    if (!path && !isPathAbsolute) {
      path = '.';
    }
    if (path && trailingSlash) {
      path += '/';
    }

    return (isPathAbsolute ? '/' : '') + path;
  }
  // posix version
  function isAbsolute(path) {
    return path.charAt(0) === '/';
  }

  // posix version
  function join() {
    var paths = Array.prototype.slice.call(arguments, 0);
    return normalize(filter(paths, function(p, index) {
      if (typeof p !== 'string') {
        throw new TypeError('Arguments to path.join must be strings');
      }
      return p;
    }).join('/'));
  }


  // path.relative(from, to)
  // posix version
  function relative(from, to) {
    from = resolve(from).substr(1);
    to = resolve(to).substr(1);

    function trim(arr) {
      var start = 0;
      for (; start < arr.length; start++) {
        if (arr[start] !== '') break;
      }

      var end = arr.length - 1;
      for (; end >= 0; end--) {
        if (arr[end] !== '') break;
      }

      if (start > end) return [];
      return arr.slice(start, end - start + 1);
    }

    var fromParts = trim(from.split('/'));
    var toParts = trim(to.split('/'));

    var length = Math.min(fromParts.length, toParts.length);
    var samePartsLength = length;
    for (var i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    var outputParts = [];
    for (var i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push('..');
    }

    outputParts = outputParts.concat(toParts.slice(samePartsLength));

    return outputParts.join('/');
  }

  var sep = '/';
  var delimiter = ':';

  function dirname(path) {
    var result = splitPath(path),
        root = result[0],
        dir = result[1];

    if (!root && !dir) {
      // No dirname whatsoever
      return '.';
    }

    if (dir) {
      // It has a dirname, strip trailing slash
      dir = dir.substr(0, dir.length - 1);
    }

    return root + dir;
  }

  function basename(path, ext) {
    var f = splitPath(path)[2];
    // TODO: make this comparison case-insensitive on windows?
    if (ext && f.substr(-1 * ext.length) === ext) {
      f = f.substr(0, f.length - ext.length);
    }
    return f;
  }


  function extname(path) {
    return splitPath(path)[3];
  }
  var path = {
    extname: extname,
    basename: basename,
    dirname: dirname,
    sep: sep,
    delimiter: delimiter,
    relative: relative,
    join: join,
    isAbsolute: isAbsolute,
    normalize: normalize,
    resolve: resolve
  };
  function filter (xs, f) {
      if (xs.filter) return xs.filter(f);
      var res = [];
      for (var i = 0; i < xs.length; i++) {
          if (f(xs[i], i, xs)) res.push(xs[i]);
      }
      return res;
  }

  // String.prototype.substr - negative index don't work in IE8
  var substr = 'ab'.substr(-1) === 'b' ?
      function (str, start, len) { return str.substr(start, len) } :
      function (str, start, len) {
          if (start < 0) start = str.length + start;
          return str.substr(start, len);
      }
  ;

  var path$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    resolve: resolve,
    normalize: normalize,
    isAbsolute: isAbsolute,
    join: join,
    relative: relative,
    sep: sep,
    delimiter: delimiter,
    dirname: dirname,
    basename: basename,
    extname: extname,
    'default': path
  });

  var require$$0 = /*@__PURE__*/getAugmentedNamespace(path$1);

  var hasRequiredLibsodium;

  function requireLibsodium () {
  	if (hasRequiredLibsodium) return libsodium.exports;
  	hasRequiredLibsodium = 1;
  	(function (module, exports) {
  } (libsodium, libsodium.exports));
  	return libsodium.exports;
  }

  (function (exports) {
  	!function(e){function r(e,r){var t,a=r.ready.then((function(){function a(){if(0!==t._sodium_init())throw new Error("libsodium was not correctly initialized.");for(var r=["crypto_aead_chacha20poly1305_decrypt","crypto_aead_chacha20poly1305_decrypt_detached","crypto_aead_chacha20poly1305_encrypt","crypto_aead_chacha20poly1305_encrypt_detached","crypto_aead_chacha20poly1305_ietf_decrypt","crypto_aead_chacha20poly1305_ietf_decrypt_detached","crypto_aead_chacha20poly1305_ietf_encrypt","crypto_aead_chacha20poly1305_ietf_encrypt_detached","crypto_aead_chacha20poly1305_ietf_keygen","crypto_aead_chacha20poly1305_keygen","crypto_aead_xchacha20poly1305_ietf_decrypt","crypto_aead_xchacha20poly1305_ietf_decrypt_detached","crypto_aead_xchacha20poly1305_ietf_encrypt","crypto_aead_xchacha20poly1305_ietf_encrypt_detached","crypto_aead_xchacha20poly1305_ietf_keygen","crypto_auth","crypto_auth_hmacsha256","crypto_auth_hmacsha256_final","crypto_auth_hmacsha256_init","crypto_auth_hmacsha256_keygen","crypto_auth_hmacsha256_update","crypto_auth_hmacsha256_verify","crypto_auth_hmacsha512","crypto_auth_hmacsha512_final","crypto_auth_hmacsha512_init","crypto_auth_hmacsha512_keygen","crypto_auth_hmacsha512_update","crypto_auth_hmacsha512_verify","crypto_auth_keygen","crypto_auth_verify","crypto_box_beforenm","crypto_box_curve25519xchacha20poly1305_keypair","crypto_box_curve25519xchacha20poly1305_seal","crypto_box_curve25519xchacha20poly1305_seal_open","crypto_box_detached","crypto_box_easy","crypto_box_easy_afternm","crypto_box_keypair","crypto_box_open_detached","crypto_box_open_easy","crypto_box_open_easy_afternm","crypto_box_seal","crypto_box_seal_open","crypto_box_seed_keypair","crypto_core_ed25519_add","crypto_core_ed25519_from_hash","crypto_core_ed25519_from_uniform","crypto_core_ed25519_is_valid_point","crypto_core_ed25519_random","crypto_core_ed25519_scalar_add","crypto_core_ed25519_scalar_complement","crypto_core_ed25519_scalar_invert","crypto_core_ed25519_scalar_mul","crypto_core_ed25519_scalar_negate","crypto_core_ed25519_scalar_random","crypto_core_ed25519_scalar_reduce","crypto_core_ed25519_scalar_sub","crypto_core_ed25519_sub","crypto_core_hchacha20","crypto_core_hsalsa20","crypto_core_ristretto255_add","crypto_core_ristretto255_from_hash","crypto_core_ristretto255_is_valid_point","crypto_core_ristretto255_random","crypto_core_ristretto255_scalar_add","crypto_core_ristretto255_scalar_complement","crypto_core_ristretto255_scalar_invert","crypto_core_ristretto255_scalar_mul","crypto_core_ristretto255_scalar_negate","crypto_core_ristretto255_scalar_random","crypto_core_ristretto255_scalar_reduce","crypto_core_ristretto255_scalar_sub","crypto_core_ristretto255_sub","crypto_generichash","crypto_generichash_blake2b_salt_personal","crypto_generichash_final","crypto_generichash_init","crypto_generichash_keygen","crypto_generichash_update","crypto_hash","crypto_hash_sha256","crypto_hash_sha256_final","crypto_hash_sha256_init","crypto_hash_sha256_update","crypto_hash_sha512","crypto_hash_sha512_final","crypto_hash_sha512_init","crypto_hash_sha512_update","crypto_kdf_derive_from_key","crypto_kdf_keygen","crypto_kx_client_session_keys","crypto_kx_keypair","crypto_kx_seed_keypair","crypto_kx_server_session_keys","crypto_onetimeauth","crypto_onetimeauth_final","crypto_onetimeauth_init","crypto_onetimeauth_keygen","crypto_onetimeauth_update","crypto_onetimeauth_verify","crypto_pwhash","crypto_pwhash_scryptsalsa208sha256","crypto_pwhash_scryptsalsa208sha256_ll","crypto_pwhash_scryptsalsa208sha256_str","crypto_pwhash_scryptsalsa208sha256_str_verify","crypto_pwhash_str","crypto_pwhash_str_needs_rehash","crypto_pwhash_str_verify","crypto_scalarmult","crypto_scalarmult_base","crypto_scalarmult_ed25519","crypto_scalarmult_ed25519_base","crypto_scalarmult_ed25519_base_noclamp","crypto_scalarmult_ed25519_noclamp","crypto_scalarmult_ristretto255","crypto_scalarmult_ristretto255_base","crypto_secretbox_detached","crypto_secretbox_easy","crypto_secretbox_keygen","crypto_secretbox_open_detached","crypto_secretbox_open_easy","crypto_secretstream_xchacha20poly1305_init_pull","crypto_secretstream_xchacha20poly1305_init_push","crypto_secretstream_xchacha20poly1305_keygen","crypto_secretstream_xchacha20poly1305_pull","crypto_secretstream_xchacha20poly1305_push","crypto_secretstream_xchacha20poly1305_rekey","crypto_shorthash","crypto_shorthash_keygen","crypto_shorthash_siphashx24","crypto_sign","crypto_sign_detached","crypto_sign_ed25519_pk_to_curve25519","crypto_sign_ed25519_sk_to_curve25519","crypto_sign_ed25519_sk_to_pk","crypto_sign_ed25519_sk_to_seed","crypto_sign_final_create","crypto_sign_final_verify","crypto_sign_init","crypto_sign_keypair","crypto_sign_open","crypto_sign_seed_keypair","crypto_sign_update","crypto_sign_verify_detached","crypto_stream_chacha20","crypto_stream_chacha20_ietf_xor","crypto_stream_chacha20_ietf_xor_ic","crypto_stream_chacha20_keygen","crypto_stream_chacha20_xor","crypto_stream_chacha20_xor_ic","crypto_stream_keygen","crypto_stream_xchacha20_keygen","crypto_stream_xchacha20_xor","crypto_stream_xchacha20_xor_ic","randombytes_buf","randombytes_buf_deterministic","randombytes_close","randombytes_random","randombytes_set_implementation","randombytes_stir","randombytes_uniform","sodium_version_string"],a=[E,x,k,S,T,w,Y,B,A,K,M,I,N,L,U,O,C,R,P,G,X,D,F,V,H,q,j,z,W,J,Q,Z,$,ee,re,te,ae,_e,se,ne,ce,oe,he,pe,ye,ie,le,ue,de,ve,ge,be,fe,me,Ee,xe,ke,Se,Te,we,Ye,Be,Ae,Ke,Me,Ie,Ne,Le,Ue,Oe,Ce,Re,Pe,Ge,Xe,De,Fe,Ve,He,qe,je,ze,We,Je,Qe,Ze,$e,er,rr,tr,ar,_r,sr,nr,cr,or,hr,pr,yr,ir,lr,ur,dr,vr,gr,br,fr,mr,Er,xr,kr,Sr,Tr,wr,Yr,Br,Ar,Kr,Mr,Ir,Nr,Lr,Ur,Or,Cr,Rr,Pr,Gr,Xr,Dr,Fr,Vr,Hr,qr,jr,zr,Wr,Jr,Qr,Zr,$r,et,rt,tt,at,_t,st,nt,ct,ot,ht,pt,yt,it,lt,ut,dt,vt,gt,bt,ft,mt],_=0;_<a.length;_++)"function"==typeof t["_"+r[_]]&&(e[r[_]]=a[_]);var s=["SODIUM_LIBRARY_VERSION_MAJOR","SODIUM_LIBRARY_VERSION_MINOR","crypto_aead_chacha20poly1305_ABYTES","crypto_aead_chacha20poly1305_IETF_ABYTES","crypto_aead_chacha20poly1305_IETF_KEYBYTES","crypto_aead_chacha20poly1305_IETF_MESSAGEBYTES_MAX","crypto_aead_chacha20poly1305_IETF_NPUBBYTES","crypto_aead_chacha20poly1305_IETF_NSECBYTES","crypto_aead_chacha20poly1305_KEYBYTES","crypto_aead_chacha20poly1305_MESSAGEBYTES_MAX","crypto_aead_chacha20poly1305_NPUBBYTES","crypto_aead_chacha20poly1305_NSECBYTES","crypto_aead_chacha20poly1305_ietf_ABYTES","crypto_aead_chacha20poly1305_ietf_KEYBYTES","crypto_aead_chacha20poly1305_ietf_MESSAGEBYTES_MAX","crypto_aead_chacha20poly1305_ietf_NPUBBYTES","crypto_aead_chacha20poly1305_ietf_NSECBYTES","crypto_aead_xchacha20poly1305_IETF_ABYTES","crypto_aead_xchacha20poly1305_IETF_KEYBYTES","crypto_aead_xchacha20poly1305_IETF_MESSAGEBYTES_MAX","crypto_aead_xchacha20poly1305_IETF_NPUBBYTES","crypto_aead_xchacha20poly1305_IETF_NSECBYTES","crypto_aead_xchacha20poly1305_ietf_ABYTES","crypto_aead_xchacha20poly1305_ietf_KEYBYTES","crypto_aead_xchacha20poly1305_ietf_MESSAGEBYTES_MAX","crypto_aead_xchacha20poly1305_ietf_NPUBBYTES","crypto_aead_xchacha20poly1305_ietf_NSECBYTES","crypto_auth_BYTES","crypto_auth_KEYBYTES","crypto_auth_hmacsha256_BYTES","crypto_auth_hmacsha256_KEYBYTES","crypto_auth_hmacsha512256_BYTES","crypto_auth_hmacsha512256_KEYBYTES","crypto_auth_hmacsha512_BYTES","crypto_auth_hmacsha512_KEYBYTES","crypto_box_BEFORENMBYTES","crypto_box_MACBYTES","crypto_box_MESSAGEBYTES_MAX","crypto_box_NONCEBYTES","crypto_box_PUBLICKEYBYTES","crypto_box_SEALBYTES","crypto_box_SECRETKEYBYTES","crypto_box_SEEDBYTES","crypto_box_curve25519xchacha20poly1305_BEFORENMBYTES","crypto_box_curve25519xchacha20poly1305_MACBYTES","crypto_box_curve25519xchacha20poly1305_MESSAGEBYTES_MAX","crypto_box_curve25519xchacha20poly1305_NONCEBYTES","crypto_box_curve25519xchacha20poly1305_PUBLICKEYBYTES","crypto_box_curve25519xchacha20poly1305_SEALBYTES","crypto_box_curve25519xchacha20poly1305_SECRETKEYBYTES","crypto_box_curve25519xchacha20poly1305_SEEDBYTES","crypto_box_curve25519xsalsa20poly1305_BEFORENMBYTES","crypto_box_curve25519xsalsa20poly1305_MACBYTES","crypto_box_curve25519xsalsa20poly1305_MESSAGEBYTES_MAX","crypto_box_curve25519xsalsa20poly1305_NONCEBYTES","crypto_box_curve25519xsalsa20poly1305_PUBLICKEYBYTES","crypto_box_curve25519xsalsa20poly1305_SECRETKEYBYTES","crypto_box_curve25519xsalsa20poly1305_SEEDBYTES","crypto_core_ed25519_BYTES","crypto_core_ed25519_HASHBYTES","crypto_core_ed25519_NONREDUCEDSCALARBYTES","crypto_core_ed25519_SCALARBYTES","crypto_core_ed25519_UNIFORMBYTES","crypto_core_hchacha20_CONSTBYTES","crypto_core_hchacha20_INPUTBYTES","crypto_core_hchacha20_KEYBYTES","crypto_core_hchacha20_OUTPUTBYTES","crypto_core_hsalsa20_CONSTBYTES","crypto_core_hsalsa20_INPUTBYTES","crypto_core_hsalsa20_KEYBYTES","crypto_core_hsalsa20_OUTPUTBYTES","crypto_core_ristretto255_BYTES","crypto_core_ristretto255_HASHBYTES","crypto_core_ristretto255_NONREDUCEDSCALARBYTES","crypto_core_ristretto255_SCALARBYTES","crypto_core_salsa2012_CONSTBYTES","crypto_core_salsa2012_INPUTBYTES","crypto_core_salsa2012_KEYBYTES","crypto_core_salsa2012_OUTPUTBYTES","crypto_core_salsa20_CONSTBYTES","crypto_core_salsa20_INPUTBYTES","crypto_core_salsa20_KEYBYTES","crypto_core_salsa20_OUTPUTBYTES","crypto_generichash_BYTES","crypto_generichash_BYTES_MAX","crypto_generichash_BYTES_MIN","crypto_generichash_KEYBYTES","crypto_generichash_KEYBYTES_MAX","crypto_generichash_KEYBYTES_MIN","crypto_generichash_blake2b_BYTES","crypto_generichash_blake2b_BYTES_MAX","crypto_generichash_blake2b_BYTES_MIN","crypto_generichash_blake2b_KEYBYTES","crypto_generichash_blake2b_KEYBYTES_MAX","crypto_generichash_blake2b_KEYBYTES_MIN","crypto_generichash_blake2b_PERSONALBYTES","crypto_generichash_blake2b_SALTBYTES","crypto_hash_BYTES","crypto_hash_sha256_BYTES","crypto_hash_sha512_BYTES","crypto_kdf_BYTES_MAX","crypto_kdf_BYTES_MIN","crypto_kdf_CONTEXTBYTES","crypto_kdf_KEYBYTES","crypto_kdf_blake2b_BYTES_MAX","crypto_kdf_blake2b_BYTES_MIN","crypto_kdf_blake2b_CONTEXTBYTES","crypto_kdf_blake2b_KEYBYTES","crypto_kx_PUBLICKEYBYTES","crypto_kx_SECRETKEYBYTES","crypto_kx_SEEDBYTES","crypto_kx_SESSIONKEYBYTES","crypto_onetimeauth_BYTES","crypto_onetimeauth_KEYBYTES","crypto_onetimeauth_poly1305_BYTES","crypto_onetimeauth_poly1305_KEYBYTES","crypto_pwhash_ALG_ARGON2I13","crypto_pwhash_ALG_ARGON2ID13","crypto_pwhash_ALG_DEFAULT","crypto_pwhash_BYTES_MAX","crypto_pwhash_BYTES_MIN","crypto_pwhash_MEMLIMIT_INTERACTIVE","crypto_pwhash_MEMLIMIT_MAX","crypto_pwhash_MEMLIMIT_MIN","crypto_pwhash_MEMLIMIT_MODERATE","crypto_pwhash_MEMLIMIT_SENSITIVE","crypto_pwhash_OPSLIMIT_INTERACTIVE","crypto_pwhash_OPSLIMIT_MAX","crypto_pwhash_OPSLIMIT_MIN","crypto_pwhash_OPSLIMIT_MODERATE","crypto_pwhash_OPSLIMIT_SENSITIVE","crypto_pwhash_PASSWD_MAX","crypto_pwhash_PASSWD_MIN","crypto_pwhash_SALTBYTES","crypto_pwhash_STRBYTES","crypto_pwhash_argon2i_BYTES_MAX","crypto_pwhash_argon2i_BYTES_MIN","crypto_pwhash_argon2i_SALTBYTES","crypto_pwhash_argon2i_STRBYTES","crypto_pwhash_argon2id_BYTES_MAX","crypto_pwhash_argon2id_BYTES_MIN","crypto_pwhash_argon2id_SALTBYTES","crypto_pwhash_argon2id_STRBYTES","crypto_pwhash_scryptsalsa208sha256_BYTES_MAX","crypto_pwhash_scryptsalsa208sha256_BYTES_MIN","crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_INTERACTIVE","crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_MAX","crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_MIN","crypto_pwhash_scryptsalsa208sha256_MEMLIMIT_SENSITIVE","crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_INTERACTIVE","crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_MAX","crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_MIN","crypto_pwhash_scryptsalsa208sha256_OPSLIMIT_SENSITIVE","crypto_pwhash_scryptsalsa208sha256_SALTBYTES","crypto_pwhash_scryptsalsa208sha256_STRBYTES","crypto_scalarmult_BYTES","crypto_scalarmult_SCALARBYTES","crypto_scalarmult_curve25519_BYTES","crypto_scalarmult_curve25519_SCALARBYTES","crypto_scalarmult_ed25519_BYTES","crypto_scalarmult_ed25519_SCALARBYTES","crypto_scalarmult_ristretto255_BYTES","crypto_scalarmult_ristretto255_SCALARBYTES","crypto_secretbox_KEYBYTES","crypto_secretbox_MACBYTES","crypto_secretbox_MESSAGEBYTES_MAX","crypto_secretbox_NONCEBYTES","crypto_secretbox_xchacha20poly1305_KEYBYTES","crypto_secretbox_xchacha20poly1305_MACBYTES","crypto_secretbox_xchacha20poly1305_MESSAGEBYTES_MAX","crypto_secretbox_xchacha20poly1305_NONCEBYTES","crypto_secretbox_xsalsa20poly1305_KEYBYTES","crypto_secretbox_xsalsa20poly1305_MACBYTES","crypto_secretbox_xsalsa20poly1305_MESSAGEBYTES_MAX","crypto_secretbox_xsalsa20poly1305_NONCEBYTES","crypto_secretstream_xchacha20poly1305_ABYTES","crypto_secretstream_xchacha20poly1305_HEADERBYTES","crypto_secretstream_xchacha20poly1305_KEYBYTES","crypto_secretstream_xchacha20poly1305_MESSAGEBYTES_MAX","crypto_secretstream_xchacha20poly1305_TAG_FINAL","crypto_secretstream_xchacha20poly1305_TAG_MESSAGE","crypto_secretstream_xchacha20poly1305_TAG_PUSH","crypto_secretstream_xchacha20poly1305_TAG_REKEY","crypto_shorthash_BYTES","crypto_shorthash_KEYBYTES","crypto_shorthash_siphash24_BYTES","crypto_shorthash_siphash24_KEYBYTES","crypto_shorthash_siphashx24_BYTES","crypto_shorthash_siphashx24_KEYBYTES","crypto_sign_BYTES","crypto_sign_MESSAGEBYTES_MAX","crypto_sign_PUBLICKEYBYTES","crypto_sign_SECRETKEYBYTES","crypto_sign_SEEDBYTES","crypto_sign_ed25519_BYTES","crypto_sign_ed25519_MESSAGEBYTES_MAX","crypto_sign_ed25519_PUBLICKEYBYTES","crypto_sign_ed25519_SECRETKEYBYTES","crypto_sign_ed25519_SEEDBYTES","crypto_stream_KEYBYTES","crypto_stream_MESSAGEBYTES_MAX","crypto_stream_NONCEBYTES","crypto_stream_chacha20_IETF_KEYBYTES","crypto_stream_chacha20_IETF_MESSAGEBYTES_MAX","crypto_stream_chacha20_IETF_NONCEBYTES","crypto_stream_chacha20_KEYBYTES","crypto_stream_chacha20_MESSAGEBYTES_MAX","crypto_stream_chacha20_NONCEBYTES","crypto_stream_chacha20_ietf_KEYBYTES","crypto_stream_chacha20_ietf_MESSAGEBYTES_MAX","crypto_stream_chacha20_ietf_NONCEBYTES","crypto_stream_salsa2012_KEYBYTES","crypto_stream_salsa2012_MESSAGEBYTES_MAX","crypto_stream_salsa2012_NONCEBYTES","crypto_stream_salsa208_KEYBYTES","crypto_stream_salsa208_MESSAGEBYTES_MAX","crypto_stream_salsa208_NONCEBYTES","crypto_stream_salsa20_KEYBYTES","crypto_stream_salsa20_MESSAGEBYTES_MAX","crypto_stream_salsa20_NONCEBYTES","crypto_stream_xchacha20_KEYBYTES","crypto_stream_xchacha20_MESSAGEBYTES_MAX","crypto_stream_xchacha20_NONCEBYTES","crypto_stream_xsalsa20_KEYBYTES","crypto_stream_xsalsa20_MESSAGEBYTES_MAX","crypto_stream_xsalsa20_NONCEBYTES","crypto_verify_16_BYTES","crypto_verify_32_BYTES","crypto_verify_64_BYTES"];for(_=0;_<s.length;_++)"function"==typeof(c=t["_"+s[_].toLowerCase()])&&(e[s[_]]=c());var n=["SODIUM_VERSION_STRING","crypto_pwhash_STRPREFIX","crypto_pwhash_scryptsalsa208sha256_STRPREFIX"];for(_=0;_<n.length;_++){var c;"function"==typeof(c=t["_"+n[_].toLowerCase()])&&(e[n[_]]=t.UTF8ToString(c()));}}t=r;try{a();var _=new Uint8Array([98,97,108,108,115]),s=e.randombytes_buf(e.crypto_secretbox_NONCEBYTES),n=e.randombytes_buf(e.crypto_secretbox_KEYBYTES),c=e.crypto_secretbox_easy(_,s,n),o=e.crypto_secretbox_open_easy(c,s,n);if(e.memcmp(_,o))return}catch(e){if(null==t.useBackupModule)throw new Error("Both wasm and asm failed to load"+e)}t.useBackupModule(),a();}));function _(e){if("function"==typeof TextEncoder)return (new TextEncoder).encode(e);e=unescape(encodeURIComponent(e));for(var r=new Uint8Array(e.length),t=0,a=e.length;t<a;t++)r[t]=e.charCodeAt(t);return r}function s(e){if("function"==typeof TextDecoder)return new TextDecoder("utf-8",{fatal:!0}).decode(e);var r=8192,t=Math.ceil(e.length/r);if(t<=1)try{return decodeURIComponent(escape(String.fromCharCode.apply(null,e)))}catch(e){throw new TypeError("The encoded data was not valid.")}for(var a="",_=0,n=0;n<t;n++){var c=Array.prototype.slice.call(e,n*r+_,(n+1)*r+_);if(0!=c.length){var o,h=c.length,p=0;do{var y=c[--h];y>=240?(p=4,o=!0):y>=224?(p=3,o=!0):y>=192?(p=2,o=!0):y<128&&(p=1,o=!0);}while(!o);for(var i=p-(c.length-h),l=0;l<i;l++)_--,c.pop();a+=s(c);}}return a}function n(e){e=m(null,e,"input");for(var r,t,a,_="",s=0;s<e.length;s++)a=87+(t=15&e[s])+(t-10>>8&-39)<<8|87+(r=e[s]>>>4)+(r-10>>8&-39),_+=String.fromCharCode(255&a)+String.fromCharCode(a>>>8);return _}var c={ORIGINAL:1,ORIGINAL_NO_PADDING:3,URLSAFE:5,URLSAFE_NO_PADDING:7};function o(e){if(null==e)return c.URLSAFE_NO_PADDING;if(e!==c.ORIGINAL&&e!==c.ORIGINAL_NO_PADDING&&e!==c.URLSAFE&&e!=c.URLSAFE_NO_PADDING)throw new Error("unsupported base64 variant");return e}function h(e,r){r=o(r),e=m(_,e,"input");var a,_=[],n=0|Math.floor(e.length/3),c=e.length-3*n,h=4*n+(0!==c?0==(2&r)?4:2+(c>>>1):0),p=new l(h+1),y=u(e);return _.push(y),_.push(p.address),0===t._sodium_bin2base64(p.address,p.length,y,e.length,r)&&g(_,"conversion failed"),p.length=h,a=s(p.to_Uint8Array()),v(_),a}function p(e,r){var t=r||"uint8array";if(!y(t))throw new Error(t+" output format is not available");if(e instanceof l){if("uint8array"===t)return e.to_Uint8Array();if("text"===t)return s(e.to_Uint8Array());if("hex"===t)return n(e.to_Uint8Array());if("base64"===t)return h(e.to_Uint8Array(),c.URLSAFE_NO_PADDING);throw new Error('What is output format "'+t+'"?')}if("object"==typeof e){for(var a=Object.keys(e),_={},o=0;o<a.length;o++)_[a[o]]=p(e[a[o]],t);return _}if("string"==typeof e)return e;throw new TypeError("Cannot format output")}function y(e){for(var r=["uint8array","text","hex","base64"],t=0;t<r.length;t++)if(r[t]===e)return !0;return !1}function i(e){if(e){if("string"!=typeof e)throw new TypeError("When defined, the output format must be a string");if(!y(e))throw new Error(e+" is not a supported output format")}}function l(e){this.length=e,this.address=d(e);}function u(e){var r=d(e.length);return t.HEAPU8.set(e,r),r}function d(e){var r=t._malloc(e);if(0===r)throw {message:"_malloc() failed",length:e};return r}function v(e){if(e)for(var r=0;r<e.length;r++)a=e[r],t._free(a);var a;}function g(e,r){throw v(e),new Error(r)}function b(e,r){throw v(e),new TypeError(r)}function f(e,r,t){null==r&&b(e,t+" cannot be null or undefined");}function m(e,r,t){return f(e,r,t),r instanceof Uint8Array?r:"string"==typeof r?_(r):void b(e,"unsupported input type for "+t)}function E(e,r,a,_,s,n){var c=[];i(n);var o=null;null!=e&&(o=u(e=m(c,e,"secret_nonce")),e.length,c.push(o)),r=m(c,r,"ciphertext");var h,y=t._crypto_aead_chacha20poly1305_abytes(),d=r.length;d<y&&b(c,"ciphertext is too short"),h=u(r),c.push(h);var f=null,E=0;null!=a&&(f=u(a=m(c,a,"additional_data")),E=a.length,c.push(f)),_=m(c,_,"public_nonce");var x,k=0|t._crypto_aead_chacha20poly1305_npubbytes();_.length!==k&&b(c,"invalid public_nonce length"),x=u(_),c.push(x),s=m(c,s,"key");var S,T=0|t._crypto_aead_chacha20poly1305_keybytes();s.length!==T&&b(c,"invalid key length"),S=u(s),c.push(S);var w=new l(d-t._crypto_aead_chacha20poly1305_abytes()|0),Y=w.address;if(c.push(Y),0===t._crypto_aead_chacha20poly1305_decrypt(Y,null,o,h,d,0,f,E,0,x,S)){var B=p(w,n);return v(c),B}g(c,"ciphertext cannot be decrypted using that key");}function x(e,r,a,_,s,n,c){var o=[];i(c);var h=null;null!=e&&(h=u(e=m(o,e,"secret_nonce")),e.length,o.push(h));var y=u(r=m(o,r,"ciphertext")),d=r.length;o.push(y),a=m(o,a,"mac");var f,E=0|t._crypto_box_macbytes();a.length!==E&&b(o,"invalid mac length"),f=u(a),o.push(f);var x=null,k=0;null!=_&&(x=u(_=m(o,_,"additional_data")),k=_.length,o.push(x)),s=m(o,s,"public_nonce");var S,T=0|t._crypto_aead_chacha20poly1305_npubbytes();s.length!==T&&b(o,"invalid public_nonce length"),S=u(s),o.push(S),n=m(o,n,"key");var w,Y=0|t._crypto_aead_chacha20poly1305_keybytes();n.length!==Y&&b(o,"invalid key length"),w=u(n),o.push(w);var B=new l(0|d),A=B.address;if(o.push(A),0===t._crypto_aead_chacha20poly1305_decrypt_detached(A,h,y,d,0,f,x,k,0,S,w)){var K=p(B,c);return v(o),K}g(o,"ciphertext cannot be decrypted using that key");}function k(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_chacha20poly1305_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_chacha20poly1305_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(h+t._crypto_aead_chacha20poly1305_abytes()|0),w=T.address;if(c.push(w),0===t._crypto_aead_chacha20poly1305_encrypt(w,null,o,h,0,y,d,0,f,E,k)){var Y=p(T,n);return v(c),Y}g(c,"invalid usage");}function S(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_chacha20poly1305_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_chacha20poly1305_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(0|h),w=T.address;c.push(w);var Y=new l(0|t._crypto_aead_chacha20poly1305_abytes()),B=Y.address;if(c.push(B),0===t._crypto_aead_chacha20poly1305_encrypt_detached(w,B,null,o,h,0,y,d,0,f,E,k)){var A=p({ciphertext:T,mac:Y},n);return v(c),A}g(c,"invalid usage");}function T(e,r,a,_,s,n){var c=[];i(n);var o=null;null!=e&&(o=u(e=m(c,e,"secret_nonce")),e.length,c.push(o)),r=m(c,r,"ciphertext");var h,y=t._crypto_aead_chacha20poly1305_ietf_abytes(),d=r.length;d<y&&b(c,"ciphertext is too short"),h=u(r),c.push(h);var f=null,E=0;null!=a&&(f=u(a=m(c,a,"additional_data")),E=a.length,c.push(f)),_=m(c,_,"public_nonce");var x,k=0|t._crypto_aead_chacha20poly1305_ietf_npubbytes();_.length!==k&&b(c,"invalid public_nonce length"),x=u(_),c.push(x),s=m(c,s,"key");var S,T=0|t._crypto_aead_chacha20poly1305_ietf_keybytes();s.length!==T&&b(c,"invalid key length"),S=u(s),c.push(S);var w=new l(d-t._crypto_aead_chacha20poly1305_ietf_abytes()|0),Y=w.address;if(c.push(Y),0===t._crypto_aead_chacha20poly1305_ietf_decrypt(Y,null,o,h,d,0,f,E,0,x,S)){var B=p(w,n);return v(c),B}g(c,"ciphertext cannot be decrypted using that key");}function w(e,r,a,_,s,n,c){var o=[];i(c);var h=null;null!=e&&(h=u(e=m(o,e,"secret_nonce")),e.length,o.push(h));var y=u(r=m(o,r,"ciphertext")),d=r.length;o.push(y),a=m(o,a,"mac");var f,E=0|t._crypto_box_macbytes();a.length!==E&&b(o,"invalid mac length"),f=u(a),o.push(f);var x=null,k=0;null!=_&&(x=u(_=m(o,_,"additional_data")),k=_.length,o.push(x)),s=m(o,s,"public_nonce");var S,T=0|t._crypto_aead_chacha20poly1305_ietf_npubbytes();s.length!==T&&b(o,"invalid public_nonce length"),S=u(s),o.push(S),n=m(o,n,"key");var w,Y=0|t._crypto_aead_chacha20poly1305_ietf_keybytes();n.length!==Y&&b(o,"invalid key length"),w=u(n),o.push(w);var B=new l(0|d),A=B.address;if(o.push(A),0===t._crypto_aead_chacha20poly1305_ietf_decrypt_detached(A,h,y,d,0,f,x,k,0,S,w)){var K=p(B,c);return v(o),K}g(o,"ciphertext cannot be decrypted using that key");}function Y(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_chacha20poly1305_ietf_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_chacha20poly1305_ietf_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(h+t._crypto_aead_chacha20poly1305_ietf_abytes()|0),w=T.address;if(c.push(w),0===t._crypto_aead_chacha20poly1305_ietf_encrypt(w,null,o,h,0,y,d,0,f,E,k)){var Y=p(T,n);return v(c),Y}g(c,"invalid usage");}function B(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_chacha20poly1305_ietf_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_chacha20poly1305_ietf_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(0|h),w=T.address;c.push(w);var Y=new l(0|t._crypto_aead_chacha20poly1305_ietf_abytes()),B=Y.address;if(c.push(B),0===t._crypto_aead_chacha20poly1305_ietf_encrypt_detached(w,B,null,o,h,0,y,d,0,f,E,k)){var A=p({ciphertext:T,mac:Y},n);return v(c),A}g(c,"invalid usage");}function A(e){var r=[];i(e);var a=new l(0|t._crypto_aead_chacha20poly1305_ietf_keybytes()),_=a.address;r.push(_),t._crypto_aead_chacha20poly1305_ietf_keygen(_);var s=p(a,e);return v(r),s}function K(e){var r=[];i(e);var a=new l(0|t._crypto_aead_chacha20poly1305_keybytes()),_=a.address;r.push(_),t._crypto_aead_chacha20poly1305_keygen(_);var s=p(a,e);return v(r),s}function M(e,r,a,_,s,n){var c=[];i(n);var o=null;null!=e&&(o=u(e=m(c,e,"secret_nonce")),e.length,c.push(o)),r=m(c,r,"ciphertext");var h,y=t._crypto_aead_xchacha20poly1305_ietf_abytes(),d=r.length;d<y&&b(c,"ciphertext is too short"),h=u(r),c.push(h);var f=null,E=0;null!=a&&(f=u(a=m(c,a,"additional_data")),E=a.length,c.push(f)),_=m(c,_,"public_nonce");var x,k=0|t._crypto_aead_xchacha20poly1305_ietf_npubbytes();_.length!==k&&b(c,"invalid public_nonce length"),x=u(_),c.push(x),s=m(c,s,"key");var S,T=0|t._crypto_aead_xchacha20poly1305_ietf_keybytes();s.length!==T&&b(c,"invalid key length"),S=u(s),c.push(S);var w=new l(d-t._crypto_aead_xchacha20poly1305_ietf_abytes()|0),Y=w.address;if(c.push(Y),0===t._crypto_aead_xchacha20poly1305_ietf_decrypt(Y,null,o,h,d,0,f,E,0,x,S)){var B=p(w,n);return v(c),B}g(c,"ciphertext cannot be decrypted using that key");}function I(e,r,a,_,s,n,c){var o=[];i(c);var h=null;null!=e&&(h=u(e=m(o,e,"secret_nonce")),e.length,o.push(h));var y=u(r=m(o,r,"ciphertext")),d=r.length;o.push(y),a=m(o,a,"mac");var f,E=0|t._crypto_box_macbytes();a.length!==E&&b(o,"invalid mac length"),f=u(a),o.push(f);var x=null,k=0;null!=_&&(x=u(_=m(o,_,"additional_data")),k=_.length,o.push(x)),s=m(o,s,"public_nonce");var S,T=0|t._crypto_aead_xchacha20poly1305_ietf_npubbytes();s.length!==T&&b(o,"invalid public_nonce length"),S=u(s),o.push(S),n=m(o,n,"key");var w,Y=0|t._crypto_aead_xchacha20poly1305_ietf_keybytes();n.length!==Y&&b(o,"invalid key length"),w=u(n),o.push(w);var B=new l(0|d),A=B.address;if(o.push(A),0===t._crypto_aead_xchacha20poly1305_ietf_decrypt_detached(A,h,y,d,0,f,x,k,0,S,w)){var K=p(B,c);return v(o),K}g(o,"ciphertext cannot be decrypted using that key");}function N(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_xchacha20poly1305_ietf_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_xchacha20poly1305_ietf_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(h+t._crypto_aead_xchacha20poly1305_ietf_abytes()|0),w=T.address;if(c.push(w),0===t._crypto_aead_xchacha20poly1305_ietf_encrypt(w,null,o,h,0,y,d,0,f,E,k)){var Y=p(T,n);return v(c),Y}g(c,"invalid usage");}function L(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"message")),h=e.length;c.push(o);var y=null,d=0;null!=r&&(y=u(r=m(c,r,"additional_data")),d=r.length,c.push(y));var f=null;null!=a&&(f=u(a=m(c,a,"secret_nonce")),a.length,c.push(f)),_=m(c,_,"public_nonce");var E,x=0|t._crypto_aead_xchacha20poly1305_ietf_npubbytes();_.length!==x&&b(c,"invalid public_nonce length"),E=u(_),c.push(E),s=m(c,s,"key");var k,S=0|t._crypto_aead_xchacha20poly1305_ietf_keybytes();s.length!==S&&b(c,"invalid key length"),k=u(s),c.push(k);var T=new l(0|h),w=T.address;c.push(w);var Y=new l(0|t._crypto_aead_xchacha20poly1305_ietf_abytes()),B=Y.address;if(c.push(B),0===t._crypto_aead_xchacha20poly1305_ietf_encrypt_detached(w,B,null,o,h,0,y,d,0,f,E,k)){var A=p({ciphertext:T,mac:Y},n);return v(c),A}g(c,"invalid usage");}function U(e){var r=[];i(e);var a=new l(0|t._crypto_aead_xchacha20poly1305_ietf_keybytes()),_=a.address;r.push(_),t._crypto_aead_xchacha20poly1305_ietf_keygen(_);var s=p(a,e);return v(r),s}function O(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_auth_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_auth_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_auth(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function C(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_auth_hmacsha256_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_auth_hmacsha256_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_auth_hmacsha256(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function R(e,r){var a=[];i(r),f(a,e,"state_address");var _=new l(0|t._crypto_auth_hmacsha256_bytes()),s=_.address;if(a.push(s),0==(0|t._crypto_auth_hmacsha256_final(e,s))){var n=(t._free(e),p(_,r));return v(a),n}g(a,"invalid usage");}function P(e,r){var a=[];i(r);var _=null,s=0;null!=e&&(_=u(e=m(a,e,"key")),s=e.length,a.push(_));var n=new l(208).address;if(0==(0|t._crypto_auth_hmacsha256_init(n,_,s))){var c=n;return v(a),c}g(a,"invalid usage");}function G(e){var r=[];i(e);var a=new l(0|t._crypto_auth_hmacsha256_keybytes()),_=a.address;r.push(_),t._crypto_auth_hmacsha256_keygen(_);var s=p(a,e);return v(r),s}function X(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_auth_hmacsha256_update(e,s,n))&&g(_,"invalid usage"),v(_);}function D(e,r,a){var _=[];e=m(_,e,"tag");var s,n=0|t._crypto_auth_hmacsha256_bytes();e.length!==n&&b(_,"invalid tag length"),s=u(e),_.push(s);var c=u(r=m(_,r,"message")),o=r.length;_.push(c),a=m(_,a,"key");var h,p=0|t._crypto_auth_hmacsha256_keybytes();a.length!==p&&b(_,"invalid key length"),h=u(a),_.push(h);var y=0==(0|t._crypto_auth_hmacsha256_verify(s,c,o,0,h));return v(_),y}function F(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_auth_hmacsha512_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_auth_hmacsha512_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_auth_hmacsha512(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function V(e,r){var a=[];i(r),f(a,e,"state_address");var _=new l(0|t._crypto_auth_hmacsha512_bytes()),s=_.address;if(a.push(s),0==(0|t._crypto_auth_hmacsha512_final(e,s))){var n=(t._free(e),p(_,r));return v(a),n}g(a,"invalid usage");}function H(e,r){var a=[];i(r);var _=null,s=0;null!=e&&(_=u(e=m(a,e,"key")),s=e.length,a.push(_));var n=new l(416).address;if(0==(0|t._crypto_auth_hmacsha512_init(n,_,s))){var c=n;return v(a),c}g(a,"invalid usage");}function q(e){var r=[];i(e);var a=new l(0|t._crypto_auth_hmacsha512_keybytes()),_=a.address;r.push(_),t._crypto_auth_hmacsha512_keygen(_);var s=p(a,e);return v(r),s}function j(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_auth_hmacsha512_update(e,s,n))&&g(_,"invalid usage"),v(_);}function z(e,r,a){var _=[];e=m(_,e,"tag");var s,n=0|t._crypto_auth_hmacsha512_bytes();e.length!==n&&b(_,"invalid tag length"),s=u(e),_.push(s);var c=u(r=m(_,r,"message")),o=r.length;_.push(c),a=m(_,a,"key");var h,p=0|t._crypto_auth_hmacsha512_keybytes();a.length!==p&&b(_,"invalid key length"),h=u(a),_.push(h);var y=0==(0|t._crypto_auth_hmacsha512_verify(s,c,o,0,h));return v(_),y}function W(e){var r=[];i(e);var a=new l(0|t._crypto_auth_keybytes()),_=a.address;r.push(_),t._crypto_auth_keygen(_);var s=p(a,e);return v(r),s}function J(e,r,a){var _=[];e=m(_,e,"tag");var s,n=0|t._crypto_auth_bytes();e.length!==n&&b(_,"invalid tag length"),s=u(e),_.push(s);var c=u(r=m(_,r,"message")),o=r.length;_.push(c),a=m(_,a,"key");var h,p=0|t._crypto_auth_keybytes();a.length!==p&&b(_,"invalid key length"),h=u(a),_.push(h);var y=0==(0|t._crypto_auth_verify(s,c,o,0,h));return v(_),y}function Q(e,r,a){var _=[];i(a),e=m(_,e,"publicKey");var s,n=0|t._crypto_box_publickeybytes();e.length!==n&&b(_,"invalid publicKey length"),s=u(e),_.push(s),r=m(_,r,"privateKey");var c,o=0|t._crypto_box_secretkeybytes();r.length!==o&&b(_,"invalid privateKey length"),c=u(r),_.push(c);var h=new l(0|t._crypto_box_beforenmbytes()),y=h.address;if(_.push(y),0==(0|t._crypto_box_beforenm(y,s,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function Z(e){var r=[];i(e);var a=new l(0|t._crypto_box_curve25519xchacha20poly1305_publickeybytes()),_=a.address;r.push(_);var s=new l(0|t._crypto_box_curve25519xchacha20poly1305_secretkeybytes()),n=s.address;r.push(n),t._crypto_box_curve25519xchacha20poly1305_keypair(_,n);var c=p({publicKey:a,privateKey:s,keyType:"curve25519"},e);return v(r),c}function $(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"publicKey");var c,o=0|t._crypto_box_curve25519xchacha20poly1305_publickeybytes();r.length!==o&&b(_,"invalid publicKey length"),c=u(r),_.push(c);var h=new l(n+t._crypto_box_curve25519xchacha20poly1305_sealbytes()|0),y=h.address;_.push(y),t._crypto_box_curve25519xchacha20poly1305_seal(y,s,n,0,c);var d=p(h,a);return v(_),d}function ee(e,r,a,_){var s=[];i(_),e=m(s,e,"ciphertext");var n,c=t._crypto_box_curve25519xchacha20poly1305_sealbytes(),o=e.length;o<c&&b(s,"ciphertext is too short"),n=u(e),s.push(n),r=m(s,r,"publicKey");var h,y=0|t._crypto_box_curve25519xchacha20poly1305_publickeybytes();r.length!==y&&b(s,"invalid publicKey length"),h=u(r),s.push(h),a=m(s,a,"secretKey");var d,g=0|t._crypto_box_curve25519xchacha20poly1305_secretkeybytes();a.length!==g&&b(s,"invalid secretKey length"),d=u(a),s.push(d);var f=new l(o-t._crypto_box_curve25519xchacha20poly1305_sealbytes()|0),E=f.address;s.push(E),t._crypto_box_curve25519xchacha20poly1305_seal_open(E,n,o,0,h,d);var x=p(f,_);return v(s),x}function re(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"message")),o=e.length;n.push(c),r=m(n,r,"nonce");var h,y=0|t._crypto_box_noncebytes();r.length!==y&&b(n,"invalid nonce length"),h=u(r),n.push(h),a=m(n,a,"publicKey");var d,f=0|t._crypto_box_publickeybytes();a.length!==f&&b(n,"invalid publicKey length"),d=u(a),n.push(d),_=m(n,_,"privateKey");var E,x=0|t._crypto_box_secretkeybytes();_.length!==x&&b(n,"invalid privateKey length"),E=u(_),n.push(E);var k=new l(0|o),S=k.address;n.push(S);var T=new l(0|t._crypto_box_macbytes()),w=T.address;if(n.push(w),0==(0|t._crypto_box_detached(S,w,c,o,0,h,d,E))){var Y=p({ciphertext:k,mac:T},s);return v(n),Y}g(n,"invalid usage");}function te(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"message")),o=e.length;n.push(c),r=m(n,r,"nonce");var h,y=0|t._crypto_box_noncebytes();r.length!==y&&b(n,"invalid nonce length"),h=u(r),n.push(h),a=m(n,a,"publicKey");var d,f=0|t._crypto_box_publickeybytes();a.length!==f&&b(n,"invalid publicKey length"),d=u(a),n.push(d),_=m(n,_,"privateKey");var E,x=0|t._crypto_box_secretkeybytes();_.length!==x&&b(n,"invalid privateKey length"),E=u(_),n.push(E);var k=new l(o+t._crypto_box_macbytes()|0),S=k.address;if(n.push(S),0==(0|t._crypto_box_easy(S,c,o,0,h,d,E))){var T=p(k,s);return v(n),T}g(n,"invalid usage");}function ae(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_box_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"sharedKey");var y,d=0|t._crypto_box_beforenmbytes();a.length!==d&&b(s,"invalid sharedKey length"),y=u(a),s.push(y);var f=new l(c+t._crypto_box_macbytes()|0),E=f.address;if(s.push(E),0==(0|t._crypto_box_easy_afternm(E,n,c,0,o,y))){var x=p(f,_);return v(s),x}g(s,"invalid usage");}function _e(e){var r=[];i(e);var a=new l(0|t._crypto_box_publickeybytes()),_=a.address;r.push(_);var s=new l(0|t._crypto_box_secretkeybytes()),n=s.address;if(r.push(n),0==(0|t._crypto_box_keypair(_,n))){var c={publicKey:p(a,e),privateKey:p(s,e),keyType:"x25519"};return v(r),c}g(r,"internal error");}function se(e,r,a,_,s,n){var c=[];i(n);var o=u(e=m(c,e,"ciphertext")),h=e.length;c.push(o),r=m(c,r,"mac");var y,d=0|t._crypto_box_macbytes();r.length!==d&&b(c,"invalid mac length"),y=u(r),c.push(y),a=m(c,a,"nonce");var f,E=0|t._crypto_box_noncebytes();a.length!==E&&b(c,"invalid nonce length"),f=u(a),c.push(f),_=m(c,_,"publicKey");var x,k=0|t._crypto_box_publickeybytes();_.length!==k&&b(c,"invalid publicKey length"),x=u(_),c.push(x),s=m(c,s,"privateKey");var S,T=0|t._crypto_box_secretkeybytes();s.length!==T&&b(c,"invalid privateKey length"),S=u(s),c.push(S);var w=new l(0|h),Y=w.address;if(c.push(Y),0==(0|t._crypto_box_open_detached(Y,o,y,h,0,f,x,S))){var B=p(w,n);return v(c),B}g(c,"incorrect key pair for the given ciphertext");}function ne(e,r,a,_,s){var n=[];i(s),e=m(n,e,"ciphertext");var c,o=t._crypto_box_macbytes(),h=e.length;h<o&&b(n,"ciphertext is too short"),c=u(e),n.push(c),r=m(n,r,"nonce");var y,d=0|t._crypto_box_noncebytes();r.length!==d&&b(n,"invalid nonce length"),y=u(r),n.push(y),a=m(n,a,"publicKey");var f,E=0|t._crypto_box_publickeybytes();a.length!==E&&b(n,"invalid publicKey length"),f=u(a),n.push(f),_=m(n,_,"privateKey");var x,k=0|t._crypto_box_secretkeybytes();_.length!==k&&b(n,"invalid privateKey length"),x=u(_),n.push(x);var S=new l(h-t._crypto_box_macbytes()|0),T=S.address;if(n.push(T),0==(0|t._crypto_box_open_easy(T,c,h,0,y,f,x))){var w=p(S,s);return v(n),w}g(n,"incorrect key pair for the given ciphertext");}function ce(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"ciphertext")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_box_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"sharedKey");var y,d=0|t._crypto_box_beforenmbytes();a.length!==d&&b(s,"invalid sharedKey length"),y=u(a),s.push(y);var f=new l(c-t._crypto_box_macbytes()|0),E=f.address;if(s.push(E),0==(0|t._crypto_box_open_easy_afternm(E,n,c,0,o,y))){var x=p(f,_);return v(s),x}g(s,"incorrect secret key for the given ciphertext");}function oe(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"publicKey");var c,o=0|t._crypto_box_publickeybytes();r.length!==o&&b(_,"invalid publicKey length"),c=u(r),_.push(c);var h=new l(n+t._crypto_box_sealbytes()|0),y=h.address;if(_.push(y),0==(0|t._crypto_box_seal(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function he(e,r,a,_){var s=[];i(_),e=m(s,e,"ciphertext");var n,c=t._crypto_box_sealbytes(),o=e.length;o<c&&b(s,"ciphertext is too short"),n=u(e),s.push(n),r=m(s,r,"publicKey");var h,y=0|t._crypto_box_publickeybytes();r.length!==y&&b(s,"invalid publicKey length"),h=u(r),s.push(h),a=m(s,a,"privateKey");var d,f=0|t._crypto_box_secretkeybytes();a.length!==f&&b(s,"invalid privateKey length"),d=u(a),s.push(d);var E=new l(o-t._crypto_box_sealbytes()|0),x=E.address;if(s.push(x),0==(0|t._crypto_box_seal_open(x,n,o,0,h,d))){var k=p(E,_);return v(s),k}g(s,"incorrect key pair for the given ciphertext");}function pe(e,r){var a=[];i(r),e=m(a,e,"seed");var _,s=0|t._crypto_box_seedbytes();e.length!==s&&b(a,"invalid seed length"),_=u(e),a.push(_);var n=new l(0|t._crypto_box_publickeybytes()),c=n.address;a.push(c);var o=new l(0|t._crypto_box_secretkeybytes()),h=o.address;if(a.push(h),0==(0|t._crypto_box_seed_keypair(c,h,_))){var y={publicKey:p(n,r),privateKey:p(o,r),keyType:"x25519"};return v(a),y}g(a,"invalid usage");}function ye(e,r,a){var _=[];i(a),e=m(_,e,"p");var s,n=0|t._crypto_core_ed25519_bytes();e.length!==n&&b(_,"invalid p length"),s=u(e),_.push(s),r=m(_,r,"q");var c,o=0|t._crypto_core_ed25519_bytes();r.length!==o&&b(_,"invalid q length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ed25519_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_core_ed25519_add(y,s,c))){var d=p(h,a);return v(_),d}g(_,"input is an invalid element");}function ie(e,r){var a=[];i(r);var _=u(e=m(a,e,"r"));e.length,a.push(_);var s=new l(0|t._crypto_core_ed25519_bytes()),n=s.address;if(a.push(n),0==(0|t._crypto_core_ed25519_from_hash(n,_))){var c=p(s,r);return v(a),c}g(a,"invalid usage");}function le(e,r){var a=[];i(r);var _=u(e=m(a,e,"r"));e.length,a.push(_);var s=new l(0|t._crypto_core_ed25519_bytes()),n=s.address;if(a.push(n),0==(0|t._crypto_core_ed25519_from_uniform(n,_))){var c=p(s,r);return v(a),c}g(a,"invalid usage");}function ue(e,r){var a=[];i(r),e=m(a,e,"repr");var _,s=0|t._crypto_core_ed25519_bytes();e.length!==s&&b(a,"invalid repr length"),_=u(e),a.push(_);var n=1==(0|t._crypto_core_ed25519_is_valid_point(_));return v(a),n}function de(e){var r=[];i(e);var a=new l(0|t._crypto_core_ed25519_bytes()),_=a.address;r.push(_),t._crypto_core_ed25519_random(_);var s=p(a,e);return v(r),s}function ve(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ed25519_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ed25519_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ed25519_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ed25519_scalar_add(y,s,c);var d=p(h,a);return v(_),d}function ge(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ed25519_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ed25519_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ed25519_scalar_complement(c,_);var o=p(n,r);return v(a),o}function be(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ed25519_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ed25519_scalarbytes()),c=n.address;if(a.push(c),0==(0|t._crypto_core_ed25519_scalar_invert(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid reciprocate");}function fe(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ed25519_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ed25519_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ed25519_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ed25519_scalar_mul(y,s,c);var d=p(h,a);return v(_),d}function me(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ed25519_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ed25519_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ed25519_scalar_negate(c,_);var o=p(n,r);return v(a),o}function Ee(e){var r=[];i(e);var a=new l(0|t._crypto_core_ed25519_scalarbytes()),_=a.address;r.push(_),t._crypto_core_ed25519_scalar_random(_);var s=p(a,e);return v(r),s}function xe(e,r){var a=[];i(r),e=m(a,e,"sample");var _,s=0|t._crypto_core_ed25519_nonreducedscalarbytes();e.length!==s&&b(a,"invalid sample length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ed25519_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ed25519_scalar_reduce(c,_);var o=p(n,r);return v(a),o}function ke(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ed25519_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ed25519_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ed25519_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ed25519_scalar_sub(y,s,c);var d=p(h,a);return v(_),d}function Se(e,r,a){var _=[];i(a),e=m(_,e,"p");var s,n=0|t._crypto_core_ed25519_bytes();e.length!==n&&b(_,"invalid p length"),s=u(e),_.push(s),r=m(_,r,"q");var c,o=0|t._crypto_core_ed25519_bytes();r.length!==o&&b(_,"invalid q length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ed25519_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_core_ed25519_sub(y,s,c))){var d=p(h,a);return v(_),d}g(_,"input is an invalid element");}function Te(e,r,a,_){var s=[];i(_),e=m(s,e,"input");var n,c=0|t._crypto_core_hchacha20_inputbytes();e.length!==c&&b(s,"invalid input length"),n=u(e),s.push(n),r=m(s,r,"privateKey");var o,h=0|t._crypto_core_hchacha20_keybytes();r.length!==h&&b(s,"invalid privateKey length"),o=u(r),s.push(o);var y=null;null!=a&&(y=u(a=m(s,a,"constant")),a.length,s.push(y));var d=new l(0|t._crypto_core_hchacha20_outputbytes()),f=d.address;if(s.push(f),0==(0|t._crypto_core_hchacha20(f,n,o,y))){var E=p(d,_);return v(s),E}g(s,"invalid usage");}function we(e,r,a,_){var s=[];i(_),e=m(s,e,"input");var n,c=0|t._crypto_core_hsalsa20_inputbytes();e.length!==c&&b(s,"invalid input length"),n=u(e),s.push(n),r=m(s,r,"privateKey");var o,h=0|t._crypto_core_hsalsa20_keybytes();r.length!==h&&b(s,"invalid privateKey length"),o=u(r),s.push(o);var y=null;null!=a&&(y=u(a=m(s,a,"constant")),a.length,s.push(y));var d=new l(0|t._crypto_core_hsalsa20_outputbytes()),f=d.address;if(s.push(f),0==(0|t._crypto_core_hsalsa20(f,n,o,y))){var E=p(d,_);return v(s),E}g(s,"invalid usage");}function Ye(e,r,a){var _=[];i(a),e=m(_,e,"p");var s,n=0|t._crypto_core_ristretto255_bytes();e.length!==n&&b(_,"invalid p length"),s=u(e),_.push(s),r=m(_,r,"q");var c,o=0|t._crypto_core_ristretto255_bytes();r.length!==o&&b(_,"invalid q length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ristretto255_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_core_ristretto255_add(y,s,c))){var d=p(h,a);return v(_),d}g(_,"input is an invalid element");}function Be(e,r){var a=[];i(r);var _=u(e=m(a,e,"r"));e.length,a.push(_);var s=new l(0|t._crypto_core_ristretto255_bytes()),n=s.address;if(a.push(n),0==(0|t._crypto_core_ristretto255_from_hash(n,_))){var c=p(s,r);return v(a),c}g(a,"invalid usage");}function Ae(e,r){var a=[];i(r),e=m(a,e,"repr");var _,s=0|t._crypto_core_ristretto255_bytes();e.length!==s&&b(a,"invalid repr length"),_=u(e),a.push(_);var n=1==(0|t._crypto_core_ristretto255_is_valid_point(_));return v(a),n}function Ke(e){var r=[];i(e);var a=new l(0|t._crypto_core_ristretto255_bytes()),_=a.address;r.push(_),t._crypto_core_ristretto255_random(_);var s=p(a,e);return v(r),s}function Me(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ristretto255_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ristretto255_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ristretto255_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ristretto255_scalar_add(y,s,c);var d=p(h,a);return v(_),d}function Ie(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ristretto255_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ristretto255_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ristretto255_scalar_complement(c,_);var o=p(n,r);return v(a),o}function Ne(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ristretto255_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ristretto255_scalarbytes()),c=n.address;if(a.push(c),0==(0|t._crypto_core_ristretto255_scalar_invert(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid reciprocate");}function Le(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ristretto255_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ristretto255_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ristretto255_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ristretto255_scalar_mul(y,s,c);var d=p(h,a);return v(_),d}function Ue(e,r){var a=[];i(r),e=m(a,e,"s");var _,s=0|t._crypto_core_ristretto255_scalarbytes();e.length!==s&&b(a,"invalid s length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ristretto255_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ristretto255_scalar_negate(c,_);var o=p(n,r);return v(a),o}function Oe(e){var r=[];i(e);var a=new l(0|t._crypto_core_ristretto255_scalarbytes()),_=a.address;r.push(_),t._crypto_core_ristretto255_scalar_random(_);var s=p(a,e);return v(r),s}function Ce(e,r){var a=[];i(r),e=m(a,e,"sample");var _,s=0|t._crypto_core_ristretto255_nonreducedscalarbytes();e.length!==s&&b(a,"invalid sample length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ristretto255_scalarbytes()),c=n.address;a.push(c),t._crypto_core_ristretto255_scalar_reduce(c,_);var o=p(n,r);return v(a),o}function Re(e,r,a){var _=[];i(a),e=m(_,e,"x");var s,n=0|t._crypto_core_ristretto255_scalarbytes();e.length!==n&&b(_,"invalid x length"),s=u(e),_.push(s),r=m(_,r,"y");var c,o=0|t._crypto_core_ristretto255_scalarbytes();r.length!==o&&b(_,"invalid y length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ristretto255_scalarbytes()),y=h.address;_.push(y),t._crypto_core_ristretto255_scalar_sub(y,s,c);var d=p(h,a);return v(_),d}function Pe(e,r,a){var _=[];i(a),e=m(_,e,"p");var s,n=0|t._crypto_core_ristretto255_bytes();e.length!==n&&b(_,"invalid p length"),s=u(e),_.push(s),r=m(_,r,"q");var c,o=0|t._crypto_core_ristretto255_bytes();r.length!==o&&b(_,"invalid q length"),c=u(r),_.push(c);var h=new l(0|t._crypto_core_ristretto255_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_core_ristretto255_sub(y,s,c))){var d=p(h,a);return v(_),d}g(_,"input is an invalid element");}function Ge(e,r,a,_){var s=[];i(_),f(s,e,"hash_length"),("number"!=typeof e||(0|e)!==e||e<0)&&b(s,"hash_length must be an unsigned integer");var n=u(r=m(s,r,"message")),c=r.length;s.push(n);var o=null,h=0;null!=a&&(o=u(a=m(s,a,"key")),h=a.length,s.push(o));var y=new l(e|=0),d=y.address;if(s.push(d),0==(0|t._crypto_generichash(d,e,n,c,0,o,h))){var E=p(y,_);return v(s),E}g(s,"invalid usage");}function Xe(e,r,a,_,s){var n=[];i(s),f(n,e,"subkey_len"),("number"!=typeof e||(0|e)!==e||e<0)&&b(n,"subkey_len must be an unsigned integer");var c=null,o=0;null!=r&&(c=u(r=m(n,r,"key")),o=r.length,n.push(c)),a=m(n,a,"id");var h,y=0|t._crypto_generichash_blake2b_saltbytes();a.length!==y&&b(n,"invalid id length"),h=u(a),n.push(h),_=m(n,_,"ctx");var d,E=0|t._crypto_generichash_blake2b_personalbytes();_.length!==E&&b(n,"invalid ctx length"),d=u(_),n.push(d);var x=new l(0|e),k=x.address;if(n.push(k),0==(0|t._crypto_generichash_blake2b_salt_personal(k,e,null,0,0,c,o,h,d))){var S=p(x,s);return v(n),S}g(n,"invalid usage");}function De(e,r,a){var _=[];i(a),f(_,e,"state_address"),f(_,r,"hash_length"),("number"!=typeof r||(0|r)!==r||r<0)&&b(_,"hash_length must be an unsigned integer");var s=new l(r|=0),n=s.address;if(_.push(n),0==(0|t._crypto_generichash_final(e,n,r))){var c=(t._free(e),p(s,a));return v(_),c}g(_,"invalid usage");}function Fe(e,r,a){var _=[];i(a);var s=null,n=0;null!=e&&(s=u(e=m(_,e,"key")),n=e.length,_.push(s)),f(_,r,"hash_length"),("number"!=typeof r||(0|r)!==r||r<0)&&b(_,"hash_length must be an unsigned integer");var c=new l(357).address;if(0==(0|t._crypto_generichash_init(c,s,n,r))){var o=c;return v(_),o}g(_,"invalid usage");}function Ve(e){var r=[];i(e);var a=new l(0|t._crypto_generichash_keybytes()),_=a.address;r.push(_),t._crypto_generichash_keygen(_);var s=p(a,e);return v(r),s}function He(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_generichash_update(e,s,n))&&g(_,"invalid usage"),v(_);}function qe(e,r){var a=[];i(r);var _=u(e=m(a,e,"message")),s=e.length;a.push(_);var n=new l(0|t._crypto_hash_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_hash(c,_,s,0))){var o=p(n,r);return v(a),o}g(a,"invalid usage");}function je(e,r){var a=[];i(r);var _=u(e=m(a,e,"message")),s=e.length;a.push(_);var n=new l(0|t._crypto_hash_sha256_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_hash_sha256(c,_,s,0))){var o=p(n,r);return v(a),o}g(a,"invalid usage");}function ze(e,r){var a=[];i(r),f(a,e,"state_address");var _=new l(0|t._crypto_hash_sha256_bytes()),s=_.address;if(a.push(s),0==(0|t._crypto_hash_sha256_final(e,s))){var n=(t._free(e),p(_,r));return v(a),n}g(a,"invalid usage");}function We(e){var r=[];i(e);var a=new l(104).address;if(0==(0|t._crypto_hash_sha256_init(a))){var _=a;return v(r),_}g(r,"invalid usage");}function Je(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_hash_sha256_update(e,s,n))&&g(_,"invalid usage"),v(_);}function Qe(e,r){var a=[];i(r);var _=u(e=m(a,e,"message")),s=e.length;a.push(_);var n=new l(0|t._crypto_hash_sha512_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_hash_sha512(c,_,s,0))){var o=p(n,r);return v(a),o}g(a,"invalid usage");}function Ze(e,r){var a=[];i(r),f(a,e,"state_address");var _=new l(0|t._crypto_hash_sha512_bytes()),s=_.address;if(a.push(s),0==(0|t._crypto_hash_sha512_final(e,s))){var n=(t._free(e),p(_,r));return v(a),n}g(a,"invalid usage");}function $e(e){var r=[];i(e);var a=new l(208).address;if(0==(0|t._crypto_hash_sha512_init(a))){var _=a;return v(r),_}g(r,"invalid usage");}function er(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_hash_sha512_update(e,s,n))&&g(_,"invalid usage"),v(_);}function rr(e,r,a,s,n){var c=[];i(n),f(c,e,"subkey_len"),("number"!=typeof e||(0|e)!==e||e<0)&&b(c,"subkey_len must be an unsigned integer"),f(c,r,"subkey_id"),("number"!=typeof r||(0|r)!==r||r<0)&&b(c,"subkey_id must be an unsigned integer"),"string"!=typeof a&&b(c,"ctx must be a string"),a=_(a+"\0"),null!=h&&a.length-1!==h&&b(c,"invalid ctx length");var o=u(a),h=a.length-1;c.push(o),s=m(c,s,"key");var y,d=0|t._crypto_kdf_keybytes();s.length!==d&&b(c,"invalid key length"),y=u(s),c.push(y);var g=new l(0|e),E=g.address;c.push(E),t._crypto_kdf_derive_from_key(E,e,r,r>>>24>>>8,o,y);var x=p(g,n);return v(c),x}function tr(e){var r=[];i(e);var a=new l(0|t._crypto_kdf_keybytes()),_=a.address;r.push(_),t._crypto_kdf_keygen(_);var s=p(a,e);return v(r),s}function ar(e,r,a,_){var s=[];i(_),e=m(s,e,"clientPublicKey");var n,c=0|t._crypto_kx_publickeybytes();e.length!==c&&b(s,"invalid clientPublicKey length"),n=u(e),s.push(n),r=m(s,r,"clientSecretKey");var o,h=0|t._crypto_kx_secretkeybytes();r.length!==h&&b(s,"invalid clientSecretKey length"),o=u(r),s.push(o),a=m(s,a,"serverPublicKey");var y,d=0|t._crypto_kx_publickeybytes();a.length!==d&&b(s,"invalid serverPublicKey length"),y=u(a),s.push(y);var f=new l(0|t._crypto_kx_sessionkeybytes()),E=f.address;s.push(E);var x=new l(0|t._crypto_kx_sessionkeybytes()),k=x.address;if(s.push(k),0==(0|t._crypto_kx_client_session_keys(E,k,n,o,y))){var S=p({sharedRx:f,sharedTx:x},_);return v(s),S}g(s,"invalid usage");}function _r(e){var r=[];i(e);var a=new l(0|t._crypto_kx_publickeybytes()),_=a.address;r.push(_);var s=new l(0|t._crypto_kx_secretkeybytes()),n=s.address;if(r.push(n),0==(0|t._crypto_kx_keypair(_,n))){var c={publicKey:p(a,e),privateKey:p(s,e),keyType:"x25519"};return v(r),c}g(r,"internal error");}function sr(e,r){var a=[];i(r),e=m(a,e,"seed");var _,s=0|t._crypto_kx_seedbytes();e.length!==s&&b(a,"invalid seed length"),_=u(e),a.push(_);var n=new l(0|t._crypto_kx_publickeybytes()),c=n.address;a.push(c);var o=new l(0|t._crypto_kx_secretkeybytes()),h=o.address;if(a.push(h),0==(0|t._crypto_kx_seed_keypair(c,h,_))){var y={publicKey:p(n,r),privateKey:p(o,r),keyType:"x25519"};return v(a),y}g(a,"internal error");}function nr(e,r,a,_){var s=[];i(_),e=m(s,e,"serverPublicKey");var n,c=0|t._crypto_kx_publickeybytes();e.length!==c&&b(s,"invalid serverPublicKey length"),n=u(e),s.push(n),r=m(s,r,"serverSecretKey");var o,h=0|t._crypto_kx_secretkeybytes();r.length!==h&&b(s,"invalid serverSecretKey length"),o=u(r),s.push(o),a=m(s,a,"clientPublicKey");var y,d=0|t._crypto_kx_publickeybytes();a.length!==d&&b(s,"invalid clientPublicKey length"),y=u(a),s.push(y);var f=new l(0|t._crypto_kx_sessionkeybytes()),E=f.address;s.push(E);var x=new l(0|t._crypto_kx_sessionkeybytes()),k=x.address;if(s.push(k),0==(0|t._crypto_kx_server_session_keys(E,k,n,o,y))){var S=p({sharedRx:f,sharedTx:x},_);return v(s),S}g(s,"invalid usage");}function cr(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_onetimeauth_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_onetimeauth_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_onetimeauth(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function or(e,r){var a=[];i(r),f(a,e,"state_address");var _=new l(0|t._crypto_onetimeauth_bytes()),s=_.address;if(a.push(s),0==(0|t._crypto_onetimeauth_final(e,s))){var n=(t._free(e),p(_,r));return v(a),n}g(a,"invalid usage");}function hr(e,r){var a=[];i(r);var _=null;null!=e&&(_=u(e=m(a,e,"key")),e.length,a.push(_));var s=new l(144).address;if(0==(0|t._crypto_onetimeauth_init(s,_))){var n=s;return v(a),n}g(a,"invalid usage");}function pr(e){var r=[];i(e);var a=new l(0|t._crypto_onetimeauth_keybytes()),_=a.address;r.push(_),t._crypto_onetimeauth_keygen(_);var s=p(a,e);return v(r),s}function yr(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_onetimeauth_update(e,s,n))&&g(_,"invalid usage"),v(_);}function ir(e,r,a){var _=[];e=m(_,e,"hash");var s,n=0|t._crypto_onetimeauth_bytes();e.length!==n&&b(_,"invalid hash length"),s=u(e),_.push(s);var c=u(r=m(_,r,"message")),o=r.length;_.push(c),a=m(_,a,"key");var h,p=0|t._crypto_onetimeauth_keybytes();a.length!==p&&b(_,"invalid key length"),h=u(a),_.push(h);var y=0==(0|t._crypto_onetimeauth_verify(s,c,o,0,h));return v(_),y}function lr(e,r,a,_,s,n,c){var o=[];i(c),f(o,e,"keyLength"),("number"!=typeof e||(0|e)!==e||e<0)&&b(o,"keyLength must be an unsigned integer");var h=u(r=m(o,r,"password")),y=r.length;o.push(h),a=m(o,a,"salt");var d,E=0|t._crypto_pwhash_saltbytes();a.length!==E&&b(o,"invalid salt length"),d=u(a),o.push(d),f(o,_,"opsLimit"),("number"!=typeof _||(0|_)!==_||_<0)&&b(o,"opsLimit must be an unsigned integer"),f(o,s,"memLimit"),("number"!=typeof s||(0|s)!==s||s<0)&&b(o,"memLimit must be an unsigned integer"),f(o,n,"algorithm"),("number"!=typeof n||(0|n)!==n||n<0)&&b(o,"algorithm must be an unsigned integer");var x=new l(0|e),k=x.address;if(o.push(k),0==(0|t._crypto_pwhash(k,e,0,h,y,0,d,_,0,s,n))){var S=p(x,c);return v(o),S}g(o,"invalid usage");}function ur(e,r,a,_,s,n){var c=[];i(n),f(c,e,"keyLength"),("number"!=typeof e||(0|e)!==e||e<0)&&b(c,"keyLength must be an unsigned integer");var o=u(r=m(c,r,"password")),h=r.length;c.push(o),a=m(c,a,"salt");var y,d=0|t._crypto_pwhash_scryptsalsa208sha256_saltbytes();a.length!==d&&b(c,"invalid salt length"),y=u(a),c.push(y),f(c,_,"opsLimit"),("number"!=typeof _||(0|_)!==_||_<0)&&b(c,"opsLimit must be an unsigned integer"),f(c,s,"memLimit"),("number"!=typeof s||(0|s)!==s||s<0)&&b(c,"memLimit must be an unsigned integer");var E=new l(0|e),x=E.address;if(c.push(x),0==(0|t._crypto_pwhash_scryptsalsa208sha256(x,e,0,o,h,0,y,_,0,s))){var k=p(E,n);return v(c),k}g(c,"invalid usage");}function dr(e,r,a,_,s,n,c){var o=[];i(c);var h=u(e=m(o,e,"password")),y=e.length;o.push(h);var d=u(r=m(o,r,"salt")),E=r.length;o.push(d),f(o,a,"opsLimit"),("number"!=typeof a||(0|a)!==a||a<0)&&b(o,"opsLimit must be an unsigned integer"),f(o,_,"r"),("number"!=typeof _||(0|_)!==_||_<0)&&b(o,"r must be an unsigned integer"),f(o,s,"p"),("number"!=typeof s||(0|s)!==s||s<0)&&b(o,"p must be an unsigned integer"),f(o,n,"keyLength"),("number"!=typeof n||(0|n)!==n||n<0)&&b(o,"keyLength must be an unsigned integer");var x=new l(0|n),k=x.address;if(o.push(k),0==(0|t._crypto_pwhash_scryptsalsa208sha256_ll(h,y,d,E,a,0,_,s,k,n))){var S=p(x,c);return v(o),S}g(o,"invalid usage");}function vr(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"password")),c=e.length;s.push(n),f(s,r,"opsLimit"),("number"!=typeof r||(0|r)!==r||r<0)&&b(s,"opsLimit must be an unsigned integer"),f(s,a,"memLimit"),("number"!=typeof a||(0|a)!==a||a<0)&&b(s,"memLimit must be an unsigned integer");var o=new l(0|t._crypto_pwhash_scryptsalsa208sha256_strbytes()).address;if(s.push(o),0==(0|t._crypto_pwhash_scryptsalsa208sha256_str(o,n,c,0,r,0,a))){var h=t.UTF8ToString(o);return v(s),h}g(s,"invalid usage");}function gr(e,r,a){var s=[];i(a),"string"!=typeof e&&b(s,"hashed_password must be a string"),e=_(e+"\0"),null!=c&&e.length-1!==c&&b(s,"invalid hashed_password length");var n=u(e),c=e.length-1;s.push(n);var o=u(r=m(s,r,"password")),h=r.length;s.push(o);var p=0==(0|t._crypto_pwhash_scryptsalsa208sha256_str_verify(n,o,h,0));return v(s),p}function br(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"password")),c=e.length;s.push(n),f(s,r,"opsLimit"),("number"!=typeof r||(0|r)!==r||r<0)&&b(s,"opsLimit must be an unsigned integer"),f(s,a,"memLimit"),("number"!=typeof a||(0|a)!==a||a<0)&&b(s,"memLimit must be an unsigned integer");var o=new l(0|t._crypto_pwhash_strbytes()).address;if(s.push(o),0==(0|t._crypto_pwhash_str(o,n,c,0,r,0,a))){var h=t.UTF8ToString(o);return v(s),h}g(s,"invalid usage");}function fr(e,r,a,s){var n=[];i(s),"string"!=typeof e&&b(n,"hashed_password must be a string"),e=_(e+"\0"),null!=o&&e.length-1!==o&&b(n,"invalid hashed_password length");var c=u(e),o=e.length-1;n.push(c),f(n,r,"opsLimit"),("number"!=typeof r||(0|r)!==r||r<0)&&b(n,"opsLimit must be an unsigned integer"),f(n,a,"memLimit"),("number"!=typeof a||(0|a)!==a||a<0)&&b(n,"memLimit must be an unsigned integer");var h=0!=(0|t._crypto_pwhash_str_needs_rehash(c,r,0,a));return v(n),h}function mr(e,r,a){var s=[];i(a),"string"!=typeof e&&b(s,"hashed_password must be a string"),e=_(e+"\0"),null!=c&&e.length-1!==c&&b(s,"invalid hashed_password length");var n=u(e),c=e.length-1;s.push(n);var o=u(r=m(s,r,"password")),h=r.length;s.push(o);var p=0==(0|t._crypto_pwhash_str_verify(n,o,h,0));return v(s),p}function Er(e,r,a){var _=[];i(a),e=m(_,e,"privateKey");var s,n=0|t._crypto_scalarmult_scalarbytes();e.length!==n&&b(_,"invalid privateKey length"),s=u(e),_.push(s),r=m(_,r,"publicKey");var c,o=0|t._crypto_scalarmult_bytes();r.length!==o&&b(_,"invalid publicKey length"),c=u(r),_.push(c);var h=new l(0|t._crypto_scalarmult_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_scalarmult(y,s,c))){var d=p(h,a);return v(_),d}g(_,"weak public key");}function xr(e,r){var a=[];i(r),e=m(a,e,"privateKey");var _,s=0|t._crypto_scalarmult_scalarbytes();e.length!==s&&b(a,"invalid privateKey length"),_=u(e),a.push(_);var n=new l(0|t._crypto_scalarmult_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_scalarmult_base(c,_))){var o=p(n,r);return v(a),o}g(a,"unknown error");}function kr(e,r,a){var _=[];i(a),e=m(_,e,"n");var s,n=0|t._crypto_scalarmult_ed25519_scalarbytes();e.length!==n&&b(_,"invalid n length"),s=u(e),_.push(s),r=m(_,r,"p");var c,o=0|t._crypto_scalarmult_ed25519_bytes();r.length!==o&&b(_,"invalid p length"),c=u(r),_.push(c);var h=new l(0|t._crypto_scalarmult_ed25519_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_scalarmult_ed25519(y,s,c))){var d=p(h,a);return v(_),d}g(_,"invalid point or scalar is 0");}function Sr(e,r){var a=[];i(r),e=m(a,e,"scalar");var _,s=0|t._crypto_scalarmult_ed25519_scalarbytes();e.length!==s&&b(a,"invalid scalar length"),_=u(e),a.push(_);var n=new l(0|t._crypto_scalarmult_ed25519_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_scalarmult_ed25519_base(c,_))){var o=p(n,r);return v(a),o}g(a,"scalar is 0");}function Tr(e,r){var a=[];i(r),e=m(a,e,"scalar");var _,s=0|t._crypto_scalarmult_ed25519_scalarbytes();e.length!==s&&b(a,"invalid scalar length"),_=u(e),a.push(_);var n=new l(0|t._crypto_scalarmult_ed25519_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_scalarmult_ed25519_base_noclamp(c,_))){var o=p(n,r);return v(a),o}g(a,"scalar is 0");}function wr(e,r,a){var _=[];i(a),e=m(_,e,"n");var s,n=0|t._crypto_scalarmult_ed25519_scalarbytes();e.length!==n&&b(_,"invalid n length"),s=u(e),_.push(s),r=m(_,r,"p");var c,o=0|t._crypto_scalarmult_ed25519_bytes();r.length!==o&&b(_,"invalid p length"),c=u(r),_.push(c);var h=new l(0|t._crypto_scalarmult_ed25519_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_scalarmult_ed25519_noclamp(y,s,c))){var d=p(h,a);return v(_),d}g(_,"invalid point or scalar is 0");}function Yr(e,r,a){var _=[];i(a),e=m(_,e,"scalar");var s,n=0|t._crypto_scalarmult_ristretto255_scalarbytes();e.length!==n&&b(_,"invalid scalar length"),s=u(e),_.push(s),r=m(_,r,"element");var c,o=0|t._crypto_scalarmult_ristretto255_bytes();r.length!==o&&b(_,"invalid element length"),c=u(r),_.push(c);var h=new l(0|t._crypto_scalarmult_ristretto255_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_scalarmult_ristretto255(y,s,c))){var d=p(h,a);return v(_),d}g(_,"result is identity element");}function Br(e,r){var a=[];i(r),e=m(a,e,"scalar");var _,s=0|t._crypto_core_ristretto255_scalarbytes();e.length!==s&&b(a,"invalid scalar length"),_=u(e),a.push(_);var n=new l(0|t._crypto_core_ristretto255_bytes()),c=n.address;if(a.push(c),0==(0|t._crypto_scalarmult_ristretto255_base(c,_))){var o=p(n,r);return v(a),o}g(a,"scalar is 0");}function Ar(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_secretbox_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"key");var y,d=0|t._crypto_secretbox_keybytes();a.length!==d&&b(s,"invalid key length"),y=u(a),s.push(y);var f=new l(0|c),E=f.address;s.push(E);var x=new l(0|t._crypto_secretbox_macbytes()),k=x.address;if(s.push(k),0==(0|t._crypto_secretbox_detached(E,k,n,c,0,o,y))){var S=p({mac:x,cipher:f},_);return v(s),S}g(s,"invalid usage");}function Kr(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_secretbox_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"key");var y,d=0|t._crypto_secretbox_keybytes();a.length!==d&&b(s,"invalid key length"),y=u(a),s.push(y);var f=new l(c+t._crypto_secretbox_macbytes()|0),E=f.address;if(s.push(E),0==(0|t._crypto_secretbox_easy(E,n,c,0,o,y))){var x=p(f,_);return v(s),x}g(s,"invalid usage");}function Mr(e){var r=[];i(e);var a=new l(0|t._crypto_secretbox_keybytes()),_=a.address;r.push(_),t._crypto_secretbox_keygen(_);var s=p(a,e);return v(r),s}function Ir(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"ciphertext")),o=e.length;n.push(c),r=m(n,r,"mac");var h,y=0|t._crypto_secretbox_macbytes();r.length!==y&&b(n,"invalid mac length"),h=u(r),n.push(h),a=m(n,a,"nonce");var d,f=0|t._crypto_secretbox_noncebytes();a.length!==f&&b(n,"invalid nonce length"),d=u(a),n.push(d),_=m(n,_,"key");var E,x=0|t._crypto_secretbox_keybytes();_.length!==x&&b(n,"invalid key length"),E=u(_),n.push(E);var k=new l(0|o),S=k.address;if(n.push(S),0==(0|t._crypto_secretbox_open_detached(S,c,h,o,0,d,E))){var T=p(k,s);return v(n),T}g(n,"wrong secret key for the given ciphertext");}function Nr(e,r,a,_){var s=[];i(_),e=m(s,e,"ciphertext");var n,c=t._crypto_secretbox_macbytes(),o=e.length;o<c&&b(s,"ciphertext is too short"),n=u(e),s.push(n),r=m(s,r,"nonce");var h,y=0|t._crypto_secretbox_noncebytes();r.length!==y&&b(s,"invalid nonce length"),h=u(r),s.push(h),a=m(s,a,"key");var d,f=0|t._crypto_secretbox_keybytes();a.length!==f&&b(s,"invalid key length"),d=u(a),s.push(d);var E=new l(o-t._crypto_secretbox_macbytes()|0),x=E.address;if(s.push(x),0==(0|t._crypto_secretbox_open_easy(x,n,o,0,h,d))){var k=p(E,_);return v(s),k}g(s,"wrong secret key for the given ciphertext");}function Lr(e,r,a){var _=[];i(a),e=m(_,e,"header");var s,n=0|t._crypto_secretstream_xchacha20poly1305_headerbytes();e.length!==n&&b(_,"invalid header length"),s=u(e),_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_secretstream_xchacha20poly1305_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(52).address;if(0==(0|t._crypto_secretstream_xchacha20poly1305_init_pull(h,s,c))){var p=h;return v(_),p}g(_,"invalid usage");}function Ur(e,r){var a=[];i(r),e=m(a,e,"key");var _,s=0|t._crypto_secretstream_xchacha20poly1305_keybytes();e.length!==s&&b(a,"invalid key length"),_=u(e),a.push(_);var n=new l(52).address,c=new l(0|t._crypto_secretstream_xchacha20poly1305_headerbytes()),o=c.address;if(a.push(o),0==(0|t._crypto_secretstream_xchacha20poly1305_init_push(n,o,_))){var h={state:n,header:p(c,r)};return v(a),h}g(a,"invalid usage");}function Or(e){var r=[];i(e);var a=new l(0|t._crypto_secretstream_xchacha20poly1305_keybytes()),_=a.address;r.push(_),t._crypto_secretstream_xchacha20poly1305_keygen(_);var s=p(a,e);return v(r),s}function Cr(e,r,a,_){var s=[];i(_),f(s,e,"state_address"),r=m(s,r,"cipher");var n,c=t._crypto_secretstream_xchacha20poly1305_abytes(),o=r.length;o<c&&b(s,"cipher is too short"),n=u(r),s.push(n);var h=null,y=0;null!=a&&(h=u(a=m(s,a,"ad")),y=a.length,s.push(h));var g=new l(o-t._crypto_secretstream_xchacha20poly1305_abytes()|0),E=g.address;s.push(E);var x,k=(x=d(1),s.push(x),(k=0===t._crypto_secretstream_xchacha20poly1305_pull(e,E,0,x,n,o,0,h,y)&&{tag:t.HEAPU8[x],message:g})&&{message:p(k.message,_),tag:k.tag});return v(s),k}function Rr(e,r,a,_,s){var n=[];i(s),f(n,e,"state_address");var c=u(r=m(n,r,"message_chunk")),o=r.length;n.push(c);var h=null,y=0;null!=a&&(h=u(a=m(n,a,"ad")),y=a.length,n.push(h)),f(n,_,"tag"),("number"!=typeof _||(0|_)!==_||_<0)&&b(n,"tag must be an unsigned integer");var d=new l(o+t._crypto_secretstream_xchacha20poly1305_abytes()|0),E=d.address;if(n.push(E),0==(0|t._crypto_secretstream_xchacha20poly1305_push(e,E,0,c,o,0,h,y,0,_))){var x=p(d,s);return v(n),x}g(n,"invalid usage");}function Pr(e,r){var a=[];return i(r),f(a,e,"state_address"),t._crypto_secretstream_xchacha20poly1305_rekey(e),v(a),!0}function Gr(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_shorthash_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_shorthash_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_shorthash(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function Xr(e){var r=[];i(e);var a=new l(0|t._crypto_shorthash_keybytes()),_=a.address;r.push(_),t._crypto_shorthash_keygen(_);var s=p(a,e);return v(r),s}function Dr(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"key");var c,o=0|t._crypto_shorthash_siphashx24_keybytes();r.length!==o&&b(_,"invalid key length"),c=u(r),_.push(c);var h=new l(0|t._crypto_shorthash_siphashx24_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_shorthash_siphashx24(y,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function Fr(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"privateKey");var c,o=0|t._crypto_sign_secretkeybytes();r.length!==o&&b(_,"invalid privateKey length"),c=u(r),_.push(c);var h=new l(e.length+t._crypto_sign_bytes()|0),y=h.address;if(_.push(y),0==(0|t._crypto_sign(y,null,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function Vr(e,r,a){var _=[];i(a);var s=u(e=m(_,e,"message")),n=e.length;_.push(s),r=m(_,r,"privateKey");var c,o=0|t._crypto_sign_secretkeybytes();r.length!==o&&b(_,"invalid privateKey length"),c=u(r),_.push(c);var h=new l(0|t._crypto_sign_bytes()),y=h.address;if(_.push(y),0==(0|t._crypto_sign_detached(y,null,s,n,0,c))){var d=p(h,a);return v(_),d}g(_,"invalid usage");}function Hr(e,r){var a=[];i(r),e=m(a,e,"edPk");var _,s=0|t._crypto_sign_publickeybytes();e.length!==s&&b(a,"invalid edPk length"),_=u(e),a.push(_);var n=new l(0|t._crypto_scalarmult_scalarbytes()),c=n.address;if(a.push(c),0==(0|t._crypto_sign_ed25519_pk_to_curve25519(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid key");}function qr(e,r){var a=[];i(r),e=m(a,e,"edSk");var _,s=0|t._crypto_sign_secretkeybytes();e.length!==s&&b(a,"invalid edSk length"),_=u(e),a.push(_);var n=new l(0|t._crypto_scalarmult_scalarbytes()),c=n.address;if(a.push(c),0==(0|t._crypto_sign_ed25519_sk_to_curve25519(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid key");}function jr(e,r){var a=[];i(r),e=m(a,e,"privateKey");var _,s=0|t._crypto_sign_secretkeybytes();e.length!==s&&b(a,"invalid privateKey length"),_=u(e),a.push(_);var n=new l(0|t._crypto_sign_publickeybytes()),c=n.address;if(a.push(c),0==(0|t._crypto_sign_ed25519_sk_to_pk(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid key");}function zr(e,r){var a=[];i(r),e=m(a,e,"privateKey");var _,s=0|t._crypto_sign_secretkeybytes();e.length!==s&&b(a,"invalid privateKey length"),_=u(e),a.push(_);var n=new l(0|t._crypto_sign_seedbytes()),c=n.address;if(a.push(c),0==(0|t._crypto_sign_ed25519_sk_to_seed(c,_))){var o=p(n,r);return v(a),o}g(a,"invalid key");}function Wr(e,r,a){var _=[];i(a),f(_,e,"state_address"),r=m(_,r,"privateKey");var s,n=0|t._crypto_sign_secretkeybytes();r.length!==n&&b(_,"invalid privateKey length"),s=u(r),_.push(s);var c=new l(0|t._crypto_sign_bytes()),o=c.address;if(_.push(o),0==(0|t._crypto_sign_final_create(e,o,null,s))){var h=(t._free(e),p(c,a));return v(_),h}g(_,"invalid usage");}function Jr(e,r,a,_){var s=[];i(_),f(s,e,"state_address"),r=m(s,r,"signature");var n,c=0|t._crypto_sign_bytes();r.length!==c&&b(s,"invalid signature length"),n=u(r),s.push(n),a=m(s,a,"publicKey");var o,h=0|t._crypto_sign_publickeybytes();a.length!==h&&b(s,"invalid publicKey length"),o=u(a),s.push(o);var p=0==(0|t._crypto_sign_final_verify(e,n,o));return v(s),p}function Qr(e){var r=[];i(e);var a=new l(208).address;if(0==(0|t._crypto_sign_init(a))){var _=a;return v(r),_}g(r,"internal error");}function Zr(e){var r=[];i(e);var a=new l(0|t._crypto_sign_publickeybytes()),_=a.address;r.push(_);var s=new l(0|t._crypto_sign_secretkeybytes()),n=s.address;if(r.push(n),0==(0|t._crypto_sign_keypair(_,n))){var c={publicKey:p(a,e),privateKey:p(s,e),keyType:"ed25519"};return v(r),c}g(r,"internal error");}function $r(e,r,a){var _=[];i(a),e=m(_,e,"signedMessage");var s,n=t._crypto_sign_bytes(),c=e.length;c<n&&b(_,"signedMessage is too short"),s=u(e),_.push(s),r=m(_,r,"publicKey");var o,h=0|t._crypto_sign_publickeybytes();r.length!==h&&b(_,"invalid publicKey length"),o=u(r),_.push(o);var y=new l(c-t._crypto_sign_bytes()|0),d=y.address;if(_.push(d),0==(0|t._crypto_sign_open(d,null,s,c,0,o))){var f=p(y,a);return v(_),f}g(_,"incorrect signature for the given public key");}function et(e,r){var a=[];i(r),e=m(a,e,"seed");var _,s=0|t._crypto_sign_seedbytes();e.length!==s&&b(a,"invalid seed length"),_=u(e),a.push(_);var n=new l(0|t._crypto_sign_publickeybytes()),c=n.address;a.push(c);var o=new l(0|t._crypto_sign_secretkeybytes()),h=o.address;if(a.push(h),0==(0|t._crypto_sign_seed_keypair(c,h,_))){var y={publicKey:p(n,r),privateKey:p(o,r),keyType:"ed25519"};return v(a),y}g(a,"invalid usage");}function rt(e,r,a){var _=[];i(a),f(_,e,"state_address");var s=u(r=m(_,r,"message_chunk")),n=r.length;_.push(s),0!=(0|t._crypto_sign_update(e,s,n,0))&&g(_,"invalid usage"),v(_);}function tt(e,r,a){var _=[];e=m(_,e,"signature");var s,n=0|t._crypto_sign_bytes();e.length!==n&&b(_,"invalid signature length"),s=u(e),_.push(s);var c=u(r=m(_,r,"message")),o=r.length;_.push(c),a=m(_,a,"publicKey");var h,p=0|t._crypto_sign_publickeybytes();a.length!==p&&b(_,"invalid publicKey length"),h=u(a),_.push(h);var y=0==(0|t._crypto_sign_verify_detached(s,c,o,0,h));return v(_),y}function at(e,r,a,_){var s=[];i(_),f(s,e,"outLength"),("number"!=typeof e||(0|e)!==e||e<0)&&b(s,"outLength must be an unsigned integer"),r=m(s,r,"key");var n,c=0|t._crypto_stream_chacha20_keybytes();r.length!==c&&b(s,"invalid key length"),n=u(r),s.push(n),a=m(s,a,"nonce");var o,h=0|t._crypto_stream_chacha20_noncebytes();a.length!==h&&b(s,"invalid nonce length"),o=u(a),s.push(o);var y=new l(0|e),d=y.address;s.push(d),t._crypto_stream_chacha20(d,e,0,o,n);var g=p(y,_);return v(s),g}function _t(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"input_message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_stream_chacha20_ietf_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"key");var y,d=0|t._crypto_stream_chacha20_ietf_keybytes();a.length!==d&&b(s,"invalid key length"),y=u(a),s.push(y);var f=new l(0|c),E=f.address;if(s.push(E),0===t._crypto_stream_chacha20_ietf_xor(E,n,c,0,o,y)){var x=p(f,_);return v(s),x}g(s,"invalid usage");}function st(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"input_message")),o=e.length;n.push(c),r=m(n,r,"nonce");var h,y=0|t._crypto_stream_chacha20_ietf_noncebytes();r.length!==y&&b(n,"invalid nonce length"),h=u(r),n.push(h),f(n,a,"nonce_increment"),("number"!=typeof a||(0|a)!==a||a<0)&&b(n,"nonce_increment must be an unsigned integer"),_=m(n,_,"key");var d,E=0|t._crypto_stream_chacha20_ietf_keybytes();_.length!==E&&b(n,"invalid key length"),d=u(_),n.push(d);var x=new l(0|o),k=x.address;if(n.push(k),0===t._crypto_stream_chacha20_ietf_xor_ic(k,c,o,0,h,a,d)){var S=p(x,s);return v(n),S}g(n,"invalid usage");}function nt(e){var r=[];i(e);var a=new l(0|t._crypto_stream_chacha20_keybytes()),_=a.address;r.push(_),t._crypto_stream_chacha20_keygen(_);var s=p(a,e);return v(r),s}function ct(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"input_message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_stream_chacha20_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"key");var y,d=0|t._crypto_stream_chacha20_keybytes();a.length!==d&&b(s,"invalid key length"),y=u(a),s.push(y);var f=new l(0|c),E=f.address;if(s.push(E),0===t._crypto_stream_chacha20_xor(E,n,c,0,o,y)){var x=p(f,_);return v(s),x}g(s,"invalid usage");}function ot(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"input_message")),o=e.length;n.push(c),r=m(n,r,"nonce");var h,y=0|t._crypto_stream_chacha20_noncebytes();r.length!==y&&b(n,"invalid nonce length"),h=u(r),n.push(h),f(n,a,"nonce_increment"),("number"!=typeof a||(0|a)!==a||a<0)&&b(n,"nonce_increment must be an unsigned integer"),_=m(n,_,"key");var d,E=0|t._crypto_stream_chacha20_keybytes();_.length!==E&&b(n,"invalid key length"),d=u(_),n.push(d);var x=new l(0|o),k=x.address;if(n.push(k),0===t._crypto_stream_chacha20_xor_ic(k,c,o,0,h,a,0,d)){var S=p(x,s);return v(n),S}g(n,"invalid usage");}function ht(e){var r=[];i(e);var a=new l(0|t._crypto_stream_keybytes()),_=a.address;r.push(_),t._crypto_stream_keygen(_);var s=p(a,e);return v(r),s}function pt(e){var r=[];i(e);var a=new l(0|t._crypto_stream_xchacha20_keybytes()),_=a.address;r.push(_),t._crypto_stream_xchacha20_keygen(_);var s=p(a,e);return v(r),s}function yt(e,r,a,_){var s=[];i(_);var n=u(e=m(s,e,"input_message")),c=e.length;s.push(n),r=m(s,r,"nonce");var o,h=0|t._crypto_stream_xchacha20_noncebytes();r.length!==h&&b(s,"invalid nonce length"),o=u(r),s.push(o),a=m(s,a,"key");var y,d=0|t._crypto_stream_xchacha20_keybytes();a.length!==d&&b(s,"invalid key length"),y=u(a),s.push(y);var f=new l(0|c),E=f.address;if(s.push(E),0===t._crypto_stream_xchacha20_xor(E,n,c,0,o,y)){var x=p(f,_);return v(s),x}g(s,"invalid usage");}function it(e,r,a,_,s){var n=[];i(s);var c=u(e=m(n,e,"input_message")),o=e.length;n.push(c),r=m(n,r,"nonce");var h,y=0|t._crypto_stream_xchacha20_noncebytes();r.length!==y&&b(n,"invalid nonce length"),h=u(r),n.push(h),f(n,a,"nonce_increment"),("number"!=typeof a||(0|a)!==a||a<0)&&b(n,"nonce_increment must be an unsigned integer"),_=m(n,_,"key");var d,E=0|t._crypto_stream_xchacha20_keybytes();_.length!==E&&b(n,"invalid key length"),d=u(_),n.push(d);var x=new l(0|o),k=x.address;if(n.push(k),0===t._crypto_stream_xchacha20_xor_ic(k,c,o,0,h,a,0,d)){var S=p(x,s);return v(n),S}g(n,"invalid usage");}function lt(e,r){var a=[];i(r),f(a,e,"length"),("number"!=typeof e||(0|e)!==e||e<0)&&b(a,"length must be an unsigned integer");var _=new l(0|e),s=_.address;a.push(s),t._randombytes_buf(s,e);var n=p(_,r);return v(a),n}function ut(e,r,a){var _=[];i(a),f(_,e,"length"),("number"!=typeof e||(0|e)!==e||e<0)&&b(_,"length must be an unsigned integer"),r=m(_,r,"seed");var s,n=0|t._randombytes_seedbytes();r.length!==n&&b(_,"invalid seed length"),s=u(r),_.push(s);var c=new l(0|e),o=c.address;_.push(o),t._randombytes_buf_deterministic(o,e,s);var h=p(c,a);return v(_),h}function dt(e){i(e),t._randombytes_close();}function vt(e){i(e);var r=t._randombytes_random()>>>0;return v([]),r}function gt(e,r){var a=[];i(r);for(var _=t._malloc(24),s=0;s<6;s++)t.setValue(_+4*s,t.Runtime.addFunction(e[["implementation_name","random","stir","uniform","buf","close"][s]]),"i32");0!=(0|t._randombytes_set_implementation(_))&&g(a,"unsupported implementation"),v(a);}function bt(e){i(e),t._randombytes_stir();}function ft(e,r){var a=[];i(r),f(a,e,"upper_bound"),("number"!=typeof e||(0|e)!==e||e<0)&&b(a,"upper_bound must be an unsigned integer");var _=t._randombytes_uniform(e)>>>0;return v(a),_}function mt(){var e=t._sodium_version_string(),r=t.UTF8ToString(e);return v([]),r}return l.prototype.to_Uint8Array=function(){var e=new Uint8Array(this.length);return e.set(t.HEAPU8.subarray(this.address,this.address+this.length)),e},e.add=function(e,r){if(!(e instanceof Uint8Array&&r instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can added");var t=e.length,a=0,_=0;if(r.length!=e.length)throw new TypeError("Arguments must have the same length");for(_=0;_<t;_++)a>>=8,a+=e[_]+r[_],e[_]=255&a;},e.base64_variants=c,e.compare=function(e,r){if(!(e instanceof Uint8Array&&r instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can be compared");if(e.length!==r.length)throw new TypeError("Only instances of identical length can be compared");for(var t=0,a=1,_=e.length;_-- >0;)t|=r[_]-e[_]>>8&a,a&=(r[_]^e[_])-1>>8;return t+t+a-1},e.from_base64=function(e,r){r=o(r);var a,_=[],s=new l(3*(e=m(_,e,"input")).length/4),n=u(e),c=d(4),h=d(4);return _.push(n),_.push(s.address),_.push(s.result_bin_len_p),_.push(s.b64_end_p),0!==t._sodium_base642bin(s.address,s.length,n,e.length,0,c,h,r)&&g(_,"invalid input"),t.getValue(h,"i32")-n!==e.length&&g(_,"incomplete input"),s.length=t.getValue(c,"i32"),a=s.to_Uint8Array(),v(_),a},e.from_hex=function(e){var r,a=[],_=new l((e=m(a,e,"input")).length/2),s=u(e),n=d(4);return a.push(s),a.push(_.address),a.push(_.hex_end_p),0!==t._sodium_hex2bin(_.address,_.length,s,e.length,0,0,n)&&g(a,"invalid input"),t.getValue(n,"i32")-s!==e.length&&g(a,"incomplete input"),r=_.to_Uint8Array(),v(a),r},e.from_string=_,e.increment=function(e){if(!(e instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can be incremented");for(var r=256,t=0,a=e.length;t<a;t++)r>>=8,r+=e[t],e[t]=255&r;},e.is_zero=function(e){if(!(e instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can be checked");for(var r=0,t=0,a=e.length;t<a;t++)r|=e[t];return 0===r},e.libsodium=r,e.memcmp=function(e,r){if(!(e instanceof Uint8Array&&r instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can be compared");if(e.length!==r.length)throw new TypeError("Only instances of identical length can be compared");for(var t=0,a=0,_=e.length;a<_;a++)t|=e[a]^r[a];return 0===t},e.memzero=function(e){if(!(e instanceof Uint8Array))throw new TypeError("Only Uint8Array instances can be wiped");for(var r=0,t=e.length;r<t;r++)e[r]=0;},e.output_formats=function(){return ["uint8array","text","hex","base64"]},e.pad=function(e,r){if(!(e instanceof Uint8Array))throw new TypeError("buffer must be a Uint8Array");if((r|=0)<=0)throw new Error("block size must be > 0");var a,_=[],s=d(4),n=1,c=0,o=0|e.length,h=new l(o+r);_.push(s),_.push(h.address);for(var p=h.address,y=h.address+o+r;p<y;p++)t.HEAPU8[p]=e[c],c+=n=1&~((65535&((o-=n)>>>48|o>>>32|o>>>16|o))-1>>16);return 0!==t._sodium_pad(s,h.address,e.length,r,h.length)&&g(_,"internal error"),h.length=t.getValue(s,"i32"),a=h.to_Uint8Array(),v(_),a},e.unpad=function(e,r){if(!(e instanceof Uint8Array))throw new TypeError("buffer must be a Uint8Array");if((r|=0)<=0)throw new Error("block size must be > 0");var a=[],_=u(e),s=d(4);return a.push(_),a.push(s),0!==t._sodium_unpad(s,_,e.length,r)&&g(a,"unsupported/invalid padding"),e=(e=new Uint8Array(e)).subarray(0,t.getValue(s,"i32")),v(a),e},e.ready=a,e.symbols=function(){return Object.keys(e).sort()},e.to_base64=h,e.to_hex=n,e.to_string=s,e}var t="object"==typeof e.sodium&&"function"==typeof e.sodium.onload?e.sodium.onload:null;"string"!=typeof exports.nodeName?r(exports,requireLibsodium()):e.sodium=r(e.commonJsStrict={},e.libsodium),t&&e.sodium.ready.then((function(){t(e.sodium);}));}(commonjsGlobal);
  } (libsodiumWrappers));

  var __importDefault$2 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
  };
  Object.defineProperty(Crypto, "__esModule", { value: true });
  Crypto.genKeyPair = Crypto.randomBytes = Crypto.unbox = Crypto.box = Crypto.init = void 0;
  const libsodium_wrappers_1$1 = __importDefault$2(libsodiumWrappers);
  async function init() {
      await libsodium_wrappers_1$1.default.ready;
  }
  Crypto.init = init;
  function increaseNonce(nonceOriginal) {
      const nonce = Buffer$1.from(nonceOriginal);
      for (let index = nonce.length - 1; index >= 0; index--) {
          const value = nonce.readUInt8(index);
          if (value < 255) {
              nonce.writeUInt8(value + 1, index);
              break;
          }
          nonce.writeUInt8(0, index);
      }
      return nonce;
  }
  /**
   * Box a message and return it.
   * Will increase nonce two times and return the next nonce to be used.
   *
   * @param {Buffer} message The message to be encrypted (max length 65535 bytes)
   * @param {Buffer} nonce An unused nonce to use (24 bytes)
   * @param {Buffer} key The key to encrypt with (32 bytes)
   * @return [boxedMessage, nextNonce]
   * @throws
   */
  function box(message, nonce, key) {
      if (message.length > 65535) {
          throw "Maximum message length is 65535 when boxing it";
      }
      const encryptedBody = libsodium_wrappers_1$1.default.crypto_secretbox_easy(message, nonce, key);
      const headerNonce = increaseNonce(nonce);
      const bodyAuthTag = Buffer$1.from(encryptedBody.slice(0, 16));
      const bodyLength = Buffer$1.alloc(2);
      bodyLength.writeUInt16BE(message.length, 0);
      const header = Buffer$1.concat([bodyLength, bodyAuthTag]); // 18 bytes
      const encryptedHeader = libsodium_wrappers_1$1.default.crypto_secretbox_easy(header, headerNonce, key); // 34 bytes
      const nextNonce = increaseNonce(headerNonce);
      const ciphertext = Buffer$1.concat([Buffer$1.from(encryptedHeader), Buffer$1.from(encryptedBody.slice(16))]);
      return [ciphertext, nextNonce];
  }
  Crypto.box = box;
  /**
   * Will increase nonce two times and return the next nonce to be used.
   * Returns undefined if not enough data available.
   *
   * @param {Buffer} ciphertext The ciphertext to be decrypted
   * @param {Buffer} nonce The first nonce to decrypt with
   * @param {Buffer} key The key to decrypt with
   * @return [unboxedMessage: Buffer, nextNonce: Buffer, bytesConsumed: number] | undefined
   * @throws
   */
  function unbox(ciphertext, nonce, key) {
      if (ciphertext.length < 34) {
          // Not enough data available.
          return undefined;
      }
      const encrypted_header = ciphertext.slice(0, 34);
      const headerNonce = increaseNonce(nonce);
      const headerArray = libsodium_wrappers_1$1.default.crypto_secretbox_open_easy(encrypted_header, headerNonce, key);
      if (!headerArray) {
          throw "Could not unbox header";
      }
      const header = Buffer$1.from(headerArray);
      const bodyLength = header.readUInt16BE(0);
      if (ciphertext.length < 34 + bodyLength) {
          // Not enough data available.
          return undefined;
      }
      const encryptedBody = ciphertext.slice(34, 34 + bodyLength);
      const body = libsodium_wrappers_1$1.default.crypto_secretbox_open_easy(Buffer$1.concat([header.slice(2), encryptedBody]), nonce, key);
      if (!body) {
          throw "Could not unbox body";
      }
      const nextNonce = increaseNonce(headerNonce);
      return [Buffer$1.from(body), nextNonce, 34 + bodyLength];
  }
  Crypto.unbox = unbox;
  function randomBytes(count) {
      return libsodium_wrappers_1$1.default.randombytes_buf(count);
  }
  Crypto.randomBytes = randomBytes;
  function genKeyPair() {
      const keyPair = libsodium_wrappers_1$1.default.crypto_sign_keypair();
      return {
          publicKey: Buffer$1.from(keyPair.publicKey),
          secretKey: Buffer$1.from(keyPair.privateKey)
      };
  }
  Crypto.genKeyPair = genKeyPair;

  var types = {};

  (function (exports) {
  	Object.defineProperty(exports, "__esModule", { value: true });
  	exports.EventType = exports.ExpectingReply = exports.MESSAGE_MAX_BYTES = void 0;
  	/**
  	 * A single message cannot exceed 65535 bytes in total.
  	 */
  	exports.MESSAGE_MAX_BYTES = 65535;
  	(function (ExpectingReply) {
  	    ExpectingReply[ExpectingReply["NONE"] = 0] = "NONE";
  	    ExpectingReply[ExpectingReply["SINGLE"] = 1] = "SINGLE";
  	    ExpectingReply[ExpectingReply["MULTIPLE"] = 2] = "MULTIPLE";
  	})(exports.ExpectingReply || (exports.ExpectingReply = {}));
  	(function (EventType) {
  	    /**
  	     * Data event only emitted on main event emitter on new
  	     * incoming messages (which are not reply messages).
  	     */
  	    EventType["ROUTE"] = "route";
  	    /**
  	     * Data event only emitted on message specific event emitters as
  	     * replies on sent message.
  	     */
  	    EventType["REPLY"] = "reply";
  	    /**
  	     * Socket error event emitted on all event emitters including main.
  	     */
  	    EventType["ERROR"] = "error";
  	    /**
  	     * Socket close event emitted on all event emitters including main.
  	     */
  	    EventType["CLOSE"] = "close";
  	    /**
  	     * Message reply timeout event emitted on message specific event emitters
  	     * who are awaiting replies on sent message.
  	     */
  	    EventType["TIMEOUT"] = "timeout";
  	    /**
  	     * Any event emitted on message specific event emitters for the events:
  	     * REPLY,
  	     * ERROR,
  	     * CLOSE,
  	     * TIMEOUT
  	     * This is useful for having a catch-all event handler when waiting on replies.
  	     */
  	    EventType["ANY"] = "any";
  	})(exports.EventType || (exports.EventType = {}));
  } (types));

  var __importDefault$1 = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
  };
  Object.defineProperty(Messaging$1, "__esModule", { value: true });
  Messaging$1.once = Messaging$1.Messaging = void 0;
  const eventemitter3_1 = __importDefault$1(eventemitter3.exports);
  const Crypto_1 = Crypto;
  __importDefault$1(require$$2); // Only used for synchronous randomBytes.
  const types_1 = types;
  class Messaging {
      constructor(socket) {
          /**
           * Remove a stored pending message so that it cannot receive any more replies.
           */
          this.cancelPendingMessage = (msgId) => {
              delete this.pendingReply[msgId.toString("hex")];
          };
          /**
           * Notify all pending messages and the main emitter about the error.
           *
           */
          this.socketError = (error) => {
              const eventEmitters = this.getAllEventEmitters();
              const errorEvent = {
                  error
              };
              this.emitEvent(eventEmitters, types_1.EventType.ERROR, errorEvent);
              const anyEvent = {
                  type: types_1.EventType.ERROR,
                  event: errorEvent
              };
              this.emitEvent(eventEmitters, types_1.EventType.ANY, anyEvent);
          };
          /**
           * Notify all pending messages about the close.
           */
          this.socketClose = (hadError) => {
              if (this.isClosed) {
                  return;
              }
              this.isClosed = true;
              const eventEmitters = this.getAllEventEmitters();
              this.pendingReply = {}; // Remove all from memory
              const closeEvent = {
                  hadError: Boolean(hadError)
              };
              this.emitEvent(eventEmitters, types_1.EventType.CLOSE, closeEvent);
              const anyEvent = {
                  type: types_1.EventType.CLOSE,
                  event: closeEvent
              };
              this.emitEvent(eventEmitters, types_1.EventType.ANY, anyEvent);
          };
          /**
           * Buffer incoming raw data from the socket.
           * Ping decryptIncoming so it can have a go on the new data.
           */
          this.socketData = (data) => {
              this.incomingQueue.encrypted.push(data);
              this.isBusyIn++;
              this.processInqueue();
          };
          this.processInqueue = async () => {
              if (this.isBusyIn <= 0) {
                  return;
              }
              this.isBusyIn--;
              await this.decryptIncoming();
              if (!this.assembleIncoming()) {
                  // Bad stream, close.
                  this.close();
                  return;
              }
              this.dispatchIncoming();
              this.processInqueue(); // In case someone increased the isBusyIn counter
          };
          /**
           * Decrypt buffers in the inqueue and move them to the dispatch queue.
           */
          this.decryptIncoming = async () => {
              if (this.encryptionKeys) {
                  let chunk = Buffer$1.alloc(0);
                  while (this.incomingQueue.encrypted.length > 0) {
                      const b = this.incomingQueue.encrypted.shift();
                      if (b) {
                          chunk = Buffer$1.concat([chunk, b]);
                      }
                      if (chunk.length === 0) {
                          continue;
                      }
                      // TODO: this we should do in a separate thread
                      try {
                          const ret = (0, Crypto_1.unbox)(chunk, this.encryptionKeys.incomingNonce, this.encryptionKeys.incomingKey);
                          if (!ret) {
                              // Not enough data in chunk
                              if (this.incomingQueue.encrypted.length === 0) {
                                  break;
                              }
                              continue;
                          }
                          const [decrypted, nextNonce, bytesConsumed] = ret;
                          this.encryptionKeys.incomingNonce = nextNonce;
                          this.incomingQueue.decrypted.push(decrypted);
                          chunk = chunk.slice(bytesConsumed);
                      }
                      catch (e) {
                          console.error("Error unboxing message. Closing socket.");
                          this.close();
                          return;
                      }
                  }
                  if (chunk.length > 0) {
                      // Data rest, put ut back to queue
                      this.incomingQueue.encrypted.unshift(chunk);
                  }
              }
              else {
                  // Just move the buffers to the next queue as they are
                  const buffers = this.incomingQueue.encrypted.slice();
                  this.incomingQueue.encrypted.length = 0;
                  this.incomingQueue.decrypted.push(...buffers);
              }
          };
          /**
           * Assemble messages from decrypted data and put to next queue.
           *
           */
          this.assembleIncoming = () => {
              while (this.incomingQueue.decrypted.length > 0) {
                  if (this.incomingQueue.decrypted[0].length < 5) {
                      // Not enough data ready, see if we can collapse
                      if (this.incomingQueue.decrypted.length > 1) {
                          const buf = this.incomingQueue.decrypted.shift();
                          if (buf) {
                              this.incomingQueue.decrypted[0] = Buffer$1.concat([buf, this.incomingQueue.decrypted[0]]);
                          }
                          continue;
                      }
                      return true;
                  }
                  // Check version byte
                  const version = this.incomingQueue.decrypted[0].readUInt8(0);
                  if (version !== 0) {
                      this.incomingQueue.decrypted.length = 0;
                      console.error("Bad stream detected reading version byte.");
                      return false;
                  }
                  const length = this.incomingQueue.decrypted[0].readUInt32LE(1);
                  const buffer = this.extractBuffer(this.incomingQueue.decrypted, length);
                  if (!buffer) {
                      // Not enough data ready
                      return true;
                  }
                  const ret = this.decodeHeader(buffer);
                  if (!ret) {
                      this.incomingQueue.decrypted.length = 0;
                      console.error("Bad stream detected in header.");
                      return false;
                  }
                  const [header, data] = ret;
                  const inMessage = {
                      target: header.target,
                      msgId: header.msgId,
                      data,
                      expectingReply: header.config & (types_1.ExpectingReply.SINGLE + types_1.ExpectingReply.MULTIPLE), // other config bits are reserved for future use
                  };
                  this.incomingQueue.messages.push(inMessage);
              }
              return true;
          };
          /**
           * Dispatch messages on event emitters.
           *
           */
          this.dispatchIncoming = () => {
              while (this.incomingQueue.messages.length > 0) {
                  if (this.dispatchLimit === 0) {
                      // This is corked
                      return;
                  }
                  else if (this.dispatchLimit > 0) {
                      this.dispatchLimit--;
                  }
                  else ;
                  const inMessage = this.incomingQueue.messages.shift();
                  if (inMessage) {
                      // Note: target is not necessarily a msg ID,
                      // but we check if it is.
                      const targetMsgId = inMessage.target.toString("hex");
                      const pendingReply = this.pendingReply[targetMsgId];
                      if (pendingReply) {
                          pendingReply.replyCounter++;
                          pendingReply.isCleared = false;
                          if (pendingReply.stream) {
                              // Expecting many replies, update timeout activity timestamp.
                              pendingReply.timestamp = this.getNow();
                          }
                          else {
                              // Remove pending message if only single message is expected
                              this.cancelPendingMessage(pendingReply.msgId);
                          }
                          // Dispatch reply on message specific event emitter
                          const replyEvent = {
                              toMsgId: inMessage.target,
                              fromMsgId: inMessage.msgId,
                              data: inMessage.data,
                              expectingReply: inMessage.expectingReply
                          };
                          this.emitEvent([pendingReply.eventEmitter], types_1.EventType.REPLY, replyEvent);
                          const anyEvent = {
                              type: types_1.EventType.REPLY,
                              event: replyEvent
                          };
                          this.emitEvent([pendingReply.eventEmitter], types_1.EventType.ANY, anyEvent);
                      }
                      else {
                          // This is not a reply message (or the message was cancelled).
                          // Dispatch on main event emitter.
                          // Do alphanumric check on target string. A-Z, a-z, 0-9, ._-
                          if (inMessage.target.some(char => {
                              if (char >= 49 && char <= 57) {
                                  return false;
                              }
                              if (char >= 65 && char <= 90) {
                                  return false;
                              }
                              if (char >= 97 && char <= 122) {
                                  return false;
                              }
                              if ([45, 46, 95].includes(char)) {
                                  return false;
                              }
                              return true; // non alpha-numeric found
                          })) {
                              // Non alphanumeric found
                              // Ignore this message
                              return;
                          }
                          const routeEvent = {
                              target: inMessage.target.toString(),
                              fromMsgId: inMessage.msgId,
                              data: inMessage.data,
                              expectingReply: inMessage.expectingReply
                          };
                          this.emitEvent([this.eventEmitter], types_1.EventType.ROUTE, routeEvent);
                      }
                  }
              }
          };
          this.processOutqueue = async () => {
              if (this.isBusyOut <= 0) {
                  return;
              }
              this.isBusyOut--;
              await this.encryptOutgoing();
              this.dispatchOutgoing();
              this.processOutqueue(); // In case isBusyOut counter got increased
          };
          /**
           * Encrypt and move buffer (or just move buffers if not using encryption) to the next out queue.
           */
          this.encryptOutgoing = async () => {
              if (this.encryptionKeys) {
                  while (this.outgoingQueue.unencrypted.length > 0) {
                      const chunk = this.outgoingQueue.unencrypted.shift();
                      if (!chunk) {
                          continue;
                      }
                      // TODO: here we should use another thread to do the heavy work.
                      const [encrypted, nextNonce] = (0, Crypto_1.box)(chunk, this.encryptionKeys.outgoingNonce, this.encryptionKeys.outgoingKey);
                      this.encryptionKeys.outgoingNonce = nextNonce;
                      this.outgoingQueue.encrypted.push(encrypted);
                  }
              }
              else {
                  const buffers = this.outgoingQueue.unencrypted.slice();
                  this.outgoingQueue.unencrypted.length = 0;
                  this.outgoingQueue.encrypted.push(...buffers);
              }
          };
          this.dispatchOutgoing = () => {
              const buffers = this.outgoingQueue.encrypted.slice();
              this.outgoingQueue.encrypted.length = 0;
              for (let index = 0; index < buffers.length; index++) {
                  this.socket.send(buffers[index]);
              }
          };
          /**
           * Check every pending message to see which have timeouted.
           *
           */
          this.checkTimeouts = () => {
              if (!this.isOpened || this.isClosed) {
                  return;
              }
              const timeouted = this.getTimeoutedPendingMessages();
              for (let index = 0; index < timeouted.length; index++) {
                  const sentMessage = timeouted[index];
                  this.cancelPendingMessage(sentMessage.msgId);
              }
              for (let index = 0; index < timeouted.length; index++) {
                  const sentMessage = timeouted[index];
                  const timeoutEvent = {};
                  this.emitEvent([sentMessage.eventEmitter], types_1.EventType.TIMEOUT, timeoutEvent);
                  const anyEvent = {
                      type: types_1.EventType.TIMEOUT,
                      event: timeoutEvent
                  };
                  this.emitEvent([sentMessage.eventEmitter], types_1.EventType.ANY, anyEvent);
              }
              setTimeout(this.checkTimeouts, 500);
          };
          /**
           * This pauses all timeouts for a message until the next message arrives then timeouts are re-activated (if set initially ofc).
           * This could be useful when expecting a never ending stream of messages where chunks could be time apart.
           */
          this.clearTimeout = (msgId) => {
              const sentMessage = this.pendingReply[msgId.toString("hex")];
              if (sentMessage) {
                  sentMessage.isCleared = true;
              }
          };
          this.socket = socket;
          this.pendingReply = {};
          this.isOpened = false;
          this.isClosed = false;
          this.dispatchLimit = -1;
          this.isBusyOut = 0;
          this.isBusyIn = 0;
          this.instanceId = Buffer$1.from(window.crypto.getRandomValues(new Uint8Array(8))).toString("hex");
          this.incomingQueue = {
              encrypted: [],
              decrypted: [],
              messages: []
          };
          this.outgoingQueue = {
              unencrypted: [],
              encrypted: []
          };
          this.eventEmitter = new eventemitter3_1.default();
      }
      getInstanceId() {
          return this.instanceId;
      }
      /**
       * Pass in the params returned from a successful handshake.
       *
       * @param peerPublicKey our peer's long term public key, only stored for convenience, is not used in encryption.
       */
      async setEncrypted(outgoingKey, outgoingNonce, incomingKey, incomingNonce, peerPublicKey) {
          await (0, Crypto_1.init)(); // init sodium
          this.encryptionKeys = {
              outgoingKey,
              outgoingNonce,
              incomingKey,
              incomingNonce,
              peerPublicKey,
          };
      }
      getPeerPublicKey() {
          var _a;
          return ((_a = this.encryptionKeys) === null || _a === void 0 ? void 0 : _a.peerPublicKey) || undefined;
      }
      setUnencrypted() {
          this.encryptionKeys = undefined;
      }
      /**
       * Get the general event emitter object.
       * This is used to listen for incoming messages
       * and socket events such as close and error.
       */
      getEventEmitter() {
          return this.eventEmitter;
      }
      /**
       * Open this Messaging object for communication.
       * Don't open it until you have hooked the event emitter.
       */
      open() {
          if (this.isOpened || this.isClosed) {
              return;
          }
          this.isOpened = true;
          this.socket.onError(this.socketError);
          this.socket.onClose(this.socketClose);
          this.socket.onData(this.socketData);
          this.checkTimeouts();
      }
      isOpen() {
          return this.isOpened && !this.isClosed;
      }
      /**
       * Close this Messaging object and it's socket.
       *
       */
      close() {
          if (!this.isOpened) {
              return;
          }
          if (this.isClosed) {
              return;
          }
          this.socket.close();
      }
      cork() {
          this.dispatchLimit = 0;
      }
      uncork(limit) {
          this.dispatchLimit = limit !== null && limit !== void 0 ? limit : -1;
      }
      /**
       * Send message to remote.
       *
       * The returned EventEmitter can be hooked as eventEmitter.on("reply", fn) or
       *  const data: ReplyEvent = await once(eventEmitter, "reply");
       *  Other events are "close" (CloseEvent) and "any" which trigger both for "reply", "close" and "error" (ErrorEvent). There is also "timeout" (TimeoutEvent).
       *
       * A timeouted message is removed from memory and a TIMEOUT is emitted.
       *
       * @param target: Buffer | string either set as routing target as string, or as message ID in reply to (as buffer).
       *  The receiving Messaging instance will check if target matches a msg ID which is waiting for a reply and in such case the message till be emitted on that EventEmitter,
       *  or else it will pass it to the router to see if it matches some route.
       * @param data: Buffer of data to be sent. Note that data cannot exceed MESSAGE_MAX_BYTES (64 KiB).
       * @param timeout milliseconds to wait for the first reply (defaults to undefined)
       *     undefined means we are not expecting a reply
       *     0 or greater means that we are expecting a reply, 0 means wait forever
       * @param stream set to true if expecting multiple replies (defaults to false)
       *     This requires that timeout is set to 0 or greater
       * @param timeoutStream milliseconds to wait for secondary replies, 0 means forever (default).
       *     Only relevant if expecting multiple replies (stream = true).
       * @return SendReturn | undefined
       *     msgId is always set
       *     eventEmitter property is set if expecting reply
       */
      send(target, data, timeout = undefined, stream = false, timeoutStream = 0) {
          if (!this.isOpened) {
              return undefined;
          }
          if (this.isClosed) {
              return undefined;
          }
          if (typeof target === "string") {
              target = Buffer$1.from(target);
          }
          data = data !== null && data !== void 0 ? data : Buffer$1.alloc(0);
          if (data.length > types_1.MESSAGE_MAX_BYTES) {
              throw `Data chunk to send cannot exceed ${types_1.MESSAGE_MAX_BYTES} bytes. Trying to send ${data.length} bytes`;
          }
          if (target.length > 255) {
              throw "target length cannot exceed 255 bytes";
          }
          const msgId = this.generateMsgId();
          const expectingReply = typeof timeout === "number" ? (stream ? types_1.ExpectingReply.MULTIPLE : types_1.ExpectingReply.SINGLE) : types_1.ExpectingReply.NONE;
          const header = {
              version: 0,
              target,
              dataLength: data.length,
              msgId,
              config: expectingReply
          };
          const headerBuffer = this.encodeHeader(header);
          this.outgoingQueue.unencrypted.push(headerBuffer);
          this.outgoingQueue.unencrypted.push(data);
          this.isBusyOut++;
          setImmediate(this.processOutqueue);
          if (expectingReply === types_1.ExpectingReply.NONE) {
              return { msgId };
          }
          const eventEmitter = new eventemitter3_1.default();
          this.pendingReply[msgId.toString("hex")] = {
              timestamp: this.getNow(),
              msgId,
              timeout: Number(timeout),
              stream: Boolean(stream),
              eventEmitter,
              timeoutStream: timeoutStream,
              replyCounter: 0,
              isCleared: false,
          };
          return { eventEmitter, msgId };
      }
      getNow() {
          return Date.now();
      }
      generateMsgId() {
          const msgId = Buffer$1.from(window.crypto.getRandomValues(new Uint8Array(4)));
          return msgId;
      }
      encodeHeader(header) {
          if (header.target.length > 255) {
              throw "Target length cannot exceed 255 bytes.";
          }
          if (header.msgId.length !== 4) {
              throw "msgId length must be exactly 4 bytes long.";
          }
          const headerLength = 1 + 4 + 1 + 4 + 1 + header.target.length;
          const totalLength = headerLength + header.dataLength;
          const buffer = Buffer$1.alloc(headerLength);
          let pos = 0;
          buffer.writeUInt8(pos, header.version);
          pos++;
          buffer.writeUInt32LE(totalLength, pos);
          pos = pos + 4;
          buffer.writeUInt8(header.config, pos);
          pos++;
          header.msgId.copy(buffer, pos);
          pos = pos + header.msgId.length;
          buffer.writeUInt8(header.target.length, pos);
          pos++;
          header.target.copy(buffer, pos);
          return buffer;
      }
      decodeHeader(buffer) {
          let pos = 0;
          const version = buffer.readUInt8(pos);
          if (version !== 0) {
              throw "Unexpected version nr. Only supporting version 0.";
          }
          pos++;
          const totalLength = buffer.readUInt32LE(pos);
          if (totalLength !== buffer.length) {
              throw "Mismatch in expected length and provided buffer length.";
          }
          pos = pos + 4;
          const config = buffer.readUInt8(pos);
          pos++;
          const msgId = buffer.slice(pos, pos + 4);
          pos = pos + 4;
          const targetLength = buffer.readUInt8(pos);
          pos++;
          const target = buffer.slice(pos, pos + targetLength);
          pos = pos + targetLength;
          const data = buffer.slice(pos);
          const dataLength = data.length;
          const header = {
              version,
              target,
              msgId,
              config,
              dataLength
          };
          return [header, data];
      }
      /**
      * Extract length as single buffer and modify the buffers array in place.
      *
      */
      extractBuffer(buffers, length) {
          let count = 0;
          for (let index = 0; index < buffers.length; index++) {
              count = count + buffers[index].length;
          }
          if (count < length) {
              // Not enough data ready.
              return undefined;
          }
          let extracted = Buffer$1.alloc(0);
          while (extracted.length < length) {
              const bytesNeeded = length - extracted.length;
              const buffer = buffers[0];
              if (buffer.length <= bytesNeeded) {
                  // Take the whole buffer and remove it from list
                  buffers.shift();
                  extracted = Buffer$1.concat([extracted, buffer]);
              }
              else {
                  // Take part of the buffer and modify it in place
                  extracted = Buffer$1.concat([extracted, buffer.slice(0, bytesNeeded)]);
                  buffers[0] = buffer.slice(bytesNeeded);
              }
          }
          return extracted;
      }
      emitEvent(eventEmitters, eventType, arg) {
          for (let index = 0; index < eventEmitters.length; index++) {
              eventEmitters[index].emit(eventType, arg);
          }
      }
      getAllEventEmitters() {
          const eventEmitters = [];
          for (let msgId in this.pendingReply) {
              eventEmitters.push(this.pendingReply[msgId].eventEmitter);
          }
          eventEmitters.push(this.eventEmitter);
          return eventEmitters;
      }
      getTimeoutedPendingMessages() {
          const timeouted = [];
          const now = this.getNow();
          for (let msgId in this.pendingReply) {
              const sentMessage = this.pendingReply[msgId];
              if (sentMessage.isCleared) {
                  continue;
              }
              if (sentMessage.replyCounter === 0) {
                  if (sentMessage.timeout && now > sentMessage.timestamp + sentMessage.timeout) {
                      timeouted.push(sentMessage);
                  }
              }
              else {
                  if (sentMessage.timeoutStream && now > sentMessage.timestamp + sentMessage.timeoutStream) {
                      timeouted.push(sentMessage);
                  }
              }
          }
          return timeouted;
      }
  }
  Messaging$1.Messaging = Messaging;
  /**
  * Mimicking the async/await once function from the nodejs events module.
  * Because EventEmitter3 module doesn't seem to support the async/await promise feature of nodejs events once() function.
  */
  function once(eventEmitter, eventName) {
      return new Promise((resolve, reject) => {
          try {
              eventEmitter.once(eventName, resolve);
          }
          catch (e) {
              reject(e);
          }
      });
  }
  Messaging$1.once = once;

  var Handshake = {};

  /**
   * A four way client-server handshake, as excellently described in https://ssbc.github.io/scuttlebutt-protocol-guide/,
   * with one added version byte and functionality to mitigate ddos attacks,
   * and added client/server data exchange for swapping application parameters.
   */
  var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
      return (mod && mod.__esModule) ? mod : { "default": mod };
  };
  Object.defineProperty(Handshake, "__esModule", { value: true });
  Handshake.HandshakeAsServer = Handshake.HandshakeAsClient = void 0;
  const libsodium_wrappers_1 = __importDefault(libsodiumWrappers);
  const pocket_sockets_1 = build$1;
  // Single byte depicting the version of the handshake protocol.
  const Version = Buffer$1.from([0]);
  // Compare two buffers in constant time
  function Equals(a, b) {
      if (a.length !== b.length) {
          // Cannot compare buffers of different lengths in constant time
          return false;
      }
      let result = 0; // == buffers are equal.
      for (let i = 0; i < a.length; i++) {
          result |= a[i] ^ b[i];
      }
      return result === 0; // true if buffers are equal
  }
  function createEphemeralKeys() {
      const keyPair = libsodium_wrappers_1.default.crypto_box_keypair();
      return {
          publicKey: Buffer$1.from(keyPair.publicKey),
          secretKey: Buffer$1.from(keyPair.privateKey)
      };
  }
  function hmac(msg, key) {
      const hmac = libsodium_wrappers_1.default.crypto_auth(msg, key);
      return Buffer$1.from(hmac);
  }
  function assertHmac(clientHmac, msg, key) {
      const hmac2 = hmac(msg, key);
      return Equals(hmac2, clientHmac);
  }
  function clientSharedSecret_ab(clientEphemeralSk, serverEphemeralPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(clientEphemeralSk, serverEphemeralPk));
  }
  function serverSharedSecret_ab(serverEphemeralSk, clientEphemeralPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(serverEphemeralSk, clientEphemeralPk));
  }
  function clientSharedSecret_aB(clientEphemeralPk, serverLongtermPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(clientEphemeralPk, libsodium_wrappers_1.default.crypto_sign_ed25519_pk_to_curve25519(serverLongtermPk)));
  }
  function serverSharedSecret_aB(serverLongtermSk, clientEphemeralPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(libsodium_wrappers_1.default.crypto_sign_ed25519_sk_to_curve25519(serverLongtermSk), clientEphemeralPk));
  }
  function clientSharedSecret_Ab(clientLongtermSk, serverEphemeralPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(libsodium_wrappers_1.default.crypto_sign_ed25519_sk_to_curve25519(clientLongtermSk), serverEphemeralPk));
  }
  function serverSharedSecret_Ab(serverEphemeralSk, clientLongtermPk) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_scalarmult(serverEphemeralSk, libsodium_wrappers_1.default.crypto_sign_ed25519_pk_to_curve25519(clientLongtermPk)));
  }
  function signDetached(msg, secretKey) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_sign_detached(msg, secretKey));
  }
  function signVerifyDetached(msg, sig, publicKey) {
      return libsodium_wrappers_1.default.crypto_sign_verify_detached(sig, msg, publicKey);
  }
  function secretBox(msg, nonce, key) {
      return Buffer$1.from(libsodium_wrappers_1.default.crypto_secretbox_easy(msg, nonce, key));
  }
  function secretBoxOpen(ciphertext, nonce, key) {
      const unboxed = libsodium_wrappers_1.default.crypto_secretbox_open_easy(ciphertext, nonce, key);
      if (!unboxed) {
          throw "Could not open box";
      }
      return Buffer$1.from(unboxed);
  }
  function calcClientToServerKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, serverLongtermPk, serverEphemeralPk) {
      const inner = hashFn(hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab])));
      const clientToServerKey = hashFn(Buffer$1.concat([inner, serverLongtermPk]));
      const clientNonce = hmac(serverEphemeralPk, discriminator).slice(0, 24);
      return [clientToServerKey, clientNonce];
  }
  function calcServerToClientKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, clientLongtermPk, clientEphemeralPk) {
      const inner = hashFn(hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab])));
      const serverToClientKey = hashFn(Buffer$1.concat([inner, clientLongtermPk]));
      const serverNonce = hmac(clientEphemeralPk, discriminator).slice(0, 24);
      return [serverToClientKey, serverNonce];
  }
  function hashFn(message) {
      const digest = libsodium_wrappers_1.default.crypto_generichash(32, message);
      return Buffer$1.from(digest);
  }
  /**
   * Client creates message 1 (65 bytes).
   *
   * @return 1 byte version + 32 bytes hmac + 32 bytes clientEphemeralPk
   */
  function message1(clientEphemeralPk, discriminator) {
      if (clientEphemeralPk.length !== 32) {
          throw "clientEphemeralPk must be 32 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      const clientHmac = hmac(clientEphemeralPk, discriminator);
      return Buffer$1.concat([Version, clientHmac, clientEphemeralPk]);
  }
  /**
   * Server verifies client message 1.
   * @return client ephemeral public key on success, else throw exception.
   * @throws
   */
  function verifyMessage1(msg1, discriminator) {
      if (msg1.length !== 65) {
          throw "Incoming message 1 must be 65 bytes long";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      const version = msg1.slice(0, 1);
      // Check so versions match.
      if (!Equals(version, Version)) {
          throw "Mismatching version of the handshake";
      }
      const hmac = msg1.slice(1, 1 + 32);
      const clientEphemeralPk = msg1.slice(1 + 32, 1 + 32 + 32);
      if (assertHmac(hmac, clientEphemeralPk, discriminator)) {
          return clientEphemeralPk;
      }
      throw "Non matching discriminators";
  }
  /**
   * Server creates message 2 (65 bytes).
   * @return msg2: Buffer
   */
  function message2(difficulty, serverEphemeralPk, discriminator) {
      if (difficulty.length !== 1) {
          throw "Difficulty must be of length 1 bytes";
      }
      if (serverEphemeralPk.length !== 32) {
          throw "ServerEphemeralPk must be of length 32 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      const serverHmac = hmac(Buffer$1.concat([difficulty, serverEphemeralPk]), discriminator);
      return Buffer$1.concat([serverHmac, difficulty, serverEphemeralPk]);
  }
  /**
   * Client verifies first server message (message 2: 65 bytes).
   * Return server ephemeral public key on success.
   * Throws on error.
   * @return serverEphemeralPk
   * @throws
   */
  function verifyMessage2(msg2, discriminator) {
      if (msg2.length !== 65) {
          throw "Incoming message 2 must be of 65 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      const hmac = msg2.slice(0, 32);
      const difficulty = msg2.slice(32, 33);
      const serverEphemeralPk = msg2.slice(33, 65);
      if (assertHmac(hmac, Buffer$1.concat([difficulty, serverEphemeralPk]), discriminator)) {
          return [difficulty, serverEphemeralPk];
      }
      throw "Non matching discriminators";
  }
  /**
   * Client creates its second message (message 3: variable length).
   * @return ciphertext: Buffer
   */
  function message3(detachedSigA, nonce, discriminator, clientLongtermPk, sharedSecret_ab, sharedSecret_aB, clientData) {
      if (detachedSigA.length !== 64) {
          throw "detachedSigA must be 64 bytes";
      }
      if (nonce.length !== 4) {
          throw "Nonce must be 4 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      if (clientLongtermPk.length !== 32) {
          throw "ServerEphemeralPk must be of length 32 bytes";
      }
      if (sharedSecret_ab.length !== 32) {
          throw "sharedSecret_ab must be of length 32 bytes";
      }
      if (sharedSecret_aB.length !== 32) {
          throw "sharedSecret_aB must be of length 32 bytes";
      }
      if (!clientData) {
          clientData = Buffer$1.alloc(0);
      }
      if (clientData.length > 1024 * 60) {
          throw "Client data cannot exceed 60 KiB";
      }
      const message = Buffer$1.concat([detachedSigA, nonce, clientLongtermPk, clientData]);
      const boxNonce = Buffer$1.alloc(24).fill(0);
      const key = hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB]));
      const ciphertext = Buffer$1.from(secretBox(message, boxNonce, key));
      const length = Buffer$1.alloc(2); // Prepend ciphertext with two bytes describing length
      length.writeUInt16BE(ciphertext.length, 0);
      return Buffer$1.concat([length, ciphertext]);
  }
  /**
   * Server verifies message 3.
   * Return client longterm public key, the detachedSigA, and the arbitrary variable length client data on success.
   * Throws exception on error.
   * @return [clientLongtermPk, detachedSigA, clientData]
   * @throws
   */
  function verifyMessage3(msg3, serverLongtermPk, discriminator, sharedSecret_ab, sharedSecret_aB) {
      if (serverLongtermPk.length !== 32) {
          throw "serverLongtermPk must be of length 32 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      if (sharedSecret_ab.length !== 32) {
          throw "sharedSecret_ab must be of length 32 bytes";
      }
      if (sharedSecret_aB.length !== 32) {
          throw "sharedSecret_aB must be of length 32 bytes";
      }
      const length = msg3.readUInt16BE(0);
      const ciphertext = msg3.slice(2);
      if (ciphertext.length !== length) {
          throw "Mismatching expected length of message 3";
      }
      const boxNonce = Buffer$1.alloc(24).fill(0);
      const key = hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB]));
      const unboxed = secretBoxOpen(ciphertext, boxNonce, key);
      const detachedSigA = unboxed.slice(0, 64);
      const nonce = unboxed.slice(64, 64 + 4);
      const clientLongtermPk = unboxed.slice(64 + 4, 64 + 4 + 32);
      const clientData = unboxed.slice(64 + 4 + 32);
      const msg = Buffer$1.concat([nonce, discriminator, serverLongtermPk, hashFn(sharedSecret_ab)]);
      if (!signVerifyDetached(msg, detachedSigA, clientLongtermPk)) {
          throw "Signature does not match";
      }
      return [nonce, clientLongtermPk, detachedSigA, clientData];
  }
  /**
   * Server creates its second message (message 4) (176 bytes).
   */
  function message4(discriminator, detachedSigA, clientLongtermPk, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, serverLongtermSk, serverData) {
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      if (detachedSigA.length !== 64) {
          throw "detachedSigA must be 64 bytes";
      }
      if (clientLongtermPk.length !== 32) {
          throw "clientLongtermPk must be of length 32 bytes";
      }
      if (sharedSecret_ab.length !== 32) {
          throw "sharedSecret_ab must be of length 32 bytes";
      }
      if (sharedSecret_aB.length !== 32) {
          throw "sharedSecret_aB must be of length 32 bytes";
      }
      if (sharedSecret_Ab.length !== 32) {
          throw "sharedSecret_Ab must be of length 32 bytes";
      }
      if (serverLongtermSk.length !== 64) {
          throw "serverLongtermSk must be of length 64 bytes";
      }
      if (!serverData) {
          serverData = Buffer$1.alloc(0);
      }
      if (serverData.length > 1024 * 60) {
          throw "Server data cannot exceed 60 KiB";
      }
      const detachedSigB = signDetached(Buffer$1.concat([discriminator, detachedSigA, clientLongtermPk, hashFn(sharedSecret_ab)]), serverLongtermSk);
      const boxNonce = Buffer$1.alloc(24).fill(0);
      const key = hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab]));
      const ciphertext = secretBox(Buffer$1.concat([detachedSigB, serverData]), boxNonce, key);
      const length = Buffer$1.alloc(2); // Prepend ciphertext with two bytes describing length
      length.writeUInt16BE(ciphertext.length, 0);
      return Buffer$1.concat([length, ciphertext]);
  }
  /**
   * Client verifies server message 2 (message 4).
   * @return serverData: Buffer
   * @throws on error
   */
  function verifyMessage4(msg4, detachedSigA, clientLongtermPk, serverLongtermPk, discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab) {
      if (detachedSigA.length !== 64) {
          throw "detachedSigA must be 64 bytes";
      }
      if (clientLongtermPk.length !== 32) {
          throw "clientLongtermPk must be of length 32 bytes";
      }
      if (serverLongtermPk.length !== 32) {
          throw "serverLongtermPk must be of length 32 bytes";
      }
      if (discriminator.length !== 32) {
          throw "Discriminator must be 32 bytes";
      }
      if (sharedSecret_ab.length !== 32) {
          throw "sharedSecret_ab must be of length 32 bytes";
      }
      if (sharedSecret_aB.length !== 32) {
          throw "sharedSecret_aB must be of length 32 bytes";
      }
      if (sharedSecret_Ab.length !== 32) {
          throw "sharedSecret_Ab must be of length 32 bytes";
      }
      const length = msg4.readUInt16BE(0);
      const ciphertext = msg4.slice(2);
      if (ciphertext.length !== length) {
          throw "Mismatching expected length of message 4";
      }
      const boxNonce = Buffer$1.alloc(24).fill(0);
      const key = hashFn(Buffer$1.concat([discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab]));
      const unboxed = secretBoxOpen(ciphertext, boxNonce, key);
      const detachedSigB = unboxed.slice(0, 64);
      const serverData = unboxed.slice(64);
      const msg = Buffer$1.concat([discriminator, detachedSigA, clientLongtermPk, hashFn(sharedSecret_ab)]);
      if (!signVerifyDetached(msg, detachedSigB, serverLongtermPk)) {
          throw "Signature does not match";
      }
      return serverData;
  }
  /**
   * @param difficulty number of nibbles to solve for
   */
  function CalculateNonce(difficulty, serverEphemeralPk) {
      const target = Buffer$1.from(serverEphemeralPk.toString("hex").slice(0, difficulty));
      let n = 0;
      let nonce = Buffer$1.alloc(4);
      const b = Buffer$1.alloc(4);
      while (!Equals(target, Buffer$1.from(nonce.toString("hex").slice(0, difficulty)))) {
          n++;
          b.writeUInt32BE(n);
          nonce = hashFn(b).slice(0, 4);
          if (n >= 0xffffffff) {
              throw "Nonce overflow";
          }
      }
      return nonce;
  }
  function VerifyNonce(difficulty, serverEphemeralPk, nonce) {
      const target = Buffer$1.from(serverEphemeralPk.toString("hex").slice(0, difficulty));
      return Equals(target, Buffer$1.from(nonce.toString("hex").slice(0, difficulty)));
  }
  /**
   * On successful handshake return a populated HandshakeResult object.
   * On unsuccessful throw exception.
   * @return Promise <HandshakeResult>
   * @throws
   */
  async function HandshakeAsClient(client, clientLongtermSk, clientLongtermPk, serverLongtermPk, discriminator, clientData, maxServerDataSize = 1024) {
      return new Promise(async (resolve, reject) => {
          try {
              await libsodium_wrappers_1.default.ready;
              // Make sure the discriminator is constant length
              discriminator = hashFn(discriminator);
              const clientEphemeralKeys = createEphemeralKeys();
              const clientEphemeralPk = clientEphemeralKeys.publicKey;
              const clientEphemeralSk = clientEphemeralKeys.secretKey;
              // First message from client (message 1)
              const msg1 = message1(clientEphemeralPk, discriminator);
              client.send(msg1);
              // First response from server (message 2)
              const msg2 = await new pocket_sockets_1.ByteSize(client).read(65);
              const [difficulty, serverEphemeralPk] = verifyMessage2(msg2, discriminator);
              const nonce = CalculateNonce(difficulty.readUInt8(0), serverEphemeralPk);
              const sharedSecret_ab = clientSharedSecret_ab(clientEphemeralSk, serverEphemeralPk);
              const sharedSecret_aB = clientSharedSecret_aB(clientEphemeralSk, serverLongtermPk);
              // Second message from client (message 3)
              const detachedSigA = signDetached(Buffer$1.concat([nonce, discriminator, serverLongtermPk, hashFn(sharedSecret_ab)]), clientLongtermSk);
              const msg3 = message3(detachedSigA, nonce, discriminator, clientLongtermPk, sharedSecret_ab, sharedSecret_aB, clientData);
              client.send(msg3);
              const sharedSecret_Ab = clientSharedSecret_Ab(clientLongtermSk, serverEphemeralPk);
              // Wait for second response from server (message 4)
              const lengthPrefix = await new pocket_sockets_1.ByteSize(client).read(2);
              const length = lengthPrefix.readUInt16BE(0);
              if (length - 64 > maxServerDataSize) {
                  throw "Server data length too big";
              }
              const msg4_ciphertext = await new pocket_sockets_1.ByteSize(client).read(length);
              const msg4 = Buffer$1.concat([lengthPrefix, msg4_ciphertext]);
              //const msg4_ciphertext = await new ByteSize(client).read(176);
              const serverData = verifyMessage4(msg4, detachedSigA, clientLongtermPk, serverLongtermPk, discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab);
              const [clientToServerKey, clientNonce] = calcClientToServerKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, serverLongtermPk, serverEphemeralPk);
              const [serverToClientKey, serverNonce] = calcServerToClientKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, clientLongtermPk, clientEphemeralPk);
              const sessionId = hashFn(sharedSecret_ab);
              const handshakeParams = {
                  longtermPk: clientLongtermPk,
                  peerLongtermPk: serverLongtermPk,
                  clientToServerKey,
                  clientNonce,
                  serverToClientKey,
                  serverNonce,
                  peerData: serverData,
                  sessionId,
              };
              resolve(handshakeParams);
          }
          catch (e) {
              reject(e);
          }
      });
  }
  Handshake.HandshakeAsClient = HandshakeAsClient;
  /**
   * On successful handshake return the client longterm public key the box keys and nonces and the arbitrary client 96 byte data buffer.
   * On successful handshake return a populated HandshakeResult object.
   * On failed handshake throw exception.
   * @param difficulty is the number of nibbles the client is required to calculate to mitigate ddos attacks. Difficulty 6 is a lot. 8 is max.
   * @return Promise<HandshakeResult>
   * @throws
   */
  async function HandshakeAsServer(client, serverLongtermSk, serverLongtermPk, discriminator, allowedClientKey, serverData, difficulty = 0, maxClientDataSize = 1024) {
      return new Promise(async (resolve, reject) => {
          try {
              if (difficulty > 8) {
                  // We support 8 nibbles of nonce.
                  throw "Too high difficulty requested, max 8.";
              }
              await libsodium_wrappers_1.default.ready;
              // Make sure the discriminator is constant length
              discriminator = hashFn(discriminator);
              const serverEphemeralKeys = createEphemeralKeys();
              const serverEphemeralPk = serverEphemeralKeys.publicKey;
              const serverEphemeralSk = serverEphemeralKeys.secretKey;
              // Wait for first message from client (message 1)
              const msg1 = await new pocket_sockets_1.ByteSize(client).read(65);
              const clientEphemeralPk = verifyMessage1(msg1, discriminator);
              // Send first message from server (message 2)
              const msg2 = message2(Buffer$1.from([difficulty]), serverEphemeralPk, discriminator);
              client.send(msg2);
              const sharedSecret_ab = serverSharedSecret_ab(serverEphemeralSk, clientEphemeralPk);
              const sharedSecret_aB = serverSharedSecret_aB(serverLongtermSk, clientEphemeralPk);
              // Wait for second message from client (message 3)
              const lengthPrefix = await new pocket_sockets_1.ByteSize(client).read(2, 3000 + difficulty * 30000);
              const length = lengthPrefix.readUInt16BE(0);
              if (length - 100 > maxClientDataSize) {
                  throw "Client data length too big";
              }
              const msg3_ciphertext = await new pocket_sockets_1.ByteSize(client).read(length);
              const msg3 = Buffer$1.concat([lengthPrefix, msg3_ciphertext]);
              const [nonce, clientLongtermPk, detachedSigA, clientData] = verifyMessage3(msg3, serverLongtermPk, discriminator, sharedSecret_ab, sharedSecret_aB);
              if (!VerifyNonce(difficulty, serverEphemeralPk, nonce)) {
                  throw "Nonce does not verify";
              }
              // Verify permissioned handshake for client longterm pk
              if (allowedClientKey) {
                  if (typeof (allowedClientKey) === "function") {
                      if (!allowedClientKey(clientLongtermPk)) {
                          throw "Client longterm pk not allowed by function";
                      }
                  }
                  else if (Array.isArray(allowedClientKey)) {
                      if (!allowedClientKey.find((pk) => Equals(pk, clientLongtermPk))) {
                          throw "Client longterm pk not in list of allowed public keys";
                      }
                  }
                  else {
                      throw "Unknown client longterm pk validator";
                  }
              }
              else {
                  // WARNING: no allowedClientKey means to allow all clients connecting
                  // Fall through
              }
              const sharedSecret_Ab = serverSharedSecret_Ab(serverEphemeralSk, clientLongtermPk);
              // Send second message from server (message 4)
              const msg4 = message4(discriminator, detachedSigA, clientLongtermPk, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, serverLongtermSk, serverData);
              client.send(msg4);
              const [clientToServerKey, clientNonce] = calcClientToServerKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, serverLongtermPk, serverEphemeralPk);
              const [serverToClientKey, serverNonce] = calcServerToClientKey(discriminator, sharedSecret_ab, sharedSecret_aB, sharedSecret_Ab, clientLongtermPk, clientEphemeralPk);
              const sessionId = hashFn(sharedSecret_ab);
              const handshakeParams = {
                  longtermPk: serverLongtermPk,
                  peerLongtermPk: clientLongtermPk,
                  clientToServerKey,
                  clientNonce,
                  serverToClientKey,
                  serverNonce,
                  peerData: clientData,
                  sessionId,
              };
              // Done
              resolve(handshakeParams);
          }
          catch (e) {
              reject(e);
          }
      });
  }
  Handshake.HandshakeAsServer = HandshakeAsServer;

  (function (exports) {
  	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  	}) : (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    o[k2] = m[k];
  	}));
  	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
  	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
  	};
  	Object.defineProperty(exports, "__esModule", { value: true });
  	__exportStar(Messaging$1, exports);
  	__exportStar(Handshake, exports);
  	__exportStar(Crypto, exports);
  	__exportStar(types, exports);
  } (src));

  (function (exports) {
  	var __createBinding = (commonjsGlobal && commonjsGlobal.__createBinding) || (Object.create ? (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
  	}) : (function(o, m, k, k2) {
  	    if (k2 === undefined) k2 = k;
  	    o[k2] = m[k];
  	}));
  	var __exportStar = (commonjsGlobal && commonjsGlobal.__exportStar) || function(m, exports) {
  	    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
  	};
  	Object.defineProperty(exports, "__esModule", { value: true });
  	__exportStar(src, exports);
  } (build));

  const CHUNK_SIZE = 65535;

  function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }

  function randomRoute() {
    let r = "";
    for (let i = 0; i < 4; i++) {
      r += String.fromCharCode(getRandomArbitrary(97, 122));
    }
    return r;
  }

  class ClientManager {
    constructor({ host, port }) {
      this._host = host;
      this._port = port;
      this._addresses = new Set();
      this._clients = new Map();
      this._job = Promise.resolve();
    }

    addAddress(address) {
      this._addresses.add(address);
    }

    async init() {
      await build.init();
      this.keyPairClient = await build.genKeyPair();
    }

    async createClient(address) {
      return new Promise((resolve, reject) => {
        console.log("create Client", address, this._port);
        let client;
        const _client = new build$1.WSClient({
          host: address,
          port: this._port,
        });

        _client.onConnect(async () => {
          console.log("onConnect");

          client = new build.Messaging(_client);

          const { skey, dis } = await new Promise((resolve, reject) => {
            const hsfn = (buf) => {
              console.log("got client data", buf.toString());
              try {
                _client.offData(hsfn);
                resolve(JSON.parse(buf.toString()));
              } catch (e) {
                console.warn(e);
              }
            };
            _client.onData(hsfn);
            _client.onError(reject);
            _client.sendString("handshake");
          });

          console.log("client hs start");

          const hs = await build.HandshakeAsClient(
            _client,
            this.keyPairClient.secretKey,
            this.keyPairClient.publicKey,
            Buffer$1.from(skey, "base64"),
            Buffer$1.from(dis)
          );

          // alert("client hs finished");
          client.setEncrypted(
            hs.clientToServerKey,
            hs.clientNonce,
            hs.serverToClientKey,
            hs.serverNonce,
            hs.peerLongtermPk
          );
          client.open();

          client.address = address;
          // alert(`resolve ${address}`);
          resolve(client);
        });
        _client.onError((e) => {
          if (client) {
            client.close();
          }
          alert(`error ${address}`);
          reject(e);
        });
        _client.onClose(() => {
          if (client) {
            client.close();
          }
          // alert(`closed ${address}`);
        });

        _client.connect();
      });
    }

    async getClient() {
      if (!this._gettingClient) {
        this._gettingClient = true;
        this._client = this._client || (await this.createClient(this._host));
      }
      while (!this._client) {
        await new Promise((r) => setTimeout(r, 50));
      }

      return this._client;
    }

    getAddresses() {
      return Array.from(this._addresses).concat([this._host]);
    }

    async connect(address, attempt) {
      if (this.isConnected(address)) return;
    }
  }

  async function normalizeBody(body) {
    if (!body) return undefined;
    if (typeof body === "string") return Buffer$1.from(body);
    if (isBuffer(body)) return body;
    if (body.arrayBuffer)
      return Buffer$1.from(new Uint8Array(await body.arrayBuffer()));
    throw new Error(`don't know how to handle body`);
  }

  class PocketClient {
    constructor(
      { id = 50, host = "localhost", port = 3000, namespace = "client" },
      onAddress = () => {}
    ) {
      this._host = host;
      this._port = port;
      this._clientManager = new ClientManager({ host, port });
      this.onAddress = onAddress;
      this._job = Promise.resolve();
      this._lastAddress = host;
      this._pending = new Set();
    }

    async init() {
      this._clientManager.init();
    }

    async patchFetch() {
      this._fetch = global$1.fetch;
      global$1.fetch = this.pocketFetch.bind(this);
    }

    handleAddresses({ lan, wan }) {
      this._clientManager.addAddress(lan);
      this._clientManager.addAddress(wan);
      setTimeout(() => this.onAddress({ lan, wan }), 0);
    }

    patchFetchArgs(reqObj, reqInit) {
      if (typeof reqObj === "string" && reqObj.startsWith("http")) {
        const url = new URL(reqObj);
        reqInit.headers = reqInit.headers || {};
        reqInit.headers["X-Intercepted-Subdomain"] = url.hostname;
        url.host = "daemon_caddy";
        url.protocol = "http:";
        url.port = "80";
        reqObj = url.toString();
      }

      return { reqObj, reqInit };
    }

    abort() {
      Array.from(this._pending).forEach((e) => {
        e.emit("abort", new Error("aborted"));
        this._pending.delete(e);
      });
    }

    async pocketFetch(reqObj, reqInit = {}, xhr = {}) {
      // if (reqObj.indexOf(".wasm") > 0) {
      //   return this._fetch(reqObj, reqInit);
      // }
      // alert("alert " + reqObj);
      // this._job = this._job.then(async () => {
      console.log("pocketFetch", xhr, reqObj, reqInit);
      const patched = this.patchFetchArgs(reqObj, reqInit);
      reqObj = patched.reqObj;
      reqInit = patched.reqInit;
      console.log("pocketFetch2", reqObj, reqInit);
      const body = reqObj.body || reqInit.body;
      delete reqObj.body;
      delete reqInit.body;
      const pbody = await normalizeBody(body);
      const packet = lobEnc.encode({ reqObj, reqInit }, pbody);
      // alert("get client");
      console.log("encodedPacket");
      // alert(`fetching ${reqObj}`);
      const client = await this._clientManager.getClient();
      // alert(`fetching from ${client.address}`);
      console.log("pocketfetch3", client);
      const uuid = randomRoute(); //Math.random().toString(36).slice(2).slice(0, 6); // short lived id, don't need hard unique constraints
      let i = 0;
      for (; i < Math.floor(packet.length / CHUNK_SIZE); i++) {
        client.send(
          uuid,
          packet.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
        );
      }

      // alert(uuid);
      // alert("last chunk " + i);
      let eventEmitter = client.send(
        uuid,
        packet.slice(i * CHUNK_SIZE),
        xhr.timeout || 60000,
        true
      );
      // await once(eventEmitter.eventEmitter, "reply");
      // alert("chunk reply");
      console.log("uuid?", uuid);
      // let eventEmitter = client.send(uuid, packet, xhr.timeout || 60000, true);
      console.log("pocketFetch4", eventEmitter, eventEmitter.msgId);

      if (eventEmitter) {
        return new Promise(async (resolve, reject) => {
          eventEmitter = eventEmitter.eventEmitter;
          eventEmitter.on("error", reject);
          eventEmitter.on("abort", () => {
            // alert("abort");
            resolve(new Response(undefined, { ok: false }));
          });
          this._pending.add(eventEmitter);
          const chunks = [];
          let clen = 0;
          do {
            const chunk = await build.once(eventEmitter, "reply");
            console.log("chunk", uuid, chunk);
            chunks.push(Buffer$1.from(chunk.data));
            clen = chunk.data.length;
          } while (clen > 0);
          console.log("concat reply", chunks);
          const reply = Buffer$1.concat(chunks);
          this._lastAddress = client.address;
          const resp = lobEnc.decode(reply);
          const { lan, wan } = resp.json;
          this.handleAddresses({ lan, wan });
          console.log("resp.json", resp.body, resp.json.res);
          resp.json.res.headers = new Headers(resp.json.res.headers);
          // alert("complete");
          this._pending.delete(eventEmitter);
          resolve(new Response(resp.body, resp.json.res));
        });
      } else {
        return new Response(undefined, { ok: false });
      }
      // });

      // return this._job;
    }

    async patchFetchBrowser() {
      this._fetch = window.fetch.bind(window);
      window.fetch = this.pocketFetch.bind(this);

      this.patchXHR();
    }

    patchXHR() {
      const _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        this._method = method;
        this._url = url;
        return _open.bind(this)(method, url);
      };
      XMLHttpRequest.prototype.send = async function (body) {
        try {
          console.log("xhr.send", this);
          const url = this._url;
          const method = this._method;
          const init = { method };
          if (body) init.body = body;
          const res = await fetch(url, init, this);
          if (!res.ok) {
            this.dispatchEvent(new Event("error"));
            return;
          }
          console.log("got res", res);
          const text = await res.text();

          Object.defineProperties(this, {
            status: {
              get: () => res.status,
            },
            statusText: {
              get: () => res.statusText,
            },
            response: {
              get: () => text,
            },
            responseText: {
              get: () => text,
            },
            readyState: {
              get: () => XMLHttpRequest.DONE,
            },
            getResponseHeader: {
              value: (key) => res.headers.get(key),
            },
            getAllResponseHeaders: {
              value: () => {
                let res = [];
                for (const pair of res.headers.entries) {
                  res.push(`${pair[0]}: ${pair[1]}`);
                }
                return res.join("\r\n");
              },
            },
          });
          console.log(
            "xhr got res",
            method,
            url,
            this.responseText,
            this.readyState
          );
          this.dispatchEvent(new Event("load"));
          this.dispatchEvent(new Event("loadend"));
          this.dispatchEvent(new Event("readystatechange"));
        } catch (e) {
          this.dispatchEvent(new Event("error", e));
        }
      };
    }
  }

  window.setImmediate = (fn) => setTimeout(fn, 0);

  async function patchFetch(host, port) {
    if (window._patch_fetch_client) {
      window._patch_fetch_client.abort();
    }
    window._patch_fetch_client = new PocketClient({ host, port }, ({ lan, wan }) => {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ lan, wan }));
      }
    });
    await window._patch_fetch_client.init();
    window._patch_fetch_client.patchFetchBrowser();
  }

  patchFetch(window.location.hostname, 4000);

})();