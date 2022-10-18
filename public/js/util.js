// Declare Directives Module
angular.module('emlogis.directives',[]);
;


var duration = function(start, end) {
    if (start.getTime() <= 0 || end.getTime() <=0) {
        return "";
    }
    var d = end.getTime() - start.getTime();
    if (d < 1000) {
        return "" + d + " ms";
    }
    else {
        return "" + d / 1000 + " sec";
    }
};
;

var ListAndCardPagingCtlr = function() {   // defining base constructor
    console.log("ListAndCardPagingCtlr base constructor");
    return this;
};

/*
 * Default / Base helper controller for displaying Lists with paging and Card view
 */
ListAndCardPagingCtlr.prototype.init = function($scope, $stateParams, $state, $filter, authService, appContext, dataService, dialogs) {

        console.log("ListAndCardPagingCtlr scope: " + $scope.$id + ' parent: ' +  $scope.$parent.$id);

        if ($scope === undefined) {
        console.log('inside BaseListMgmtCtlr controller NO ARG');
            return;
        }
        console.log('inside BaseListMgmtCtlr controller for: ' + $stateParams.entity + '/' + $stateParams.q);
           
        console.log("ListAndCardPagingCtlr state params " + "." + $stateParams.entity);
        console.log("ListAndCardPagingCtlr scope params " + $scope.entity + "->" + $scope.relatedentity);
        console.log("ListAndCardPagingCtlr scope order " + $scope.orderby);



        // controller init:
        var entity = $stateParams.entity;  
        $scope.entity = entity;
        var entity2resource = appContext.get('entity2resource');             
        $scope.entityTypeLabel = entity2resource.getLabel(entity);
        $scope.resource = entity2resource.getResource(entity);

        var ctlrConfig = $stateParams.ctlrConfig;
        if (ctlrConfig) {
            // copy controllr config parmas into scope
            _.extend($scope, ctlrConfig); 
        }

        // search/query params
        $scope.elements = [];
        $scope.q = $stateParams.q;
        
        // filter params
        $scope.filteredElements = [];
        $scope.filteredCount = 0;
        
        // sort params
        if (ctlrConfig.columns) {
            $scope.orderby = ctlrConfig.columns[0].name;
        }
        $scope.reverse = false;

        //paging params
        $scope.totalRecords = 0;
        $scope.pageSize = 60;
        $scope.currentPage = 1;

        // view type params. show list view by default
        $scope.ViewEnum = {Card: 0, List: 1};
        $scope.listViewEnabled = true;

        // toolbar  filter input
        $scope.filterText = '';
        
        $scope.selectedElement = undefined;

        $scope.this = this;
        // ===========================================================================
        // Scope methods


        // permission check proxy method. permission check is proxied to  authService
        // note: this method is required in all controllers that have controls depending on permissions
        $scope.hasPermission = function( perm) {
            return authService.hasPermission( perm);
        };

        $scope.hasPermissionIn = function(perms) {
            return authService.hasPermissionIn(perms);
        };

        // switch list/card view 
        $scope.changeView = function (view) {
            switch (view) {
                case $scope.ViewEnum.Card:
                    $scope.listViewEnabled = false;
                    break;
                case $scope.ViewEnum.List:
                    $scope.listViewEnabled = true;
                    break;
            }
        };

        // change page and refesh view
        $scope.pageChanged = function () {
            $scope.this.getElements();
        };

        // set sorting order (asc / desc) and refesh view
        $scope.setOrder = function (orderby) {
            if (orderby.name === $scope.orderby) {
                $scope.reverse = !$scope.reverse;
            }
            $scope.orderby = orderby.name;
            $scope.this.getElements();
            var x  = 1;
        };

        // filter rows based on filter input
        $scope.filterElements = function (filterText) {
            if (filterText !== undefined && filterText.length > 0) {
                $scope.filteredElements = $filter('filter')($scope.elements, filterText);
            }
            else {
                $scope.filteredElements = $scope.elements;
            }
            $scope.filteredCount = $scope.filteredElements.length;
            console.log('--> filter(' + filterText + ')' + ' => ' + $scope.filteredCount + '/' +
                $scope.elements.length);
        };

        // displays Element details according to selected row
        $scope.showElementDetails = function( element){
            // FOR NOW, JUST USE THIS METHOD TO SELECT A ROW

            $scope.selectedElement = element;
            // get entity from element class name.
            var actualentity = element.clName.toLowerCase();
            console.log('--> showElementDetails(' + actualentity + ':' + element + ')' + ' => ' + element.name + ',' +
                element.id);
            var to = 'authenticated.entity';
            $state.go(to, {entity: actualentity, id: element.id});
            var x =1;
        };

        $scope.renderDateField = function(value, filter) {
            if (filter === null)
                return value;
            else
                return $filter('date')(value, filter);
        };


        // ===========================================================================
        // overridable Controller methods

        this.getElements = function() {

            console.log("ListAndCardPagingCtlr.getElements()");
            console.log("ListAndCardPagingCtlr.getElements()");
            console.log("ListAndCardPagingCtlr state params " + "." + $stateParams.entity);
            console.log("ListAndCardPagingCtlr scope params " + $scope.entity + "->" + $scope.relatedentity);
            console.log("ListAndCardPagingCtlr scope order " + $scope.orderby);


            var queryParams = {filter: $scope.q};
            if ($scope.orderby) {
                queryParams.orderby = $scope.orderby;
                queryParams.orderdir = (!$scope.reverse ? 'ASC' : 'DESC');
            }

            dataService
            .getElements($scope.resource, queryParams, $scope.currentPage, $scope.pageSize)
            .then(function (result) {
                $scope.elements = result.data;
                $scope.totalRecords = result.total;
                    console.log(result);

                // debug code
                var i = 0;
                for( i=0; i<$scope.elements.length; i++){
                    var elt = $scope.elements[i];
                    console.log('--> loaded[' + i + ']' + elt.clName + ': ' + elt.id);                  
                }
                // end debug
                $scope.filterElements($scope.filterText); 
            }, function (error) {
                dialogs.error("Error", error.data.message, 'lg');
            }); 

        };
        

        // ===========================================================================
        // private Controller methods

        createWatches();  


        // watch filter
        function createWatches() {
            //Watch filterText value and pass it and t
            //Doing this instead of adding the filter to ng-repeat allows it to only be run once (rather than twice)
            //while also accessing the filtered count via $scope.filteredCount above
            $scope.$watch("filterText", function(filterText) {
                $scope.filterElements(filterText);
            });
        }

        return this;
};



/*
 * Default / Base helper controller for Displaying the attributes of an entity or creating a new entity
 */
var EditOrCreateEntityCtlr = function($scope, $stateParams, $state, stateManager, $filter, authService, appContext,
                                      dataService, dialogs, alertsManager) {

    console.log("EditOrCreateEntityCtlr scope: " + $scope.$id + ' parent: ' +  $scope.$parent.$id);

//    $("#alert").hide();
    $scope.alerts = [];

    console.log('inside EditOrCreateEntityDetailsCtlr controller for: ' + $stateParams.entity + '/' + $stateParams.id);
    $scope.name = $stateParams.entity + ":" + $stateParams.id;

    var entity = $stateParams.entity; 
    $scope.entity = entity;
    var entity2resource = appContext.get('entity2resource');             
    $scope.entityTypeLabel = entity2resource[entity].label;
    var resource = entity2resource[entity].restResource; 

    var ctlrConfig = $stateParams.ctlrConfig;
    if (ctlrConfig) {
        // copy controllr config parmas into scope
        _.extend($scope, ctlrConfig); 
    }

    var id = $stateParams.id;


    // ===========================================================================
    // Scope methods

    // permission check proxy method. permission check is proxied to  authService
    // note: this method is required in all controllers that have controls depending on permissions
    $scope.hasPermission = function( perm) {
        return authService.hasPermission( perm);
    };

    $scope.hasPermissionIn = function(perms) {
        return authService.hasPermissionIn(perms);
    };

    $scope.getElement = function() {
        getElement();
    };  

    /*
    * placeholder for controllers that need to perform some operations after (re-)loading the data 
    */
//    if ($scope.postGetElement  === undefined) {
        // add it if not already existent to avoid race conditions.
//        $scope.postGetElement = function() {
            // do nothing
//        };    
//    }

    $scope.saveOrCreate = function() {
        if ($scope.mode == 'Edit') {
            // update entity
            updateElement();
        }
        else {
            // create entity, then switch to Edit mode
            if (! $scope.vetoCreate()) {
                createElement();
            }
        }

    };

    /* 
     * vetoCreate() can be ovveriden to for instance check data is valid or prompt for additional data
     * (ex on team creation, a Site must be selected, see teamcontrollers.js) 
     */
    $scope.vetoCreate = function() {
        return false;
    };

    $scope.closeAlert = function(index) {
        $scope.alerts.splice(index, 1);
    };

    /*
    * getCreateDto() method to be overriden in some controllers that need
    * to process the data to be sent to the backend on object create  
    */
    $scope.getCreateDto = function() {
        // by default, just return the object itself;
        return $scope.elt;
    };

    /*
    * getUpdateDto() method to be overriden in some controllers that need
    * to process the data to be sent to the backend on object update  
    */
    $scope.getUpdateDto = function() {
        // by default, just return the object itself;
        return $scope.elt;
    };

    //----datepicker methods
    $scope.clear = function () {
        $scope.dt = null;
    };
    $scope.open = function($event,opened) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope[opened] = true;
    };

    $scope.today = function() {
        $scope.dt = new Date();
    };
    $scope.today();
    //---------

    $scope.partials = {
        addInfo: 'modules/browser/partials/entity_info.tpl.html',
        tabs: 'modules/browser/partials/entity_tabs.tpl.html'
    };

    $scope.cancel = function () {
        if($state.current.name == "authenticated.createchildentity"){
            $state.go(stateManager.previousState, stateManager.previousParams);
        }
    };


    // ===========================================================================
    // Controller private methods

    // getElement by id 
    function getElement(){

        if ($scope.secundaryEntity) {
            // api call has form api($parentId, dto)
            var params = [$stateParams.parentEntityId, $scope.elt.id];     
            dataService[ctlrConfig.dataServiceGetAssociatedEntityAPI]
                .apply(this, params)
                .then(function (result) {
                    var elt = result;
                    var label = (elt.name ? elt.name : elt.id) /*+ '(' + elt.id + ')')*/;
                    console.log('--> loaded[' + elt.clName + ': ' + label + ']'); 
                    $scope.elt = elt;  // update view with backend result
                    if ($scope.postGetElement !== undefined) {
                        $scope.postGetElement();    
                    }
                },function (error) {
                    dialogs.error("Error", error.data.message, 'lg');
                }); 
        }
        else {
            dataService
            .getElement(resource, $scope.elt.id, {})
            .then(function (result) {
                var elt = result;
                var label = (elt.name ? elt.name : elt.id);
                console.log('--> loaded[' + elt.clName + ': ' + label + ']'); 
                $scope.elt = elt;
                if ($scope.postGetElement !== undefined) {
                    $scope.postGetElement();    
                }
            }, function (error) {
                dialogs.error("Error", error.data.message, 'lg');
            }); 
        }              
    }
    
    // update Element  
    function updateElement(){

        var elt = $scope.getUpdateDto();
        if ($scope.secundaryEntity) {
            // api call has form api($parentId, dto)
            var params = [$stateParams.parentEntityId, $scope.elt.id, elt];     
            dataService[ctlrConfig.dataServiceUpdateAssociatedEntityAPI]
                .apply(this, params)
                .then(function (result) {
                    var elt = result;
                    var label = (elt.name ? elt.name : elt.id);
                    console.log('--> updated[' + label + ']'); 
                    $scope.elt = elt;  // update view with backend result
                    alertsManager.addAlert("'" + label + "' successfully updated.", 'success');
                },function (error) {
                	dialogs.error("Error", "Error while updating: '" + elt.name + "': " + error.data.message, 'lg');
                });
        }
        else {
            dataService
            .updateElement(resource, $scope.elt.id, elt)
            .then(function (result) {
                var elt = result;
                var label = (elt.name ? elt.name : elt.id);
                $scope.elt = elt;  // update view with backend result

                alertsManager.addAlert("'" + label + "' successfully updated.", 'success');

                },function (error) {
            	dialogs.error("Error", "Error while updating: '" + elt.name + "': " + error.data.message, 'lg');
            });
        }
    }

    // create Element  
    function createElement(){

        var elt = $scope.getCreateDto();
        if ($scope.secundaryEntity) {
            // api call has form: api($parentId, dto)
            var params = [$stateParams.parentEntityId, elt];     
            dataService[ctlrConfig.dataServiceCreateAssociatedEntityAPI]
                .apply(this, params)
                .then(function (result) {
                    var elt = result;
                    var label = (elt.name ? elt.name : elt.id);
                    console.log('--> created[' + label + ']'); 
                    $scope.elt = elt;  // update view with backend result
                    $scope.mode = 'Edit';
                    $scope.modeBtn = 'Save';
                    // update state
                    //$stateParams.id = elt.id; // doesn't work

                    alertsManager.addAlert("'" + label + "' successfully created.", 'success');

                    if($state.current.name == "authenticated.createchildentity"){
                        $state.go(stateManager.previousState, stateManager.previousParams);
                    }

                },function (error) {
                	dialogs.error("Error", "Error while creating: '" + $scope.elt.name + "': " + error.data.message, 'lg');
                });
        }
        else {
            // api call has standard form: createElement(dto)
            dataService
            .createElement(resource, elt)
            .then(function (result) {
                var elt = result;
                var label = (elt.name ? elt.name : elt.id);
                console.log('--> created[' + label+ ': ' + elt.id + ']'); 
                $scope.elt = elt;  // update view with backend result
                $scope.mode = 'Edit';
                $scope.modeBtn = 'Save';
//                $stateParams.id = elt.id;
                var st = $state.current;            // reload current state with created object
                alertsManager.addAlert("'" + label + "' successfully created.", 'success');

                if($state.current.name == "authenticated.createchildentity"){
                    $state.go(stateManager.previousState, stateManager.previousParams);
                } else {
                    $state.go(st.name, {id: elt.id});
                }

            }, function (error) {
            	dialogs.error("Error", "Error while creating: '" + $scope.elt.name + "': " + error.data.message, 'lg');
            });    
        }         
    }

    $scope.currentState = $state.current.name;
    $scope.elt = {};
    $scope.mode = 'Edit';
    $scope.modeBtn = 'Save';
    if (id === undefined || id == 'new'  || id === '') {
        id = '';    // clear Id (will be generated by backend)
        $scope.elt.name = 'new ' + $scope.entityTypeLabel;
        $scope.elt.description = 'new ' + $scope.entityTypeLabel;
        $scope.mode = 'Create';
        $scope.modeBtn = 'Create';
        $scope.elt.id = id;

    } 
    else {
        $scope.elt.id = id;
        getElement();

        ctlrConfig = $stateParams.ctlrConfig;
        $state.go('authenticated.entity.relatedentity', {relatedentity: ctlrConfig.defaultRelatedEntity});
    }

};    

var getScopeHierachy = function(scope) {
    var scopelist = '';
    while (scope !== null) {
        scopelist += (scope.$id + ',');
        scope = scope.$parent;
    }
    return scopelist;
};


var ModalInstanceCtrl = function($scope, $modalInstance, $modal, item) {
    console.log("ModaCtlr: " + getScopeHierachy($scope));

    $scope.item = item;
    $scope.ctlr = 'ModalInstanceCtrl';
    $scope.ok = function () {
        if (! $scope.selectedEntity) {
            $scope.cancel();    // in case user has closed wo selecting any item
        }
        $modalInstance.close($scope.selectedEntity);
    };
    $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
    };
};




    	

;
/**
 * Created by Georgi K. on 10/9/14.
 */

app = angular.module('emlogis.directives');

app.directive('activeClassOn', [
    '$state', function($state) {
        return {
            restrict: 'A',
            controller: [
                '$scope', '$element', '$attrs', function($scope, $element, $attrs) {
                    var isMatch, routesToMatch;
                    routesToMatch = $attrs.activeClassOn.split(' ');
                    isMatch = function() {
                        return _.any(routesToMatch, function(route) {
                            return $state.includes(route);
                        });
                    };
                    $scope.$on('$stateChangeSuccess', function() {
                        if (isMatch()) {
                            return $element.addClass('active');
                        } else {
                            return $element.removeClass('active');
                        }
                    });
                    if (isMatch()) {
                        return $element.addClass('active');
                    } else {
                        return $element.removeClass('active');
                    }
                }
            ]
        };
    }
]);

;
var app = angular.module('emlogis.directives');

app.directive('dhxScheduler', function() {
    return {
        restrict: 'A',
        scope: false,
        transclude: true,
        template:'<div class="dhx_cal_navline" ng-transclude></div><div class="dhx_cal_header"></div><div class="dhx_cal_data"></div>',

        link:function ($scope, $element, $attrs, $controller){
            //default state of the scheduler
            if (!$scope.scheduler)
                $scope.scheduler = {};
            $scope.scheduler.mode = $scope.scheduler.mode || "month";
            $scope.scheduler.date = $scope.scheduler.date || new Date();

            //watch data collection, reload on changes
            $scope.$watch($attrs.data, function(collection){
                scheduler.clearAll();
                scheduler.parse(collection, "json");
            }, true);

            //mode or date
            $scope.$watch(function(){
                return $scope.scheduler.mode + $scope.scheduler.date.toString();
            }, function(nv, ov) {
                var mode = scheduler.getState();
                if (nv.date != mode.date || nv.mode != mode.mode)
                    scheduler.setCurrentView($scope.scheduler.date, $scope.scheduler.mode);
            }, true);

            //size of scheduler
            $scope.$watch(function() {
                return $element[0].offsetWidth + "." + $element[0].offsetHeight;
            }, function() {
                scheduler.setCurrentView();
            });

            //styling for dhtmlx scheduler
            $element.addClass("dhx_cal_container");

            //init scheduler
            scheduler.init($element[0], $scope.scheduler.date, $scope.scheduler.mode);

        }
    };
});

;


var app = angular.module('emlogis.directives');


app.directive('shiftPatternGraph',['patternGraph',
  function(patternGraph) {
    return {
      restrict: 'AEC',
      scope: {
        selectShiftInGraph: '&'
      },
      templateUrl: 'util/directive/templates/shift-pattern-graph.tpl.html',
      link:function ($scope, $element, $attrs, $controller){

        // const variable
        var MIN_PER_HOUR = 60;
        var MIN_PER_SCALE = 30;

        console.log('Shift Pattern Graph Directive');

        // Shared variable
        $scope.graph = patternGraph.getGraph();

        $scope.inOptimumColsHeader = function($index, isGridTime) {

          if (isGridTime === true) {
            return ($index < $scope.graph.optimumCols );
          }
          else {
            return ($index < $scope.graph.optimumCols * 2 );
          }

        };

        $scope.inOptimumColsShifts = function(shift) {

          return (shift.x + shift.shiftLengthLength / MIN_PER_HOUR * 2 <= $scope.graph.optimumCols * 2);

        };


      }
    };
  }
]);

;
var app = angular.module('emlogis.directives');

var GENERAL = 'GENERAL';
var SPECIFIC = 'SPECIFIC';
var EXISTING = 'EXISTING';

var hourDifference = (new Date().getTimezoneOffset()) / 60;
var minDifference = (Math.abs(new Date().getTimezoneOffset())) % 60;

var timeDifference = null;

if (hourDifference > 0) {
    timeDifference = '-';
}
else {
    timeDifference = '+';
}

if (hourDifference.toString().length < 2 )
    hourDifference = '0' + hourDifference.toString();

if (minDifference.toString().length < 2 )
    minDifference = '0' + minDifference.toString();

timeDifference += hourDifference + minDifference;

app.directive('shiftPatternList',[ '$rootScope', '$modal', 'crudDataService',
  'applicationContext',
  'patternList',
  'appFunc',
  function($rootScope, $modal, crudDataService, applicationContext, patternList, appFunc) {
  return {
    restrict: 'AEC',
    scope: {
      site: '=',
      team: '=',
      skill: '=',
      save: '&'
    },
    templateUrl: 'util/directive/templates/shift-pattern-list.tpl.html',
    link:function ( $scope, $element, $attrs, $controller ){

      var factory = _.clone(crudDataService);

      console.log('Shift Pattern List Directive');

      $scope.patternCalendar = patternList.getPatternCalendar();

      /**
       * Link variables with $scope variable
       */

      var defaultPatternName = 'New Shift';

      $scope.patternCalendar.maxDayPatternCount = 0;

      $scope.getBlankPatterns = function(patterns){
        return new Array($scope.patternCalendar.maxDayPatternCount - patterns.length);
      };

      /**
       * add one Shift Pattern for Day
       * @param shiftPatternDay
       * @param newPattern : null (on the fly), object: from backend
       */
      $scope.addShiftPatternForDay = function(shiftPatternDay, newPattern) {


        if (!newPattern) {

          newPattern = {
            'name' : defaultPatternName,
            'shifts': [],
            'hours': [],
            'shiftLengths': [],
            'shiftIds': [],
            'dayType': 'GENERAL',
            'cdDate': null,
            'shiftPatternCdDate': null,
            'shiftPatternType': 'Set'
          };
//
//
//          patternCalendar.option.patternType = pattern.shiftPatternType;
//          patternCalendar.option.cdDate = pattern.shiftPatternCdDate;
//          if (pattern.shiftPatternCdDate === null) {
//            patternCalendar.option.dayType = 'GENERAL';
//          }
//          else {
//            patternCalendar.option.dayType = 'SPECIFIC';
//          }

          /**
           * set it true so that it will not loaded from backend when use selects on the graph
           * @type {boolean}
           */
          newPattern.loaded = true;
          patternList.initializeDefaultDemands(newPattern);


            /**
             * if current shift pattern is editing
             */
          if ($scope.patternCalendar.option.editing) {

            appFunc.getSaveWorkDlg().then(function(reason){

              var working = applicationContext.getWorking();

              if (reason === DISCARD || reason === SKIP) {

                working.restoreFunc();

                /**
                 * Clear Selected pattern to false
                 */
                clearPatternsSelection($scope.skill.generalPatterns);
                clearPatternsSelection($scope.skill.specificPatterns);

                /**
                 * It is adding new shift pattern so editing should be true
                 */
                if (working.option !==null)
                  working.option.editing = true;
                patternList.processAddShiftPatternForDay(shiftPatternDay,newPattern);

                /**
                 * Set new pattern as selected
                 */

                patternList.processSetCurrentShiftPattern(newPattern, shiftPatternDay);

                //uncheck demandshiftlength
                patternList.uncheckAllDemandShiftLengths();

              }
              else if (reason === SAVE) {

//                if (($scope.patternCalendar.option.dayType === SPECIFIC) && (!$scope.patternCalendar.option.cdDate)) {
//                  applicationContext.setNotificationMsgWithValues('schedule_builder.PLEASE_SPECIFY_SPECIFIC_DATE', '', true, '');
//                  return;
//                }
//
                return working.saveFunc()
                  .then( function(result) {
                    patternList.processAddShiftPatternForDay(patternList.getShiftPatternDay(shiftPatternDay.day, EXISTING),newPattern);
                    patternList.processSetCurrentShiftPattern(newPattern, shiftPatternDay);
                    $scope.patternCalendar.option.editing = true;

                    patternList.uncheckAllDemandShiftLengths();

                    console.log('Add new shift after update/save');

                  },function (reason){
                    /**
                     * We have error and should roll back
                     */
                    working.restoreFunc();

                    /**
                     * Clear Selected pattern to false
                     */
                    clearPatternsSelection($scope.skill.generalPatterns);
                    clearPatternsSelection($scope.skill.specificPatterns);

                    patternList.processAddShiftPatternForDay(patternList.getShiftPatternDay(shiftPatternDay.day, EXISTING),newPattern);
                    patternList.processSetCurrentShiftPattern(newPattern, shiftPatternDay);
                    $scope.patternCalendar.option.editing = true;
                  }

                );
              }

            }, function(reason) {
                console.log('dismissed');
            });
          }
          else {
            patternList.uncheckAllDemandShiftLengths();
            patternList.processAddShiftPatternForDay(shiftPatternDay,newPattern);
            /**
             * Set new pattern as selected
             */

            patternList.processSetCurrentShiftPattern(newPattern, shiftPatternDay);

          }

          /**
           * If it is add new pattern on the web, mark editing as true
           */
          $scope.patternCalendar.option.editing = true;
        }
        else {
          $scope.uncheckAllDemandShiftLengths();
          patternList.processAddShiftPatternForDay(shiftPatternDay, newPattern);
          /**
           * Set new pattern as selected
           */

          patternList.processSetCurrentShiftPattern(newPattern, shiftPatternDay);



        }

      };

      /**
       * Set Current Shift Pattern, Loads shifts as well
       * Sometimes it is necessary to watch currentShiftPattern variable
       * @param pattern
       * @param shiftPatternDay
       */
      $scope.setCurrentShiftPattern = function (pattern, shiftPatternDay) {

        if ($scope.patternCalendar.currentShiftPattern) {

          /**
           * if same shift pattern clicked, return
           */
          if ($scope.patternCalendar.currentShiftPattern.id === pattern.id) {
            return;
          }

          /**
           * Previous demand ShiftLength is not to switch the current pattern without save/update
           */
          if ($scope.patternCalendar.option.editing ===true) {

            appFunc.getSaveWorkDlg().then(function(reason) {

              var working = applicationContext.getWorking();

              if (reason === DISCARD || reason === SKIP) {

                if (working.option !==null)
                  working.option.editing = false;

                working.restoreFunc();
                $scope.patternCalendar.currentShiftPattern.selected = false;
                patternList.processSetCurrentShiftPattern(pattern,shiftPatternDay);

              }
              else if (reason === SAVE) {
                $scope.patternCalendar.option.editing = false;
                return working.saveFunc()
                  .then( function(result) {

                    var tmpShiftPatternDay = patternList.getShiftPatternDay(shiftPatternDay.day, EXISTING);
                    var tmpShiftPattern = patternList.getShiftPattern(tmpShiftPatternDay,pattern.id);
                    patternList.processSetCurrentShiftPattern(tmpShiftPattern,tmpShiftPatternDay);

                  },function (reason){

                    $scope.patternCalendar.option.editing = true;
                    // do not switch
                  }

                );

              }

            }, function(reason) {
              console.log('dismissed');
            });

            return;
          }

          else {
            $scope.patternCalendar.currentShiftPattern.selected = false;

            if ($scope.patternCalendar.currentShiftPattern.id !== pattern.id) {
              if ($scope.patternCalendar.option.editing !== false) {
                $scope.patternCalendar.option.editing = false;
              }
            }
          }


          //Set Current Shift Pattern, PatternDay

        }

        patternList.processSetCurrentShiftPattern(pattern,shiftPatternDay);


      };


      /**
       * This function returns based on the weekday and day time on the page
       * @param shiftPatternDay
       * return true : can select current shift pattern or add
       */
      $scope.canClickLink = function(shiftPatternDay) {
        if (($scope.patternCalendar.option.dayType === 'GENERAL') && (shiftPatternDay.day !== 'SPECIFIC_DATE')) {
          return true;
        }
        else if (($scope.patternCalendar.option.dayType === 'SPECIFIC') && (shiftPatternDay.day === 'SPECIFIC_DATE')) {
          return true;
        }
        return false;
      };

      $scope.uncheckAllDemandShiftLengths = function() {
        
        
      };

      /**
       * Clear Selected Variable in the Shift patterns
       */
      function clearPatternsSelection(patterns) {
        _.each(patterns, function(pattern) {
          if (pattern.selected === true) {
            pattern.selected = false;
          }
        });
      }


      // Init ShiftPatterDay Collection: Shift Pattern List Directive with Starting from Sunday
      patternList.initShiftPatternDayCollection(0);

    }
  };
}]);

/**
 * This is the date pattern issue when we use angular 1.3
 */

app.directive('datepickerPopup', function (){
  return {
    restrict: 'EAC',
    require: 'ngModel',
    link: function(scope, element, attr, controller) {
      //remove the default formatter from the input directive to prevent conflict
      controller.$formatters.shift();
    }
  };
});