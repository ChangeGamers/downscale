/* downscale 1.0.0
   Better image downscale with canvas.
   https://github.com/ytiurin/downscale
   Eugene Tiurin <yevhentiurin@gmail.com>
   Under MIT license
*/
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.downscale = factory();
    }
}(this, function () {

function round(val)
{
  return (val + 0.5) << 0
}

function downsample(sourceImageData, destWidth, destHeight, sourceX, sourceY,
  sourceWidth, sourceHeight)
{
  var dest = new ImageData(destWidth, destHeight)

  var SOURCE_DATA  = new Int32Array(sourceImageData.data.buffer)
  var SOURCE_WIDTH = sourceImageData.width

  var DEST_DATA  = new Int32Array(dest.data.buffer)
  var DEST_WIDTH = dest.width

  var SCALE_FACTOR_X  = destWidth  / sourceWidth
  var SCALE_FACTOR_Y  = destHeight / sourceHeight
  var SCALE_RANGE_X   = round(1 / SCALE_FACTOR_X)
  var SCALE_RANGE_Y   = round(1 / SCALE_FACTOR_Y)
  var SCALE_RANGE_SQR = SCALE_RANGE_X * SCALE_RANGE_Y

  for (var destRow = 0; destRow < dest.height; destRow++) {
    for (var destCol = 0; destCol < DEST_WIDTH; destCol++) {

      var sourceInd = sourceX + round(destCol / SCALE_FACTOR_X) +
        (sourceY + round(destRow / SCALE_FACTOR_Y)) * SOURCE_WIDTH

      var destRed   = 0
      var destGreen = 0
      var destBlue  = 0
      var destAlpha = 0

      for (var sourceRow = 0; sourceRow < SCALE_RANGE_Y; sourceRow++)
        for (var sourceCol = 0; sourceCol < SCALE_RANGE_X; sourceCol++) {
          var sourcePx = SOURCE_DATA[sourceInd + sourceCol + sourceRow * SOURCE_WIDTH]
          destRed   += sourcePx <<  24 >>> 24
          destGreen += sourcePx <<  16 >>> 24
          destBlue  += sourcePx <<  8  >>> 24
          destAlpha += sourcePx >>> 24
        }

      destRed   = round(destRed   / SCALE_RANGE_SQR)
      destGreen = round(destGreen / SCALE_RANGE_SQR)
      destBlue  = round(destBlue  / SCALE_RANGE_SQR)
      destAlpha = round(destAlpha / SCALE_RANGE_SQR)

      DEST_DATA[destCol + destRow * DEST_WIDTH] =
        (destAlpha << 24) |
        (destBlue  << 16) |
        (destGreen << 8)  |
        (destRed)
    }
  }

  return dest
}
function createTiming(enabled, source, destWidth, destHeight)
{
  var start  = new Date
  var timing = {}
  var prev   = start
  var n      = "01"

  return {
    mark: enabled ? function(name) {
      name = `${n}. ${name || "..."}`
      timing[name] = { "time (ms)": (new Date) - prev }
      prev = new Date
      n = `0${(n >> 0) + 1}`.substr(-2)
    } : new Function,
    finish: enabled ? function() {
      timing[`${n}. TOTAL`] = { "time (ms)": (new Date) - start }
      console.log("IMAGE SOURCE:", source)
      console.log("DOWNSCALE TO:", `${destWidth}x${destHeight}`)
      console.table(timing)
    } : new Function
  }
}

function createCache()
{
  var keys       = []
  var values     = []
  var subscribes = []
  var PENDING    = new Object

  return {
    createSetter: function(key) {
      if (this.get(key)) {
        return
      }
      var cacheInd = keys.push(key) - 1
      values.push(PENDING)
      subscribes.push([])

      return function(value) {
        values[cacheInd] = value
        subscribes[cacheInd] = subscribes[cacheInd].reduce(function(r, resolve) {
          resolve(value)
        }, [])
      }
    },
    get: function(key, resolve) {
      var cacheInd = keys.indexOf(key)
      if (!~cacheInd) {
        return
      }
      if (values[cacheInd] === PENDING) {
        subscribes[cacheInd].push(resolve)
        return
      }
      resolve(values[cacheInd])
    },
    has: function(key) {
      return !!~keys.indexOf(key)
    }
  }
}

function getImageData(canvas, img, sourceWidth, sourceHeight)
{
  canvas.width  = sourceWidth
  canvas.height = sourceHeight

  var ctx = canvas.getContext("2d")
  ctx.drawImage(img, 0, 0)

  return ctx.getImageData(0, 0, sourceWidth, sourceHeight)
}

function scaleImageData(imageData, destWidth, destHeight, sourceX, sourceY)
{
  var sourceWidth  = imageData.width
  var sourceHeight = imageData.height

  var origSourceWidth  = sourceWidth
  var origSourceHeight = sourceHeight

  var destRatio   = destWidth / destHeight
  var sourceRatio = sourceWidth / sourceHeight

  if (destRatio > sourceRatio) {
    sourceHeight = sourceWidth / destRatio
  }
  else {
    sourceWidth = sourceHeight * destRatio
  }

  var sourceX = sourceX || (origSourceWidth  - sourceWidth)  / 2 >> 0
  var sourceY = sourceY || (origSourceHeight - sourceHeight) / 2 >> 0

  return downsample(imageData, destWidth, destHeight, sourceX, sourceY,
    sourceWidth, sourceHeight)
}

function produceResult(canvas, imageData, options, callback)
{
  canvas.width  = imageData.width
  canvas.height = imageData.height

  var ctx = canvas.getContext("2d")
  ctx.putImageData(imageData, 0, 0)

  if (options.returnCanvas) {
    callback(canvas)
    return
  }

  if (options.returnBlob) {
    canvas.toBlob(callback, `image/${options.imageType || "jpeg"}`, options.quality || .85)
    return
  }

  var dataURL = canvas.toDataURL(`image/${options.imageType || "jpeg"}`,
    options.quality || .85)

  callback(dataURL)
}

function loadArrayBuffer(source, callback)
{
  var xhr = new XMLHttpRequest

  xhr.open("GET", source)
  xhr.responseType = "arraybuffer"

  xhr.addEventListener("load", function() {
    callback(this.response)
  })

  xhr.send()
}

function loadImg(img, callback)
{
  if (img.complete) {
    callback()
  }
  else {
    img.addEventListener("load",  callback)
  }
}

function loadVideo(video, callback)
{
  if (video.readyState > 1) {
    callback()
  }
  else {
    video.addEventListener("loadeddata", callback)
  }
}

function detectSourceType(source)
{
  if (source instanceof File) {
    return "File"
  }
  if (source instanceof HTMLImageElement) {
    return "HTMLImageElement"
  }
  if (source instanceof HTMLVideoElement) {
    return "HTMLVideoElement"
  }
  if (typeof source === "string") {
    return "URL"
  }
}

function validateArguments(args)
{
  if (args.length < 3) {
    return new TypeError(`3 arguments required, but only ${args.length} present.`)
  }
  if (!detectSourceType(args[0])) {
    return new TypeError("First argument should be HTMLImageElement, HTMLVideoElement, File of String")
  }
  if (typeof args[1] !== "number") {
    return new TypeError("Second argument should be a number")
  }
  if (typeof args[2] !== "number") {
    return new TypeError("Third argument should be a number")
  }
}

function downscale(source, destWidth, destHeight, options)
{
  var timing = createTiming(options && options.debug || false,
    source, destWidth, destHeight)

  var err = validateArguments(arguments)
  if (err instanceof TypeError) {
    return Promise.reject(err)
  }

  options = options || {}

  downscale.canvas = downscale.canvas || document.createElement("canvas")
  downscale.cache  = downscale.cache  || createCache()

  var canvas = downscale.canvas
  var cache  = downscale.cache

  if (cache.has(source)) {
    timing.mark()
    return new Promise(function(resolve, reject) {
      cache.get(source,
      function(sourceImageData) {
        timing.mark("PENDING CACHE")
        var destImageData = scaleImageData(sourceImageData, destWidth,
          destHeight, options.sourceX, options.sourceY)
        timing.mark("DOWNSCALE")

        produceResult(canvas, destImageData, options,
        function(result) {
          timing.mark("PRODUCE RESULT")
          resolve(result)
          timing.finish()
        })
      })
    })
  }

  var setCache = cache.createSetter(source)
  var URL = window.URL || window.webkitURL

  return new Promise(function(resolve, reject) {

    var scaleImgResolve = function(img, width, height) {
      timing.mark()
      var imageData = getImageData(canvas, img, width, height)
      timing.mark("GET IMAGE DATA")

      var destImageData = scaleImageData(imageData, destWidth, destHeight,
        options.sourceX, options.sourceY)
      timing.mark("DOWNSCALE")

      produceResult(canvas, destImageData, options,
      function(result) {
        timing.mark("PRODUCE RESULT")
        resolve(result)
        timing.finish()

        setCache(imageData)
      })
    }

    switch (detectSourceType(source)) {

      case "File":
        var sourceImg = document.createElement("img")
        timing.mark()
        sourceImg.src = URL.createObjectURL(source)
        timing.mark("READ FILE")
        loadImg(sourceImg,
        function() {
          timing.mark("LOAD IMAGE")
          scaleImgResolve(sourceImg, sourceImg.naturalWidth,
            sourceImg.naturalHeight)
        })
        break

      case "HTMLImageElement":
        timing.mark()
        loadImg(source,
        function() {
          timing.mark("LOAD IMAGE")
          scaleImgResolve(source, source.naturalWidth, source.naturalHeight)
        })
        break

      case "HTMLVideoElement":
        loadVideo(source,
        function() {
          scaleImgResolve(source, source.videoWidth, source.videoHeight)
        })
        break

      case "URL":
        timing.mark()
        loadArrayBuffer(source,
        function(arrayBuffer) {
          timing.mark("LOAD ARRAY BUFFER")
          var arrayBufferView = new Uint8Array(arrayBuffer)
          var blob = new Blob( [ arrayBufferView ], { type: "image/jpeg" } )
          var sourceImg = document.createElement("img")
          sourceImg.src = URL.createObjectURL(blob)
          timing.mark()
          loadImg(sourceImg,
          function() {
            timing.mark("LOAD IMAGE")
            scaleImgResolve(sourceImg, sourceImg.naturalWidth,
              sourceImg.naturalHeight)
          })
        })
        break
    }
  })
}
    return downscale
}));