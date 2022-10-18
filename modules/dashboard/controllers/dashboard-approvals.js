var dashboard = angular.module('emlogis.dashboard');

dashboard.controller('DashboardApprovalsTimeOffMsgCtrl',
  [
    '$http',
    '$scope',
    '$modalInstance',
    'shift',
    function($http, $scope, $modalInstance, shift) {

      /**
       * Use shift name
       */
      $scope.shift = shift;
      // Close Modal
      $scope.close = function () {
        $modalInstance.dismiss('cancel');
      };
    }
  ]
);

dashboard.controller('DashboardApprovalsCtrl',
  [
    '$http',
    '$scope',
    '$state',
    '$q',
    '$sessionStorage',
    '$filter',
    '$timeout',
    '$modal',
    'appFunc',
    'applicationContext',
    'dataService',
    'crudDataService',
    'uiGridConstants',
    'DashboardService',
    function($http, $scope, $state, $q, $sessionStorage, $filter, $timeout, $modal,
             appFunc, applicationContext, dataService, crudDataService,
             uiGridConstants, DashboardService) {

      /**
      /**
       * Variables in Dashboard Approvals
       * 1. $scope.days: Filter Dropdown list in Filter
       * 2. $scope.filter.siteTeams: Filter Dropdown tree list in Filter
       * 3. $scope.filter.statuses: Filter Dropdown Statuses
       * 4. $scope.filter.dayLength: Filter ng-model of days
       */

      $scope.days = [
        {day: 7, title: 'LAST 7 DAYS'},
        {day: 14, title: 'LAST 14 DAYS'},
        {day: 30, title: 'LAST 30 DAYS'},
        {day: 0, title: 'ALL'}
      ];


      /**
       *
       * For the MultiSelect Dropdown
       */
      $scope.localLang = {
        selectAll  : 'Select All',
        selectNone : 'Select None',
        reset : 'Reset',
        search : 'Search...',
        nothingSelected : 'Nothing is selected'         //default-label is deprecated and replaced with this.
      };

      var baseUrl = applicationContext.getBaseRestUrl();
      var factory = _.clone(crudDataService);
      var numOfRows = 25;

      /*
       *This header cell template is almost same as default cell template except
       * it has translate directive inside so grid header will support i18n as well
       */
      var headerCellTemplate = function(){
        return "<div ng-class=\"{ 'sortable': sortable }\">" +
          "<div class=\"ui-grid-vertical-bar\">&nbsp;</div>" +
          "<div class=\"ui-grid-cell-contents\" col-index=\"renderIndex\" ><span translate>{{ col.name CUSTOM_FILTERS }} </span>" +
          "<span ui-grid-visible=\"col.sort.direction\" ng-class=\"{ 'ui-grid-icon-up-dir': col.sort.direction == asc, 'ui-grid-icon-down-dir': col.sort.direction == desc, 'ui-grid-icon-blank': !col.sort.direction }\">&nbsp;</span>" +
          "</div>" +
          "<div class=\"ui-grid-column-menu-button\" ng-if=\"grid.options.enableColumnMenus && !col.isRowHeader  && col.colDef.enableColumnMenu !== false\" class=\"ui-grid-column-menu-button\" ng-click=\"toggleMenu($event)\">" +
          "<i class=\"ui-grid-icon-angle-down\">&nbsp;</i>" +
          "</div>" +
          "<div ng-if=\"filterable\" class=\"ui-grid-filter-container\" ng-repeat=\"colFilter in col.filters\">" +
          "<input type=\"text\" class=\"ui-grid-filter-input\" ng-model=\"colFilter.term\" ng-click=\"$event.stopPropagation()\" ng-attr-placeholder=\"{{colFilter.placeholder || ''}}\">" +
          "<div class=\"ui-grid-filter-button\" ng-click=\"colFilter.term = null\">" +
          "<i class=\"ui-grid-icon-cancel right\" ng-show=\"!!colFilter.term\">&nbsp;</i> <!-- use !! because angular interprets 'f' as false -->" +
          "</div>" +
          "</div>" +
          "</div>";
      };

      // Row Template: Homepage Dashboard Manager Request Approval
      function rowTemplate() {

          return '<div ng-class="{\'row-hovered\' : hover}" ' +
            '     ng-mouseenter="hover = true" ' +
            '     ng-mouseleave="hover = false" ' +
            '     ng-style="{ \'font-weight\': row.entity.isRead !== true ? \'bold\' : \'normal\' }" ' +
//            '     ng-click="grid.appScope.loadCurRequest(row.entity.requestId)">' +
            '     >' +
            '  <div ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.colDef.name" ' +
            '       class="ui-grid-cell" ' +
            '       ng-class="{ \'ui-grid-row-header-cell\': col.isRowHeader }"  ' +
            '       ui-grid-cell>' +
            '  </div>' +
            '</div>' ;
      }

      // Header Template
      function headerTemplate() {
        return '<div ng-style="{ height: col.headerRowHeight }" ng-repeat="col in renderedColumns" ng-class="col.colIndex()" class="ngHeaderCell" ng-header-cell></div>';
      }

      // ColumnDef Info
      // The columns with empty filed will not work for sort as of now
      $scope.columnDef = [
        {
          name: 'home.TEAM',
          field: 'submitterTeamName',
          headerCellTemplate: headerCellTemplate()
        },
        {
          name: 'home.EMPLOYEE',
          field: 'submitterName',
          headerCellTemplate: headerCellTemplate()
        },
        {
          name: 'home.START_DATE',
          field: 'employeeStartDate',
          headerCellTemplate: headerCellTemplate(),
          dateFormat: 'M/d/yy'
        },
        {
          name: 'home.REQ_TYPE',
          field: 'type',
          headerCellTemplate: headerCellTemplate(),
          transPrefix: 'home'
        },
        {
          name: 'home.SUBMITTED',
          field: 'submitDate',
          headerCellTemplate: headerCellTemplate(),
          dateFormat: 'M/d/yy - hh:mm a'
        },
        {
          name: 'home.REQ_DATE',
          field: 'reqDate',
          headerCellTemplate: headerCellTemplate(),
          dateFormat: 'M/d/yy'
        },
        {
          name: 'home.DESCRIPTION',
          field: 'description',
          headerCellTemplate: headerCellTemplate()
        },
        {
          name: 'home.EXPIRES',
          field: 'expirationDate',
          headerCellTemplate: headerCellTemplate(),
          dateFormat: 'M/d/yy'
        },
        {
          name: 'home.STATUS',
          field: 'status',
          transPrefix: 'app',
          width: '20%',
          headerCellTemplate: headerCellTemplate()
        }
      ];

      // External Scope Module, This variable will be used when we have an action inside grid row
      $scope.gridModel = {

        // On a double click event , it will move to employee detail page to show employee detail
        onClickRow : function(row){
          row.isSelected = true;
        }

      };

      $scope.gridOptions = {

        enableColumnResizing: true,
        enableRowHeaderSelection: false,
        modifierKeysToMultiSelect: false,
        noUnselect: true,
//        enableGridMenu: true,
        minRowsToShow: numOfRows,
        columnDefs: $scope.columnDef, //
        rowTemplate: rowTemplate(), //Row Template,
        enableHorizontalScrollbar: 0,
        enableVerticalScrollbar: 0,
        enableColumnMenus: false,

//        enableFiltering: true,
        multiSelect: false,
        useExternalFiltering: true,

        enableSorting: true,
        useExternalSorting: true,

        needPagination: true,
        useExternalPagination: true,
        enablePaginationControls: false,
        paginationPageSize: numOfRows,
        paginationCurrentPage: 1,
        enableFullRowSelection: true,

        //enableSelectAll: true,
        enableRowSelection: true,
//        enableColumnMenus: true,
//        gridMenuTitleFilter: $translate, // Translate Grid Menu column name

        onRegisterApi: function( gridApi ) {
          $scope.gridApi = gridApi;

          gridApi.selection.on.rowSelectionChanged($scope, function (row) {
            if (row.isSelected) {
              $scope.loadCurRequest(row.entity.requestId)
                .then(function onSuccess(request) {
                  $scope.curRequest = prepareRequest(request);
                  $scope.reloadRequestInGrid(request);
                }, function onError(error) {
                  applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
                  console.error(error);
                });
            }
          });


          /**
           *  Dashboard Manager Approval Sort Changed
           */
          $scope.gridApi.core.on.sortChanged( $scope, function( grid, sortColumns ) {

            if (sortColumns.length === 0) {
              $scope.gridOptions.queryParams.orderdir = 'asc';
              $scope.gridOptions.queryParams.orderby = 'TEAM';
            } else {
              $scope.gridOptions.queryParams.orderdir = sortColumns[0].sort.direction;

              switch (sortColumns[0].field) {
                case "submitterTeamName":
                  $scope.gridOptions.queryParams.orderby = 'TEAM';
                  break;
                case "submitterName":
                  $scope.gridOptions.queryParams.orderby = 'EMPLOYEE';
                  break;
                case "employeeStartDate":
                  $scope.gridOptions.queryParams.orderby = 'EMPLOYEE_START_DATE';
                  break;
                case "type":
                  $scope.gridOptions.queryParams.orderby = 'REQ_TYPE';
                  break;
                case "submitDate":
                  $scope.gridOptions.queryParams.orderby = 'SUBMITTED';
                  break;
                case "reqDate":
                  $scope.gridOptions.queryParams.orderby = 'REQ_DATE';
                  break;
                case "expirationDate":
                  $scope.gridOptions.queryParams.orderby = 'EXPIRES';
                  break;
                case "status":
                  $scope.gridOptions.queryParams.orderby = 'REQ_STATUS';
                  break;
                case "description":
                  $scope.gridOptions.queryParams.orderby = 'DESCRIPTION';
                  break;
              }

            }
            getPage();

          });

          //
          // Back-end pagination

          $scope.gridApi.pagination.on.paginationChanged($scope, function (newPage, pageSize) {
            $scope.gridOptions.paginationCurrentPage = newPage;
            getPage();
          });

          var getPage = function() {
            return $scope.loadRequests($scope.gridOptions.paginationCurrentPage);
          };
        }
      };

      $scope.gridOptions.queryParams = {
        orderby:'SUBMITTED',
        orderdir:'desc'
      };

      $scope.isPendingRecipientAndNotApprovedRequest = DashboardService.isPendingRecipientAndNotApprovedRequest;

      //API CALL sites/ops/siteteams
      $scope.loadSiteTeams = function() {

        var deferred = $q.defer();

        factory.getElements('sites/ops/siteteams',{})
          .then(function(res){

            var entities = res.data;

            $scope.filter.siteTeams = [];
            var sites = [];
            var site = null;

            /**
             * Build tree structure
             */
            for (var i=0; i<entities.length; i++) {

              var entity = entities[i];
              site = _.findWhere(sites, {'id': entity.siteId});

              if (!site) {
                site = {id: entity.siteId, name: entity.siteName, teams: []};
                sites.push(site);
              }

              site.teams.push(entity);

            }

            /**
             * Build siteTeams array for dropdown list
             */
            for (i=0; i<sites.length; i++) {
              site = sites[i];

              // group start
              $scope.filter.siteTeams.push({
                searchBy: site.name,
                name: '<strong>' + site.name + '</strong>',
                siteId: site.id,
                msSite: true
              });

              for (var j=0; j<site.teams.length; j++) {
                var team = site.teams[j];

                $scope.filter.siteTeams.push({
                  searchBy: team.teamName,
                  searchBySite: site.name,
                  name: team.teamName,
                  teamId: team.teamId,
                  ticked: true
                });

              }

              // group end
              $scope.filter.siteTeams.push({
                msSite: false
              });

            }

            deferred.resolve(entities); // it will be not useful purpose

          },function(error) {
            applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            deferred.reject(error);
          });

        return deferred.promise;

      };

      /**
       * Searches the requests and updates the grid: manager approval
       * @param pageNum
       * @returns {*}
       */
      $scope.loadRequests = function(pageNum) {
        //[POST] /requests/manager/ops/query
        var deferred = $q.defer();
        var selectedTeamIds = getSelectedTeamIds();
        var selectedStatusIds = getSelectedStatusIds();
        var selectedReqTypesIds = getSelectedReqTypeIds();
        var startTime = null;
        var requestUrl = 'requests/manager/ops/query';

        //Apply "Last # days" filter - prepare startTime to load requests. Subtracts selected days from current time.
        if ($scope.filter.dayLength.day !== 0) {
          startTime = moment().subtract($scope.filter.dayLength.day, 'days').toDate().getTime();
        }

        var urlParam = factory.prepareQueryParams(
            $scope.gridOptions.queryParams,
            pageNum ? pageNum : 1,
            numOfRows);

        var param = {
          sites: null,
          teams: selectedTeamIds.length === 0 ? null : selectedTeamIds,
          types: selectedReqTypesIds.length === 0 ? null : selectedReqTypesIds,
          statuses: selectedStatusIds.length === 0 ? null : selectedStatusIds,
          dateFrom: startTime,
          dateTo: null,
          fullTextSearch: $scope.filter.searchTxt,
          offset: urlParam.offset,
          limit: urlParam.limit,
          orderBy: urlParam.orderby,
          orderDir: urlParam.orderdir.toUpperCase()
        };

        $http.post(baseUrl+requestUrl, param)
          .then(function (response) {
            var approvals = response.data;

            //Prepare approval rows to display
            angular.forEach(approvals.data, function(entity) {
              prepareRequestToDisplayInGrid(entity, $scope.columnDef);
            });

            $scope.gridOptions.data = approvals.data;
            $scope.gridOptions.totalItems = approvals.total;

            deferred.resolve(approvals.data);
//          clear curDetail View
            $scope.curRequest = null;
          }, function(error) {
            applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            deferred.reject(error);
          });

        return deferred.promise;
      };

      function prepareRequestToDisplayInGrid(request, gridColumnDefs) {
        var requestTz = request.submitterTz;

        //Create new fields which is not present in request (which is present in gridColumnDefs)
        request.reqDate = request.eventDate;

        angular.forEach(gridColumnDefs, function(column) {
          switch(column.field) {
            case 'type':
              request[column.field] = $filter('translate')(column.transPrefix+'.'+request[column.field]);
              break;
            case 'status':
              request[column.field] = $filter('translate')(column.transPrefix+'.'+request[column.field]);
              break;
          }
          //If current column is Date
          if(column.dateFormat) {
            request[column.field] = $filter('date')(
                appFunc.convertToBrowserTimezone(request[column.field], requestTz), column.dateFormat
            );
          }
        });
      }

      function updateCurrentGridRowAccordingToGridColumnDef(curRow, request, gridColumnDefs) {
        curRow.submitterTeamName = request.submitterTeamName;
        curRow.submitterName = request.submitterName;
        curRow.type = $filter('translate')('home.'+request.type);
        curRow.description = request.description;
        curRow.status = $filter('translate')('app.'+request.status);
        curRow.isRead = request.isRead;

        var submitDateColumnDef = _.findWhere(gridColumnDefs, {'field': 'submitDate'});
        curRow.submitDate = $filter('date')(request.submitDate, submitDateColumnDef.dateFormat);

        var reqDateColumnDef = _.findWhere(gridColumnDefs, {'field': 'reqDate'});
        curRow.reqDate = $filter('date')(request.eventDate, reqDateColumnDef.dateFormat);

        var expirationDateColumnDef = _.findWhere(gridColumnDefs, {'field': 'expirationDate'});
        curRow.expirationDate = $filter('date')(request.expirationDate, expirationDateColumnDef.dateFormat);
      }

      $scope.loadStatuses = function() {

        //rest/workflow/dashboard/tasks/manager?offset=0&limit=20&orderby=submitted&orderdir=asc
        var deferred = $q.defer();
        $http.get(baseUrl + 'workflow/dashboard/statuses', {})
          .then(function (response) {
            var result = response.data;
            $scope.filter.statuses = result.data;

            _.each($scope.filter.statuses, function(status) {status.ticked = true;});

            deferred.resolve(response.data);

          }, function(error) {
            applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            deferred.reject(error);
          });

        return deferred.promise;
      };

      $scope.loadReqTypes = function() {
        // WIP_REQUEST , SHIFT_SWAP_REQUEST , OPEN_SHIFT_REQUEST, PTO_REQUEST, AVAILABILITY_REQUEST
        $scope.filter.reqTypes = [
          {
            name:'WIP_REQUEST',
            id:'WIP_REQUEST',
            ticked: true
          },
          {
            name:'SHIFT_SWAP_REQUEST',
            id:'SHIFT_SWAP_REQUEST',
            ticked: true
          },
          {
            name:'OPEN_SHIFT_REQUEST',
            id:'OPEN_SHIFT_REQUEST',
            ticked: true
          },
          {
            name:'PTO_REQUEST',
            id:'PTO_REQUEST',
            ticked: true
          },
          {
            name:'AVAILABILITY_REQUEST',
            id:'AVAILABILITY_REQUEST',
            ticked: true
          }
        ];
//        var deferred = $q.defer();
//        $http.get(baseUrl + 'workflow/dashboard/types?orderby=name&orderdir=ASC', {})
//          .then(function (response) {
//            var result = response.data;
//            $scope.filter.reqTypes = result.data;
//
//            _.each($scope.filter.reqTypes, function(reqType) {reqType.ticked = true;});
//
//            deferred.resolve(response.data);
//
//          }, function(error) {
//            deferred.reject(error);
//          });
//
//        return deferred.promise;

      };

      /**
       * Load specific request detail: manager approvals
       * @param requestId
       * @returns {*}
       */
      $scope.loadCurRequest = function (requestId) {
        var deferred = $q.defer();
        $http.get(baseUrl + 'requests/manager/'+requestId, {})
          .then(function (response) {
            var request = response.data.data;
            if(request) {
              deferred.resolve(response.data.data);
            } else {
              console.error("Invalid json received! Cannot get the request object.");
              deferred.reject(response);
            }
          }).catch(function(error) {
              deferred.reject(error);
          });
        return deferred.promise;
      };

      /**
       * Init function: manager approval
       */

      $scope.init = function() {


        $scope.filter = {
          dayLength: null,
          statuses: DashboardService.getRequestStatuses(),
          reqTypes: DashboardService.getRequestTypes(),
          searchTxt: ''
        };

        /**
         * enable all reqTypes in manager approval
         */

        $scope.filter.reqTypes[0]['ticked'] = true;
        $scope.filter.reqTypes[1]['ticked'] = true;

        $scope.filter.dayLength = $scope.days[2]; // load last 30 days

        $scope.currentAccountInfo = JSON.parse($sessionStorage.info);

        /**
         * get Current Account Info
         */
//        DashboardService.getCurrentAccountInfo($scope.currentAccountType).then(function(response) {
//          if ($scope.currentAccountType === 'Employee') {
//            $scope.currentAccountInfo.accountId = response.data.employeeDto.id;
//          }
//          $scope.currentAccountInfo.timezone = response.data.siteTz.id;
//          $scope.currentAccountInfo.siteId = response.data.siteId;
//          $scope.currentAccountInfo.siteFirstDayOfweek = response.data.siteFirstDayOfweek;
//          $scope.currentAccountInfo.teams = response.data.teams;
//
//        }, function(err) {
//          applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
//          deferred.reject(error);
//        });


        $scope.loadSiteTeams()
          .then(function() {
            return DashboardService.getCurrentAccountInfo($scope.currentAccountType);
          })
          .then(function(response) {

            if ($scope.currentAccountType === 'Employee') {
              $scope.currentAccountInfo.accountId = response.data.employeeDto.id;
              $scope.currentAccountInfo.timezone = response.data.siteTz.id;
              $scope.currentAccountInfo.siteId = response.data.siteId;
              $scope.currentAccountInfo.siteFirstDayOfweek = response.data.siteFirstDayOfweek;
              $scope.currentAccountInfo.teams = response.data.teams;
            }
            else {
              $scope.currentAccountInfo.timezone = response.data.actualTimeZone.id;
            }

            return $scope.loadRequests();
          })
          .catch(function(error) {
            if (error.message) {
              applicationContext.setNotificationMsgWithValues(error.message, '', true, '');
            }
            else {
              applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            }

          });



      };

      /**
       * :Manager Approval
       */
      $scope.delayedLoadRequests = function() {
        $timeout(function() {$scope.loadRequests();}, 1000); //wait for the dropdown list update their selectedOutputs
      };

      /**
       * check today is just one day before to specific date
       * @param date
       * @returns {boolean}
       */
      $scope.isTomorrow = function(date){
        var tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000);
        var day = tomorrow.getDate();
        var month = tomorrow.getMonth();
        var year = tomorrow.getFullYear();
        var dateT = new Date(date);

        if (day === dateT.getDate() && month === dateT.getMonth() && year === dateT.getFullYear()) {
          return true;
        }

        return false;


      };

      /**
       * Update Request Status: Manager Approval
       * @param status
       */
      $scope.updateRequest = function(status) {

        var url = 'requests/manager/' +$scope.curRequest.requestId +'/ops/'+status;
        var param = {
          type: $scope.curRequest.type,
          comment: $scope.curRequest.comment
        };

        if ($scope.curRequest.type === 'SHIFT_SWAP_REQUEST') {

          if (status === 'approve' && !$scope.curRequest.curRecipient) {
            applicationContext.setNotificationMsgWithValues('Please select the recipient', '', true);
            return;
          }
          else if (status === 'approve'){
            param.employeeId = $scope.curRequest.curRecipient.peerId;
            param.shiftId = $scope.curRequest.curRecipient.recipientShift.id;
          }

        }
        else if ($scope.curRequest.type === 'WIP_REQUEST') {

          if (status === 'approve' && !$scope.curRequest.curRecipient) {
            applicationContext.setNotificationMsgWithValues('Please select the recipient', '', true);
            return;
          }
          else if (status === 'approve'){
            param.employeeId = $scope.curRequest.curRecipient.peerId;
          }

        }
        else if ($scope.curRequest.type === 'TIME_OFF_REQUEST') {

          param.shiftActions = [];

          for (var i =0; i<$scope.curRequest.shifts.length; i++) {
            var shift = $scope.curRequest.shifts[i];

            var employeeIds = null;
            var errMsg = '';

            if (shift.action === 'ASSIGN_SHIFT') {
              if (shift.teamMate) {
                employeeIds = [shift.teamMate.employeeId];
              }
              else {
                employeeIds = null;
              }

              errMsg = 'Assign Failed: ' + shift.id;
            }

            else if (shift.action === 'POST_AS_OPEN_SHIFT') {
              employeeIds = _.pluck(shift.eligibleTeammates, 'employeeId');
              errMsg = 'POST Failed: ' + shift.id;
            }

            /**
             * Display Dialog box when no employees selected in POST & FIll option
             */
            if ((shift.action === 'POST_AS_OPEN_SHIFT' || shift.action === 'ASSIGN_SHIFT') && (employeeIds === null || employeeIds.length === 0)) {

              break;

            }


            param.shiftActions.push({
                shiftId: shift.id,
                action: shift.action,
                employeeIds: employeeIds
              }
            );

          }

          /**
           * abnormally returned;
           */
          if (i < $scope.curRequest.shifts.length) {
            var dlg = $modal.open({
              templateUrl: 'modules/dashboard/partials/dashboard_approvals_timeoff_msg_dlg.html',
              controller: 'DashboardApprovalsTimeOffMsgCtrl',
              windowClass: 'dashboard-approvals',
              resolve: {
                shift: function() {
                  return $scope.curRequest.shifts[i];
                }
              }
            });

            return dlg;

          }

        }

        $http.post(
          baseUrl + url , param)
          .then(function (response) {
            if (response.data.status === 'SUCCESS') {
              $scope.loadCurRequest($scope.curRequest.requestId)
                .then(function onSuccess(request) {
                  $scope.curRequest = prepareRequest(request);
                  $scope.reloadRequestInGrid(request);
                }, function onError(error) {
                  applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
                  console.error(error);
                });
            } else {
              console.error("Data loaded with invalid status: ", response.data);
            }
          }, function(error) {
            applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            console.error(error);
          });
      };
      
      function prepareRequest(request) {
        function toSubmitterTz(date) {
          return appFunc.convertToBrowserTimezone(date, request.submitterTz);
        }

        //Prepare request data
        request.dateOfAction = toSubmitterTz(request.dateOfAction);
        request.eventDate = toSubmitterTz(request.eventDate);
        request.expirationDate = toSubmitterTz(request.expirationDate);
        request.submitDate = toSubmitterTz(request.submitDate);

        request.isRead = true;

        if (request.commentary.commentary) {
          _.each(request.commentary.commentary, function (comment) {
            comment.datetime = toSubmitterTz(comment.datetime);
          });
        }

        if (request.submitterShift) {
          request.submitterShift.endDateTime = toSubmitterTz(request.submitterShift.endDateTime);
          request.submitterShift.startDateTime = toSubmitterTz(request.submitterShift.startDateTime);
        }

        // Prepare request recipients and shifts
        switch (request.type) {
          case 'SHIFT_SWAP_REQUEST':
          //go down
          case 'WIP_REQUEST':
          {
            //Load Eligible Teammates
            var counts = _.countBy(request.recipients, function (recipient) {
              recipient.dateActed = toSubmitterTz(recipient.dateActed);
              if (recipient.recipientShift) {
                recipient.recipientShift.endDateTime = toSubmitterTz(recipient.recipientShift.endDateTime);
                recipient.recipientShift.startDateTime = toSubmitterTz(recipient.recipientShift.startDateTime);
              }
              if (recipient.status === 'PEER_APPROVED') {
                return 'accepted';
              }
            });
            request.acceptedRecipientCount = counts.accepted ? counts.accepted : 0;
            request.showAcceptedRecipientsOnly = true; // default : only shows accepted
            break;
          }
          case 'TIME_OFF_REQUEST':
          {
            _.each(request.shifts, function (shift) {
              shift.action = 'DROP_SHIFT';//select Drop by default
              shift.endDateTime = toSubmitterTz(shift.endDateTime);
              shift.startDateTime = toSubmitterTz(shift.startDateTime);
            });
            break;
          }
        }
        return request;
      }

      $scope.previewChange = function(request) {

        $modal.open({
          templateUrl: 'modules/dashboard/partials/availability_preview_modal.html',
          controller: 'AvailabilityPreviewModalCtrl',
          size: 'lg',
          resolve: {
            employeeId: function() {
              return request.submitterId;
            },
            siteTimeZone: function() {
              return $scope.currentAccountInfo.timezone;
            },
            firstDayOfWeek: function() {
              return $scope.currentAccountInfo.siteFirstDayOfweek;
            },
            previewParams: function() {
              var firstDate;
              if (request.availUpdate.effectiveStartDate) {
                // for ci timeframes
                firstDate = request.availUpdate.effectiveStartDate;
              } else {
                // for cd timeframes
                firstDate = request.availUpdate.selectedDates[0];
              }

              return {
                requestId: request.requestId,
                year: new Date(firstDate).getFullYear(),
                month: new Date(firstDate).getMonth()
              };
            }
          }
        });
      };

      $scope.showPreviewButton = function(request) {
        return request && request.type === "AVAILABILITY_REQUEST";
      };

      /**
       * return boolean whether action buttons can be shown or not.
       * @param request
       */
      $scope.canShowApproveButton = function(request) {

        if (!request) {
          return false;
        }

        if (request.type=== 'WIP_REQUEST' || request.type=== 'SHIFT_SWAP_REQUEST') {

          if (request.status !=='ADMIN_PENDING') {
            return false;
          }

          var approvedRecipient = _.findWhere(request.recipients, {'status': 'PEER_APPROVED'});

          if (approvedRecipient) {
            return true;
          }
          else {
            return false;
          }

        }
        else if (request.type=== 'TIME_OFF_REQUEST' || request.type=== 'OPEN_SHIFT_REQUEST' || request.type=== 'AVAILABILITY_REQUEST') {

          if (request.status ==='ADMIN_PENDING') {
            return true;
          }
          return false;
        }

      };

      /**
       * return boolean whether action buttons can be shown or not.
       * @param request
       * @returns {boolean}
       */
      $scope.canShowDeclineButton = function(request) {

        if (!request) {
          return false;
        }

        if (request.status ==='ADMIN_PENDING') {
          return true;
        }
        return false;

      };

      /**
       * Update
       * @param recipient
       */
      $scope.setCurRecipient = function(recipient) {
        $scope.curRequest.curRecipient = recipient;
      };


      /**
       * Get Request Employees from Shift : Manager Approval
       * @returns {*}
       */
      $scope.loadEligibleTeammates = function(shift) {

        if (shift.eligibleTeammates) {
          /**
           * Do not call again
           */
          return;
        }

        shift.callInProcess = true;

        shift.eligibleTeammates = [];
        var url = 'employees/' + shift.employeeId + '/ops/getwipeligibleemployees';

        var param = {
          shiftId: shift.id
        };

        $http.post(
            baseUrl + url , param)
          .then(function (response) {

            var result = response.data;
            shift.eligibleTeammates = result.eligibleTeammates;
            shift.callInProcess = false;

            /**
             * No Eligible teammates, switch to 'drop'
             */
            if (shift.eligibleTeammates.length < 1) {
              shift.action = 'DROP_SHIFT';
            }

          }, function(error) {
            shift.eligibleTeammates = null;
            shift.callInProcess = false;
            shift.action = 'DROP_SHIFT';
            applicationContext.setNotificationMsgWithValues(error.data.message, '', true, error.statusText);
            console.log(error);
          });


      };

      /**
       * Update one grid row data
       */
      $scope.reloadRequestInGrid = function(request) {
        var curRow = _.findWhere($scope.gridOptions.data, {'requestId': request.requestId});
        if (!curRow) {
          applicationContext.setNotificationMsgWithValues("can't find the request in the grid", '', true, 'error');
          return;
        }
        updateCurrentGridRowAccordingToGridColumnDef(curRow, request, $scope.columnDef);
      };

      function getSelectedTeamIds() {
        var selectedTeams = [];
        _.each($scope.filter.selectedSiteTeams, function(team) {
              if (team !== null && team.teamId !== null){
                selectedTeams.push(team.teamId);}
            }
        );
        return selectedTeams;
      }

      function getSelectedStatusIds() {
        var selectedStatusIds = [];
        _.each($scope.filter.selectedStatuses, function(status) {selectedStatusIds.push(status.id);});
        return selectedStatusIds;
      }

      function getSelectedReqTypeIds() {
        var selectedReqTypesIds = [];
        _.each($scope.filter.selectedReqTypes, function(type) {selectedReqTypesIds.push(type.id);});
        return selectedReqTypesIds;
      }

    }
  ]
);

dashboard.directive('printRequestStatus', ['$filter', function($filter) {
  var statuses = {
    PEER_PENDING: {
      name: "PEER_PENDING",
      imgPath: "/scheduler-server/emlogis/img/dashboard/peer_pending.png",
      css: "peer-pending"
    },
    ADMIN_PENDING: {
      name: "ADMIN_PENDING",
      imgPath: "/scheduler-server/emlogis/img/dashboard/admin_pending.png",
      css: "admin-pending"
    },
    PEER_APPROVED: {
      name: "PEER_APPROVED",
      imgPath: "/scheduler-server/emlogis/img/mark_as_read_opt1.svg",
      imgStyle: "width: 16px;",
      css: "approved"
    },
    APPROVED: {
      name: "APPROVED",
      imgPath: "/scheduler-server/emlogis/img/mark_as_read_opt1.svg",
      imgStyle: "width: 16px;",
      css: "approved"
    },
    PEER_DECLINED: {
      name: "PEER_DECLINED",
      imgPath: "/scheduler-server/emlogis/img/dashboard/declined.png",
      css: "declined"
    },
    DECLINED: {
      name: "DECLINED",
      imgPath: "/scheduler-server/emlogis/img/dashboard/declined.png",
      css: "declined"
    },
    DELETED: {
      name: "DELETED",
      imgPath: "/scheduler-server/emlogis/img/dashboard/deleted.png",
      css: "deleted"
    },
    EXPIRED: {
      name: "EXPIRED",
      imgPath: "/scheduler-server/emlogis/img/dashboard/expired.png",
      css: "expired"
    },
    WITHDRAWN: {
      name: "WITHDRAWN",
      imgPath: "/scheduler-server/emlogis/img/dashboard/withdrawn.png",
      css: "withdrawn"
    },
    UNKNOWN: {
      name: "UNKNOWN",
      imgPath: "/scheduler-server/emlogis/img/dashboard/unknown.png",
      css: "unknown"
    }
  };

  function getCurrentStatus(statusName) {
    for(var status in statuses){
      if(statuses[status].name == statusName) {
        return statuses[status];
      }
    }
    return statuses.UNKNOWN;
  }

  return {
    restrict: 'A',
    link: function($scope, element, attrs) {
      $scope.$watch(attrs.printRequestStatus, function(value){
        var currentStatus = getCurrentStatus(value);
        if(currentStatus) {
          var imgStyle = currentStatus.imgStyle ? ("style='" + currentStatus.imgStyle + "'") : "";
          var cssClasses = currentStatus.css ? ("class='" + currentStatus.css + "'") : "";
          element.html(
              "<em " + cssClasses + ">" +
              "<img src='" + currentStatus.imgPath + "' " + imgStyle + ">" +
              $filter('translate')('app.'+currentStatus.name) +
              "</em>"
          );
        }
      });
    }
  };
}]);

