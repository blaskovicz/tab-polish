angular.module('tabpolish.controllers').controller "TabManageController", [
  "$scope"
  "$timeout"
  "$log"
  "Preferences"
  ($scope, $timeout, $log, Preferences) ->
    polishing = no
    NEW_TAB = {
      title: "-- new window --"
      windowId: -1
    }
    $scope.allSelected = no
    $scope.newWindow = NEW_TAB.windowId
    WindowType =
      NORMAL: "normal"
      POPUP: "popup"
      PANEL: "panel"
      APP: "app"
    populateWindowInfo = ->
      $log.info "querying current window for tabs"
      chrome.windows.getCurrent {populate: yes}, (ourWindow) ->
        return unless ourWindow.type is WindowType.NORMAL
        chrome.windows.getAll {populate: yes}, (allWindows) ->
          $log.info "window/#{ourWindow.id} tabs loaded \
            [#{if ourWindow.tabs? then ourWindow.tabs.length else 'none'}]"
          $timeout ->
            $scope.ourWindow = ourWindow
            movableWindowTabs = []
            for win in allWindows
              continue if win.id is ourWindow.id
              for tab in win.tabs
                continue unless tab.active
                movableWindowTabs.push tab
                break
            movableWindowTabs.push NEW_TAB
            $scope.movableWindowTabs = movableWindowTabs
    $scope.tabsSelectedForMove = ->
      return unless $scope.ourWindow?.tabs?
      for tab in $scope.ourWindow.tabs
        return true if tab.moveDesired
      false
    $scope.moveTabs = ->
      return unless $scope.ourWindow?.tabs?
      selectedTabs = \
        (tab.id for tab in $scope.ourWindow.tabs when tab.moveDesired)
      return unless selectedTabs.length isnt 0
      movingMessagePrefix = \
        "moving tab#{if selectedTabs.length isnt 1 then 's' else ''} \
        #{selectedTabs.join(', ')} to "
      if $scope.newWindow is NEW_TAB.windowId
        $log.info "#{movingMessagePrefix} to new window"
        chrome.windows.create {focused: true, type: WindowType.NORMAL},
        (createdWindow) ->
          chrome.tabs.move selectedTabs, {windowId: createdWindow.id, index: -1}
          populateWindowInfo()
          chrome.tabs.query {windowId: createdWindow.id}, (createdWindowTabs) ->
            chrome.tabs.remove(createdWindowTabs[0].id) \
              if createdWindowTabs? and createdWindowTabs.length > 0
      else
        moveToWindow = $scope.newWindow
        $log.info "#{movingMessagePrefix} to window #{$scope.newWindow}"
        chrome.tabs.move selectedTabs, {windowId: moveToWindow, index: -1}, ->
          populateWindowInfo()
    $scope.toggleAllSelect = ->
      $scope.allSelected = not $scope.allSelected
      return unless $scope.ourWindow?.tabs?
      for tab in $scope.ourWindow.tabs
        tab.moveDesired = $scope.allSelected

    populateWindowInfo()
    normalizeUrl = (url) ->
      return "" unless url?
      url = url.toUpperCase()
      url = url.replace(/#.*$/,'').replace(/&?commentid=\d+/i,'') \
        if url.match(/rpd\/summary.aspx/i)
      url
    polishTabs = (tabId, changeInfo, tab) ->
      return if polishing or changeInfo?.status isnt "complete"
      polishing = yes
      $log.info \
        "Polishing tabs#{if tab? then ', triggered by tab ' + tab.id else ''}"
      # load all prefs each time
      windowId = chrome.windows.WINDOW_ID_CURRENT
      Preferences.get (prefs) ->
        closeOldTabs = prefs?['close-old-tabs']?.value
        currentTabNormalizedUrl = normalizeUrl(tab.url)
        $log.info "window/#{windowId}/tab/#{tab.id} update: \
          #{tab.url} [ #{currentTabNormalizedUrl} ]"
        chrome.tabs.query {windowId: windowId}, (tabs) ->
          $log.info("window/" + windowId + " has " + tabs.length + " tabs")
          return unless tabs? and tabs.length > 0
          tabLookup = {}
          if(closeOldTabs)
            $log.info \
              "window/#{windowId}/tab/#{tab.id} saving due to old tab pref"
            tabLookup[currentTabNormalizedUrl] = tab
          # for every tab in the current window, save the
          # first tab we find and close any others with the same url.
          # if the close-old-tabs option is set, treat the current tab
          # as highest priority for remaining open
          for iterTab in tabs
            url = normalizeUrl(iterTab.url)
            if(!tabLookup[url])
              tabLookup[url] = iterTab
            else
              if iterTab.id is tab.id and closeOldTabs then continue
              else if iterTab.highlighted
                $log.info "window/#{tabLookup[url].windowId}/\
                  tab/#{tabLookup[url].id} getting focused"
                chrome.tabs.update tabLookup[url].id, {active: true}
              try
                $log.info "window/#{iterTab.windowId}/\
                  tab/#{iterTab.id} being closed"
                chrome.tabs.remove iterTab.id
              catch e
                $log.error "window/#{iterTab.windowId}/\
                  tab/#{iterTab.id} error on close..."
                $log.error e
          polishing = no
          populateWindowInfo()
    chrome.tabs.onUpdated.addListener polishTabs
    chrome.tabs.onDetached.addListener ->
      populateWindowInfo()
    chrome.tabs.onAttached.addListener ->
      populateWindowInfo()
    chrome.tabs.onRemoved.addListener ->
      populateWindowInfo()
    return
]