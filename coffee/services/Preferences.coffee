angular.module('tabpolish.services').factory "Preferences", ->
  new class PreferenceManager
    constructor: ->
      @prefType =
        checkbox: "checkbox"
      @prefs =
        "close-old-tabs":
          type: @prefType.checkbox
          default: false
          label: "Close Older Tabs"
    save: (callback) ->
      toSave = {}
      for pref, def of @prefs
        toSave[pref] = def.value if def.value isnt undefined
      chrome.storage.sync.set toSave, ->
        callback() if callback?
    get: (callback) ->
      toRead = {}
      for pref, def of @prefs
        toRead[pref] = def.default
      chrome.storage.sync.get toRead, (readPrefs) =>
        for pref, def of @prefs
          def.value = readPrefs[pref]
        callback(@prefs) if callback?