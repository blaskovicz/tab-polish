angular.module('tabpolish.controllers').controller "PrefManageController", [
  "$scope"
  "$timeout"
  "$log"
  "Preferences"
  ($scope, $timeout, $log, Preferences) ->
    lastPrefs = null
    Preferences.get (prefs) ->
      $timeout ->
        $log.info "Loaded prefs for management"
        $log.info prefs
        $scope.prefs = prefs
        lastPrefs = angular.copy prefs
    $scope.prefsHaveChanged = ->
      return false if lastPrefs is null
      return not angular.equals lastPrefs, $scope.prefs
    $scope.savePrefs = ->
      Preferences.save ->
        $log.info "Saved new prefs"
        $log.info $scope.prefs
        $timeout ->
          lastPrefs = angular.copy $scope.prefs
    $scope.resetPrefs = ->
      $scope.prefs = angular.copy lastPrefs
    return
]