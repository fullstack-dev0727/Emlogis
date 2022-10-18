(function () {
  "use strict";

  var rules = angular.module('emlogis.rules');

  rules.controller('RulesSiteTeamsCtrl', ['$scope', '$state', '$filter',
                                           'applicationContext', 'dialogs', 'appFunc',
                                           'dataService', 'rulesSitesService', 'rulesTeamsService',
    function ($scope, $state, $filter,
              applicationContext, dialogs, appFunc,
              dataService, rulesSitesService, rulesTeamsService) {

    //console.log('+++ inside Rules Site / Teams controller');


    //--------------------------------------------------------------------
    // Defaults for Sites & Teams tab
    //--------------------------------------------------------------------

    var i,
        allSitesInit,
        lastModifiedSiteId = rulesTeamsService.getSiteLastModified();

    $scope.page.editing = false;
    $scope.page.submitted = false;
    $scope.updatesCounter = 0;
    $scope.isEditWellCollapsed = true;


    // Site
    $scope.allSites = [];
    $scope.siteDataIsLoading = true;
    $scope.sitesTeamsTree = null;
    $scope.selectedSite = null;

    // Teams
    $scope.selectedSiteChildren = {
      site: {}
    };



    //--------------------------------------------------------------------
    // Site related methods
    //--------------------------------------------------------------------


    //
    // Check if Site can be deleted by user
    // TEMP TODO change when API property is implemented

    $scope.isSiteDeletable = function(){
      return _.find($scope.selectedSiteChildren.site.allTeams, { 'isDeleted': false }) ? true : false;
    };



    //
    // GET the list of all Sites

    $scope.loadAllSites = function() {
      return rulesSitesService.getAllSites().then( function(res) {
        // Save response
        allSitesInit = res.data;
        $scope.allSites = angular.copy(allSitesInit);

        // and load SitesTeamsTree
        loadSitesTeamsTree();

      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);

      }).finally( function() {

        // After all Sites were loaded
        // display the most recently updated Site

        if (lastModifiedSiteId) $scope.selectedSite = _.find($scope.allSites, {id: lastModifiedSiteId});
        else {
          var lastUpdated = _.sortBy($scope.allSites, function(site) { return site.updated.getTime(); }).reverse();
          $scope.selectedSite = lastUpdated[0];
        }
      });
    };



    //
    // GET all details for a Site

    $scope.loadSiteDetails = function(siteId) {
      rulesSitesService.getSiteDetails(siteId).then( function(res) {
        $scope.selectedSiteDetails = res.data;
        $scope.selectedSiteDetails.twoWeeksOvertimeStartDate = appFunc.convertToBrowserTimezone(res.data.twoWeeksOvertimeStartDate, res.data.timeZone);

        // Hide '-1' in input fields
        $scope.selectedSiteDetails.overtimeDto.biweeklyOvertimeMins = $filter('hideMinus')($scope.selectedSiteDetails.overtimeDto.biweeklyOvertimeMins);
        $scope.selectedSiteDetails.overtimeDto.weeklyOvertimeMins = $filter('hideMinus')($scope.selectedSiteDetails.overtimeDto.weeklyOvertimeMins);
        $scope.selectedSiteDetails.overtimeDto.dailyOvertimeMins = $filter('hideMinus')($scope.selectedSiteDetails.overtimeDto.dailyOvertimeMins);

        // Convert to hours
        $scope.selectedSiteDetails.overtimeDto.biweeklyOvertimeMins = $filter('minsToHoursFloat')($scope.selectedSiteDetails.overtimeDto.biweeklyOvertimeMins);
        $scope.selectedSiteDetails.overtimeDto.weeklyOvertimeMins = $filter('minsToHoursFloat')($scope.selectedSiteDetails.overtimeDto.weeklyOvertimeMins);
        $scope.selectedSiteDetails.overtimeDto.dailyOvertimeMins = $filter('minsToHoursFloat')($scope.selectedSiteDetails.overtimeDto.dailyOvertimeMins);

        displaySiteDetails();

      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);

      }).finally( function(){
        $scope.siteDataIsLoading = false;                                      // hide loading spinner
      });
    };



    //
    // GET all details for a Site

    var displaySiteDetails = function() {
      $scope.selectedSiteDetailsToDisplay = angular.copy($scope.selectedSiteDetails);

      // Resetting the page state
      $scope.page.submitted = false;
      $scope.page.editing = false;
    };



    // Load Sites Teams tree

    var loadSitesTeamsTree = function() {
      rulesSitesService.getSitesTeamsTree().then( function(res) {
        $scope.sitesTeamsTree = res.data;

        $scope.sitesTeamsTree = $filter('orderBy')($scope.sitesTeamsTree, 'name');    // sort Sites in ABC order
        angular.forEach($scope.sitesTeamsTree, function(site) {                       // sort Teams in ABC order
          site.children = $filter('orderBy')(site.children, 'name');
        });

      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);

      });
    };



    $scope.loadAllSites();



    //--------------------------------------------------------------------
    // CRUD
    //--------------------------------------------------------------------

    //
    // Add new Site
    // and move user to /new state

    $scope.addNewSiteInit = function () {
      $state.go('authenticated.rules.site_teams.new_site');
      $scope.selectedSiteDetailsToDisplay = {};
    };



    //
    // Save button clicked

    $scope.saveSite = function(){
      console.log('+++ SITE SAVE clicked');

      // Check if Site's Details were modified.
      // If so, update Site

      if ( !angular.equals($scope.selectedSiteDetailsToDisplay, $scope.selectedSiteDetails) ) {
        if ( rulesSitesService.getSiteForm().$valid ) {
          console.log('+++ UPDATING the Site...');

          // Prepare to save
          // var date = new Date($scope.selectedSiteDetailsToDisplay.twoWeeksOvertimeStartDate).getTime(); // TODO: Time Zone?
          var saveSiteId = $scope.selectedSiteDetailsToDisplay.id,
              date = null;

          if ($scope.selectedSiteDetailsToDisplay.twoWeeksOvertimeStartDate) {
            date = appFunc.getDateWithTimezone(
              $scope.selectedSiteDetailsToDisplay.twoWeeksOvertimeStartDate.getFullYear(),
              $scope.selectedSiteDetailsToDisplay.twoWeeksOvertimeStartDate.getMonth(),
              $scope.selectedSiteDetailsToDisplay.twoWeeksOvertimeStartDate.getDate(),
              $scope.selectedSiteDetailsToDisplay.timeZone
            ).getTime();
          }

          var updatedSite = {
            "properties": {},
            "name":                       $scope.selectedSiteDetailsToDisplay.name,
            "description":                $scope.selectedSiteDetailsToDisplay.description,
            "weekendDefinition":          $scope.selectedSiteDetailsToDisplay.weekendDefinition,
            "firstDayOfWeek":             $scope.selectedSiteDetailsToDisplay.firstDayOfWeek,
            "isNotificationEnabled":      $scope.selectedSiteDetailsToDisplay.isNotificationEnabled,
            "timeZone":                   $scope.selectedSiteDetailsToDisplay.timeZone,
            "abbreviation":               $scope.selectedSiteDetailsToDisplay.abbreviation,
            "address":                    $scope.selectedSiteDetailsToDisplay.address,
            "address2":                   $scope.selectedSiteDetailsToDisplay.address2,
            "city":                       $scope.selectedSiteDetailsToDisplay.city,
            "state":                      $scope.selectedSiteDetailsToDisplay.state,
            "country":                    $scope.selectedSiteDetailsToDisplay.country,
            "zip":                        $scope.selectedSiteDetailsToDisplay.zip,
            "shiftIncrements":            $scope.selectedSiteDetailsToDisplay.shiftIncrements,
            "shiftOverlaps":              $scope.selectedSiteDetailsToDisplay.shiftOverlaps,
            "maxConsecutiveShifts":       $scope.selectedSiteDetailsToDisplay.maxConsecutiveShifts,
            "timeOffBetweenShifts":       $scope.selectedSiteDetailsToDisplay.timeOffBetweenShifts,
            "enableWIPFragments":         $scope.selectedSiteDetailsToDisplay.enableWIPFragments,
            "twoWeeksOvertimeStartDate":  date,
            "overtimeDto": {
              "dailyOvertimeMins":        $filter('hoursToMins')($scope.selectedSiteDetailsToDisplay.overtimeDto.dailyOvertimeMins) || -1,
              "weeklyOvertimeMins":       $filter('hoursToMins')($scope.selectedSiteDetailsToDisplay.overtimeDto.weeklyOvertimeMins) || -1,
              "biweeklyOvertimeMins":     $filter('hoursToMins')($scope.selectedSiteDetailsToDisplay.overtimeDto.biweeklyOvertimeMins) || -1
            }
          };

          return rulesSitesService.updateSite($scope.selectedSiteDetailsToDisplay.id, updatedSite).then( function(res) {
            applicationContext.setNotificationMsgWithValues('app.SAVED_SUCCESSFULLY', 'success', true);
            $scope.page.editing = false;
            $scope.page.submitted = false;

            $scope.loadSiteDetails(saveSiteId);
            $scope.loadAllSites();

            // Save current selected Site,
            // as the one that was last modified,
            // even if the attempt to save the changes wasn't successful

            lastModifiedSiteId = $scope.selectedSiteDetailsToDisplay.id;
            rulesTeamsService.saveSiteLastModified(lastModifiedSiteId);

          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);

          });

        } else {
          $scope.page.submitted = true;
          $scope.isEditWellCollapsed = false;
          applicationContext.setNotificationMsgWithValues('Please enter all required details for selected Site!', 'danger', true);
          return;
        }
      }
    };



    // Delete Site

    $scope.deleteSite = function(site){

      // Confirm deletion
      var question = $filter('translate')("rules.site_teams.DELETE_SITE") + site.name + '?';
      var dlg = dialogs.confirm('app.PLEASE_CONFIRM', question);                // Show modal window
      dlg.result.then(function (btn) {                                          // If user confirms, proceed
        return dataService.deleteSite(site.id)
          .then(function(res){
            //Reload all Sites
            $scope.loadAllSites();
            applicationContext.setNotificationMsgWithValues('rules.site_teams.SITE_DELETED', 'success', true);

          }, function (err) {
            applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
          });
      });
    };



    //--------------------------------------------------------------------
    // Sidebar related methods
    //--------------------------------------------------------------------


    //
    // Toggle Sidebar
    $scope.toggleSidebar = function(){
      $scope.sidebarVisible = !$scope.sidebarVisible;
    };


    //
    // Change Selected Site with its ID
    $scope.setSelectedSite = function(siteId) {
      angular.forEach($scope.allSites, function(site) {
        if (site.id === siteId) $scope.selectedSite = site;
      });
    };


    //
    // Choose team in sidebar
    $scope.displayTeam = function(siteId, teamId) {
      if ( $scope.selectedSiteChildren.site.id != siteId ) {
        $scope.setSelectedSite(siteId);
        openTeam(teamId); // TODO promise
      } else {
        openTeam(teamId);
      }
    };

    var openTeam = function(teamId){
      angular.forEach($scope.selectedSiteChildren.site.allTeams, function(team) {
        if (team.id === teamId && !team.isSelected) {
          console.log('team', team);

          team.isPanelCollapsed = false;          // open panel
          team.panelOpenedOnce = true;            // team was opened at least once
          team.isSelected = true;                 //

          // scroll to team panel
          // add class to panel
          // load team details

        } else if (team.id !== teamId){
          team.isSelected = false;
          team.isPanelCollapsed = true;
        }
      });
    };



    //--------------------------------------------------------------------
    // Setup Working for this page
    //--------------------------------------------------------------------

    var working = applicationContext.getWorking();

    working.entityName = 'rules.SITE_TEAMS';
    working.option = $scope.page;
    working.saveFunc = $scope.save;
    //working.restoreFunc = restoreOriginalSchedule;

    console.log('working', working);


  }]);
})();