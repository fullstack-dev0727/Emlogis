(function () {
  "use strict";

  var rules = angular.module('emlogis.rules');

  rules.controller('RulesTeamsCtrl', ['$scope', '$filter', '$modal', '$log', '$timeout',
                                       'applicationContext', 'rulesTeamsService', 'dialogs', 'uiGridConstants',
    function ($scope, $filter, $modal, $log, $timeout,
              applicationContext, rulesTeamsService, dialogs, uiGridConstants) {


      //--------------------------------------------------------------------
      // Defaults for Teams Ctrl
      //--------------------------------------------------------------------
  
      var tm = this,
          numOfRows = 12;
  
      $scope.savingTeamsCounter = 0;
      tm.isEditing = false;
  
  
      //
      // Listen to selected Site is being changed
      // and load Teams for newly selected Site
  
      $scope.$watch("selectedSite", function(newSite) {
        if (newSite) {
          //console.log('+++ Selected Site changed, newSite');
          $scope.siteDataIsLoading = true;                                              // Display loading spinner
  
          if ($scope.sitesTeamsTree){
            displaySiteChildrenFromTree(newSite.id);
          }
        }
      });
  
      $scope.$watch("sitesTeamsTree", function(newTree) {
        if (newTree) {
          displaySiteChildrenFromTree($scope.selectedSite.id);
        }
      });
  
  
  
      //--------------------------------------------------------------------
      // Teams related methods
      //--------------------------------------------------------------------
  
  
      //
      // Display initial details from Tree API
      // this will only display Panels names and Skills names
  
      var displaySiteChildrenFromTree = function(siteId){
        //console.log('+++ Displaying Panels and Skills tags for the selected Site...');
  
        var siteFromTree = _.find($scope.sitesTeamsTree, { 'id': siteId });
        $scope.selectedSiteChildren.site = {};                                           // First, clear the obj
        $scope.selectedSiteChildren.site = angular.copy(siteFromTree);                   // Then, save Site Tree data
  
  
        // Get all Teams for currently selected Site
  
        rulesTeamsService.getSiteTeams(siteId).then( function(res) {
  
          $scope.selectedSiteChildren.site.allTeamsInit = res.data;
          $scope.selectedSiteChildren.site.allTeams = angular.copy($scope.selectedSiteChildren.site.allTeamsInit);
  
          // Prepare allTeams object for Collapsing Panel
  
          angular.forEach($scope.selectedSiteChildren.site.allTeams, function(team) {
            team.isPanelCollapsed = true;                        // set the Panel collapsed value
            team.isWellCollapsed = true;                         // set the Edit Well collapsed value
            team.panelOpenedOnce = false;                        // to check is Panel for this Team was opened before
            team.panelName = team.name;                          // copy Team name to display in Panel header
            team.panelAbbreviation = team.abbreviation;          // copy Team abbreviation for Panel header
            team.refresh = true;
          });
  
          // Save initial Skills
          // from SiteTeamTree to allTeamsInit as children
  
          angular.forEach($scope.selectedSiteChildren.site.allTeamsInit, function(initTeam){
            initTeam.initSkills =_.result(_.find($scope.selectedSiteChildren.site.children, { 'id': initTeam.id}), 'children');
          });
  
          // TEMP TODO: until "Team.deletable" prop is not implemented
          angular.forEach($scope.selectedSiteChildren.site.allTeams, function(team){
            team.initSkills =_.result(_.find($scope.selectedSiteChildren.site.children, { 'id': team.id}), 'children');
          });
          // end of temp
        });
      };
  
  
  
      tm.loadAllDetailsForTeam = function(team){
        // Load Skills associated to this Team
        rulesTeamsService.getTeamSkills(team.id).then( function(res){
          team.associatedSkills = res;
          angular.forEach(team.associatedSkills, function(skill){
            skill.active = skill.isActive;
          });
        });
  
        // Load Skills unassociated to this Team
        rulesTeamsService.getUnassociatedTeamSkills(team.id).then( function(res){
          team.skillsToAdd = res;
          angular.forEach(team.skillsToAdd, function(skill){
            skill.active = skill.isActive;
          });
        });
  
        // Load Employees for this Team
        displayEmployeesGrid(team);
      };
  
  
      // Add a new Team to a Site
  
      $scope.addNewTeam = function(){
        var newTeam = {
          isPanelCollapsed: false,
          isWellCollapsed: false,
          panelOpenedOnce: true,
          panelName: 'New Team',
          active: true
        };
        $scope.selectedSiteChildren.site.allTeams.unshift(newTeam);
        tm.updateEditing();                                         // change Editing state to true
      };
  
  
      // Delete Team
  
      $scope.deleteTeam = function(team){
  
        // Confirm deletion
        var question = $filter('translate')("rules.site_teams.DELETE_TEAM") + team.name + '?';
        var dlg = dialogs.confirm('app.PLEASE_CONFIRM', question);                // Show modal window
        dlg.result.then( function(btn) {                                          // If user confirms, proceed
  
          // for an existing Team
          if (team.id) {
            return rulesTeamsService.deleteTeam(team.id).then( function(res){
  
              displaySiteChildrenFromTree($scope.selectedSite.id);  // Reload Teams
              $scope.$parent.loadAllSites();                        // Reload Site Info and SiteTeamsTree in sidebar
            });
  
          // for a new Team
          } else {
            $scope.selectedSiteChildren.site.allTeams.shift();
            $scope.page.editing = false;                            // Refresh editing state to default
          }
        });
      };
  
  
  
      //--------------------------------------------------------------------
      // Skills related methods
      //--------------------------------------------------------------------
  
      //
      // Remove a Skill from a given Team
  
      $scope.removeSkill = function(skill, team){
        var i = team.associatedSkills.indexOf(skill);               // Find index of Skill in Teams array
        if (i != -1) team.associatedSkills.splice(i, 1);            // If Skill is in Teams, remove it from array
        tm.updateEditing();                                         // and change Editing state to true
  
      };
  
  
      //
      // Attach a Skill from a given Team
  
      $scope.attachSkillToTeam = function(skill, team){
        team.associatedSkills.push(skill);
        tm.updateEditing();                                         // and change Editing state to true
      };
  
  
  
      //--------------------------------------------------------------------
      // Employees related methods
      //--------------------------------------------------------------------
  
      //
      // Prepare Employees grid
  
      var displayEmployeesGrid = function(team){
        return rulesTeamsService.loadTeamEmployees(team.id, { orderby:'Employee.lastName', orderdir:'ASC' }, 1, numOfRows)
          .then( function(res){
            team.associatedEmployees = res;
  
            //
            // Employees table
            // placed inside each Team
  
            team.gridOptions = {
              data: team.associatedEmployees.data,
              totalItems: team.associatedEmployees.total,
              minRowsToShow: team.associatedEmployees.total < numOfRows ? team.associatedEmployees.total : numOfRows,
  
              enableHorizontalScrollbar: 0,
              enableVerticalScrollbar: 0,
              enableColumnMenus: false,
  
              enableFiltering: true,
              useExternalFiltering: true,
  
              enableSorting: true,
              useExternalSorting: true,
  
              needPagination: true,
              useExternalPagination: true,
              enablePaginationControls: false,
              paginationPageSize: numOfRows,
              paginationCurrentPage: 1,
  
              enableSelectAll: true,
              enableRowSelection: true,
              enableFullRowSelection: true,               // full row selection
              enableHighlighting: false,
  
              /*isRowSelectable: function(row) {            // prevent selection employees whos HomeTeam is current Team
                return row.entity.homeTeamId !== team.id;
              },
              rowTemplate: '<div ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.uid" ' +
                                'class="ui-grid-cell" ' +
                                'ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader,' +
                                            ' \'not-selectable\': !row.enableSelection }"  ' +
                                'ui-grid-cell></div>',*/
  
              columnDefs: [
                {
                  field: 'lastName',
                  displayName: 'Last Name', // TODO translate
                  enableFiltering: true,
                  minWidth: '150',
                  sort: {
                    direction: uiGridConstants.ASC
                  }
                },
                { field: 'firstName',        enableFiltering: false, displayName: 'First Name' }, // TODO translate
                { field: 'isFloating',                          enableFiltering: false, displayName: 'Is Floating', enableSorting: false },
                { field: 'employeeType',     enableFiltering: false, displayName: 'Employee Type' },
                { field: 'primarySkillName', enableFiltering: false, displayName: 'Primary Skill' },
                { field: 'homeTeamName',                        enableFiltering: false, displayName: 'Home Team' },
                { field: 'hireDate',         enableFiltering: false, displayName: 'Hire Date', cellFilter: 'date' },
                { field: 'primarySkillId',   visible: false },
                { field: 'homeTeamId',                          visible: false },
                { field: 'employeeId',               visible: false }
              ],
              onRegisterApi: function(gridApi) {
                team.gridApi = gridApi;
                team.gridOptions.queryParams = {
                  orderby:'lastName',
                  orderdir:'ASC'
                };
  
  
                //
                // Back-end filtering
  
                team.gridApi.core.on.filterChanged( $scope, function() {
                  var grid = this.grid;
                  var filterTerm = grid.columns[1].filters[0].term;
                  //console.log('~~~ filter changed - grid', grid);
  
                  if (filterTerm === null || filterTerm === '' || filterTerm === undefined ){
                    team.gridOptions.queryParams = {
                      orderby : team.gridOptions.queryParams.orderby,
                      orderdir: team.gridOptions.queryParams.orderdir
                    };
                  } else {
                    var filterName = 'Employee.lastName';
                    team.gridOptions.queryParams.filter = filterName + " LIKE '" + filterTerm + "%'";
                  }
                  getPage();
                });
  
  
                //
                // Back-end sorting
  
                team.gridApi.core.on.sortChanged($scope, function(grid, sortColumns) {
                  //console.log('~~~ sortColumns', sortColumns);
                  //console.log('~~~ sorting changed - grid', grid);
                  if (sortColumns.length === 0) {
                    team.gridOptions.queryParams.orderdir = 'ASC';
                    team.gridOptions.queryParams.orderby = 'lastName';
                  } else {
                    team.gridOptions.queryParams.orderdir = sortColumns[0].sort.direction;
  
                    switch (sortColumns[0].field) {
                      case "lastName":
                        team.gridOptions.queryParams.orderby = 'Employee.lastName';
                        break;
                      case "firstName":
                        team.gridOptions.queryParams.orderby = 'Employee.firstName';
                        break;
                      case "isFloating":
                        team.gridOptions.queryParams.orderby = 'EmployeeTeam.isFloating';  // TODO: Yuriy is adding the logic
                        break;
                      case "employeeType":
                        team.gridOptions.queryParams.orderby = 'Employee.employeeType';
                        break;
                      case "primarySkillName":
                        team.gridOptions.queryParams.orderby = 'Skill.name';
                        break;
                      case "homeTeamName":
                        team.gridOptions.queryParams.orderby = 'Team.name';
                        break;
                      case "hireDate":
                        team.gridOptions.queryParams.orderby = 'Employee.hireDate';
                        break;
                      default:
                        team.gridOptions.queryParams.orderby = 'Employee.lastName';
                        break;
                    }
                  }
                  getPage();
                });
  
  
                //
                // Back-end pagination
  
                team.gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
                  team.gridOptions.paginationCurrentPage = newPage;
                  getPage();
                });
  
                var getPage = function() {
                  //console.log('team.gridOptions.queryParams', team.gridOptions.queryParams);
                  rulesTeamsService.loadTeamEmployees(team.id, team.gridOptions.queryParams, team.gridOptions.paginationCurrentPage, numOfRows)
                    .then(function(res){
                      refreshEmployeesGrid(team, res);
                    })
                  ;
                };
              }
            };
        }, function (err) {
          applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
        });
      };
  
  
      //
      // Remove selected Employees
      // from this Team
  
      $scope.removeEmployeesFromTeam = function(team, emplIdsList){
        var toDelete = team.gridApi.selection.getSelectedRows();
        var toDeleteIds = [];
        angular.forEach(toDelete, function(row){
          toDeleteIds.push(row.employeeId);
        });
  
        rulesTeamsService.removeEmployeesTeamMembership(team.id, toDeleteIds).then(function(res){
          //displayEmployeesGrid(team);
          return rulesTeamsService.loadTeamEmployees(team.id, team.gridOptions.queryParams, team.gridOptions.paginationCurrentPage, numOfRows)
            .then(function(res){
              refreshEmployeesGrid(team, res);
            })
          ;
        });
      };
  
  
      var refreshEmployeesGrid = function(team, res){
        team.associatedEmployees = res;
        team.gridOptions.totalItems = res.total;
        team.gridOptions.data = res.data;
        team.gridOptions.minRowsToShow = res.total < numOfRows ? res.total : numOfRows;
        team.gridApi.core.refresh();
        refreshGrid(team);
      };
  
  
      // Hacky way to re-render the whole grid
      // to update the number of rows shown, because of
      // UI-Grid does not recalculate # of rows once rendered: https://github.com/angular-ui/ng-grid/issues/2531
  
      function refreshGrid(team) {
        team.refresh = false;
        $timeout( function() {
          team.refresh = true;
        });
      }
  
  
      //--------------------------------------------------------------------
      // CRUD
      //--------------------------------------------------------------------
  
  
      tm.saveTeams = function() {
        $scope.savingTeamsCounter = 0;
  
        // First, check if a New Team was added to a Site
  
        if ($scope.selectedSiteChildren.site.allTeamsInit.length < $scope.selectedSiteChildren.site.allTeams.length){
  
          // For a new Team check if Team name was filled.
          // If not - display notification and cancel Saving process
          if ( !$scope.selectedSiteChildren.site.allTeams[0].name ) {
            applicationContext.setNotificationMsgWithValues('Please enter a name for a New Team!', 'danger', true);
            return;
          }
  
          // If New Team has a name filled, proceed
          $scope.savingTeamsCounter++;
          var newTeamDto = {
            "id":               null,
            "siteId":           $scope.selectedSiteChildren.site.id,
            "updateDto": {
              "name":           $scope.selectedSiteChildren.site.allTeams[0].name,                  // required
              "abbreviation":   $scope.selectedSiteChildren.site.allTeams[0].abbreviation,          // required
              "description":    $scope.selectedSiteChildren.site.allTeams[0].description || null,
              "active":         $scope.selectedSiteChildren.site.allTeams[0].active,
              "startDate":      0,
              "endDate":        0
            }
          };
  
          rulesTeamsService.addNewTeam(newTeamDto).then( function(res){
            applicationContext.setNotificationMsgWithValues('New Team was successfully added!', 'success', true);
            $scope.savingTeamsCounter--;
  
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
          });
        }
  
  
        // Next,
        // Compare initial and new states of every Team
  
        angular.forEach($scope.selectedSiteChildren.site.allTeamsInit, function(initTeam) {
          var newTeam = _.find($scope.selectedSiteChildren.site.allTeams, { 'id': initTeam.id });
  
          // Check if Team Details were modified
  
          var initTeamDetails = {                                                           // initial Team details dto
            name:         initTeam.name,
            abbreviation: initTeam.abbreviation,
            description:  initTeam.description,
            active:       initTeam.active
          };
  
          var newTeamDetails = {                                                            // current Team details dto
            name:         newTeam.name,
            abbreviation: newTeam.abbreviation,
            description:  newTeam.description,
            active:       newTeam.active
          };
  
          if ( !angular.equals(initTeamDetails, newTeamDetails) ) {                         // if initial and current DTOs differ
            if ( newTeamDetails.name && newTeamDetails.name.length <= 50 &&
                 newTeamDetails.abbreviation && newTeamDetails.abbreviation.length <= 5 ) {
  
              $scope.savingTeamsCounter++;
              console.log('SAVING newTeamDetails', newTeamDetails);
              rulesTeamsService.putTeamDetails(newTeam.id, newTeamDetails).then( function(){   // update Team details
                $scope.savingTeamsCounter--;
              }, function (err) {
                applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
              })
              ;
  
            } else {
              applicationContext.setNotificationMsgWithValues('Please make sure you entered all Team details properly!', 'danger', true);
              return;
            }
          }
  
  
          // Check,
          // if list of Skills was modified.
  
          if (newTeam.associatedSkills){
            if (initTeam.initSkills.length > newTeam.associatedSkills.length){                      // If some Skills were removed:
              var skillsToRemove = diffNotInArray(initTeam.initSkills, newTeam.associatedSkills);   // find all deleted Skills,
              //console.log('~~~ skillsToRemove', skillsToRemove);
  
              angular.forEach(skillsToRemove, function(skill) {                                     // for every added Skill
                $scope.savingTeamsCounter++;                                                        // increase counter for every API call,
                rulesTeamsService.removeSkillFromTeam(newTeam.id, skill.id).then( function(){       // remove this Skill from the Team,
                  $scope.savingTeamsCounter--;                                                      // decrease counter for every API call resolved.
                }, function (err) {
                  applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
                });
              });
  
            } else if (initTeam.initSkills.length < newTeam.associatedSkills.length) {              // If some Skills were added:
              var skillsToAdd = diffNotInArray(newTeam.associatedSkills, initTeam.initSkills);      // find all added Skills,
              //console.log('~~~ skillsToAdd', skillsToAdd);
  
              angular.forEach(skillsToAdd, function(skill) {                                        // for every added Skill
                $scope.savingTeamsCounter++;                                                        // increase counter for every API call,
                rulesTeamsService.addTeamSkill(newTeam.id, skill.id).then( function(){              // attach this Skill to the Team,
                  $scope.savingTeamsCounter--;                                                      // decrease counter for every API call resolved.
                }, function (err) {
                  applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
                });
              });
  
            } else if (initTeam.initSkills.length === newTeam.associatedSkills.length){             // If number of Skills is the same
              angular.forEach(newTeam.associatedSkills, function(skill) {
                var skillIsAssociated = _.find(initTeam.initSkills, { 'id': skill.id });            // Check if any Skills were removed
                if (!skillIsAssociated) {
                  $scope.savingTeamsCounter++;                                                      // increase counter for every API call,
                  rulesTeamsService.addTeamSkill(newTeam.id, skill.id).then( function(){            // remove this Skill from the Team,
                    $scope.savingTeamsCounter--;                                                    // decrease counter for every API call resolved.
                  }, function (err) {
                    applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
                  });
                }
              });
  
              angular.forEach(initTeam.initSkills, function(skill) {                                // Check if any Skills were removed
                var skillIsKept = _.find(newTeam.associatedSkills, { 'id': skill.id });
                if (!skillIsKept) {
                  $scope.savingTeamsCounter++;                                                      // increase counter for every API call,
                  rulesTeamsService.removeSkillFromTeam(newTeam.id, skill.id).then( function(){     // remove this Skill from the Team,
                    $scope.savingTeamsCounter--;                                                    // decrease counter for every API call resolved.
                  }, function (err) {
                    applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
                  });
                }
              });
            }
          }
        });

        // Finally,
        // wait for when all API calls are resolved
        // and after that - reload SitesTeamsTree

        var removeThisWatcher = $scope.$watch("savingTeamsCounter", function(newVal, oldVal) {
          if (newVal === 0 && oldVal === 1) {
            applicationContext.setNotificationMsgWithValues('app.SAVED_SUCCESSFULLY', 'success', true);
            $scope.$parent.loadAllSites();
            tm.isEditing = false;
            removeThisWatcher();                                           // remove this $watch
          }
        });
      };
  
  
  
      //--------------------------------------------------------------------
      // Other related methods
      //--------------------------------------------------------------------
  
      //
      // Update Site Scheduling Settings model
  
      tm.updateEditing = function(){
        tm.isEditing = true;
      };
  
  
  
      $scope.openEmployeesModal = function (team) {
        var modalTeam = team;
  
        var modalInstance = $modal.open({
          templateUrl: 'modules/settings/rules/sites_teams/partials/include/rules_sites-teams_employees-modal.tmpl.html',
          controller: 'RulesSitesTeamsEmployeesModalCtrl as te',
          windowClass: 'employees-modal',
          size: 'lg',
          resolve: {
            team: function () {
              return modalTeam;
            }
          }
        });
  
        modalInstance.result.then(function () {
          applicationContext.setNotificationMsgWithValues('app.ADDED_SUCCESSFULLY', 'success', true);
          //displayEmployeesGrid(team);
          rulesTeamsService.loadTeamEmployees(team.id, team.gridOptions.queryParams, team.gridOptions.paginationCurrentPage, numOfRows)
            .then(function(res){
              refreshEmployeesGrid(team, res);
            })
          ;
        }, function () {
          $log.info('Modal dismissed at: ' + new Date());
        });
      };
  
  
  
      function diffNotInArray(bigArray, smArray){
        var smArrayIds = {};
        _.forEach(smArray, function(obj) {
          smArrayIds[obj.id] = obj;
        });
  
        return bigArray.filter(function(obj){
          return !(obj.id in smArrayIds);
        });
      }
    }
  ]);
})();