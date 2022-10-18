(function () {
  "use strict";

  var rules = angular.module('emlogis.rules');

  rules.controller('RulesOverwriteOrgCtrl', ['$scope', 'dataService', 'applicationContext',
    function ($scope, dataService, applicationContext) {

      console.log('   +++ in SiteSchedulingSettings');


      //--------------------------------------------------------------------
      // On page load
      //--------------------------------------------------------------------

      var schedSetInit,
          over = this;

      over.site = {};
      over.schedSet = {};
      $scope.schedSetModified = {};
      over.hasMgmtPermission = false;
      over.isEditing = false;
      over.saveClicked = false;



      $scope.$watch("selectedSite", function(newSite) {
        if (newSite) {
          over.site = newSite;
          over.getSiteSchedulingSettings(newSite.id);
          over.hasMgmtPermission = $scope.hasMgmtPermission();
        }
      });


      $scope.$watch("schedSetModified", function(modifiedSettings) {
        if (modifiedSettings && !_.isEmpty(modifiedSettings)) {
          console.log('   +++ modifiedSettings', modifiedSettings);
          over.updSiteSchedulingSettings(modifiedSettings);
        }
      });


      //--------------------------------------------------------------------
      // CRUD
      //--------------------------------------------------------------------

      //
      // Update Site Scheduling Settings

      over.updSiteSchedulingSettings = function(dto) {
        console.log('   +++ updSiteSchedulingSettings: new schedSetModified', dto);
        return dataService.updateSiteSchedulingSettings(over.site.id, dto).then( function(res) {
          updateSiteSchedulingSettingsModel(res.data);
          applicationContext.setNotificationMsgWithValues('app.UPDATED_SUCCESSFULLY', 'success', true);

        }, function (err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
        });
      };



      //
      // Reset Site level settings to org level

      over.resetToOrgLevel = function() {
        console.log('   +++ reset SiteSchedulingSettings');
        return dataService.deleteSiteSchedulingSettings(over.site.id).then( function(res) {
          updateSiteSchedulingSettingsModel(res.data);
          applicationContext.setNotificationMsgWithValues('app.RESET_SUCCESSFULLY', 'success', true);

        }, function (err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
        });
      };




      //--------------------------------------------------------------------
      // Other related methods
      //--------------------------------------------------------------------

      //
      // Get Site Scheduling Settings

      over.getSiteSchedulingSettings = function(siteId) {
        return dataService.getSiteSchedulingSettings(siteId).then(function(res) {
          updateSiteSchedulingSettingsModel(res.data);
        }, function (err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
        });
      };


      //
      // Update Site Scheduling Settings model

      var updateSiteSchedulingSettingsModel = function(settings){
        schedSetInit = settings;
        over.schedSet = angular.copy(schedSetInit);
        console.log('   +++ over.schedSet updated', over.schedSet);
        over.isEditing = false;
        over.saveClicked = false;
      };

    }]);
})();