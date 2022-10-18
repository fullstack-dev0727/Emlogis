(function () {
  "use strict";

  var rules = angular.module('emlogis.rules');

  rules.controller('RulesGeneralCtrl',
    ['$scope', '$http', '$q', 'rulesGeneralFactory', 'dataService', 'applicationContext',
    function ($scope, $http, $q, rulesGeneralFactory, dataService, applicationContext) {

      //--------------------------------------------------------------------
      // Defaults for General tab
      //--------------------------------------------------------------------

      $scope.page.editing = false;
      $scope.page.submitted = false;
      $scope.updatesCounter = 0;
      $scope.hasMgmtPerm = $scope.hasMgmtPermission();

      var schedSetInit, orgInit;

      $scope.org = {};
      $scope.schedSet = {};
      $scope.schedSetModified = {};
      $scope.saveClicked = false;


      $scope.$watch("schedSetModified", function(modifiedSettings) {
        if (modifiedSettings && !_.isEmpty(modifiedSettings)) {
          $scope.updateOrgSettings(modifiedSettings);
        }
      });


      // Prepare Address panel

      $scope.panels = {
        general: {
          title: "rules.general.GENERAL",
          countries: $scope.countriesList
        }
      };



      //--------------------------------------------------------------------
      // Load Org data
      //--------------------------------------------------------------------

      //
      // GET Scheduling Settings
      // for Org-level

      var getSchedulingSettings = function () {
        return rulesGeneralFactory.getSchedulingSettings().then( function (res) {
          schedSetInit = res.data;
          $scope.schedSet = angular.copy(schedSetInit);
        });
      };


      //
      // GET Organization Details

      var getOrgDetails = function () {
        return dataService.getOrgDetails()
          .then(function (res) {
            orgInit = res;
            $scope.org = angular.copy(orgInit);
          })
        ;
      };

      getSchedulingSettings();
      getOrgDetails();




      //--------------------------------------------------------------------
      // CRUD
      //--------------------------------------------------------------------

      //
      // UPDATE Org level settings

      $scope.updateOrgSettings = function(dto){

        if ($scope.scheduleSettingsForm.$valid) {
          var deferred = $q.defer();
          $scope.updatesCounter = 0;

          //
          // Check if Scheduling Settings have been changed.
          // If yes - update Scheduling Settings

          if ( !angular.equals($scope.schedSetModified, schedSetInit) ) {
            $scope.updatesCounter++;
            updateSchedulingSettings(dto).then( function(){ $scope.updatesCounter--; });
          }

          //
          // Check if Address details have been changed.
          // If yes - update Scheduling Settings

          if ( !angular.equals($scope.org, orgInit) ){
            $scope.updatesCounter++;
            updateOrgAddress().then( function(){ $scope.updatesCounter--; });
          }

          //
          // Wait for both API calls to be resolved,
          // then update page options
          // and resolve promise

          var removeThisWatcher = $scope.$watch("updatesCounter", function(newVal, oldVal) {
            if (newVal === 0 && oldVal === 1) {
              $scope.page.editing = false;
              $scope.page.submitted = false;
              $scope.saveClicked = false;
              applicationContext.setNotificationMsgWithValues('app.SAVED_SUCCESSFULLY', 'success', true);
              deferred.resolve();

              removeThisWatcher();                                           // remove this $watch
            }
          });

          return deferred.promise;
        }
      };



      //
      // UPDATE Scheduling settings on Org level

      var updateSchedulingSettings = function(dto){
        var deferred = $q.defer();

        dataService.updScheduleSettings(dto).then( function(res){
          getSchedulingSettings();
          deferred.resolve('SUCCESS');

        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
          deferred.resolve('ERROR');
        });

        return deferred.promise;
      };



      //
      // UPDATE Address details on Org level

      var updateOrgAddress = function(){
        var deferred = $q.defer();

        var newAddress = {
          "name"             : $scope.org.name,
          "description"      : $scope.org.description,
          "inactivityPeriod" : $scope.org.inactivityPeriod,
          "address"          : $scope.org.address,
          "address2"         : $scope.org.address2,
          "city"             : $scope.org.city,
          "country"          : $scope.org.country,
          "geo"              : $scope.org.geo,
          "state"            : $scope.org.state,
          "timeZone"         : $scope.org.timeZone,
          "zip"              : $scope.org.zip
        };

        //
        // Update Org details

        dataService.updOrgDetails(newAddress).then( function(res) {
          $scope.scheduleSettingsForm.$setPristine(true);
          getOrgDetails();
          deferred.resolve('SUCCESS');

        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
          deferred.resolve('ERROR');
        });

        return deferred.promise;
      };



      //--------------------------------------------------------------------
      // Other methods
      //--------------------------------------------------------------------



      $scope.clickSave = function() {
        $scope.saveClicked = true;
      };



      //
      // Register call back function,
      // for confirmation Dialog & Save btn in Notification

      var working = applicationContext.getWorking();

      working.entityName = 'rules.GENERAL';
      working.option = $scope.page;
      working.saveFunc = $scope.updateOrgSettings;
      //working.restoreFunc = restoreOriginalSchedule;
    }
  ]);
})();