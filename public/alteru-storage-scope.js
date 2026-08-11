/* eslint-disable */
// Browser storage belongs to one deployed/remixed game UUID, not the shared origin.
// Keep this as a classic script loaded before the game module so module-level reads are scoped.
(function installAlteruStorageScope(global) {
  'use strict'

  var script = document.currentScript
  var sourceGameId = script && script.getAttribute('data-game-storage-id')

  function currentGameId() {
    var firstPathSegment = location.pathname.split('/').filter(Boolean)[0] || ''
    if (location.hostname === 'game.aiwaves.tech' && firstPathSegment) return firstPathSegment
    if (global.__GAME_UUID__) return String(global.__GAME_UUID__)
    if (sourceGameId) return sourceGameId
    var meta = document.querySelector('meta[name="game-uuid"]')
    if (meta && meta.content) return meta.content
    if (firstPathSegment) return firstPathSegment
    return location.host || 'local'
  }

  function prefix() {
    return 'alteru:' + currentGameId() + ':'
  }

  function scopedKeys(storage) {
    var match = prefix()
    var keys = []
    for (var index = 0; index < storage.length; index += 1) {
      var key = storage.key(index)
      if (key && key.indexOf(match) === 0) keys.push(key)
    }
    return keys
  }

  function adapter(storage) {
    return {
      get length() {
        return scopedKeys(storage).length
      },
      clear: function clear() {
        scopedKeys(storage).forEach(function remove(key) { storage.removeItem(key) })
      },
      getItem: function getItem(key) {
        return storage.getItem(prefix() + String(key))
      },
      key: function key(index) {
        var stored = scopedKeys(storage)[index]
        return stored ? stored.slice(prefix().length) : null
      },
      removeItem: function removeItem(key) {
        storage.removeItem(prefix() + String(key))
      },
      setItem: function setItem(key, value) {
        storage.setItem(prefix() + String(key), String(value))
      },
    }
  }

  global.alteruLocalStorage = adapter(global.localStorage)
  global.alteruSessionStorage = adapter(global.sessionStorage)
  global.__alteruStorageScope = currentGameId
})(window)
