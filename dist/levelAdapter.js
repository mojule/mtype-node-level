'use strict';

var path = require('path');
var level = require('levelup');
var pify = require('pify');

// manually pify, only a few and simpler when some should not be promisified
var Db = function Db(db) {
  return {
    get: pify(db.get),
    put: pify(db.put),
    del: pify(db.del),
    createReadStream: db.createReadStream
  };
};

/*
 in node a module is treated as a singleton
 we store a cache of the already open stores to prevent trying to open an
 already open store, as with some backing stores if it is already open it is
 locked and will throw an  error on trying to open it again
*/
var storeCache = {};

var Adapter = function Adapter(name, options) {
  if (name in storeCache) return Promise.resolve(storeCache[name]);

  var opts = Object.assign({}, defaults, options);
  var dbName = path.join(opts.path, name);
  var db = Db(level(dbName));

  var api = {
    exists: function exists(id) {
      return _exists(db, id);
    },
    save: function save(obj) {
      return _save(db, obj);
    },
    load: function load(id) {
      return _load(db, id);
    },
    get: function get(key) {
      return _get(db, key);
    },
    remove: function remove(id) {
      return _remove(db, id);
    },
    all: function all() {
      return _all(db);
    }
  };

  storeCache[name] = api;

  // some adapters will need async, this doesn't but has to be consistent
  return Promise.resolve(api);
};

var defaults = {
  path: './data/level'
};

var _exists = function _exists(db, id) {
  return new Promise(function (resolve) {
    return _load(db, id).then(function () {
      return resolve(true);
    }).catch(function () {
      return resolve(false);
    });
  });
};

var _save = function _save(db, obj) {
  return db.put(obj.value._id, JSON.stringify(obj));
};

var _load = function _load(db, id) {
  return Array.isArray(id) ? Promise.all(id.map(function (id) {
    return _load(db, id);
  })) : db.get(id);
};

var _get = function _get(db, key) {
  return new Promise(function (resolve, reject) {
    var items = [];

    var stream = key ? db.createReadStream({ start: key + '-', end: key + '-\uFFFF' }) : db.createReadStream();

    stream.on('data', function (item) {
      return items.push(JSON.parse(item.value));
    }).on('error', reject).on('close', function () {
      return resolve(items);
    });
  });
};

var _remove = function _remove(db, id) {
  return db.del(id);
};

var _all = function _all(db) {
  return _get(db);
};

module.exports = Adapter;