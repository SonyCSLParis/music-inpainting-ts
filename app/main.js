/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./main.ts");
/******/ })
/************************************************************************/
/******/ ({

/***/ "../../node_modules/abletonlink/index.js":
/*!*********************************************************************************************************!*\
  !*** /home/theis/code/flowmachinesstudio/interactive-score-interface/node_modules/abletonlink/index.js ***!
  \*********************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

/* WEBPACK VAR INJECTION */(function(__dirname) {const nbind = __webpack_require__(/*! nbind */ "../../node_modules/nbind/dist/nbind.js");
const binding = nbind.init(__dirname);
const lib = binding.lib;

lib.AbletonLink.prototype.startUpdate = function(interval_ms, callback) {
    this.update();
    if(callback) {
        this.timer = setInterval(() => {
            this.update();
            callback(this.beat, this.phase, this.bpm);
        }, interval_ms);
        callback(this.beat, this.phase, this.bpm);
    } else {
        this.timer = setInterval(() => {
            this.update();
        }, interval_ms);
    }
};

lib.AbletonLink.prototype.stopUpdate = function() {
    if(this.timer) {
        clearInterval(this.timer);
        this.timer = null;
    }
}

module.exports = lib.AbletonLink;

/* WEBPACK VAR INJECTION */}.call(this, "/"))

/***/ }),

/***/ "../../node_modules/loglevel/lib/loglevel.js":
/*!*************************************************************************************************************!*\
  !*** /home/theis/code/flowmachinesstudio/interactive-score-interface/node_modules/loglevel/lib/loglevel.js ***!
  \*************************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;/*
* loglevel - https://github.com/pimterry/loglevel
*
* Copyright (c) 2013 Tim Perry
* Licensed under the MIT license.
*/
(function (root, definition) {
    "use strict";
    if (true) {
        !(__WEBPACK_AMD_DEFINE_FACTORY__ = (definition),
				__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
				(__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) :
				__WEBPACK_AMD_DEFINE_FACTORY__),
				__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
    } else {}
}(this, function () {
    "use strict";

    // Slightly dubious tricks to cut down minimized file size
    var noop = function() {};
    var undefinedType = "undefined";

    var logMethods = [
        "trace",
        "debug",
        "info",
        "warn",
        "error"
    ];

    // Cross-browser bind equivalent that works at least back to IE6
    function bindMethod(obj, methodName) {
        var method = obj[methodName];
        if (typeof method.bind === 'function') {
            return method.bind(obj);
        } else {
            try {
                return Function.prototype.bind.call(method, obj);
            } catch (e) {
                // Missing bind shim or IE8 + Modernizr, fallback to wrapping
                return function() {
                    return Function.prototype.apply.apply(method, [obj, arguments]);
                };
            }
        }
    }

    // Build the best logging method possible for this env
    // Wherever possible we want to bind, not wrap, to preserve stack traces
    function realMethod(methodName) {
        if (methodName === 'debug') {
            methodName = 'log';
        }

        if (typeof console === undefinedType) {
            return false; // No method possible, for now - fixed later by enableLoggingWhenConsoleArrives
        } else if (console[methodName] !== undefined) {
            return bindMethod(console, methodName);
        } else if (console.log !== undefined) {
            return bindMethod(console, 'log');
        } else {
            return noop;
        }
    }

    // These private functions always need `this` to be set properly

    function replaceLoggingMethods(level, loggerName) {
        /*jshint validthis:true */
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, loggerName);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName, level, loggerName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this, level, loggerName);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, level, loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, defaultLevel, factory) {
      var self = this;
      var currentLevel;
      var storageKey = "loglevel";
      if (name) {
        storageKey += ":" + name;
      }

      function persistLevelIfPossible(levelNum) {
          var levelName = (logMethods[levelNum] || 'silent').toUpperCase();

          if (typeof window === undefinedType) return;

          // Use localStorage if available
          try {
              window.localStorage[storageKey] = levelName;
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=" + levelName + ";";
          } catch (ignore) {}
      }

      function getPersistedLevel() {
          var storedLevel;

          if (typeof window === undefinedType) return;

          try {
              storedLevel = window.localStorage[storageKey];
          } catch (ignore) {}

          // Fallback to cookies if local storage gives us nothing
          if (typeof storedLevel === undefinedType) {
              try {
                  var cookie = window.document.cookie;
                  var location = cookie.indexOf(
                      encodeURIComponent(storageKey) + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(cookie.slice(location))[1];
                  }
              } catch (ignore) {}
          }

          // If the stored level is not valid, treat it as if nothing was stored.
          if (self.levels[storedLevel] === undefined) {
              storedLevel = undefined;
          }

          return storedLevel;
      }

      /*
       *
       * Public logger API - see https://github.com/pimterry/loglevel for details
       *
       */

      self.name = name;

      self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
          "ERROR": 4, "SILENT": 5};

      self.methodFactory = factory || defaultMethodFactory;

      self.getLevel = function () {
          return currentLevel;
      };

      self.setLevel = function (level, persist) {
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              currentLevel = level;
              if (persist !== false) {  // defaults to true
                  persistLevelIfPossible(level);
              }
              replaceLoggingMethods.call(self, level, name);
              if (typeof console === undefinedType && level < self.levels.SILENT) {
                  return "No console available for logging";
              }
          } else {
              throw "log.setLevel() called with invalid level: " + level;
          }
      };

      self.setDefaultLevel = function (level) {
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      // Initialize with the right level
      var initialLevel = getPersistedLevel();
      if (initialLevel == null) {
          initialLevel = defaultLevel == null ? "WARN" : defaultLevel;
      }
      self.setLevel(initialLevel, false);
    }

    /*
     *
     * Top-level API
     *
     */

    var defaultLogger = new Logger();

    var _loggersByName = {};
    defaultLogger.getLogger = function getLogger(name) {
        if (typeof name !== "string" || name === "") {
          throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
          logger = _loggersByName[name] = new Logger(
            name, defaultLogger.getLevel(), defaultLogger.methodFactory);
        }
        return logger;
    };

    // Grab the current global log variable in case of overwrite
    var _log = (typeof window !== undefinedType) ? window.log : undefined;
    defaultLogger.noConflict = function() {
        if (typeof window !== undefinedType &&
               window.log === defaultLogger) {
            window.log = _log;
        }

        return defaultLogger;
    };

    defaultLogger.getLoggers = function getLoggers() {
        return _loggersByName;
    };

    return defaultLogger;
}));


/***/ }),

/***/ "../../node_modules/nbind/dist sync recursive":
/*!****************************************************************************************************!*\
  !*** /home/theis/code/flowmachinesstudio/interactive-score-interface/node_modules/nbind/dist sync ***!
  \****************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function webpackEmptyContext(req) {
	var e = new Error("Cannot find module '" + req + "'");
	e.code = 'MODULE_NOT_FOUND';
	throw e;
}
webpackEmptyContext.keys = function() { return []; };
webpackEmptyContext.resolve = webpackEmptyContext;
module.exports = webpackEmptyContext;
webpackEmptyContext.id = "../../node_modules/nbind/dist sync recursive";

/***/ }),

/***/ "../../node_modules/nbind/dist/nbind.js":
/*!********************************************************************************************************!*\
  !*** /home/theis/code/flowmachinesstudio/interactive-score-interface/node_modules/nbind/dist/nbind.js ***!
  \********************************************************************************************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

// This file is part of nbind, copyright (C) 2014-2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.
Object.defineProperty(exports, "__esModule", { value: true });
var path = __webpack_require__(/*! path */ "path"); // tslint:disable-line:no-var-requires
var Binding = (function () {
    function Binding() {
    }
    return Binding;
}());
exports.Binding = Binding;
/** Default callback that throws any error given to it. */
function rethrow(err, result) {
    if (err)
        throw (err);
}
/** Make list of possible paths for a single compiled output file name. */
function makeModulePathList(root, name) {
    return ([
        // Binary copied using copyasm
        [root, name],
        // node-gyp's linked version in the "build" dir
        [root, 'build', name],
        // node-waf and gyp_addon (a.k.a node-gyp)
        [root, 'build', 'Debug', name],
        [root, 'build', 'Release', name],
        // Debug files, for development (legacy behavior, remove for node v0.9)
        [root, 'out', 'Debug', name],
        [root, 'Debug', name],
        // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        [root, 'out', 'Release', name],
        [root, 'Release', name],
        // Legacy from node-waf, node <= 0.4.x
        [root, 'build', 'default', name],
        [
            root,
            process.env['NODE_BINDINGS_COMPILED_DIR'] || 'compiled',
            process.versions.node,
            process.platform,
            process.arch,
            name
        ]
    ]);
}
function findCompiledModule(basePath, specList, callback) {
    var resolvedList = [];
    var ext = path.extname(basePath);
    /** If basePath has a known extension, check if it's a loadable module. */
    for (var _i = 0, specList_1 = specList; _i < specList_1.length; _i++) {
        var spec = specList_1[_i];
        if (ext == spec.ext) {
            try {
                spec.path = /*require.resolve*/(__webpack_require__("../../node_modules/nbind/dist sync recursive").resolve(basePath));
                // Stop if a module was found.
                callback(null, spec);
                return (spec);
            }
            catch (err) {
                resolvedList.push(basePath);
            }
        }
    }
    /** Try all possible subdirectories of basePath. */
    for (var _a = 0, specList_2 = specList; _a < specList_2.length; _a++) {
        var spec = specList_2[_a];
        // Check if any possible path contains a loadable module,
        // and store unsuccessful attempts.
        for (var _b = 0, _c = makeModulePathList(basePath, spec.name); _b < _c.length; _b++) {
            var pathParts = _c[_b];
            var resolvedPath = path.resolve.apply(path, pathParts);
            try {
                spec.path = /*require.resolve*/(__webpack_require__("../../node_modules/nbind/dist sync recursive").resolve(resolvedPath));
            }
            catch (err) {
                resolvedList.push(resolvedPath);
                continue;
            }
            // Stop if a module was found.
            callback(null, spec);
            return (spec);
        }
    }
    var err = new Error('Could not locate the bindings file. Tried:\n' +
        resolvedList.join('\n'));
    err.tries = resolvedList;
    callback(err);
    return (null);
}
function find(basePath, cb) {
    var callback = arguments[arguments.length - 1];
    if (typeof (callback) != 'function')
        callback = rethrow;
    return (findCompiledModule((basePath != callback && basePath) || process.cwd(), [
        { ext: '.node', name: 'nbind.node', type: 'node' },
        { ext: '.js', name: 'nbind.js', type: 'emcc' }
    ], callback));
}
exports.find = find;
function init(basePath, lib, cb) {
    var callback = arguments[arguments.length - 1];
    if (typeof (callback) != 'function')
        callback = rethrow;
    var binding = new Binding();
    find(basePath != callback && basePath, function (err, binary) {
        if (err) {
            callback(err);
            return;
        }
        binding.binary = binary;
        binding.lib = (lib != callback && lib) || {};
        if (binary.type == 'emcc') {
            initAsm(binding, callback);
        }
        else {
            initNode(binding, callback);
        }
    });
    return (binding);
}
exports.init = init;
/** Initialize asm.js module. */
function initAsm(binding, callback) {
    var lib = binding.lib;
    lib.locateFile = lib.locateFile || function (name) {
        return (path.resolve(path.dirname(binding.binary.path), name));
    };
    // Load the Asm.js module.
    __webpack_require__("../../node_modules/nbind/dist sync recursive")(binding.binary.path)(lib, function (err, parts) {
        if (!err) {
            for (var _i = 0, _a = Object.keys(parts); _i < _a.length; _i++) {
                var key = _a[_i];
                binding[key] = parts[key];
            }
        }
        callback(err, binding);
    });
}
/** Initialize native Node.js addon. */
function initNode(binding, callback) {
    // Load the compiled addon.
    var lib = __webpack_require__("../../node_modules/nbind/dist sync recursive")(binding.binary.path);
    if (!lib || typeof (lib) != 'object') {
        callback(new Error('Error loading addon'));
        return;
    }
    binding.bind = lib.NBind.bind_value;
    binding.reflect = lib.NBind.reflect;
    binding.queryType = lib.NBind.queryType;
    binding.toggleLightGC = function (enable) { }; // tslint:disable-line:no-empty
    Object.keys(lib).forEach(function (key) {
        binding.lib[key] = lib[key];
    });
    callback(null, binding);
}


/***/ }),

/***/ "./main.ts":
/*!*****************!*\
  !*** ./main.ts ***!
  \*****************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = __webpack_require__(/*! electron */ "electron");
const log = __webpack_require__(/*! loglevel */ "../../node_modules/loglevel/lib/loglevel.js");
let mainWindow;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({ width: 800, height: 600 });
    mainWindow.loadFile('./index.html');
    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}
electron_1.app.on('ready', createWindow);
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});
const abletonlink = __webpack_require__(/*! abletonlink */ "../../node_modules/abletonlink/index.js");
let pattern_synchronization_duration_quarters = 4.;
let link_channel_prefix = 'link/';
let link;
function initAbletonLinkServer(bpm = 120, quantum = 4, enable = false) {
    link = new abletonlink(bpm = 120., quantum, enable);
    let success = true;
    return success;
}
;
electron_1.ipcMain.on(link_channel_prefix + 'init', (event, _) => {
    let return_promise = new Promise((resolve) => {
        let success = initAbletonLinkServer();
        resolve(success);
    });
    event.sender.send(link_channel_prefix + 'init-success', return_promise);
});
electron_1.ipcMain.on(link_channel_prefix + 'event', function (data) { });
electron_1.ipcMain.on(link_channel_prefix + 'tempo', (newBPM) => {
    if (link.bpm !== newBPM)
        link.bpm = newBPM;
});
electron_1.ipcMain.on(link_channel_prefix + 'enable', (event, _) => {
    link.enable();
    event.sender.send(link_channel_prefix + 'enable-success', true);
});
electron_1.ipcMain.on(link_channel_prefix + 'disable', (event, _) => {
    link.disable();
    event.sender.send(link_channel_prefix + 'disable-success', true);
});
electron_1.ipcMain.on(link_channel_prefix + 'get_bpm', (event, _) => {
    event.sender.send(link_channel_prefix + 'bpm', link.bpm);
});
electron_1.ipcMain.on('disconnect', function () { });
link.on('tempo', (bpm) => {
    log.info('LINK: BPM changed, now ' + bpm);
    mainWindow.webContents.send(link_channel_prefix + 'tempo', bpm);
});
link.on('numPeers', (numPeers) => {
    log.info('LINK: numPeers changed, now ' + numPeers);
    mainWindow.webContents.send(link_channel_prefix + 'numPeers', numPeers);
});
let updateRate = 16;
(() => {
    let lastBeat = 0.0;
    let lastPhase = 0.0;
    link.startUpdate(updateRate, (beat, phase, bpm) => {
        beat = 0 ^ beat;
        if (0 < beat - lastBeat) {
            mainWindow.webContents.send('beat', { beat });
            lastBeat = beat;
        }
        if (0 > phase - lastPhase) {
            mainWindow.webContents.send('downbeat');
            log.debug('LINK: downbeat');
        }
        lastPhase = phase;
    });
})();


/***/ }),

/***/ "electron":
/*!***************************!*\
  !*** external "electron" ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("electron");

/***/ }),

/***/ "path":
/*!***********************!*\
  !*** external "path" ***!
  \***********************/
/*! no static exports found */
/***/ (function(module, exports) {

module.exports = require("path");

/***/ })

/******/ });
//# sourceMappingURL=main.js.map