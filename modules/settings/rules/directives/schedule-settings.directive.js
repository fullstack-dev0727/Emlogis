(function () {
  "use strict";

  var injectParams = [];

  var scheduleSettingsDirective = function () {
    return {
      restrict: 'AE',
      replace: true,
      scope: {
        settingsData: '=',
        modifiedSettingsData: '=',
        isEditing: '=',
        hasPermissions: '=',
        saveClicked: '='
      },
      templateUrl: 'modules/settings/rules/directives/schedule-settings.directive.tmpl.html',
      link: function(scope, element) {
        console.log('   --> in Schedule Settings dir');

        //--------------------------------------------------------------------
        // On load
        //--------------------------------------------------------------------

        var panelsInit = {};

        scope.panels = {
          configuration: {                                           // Site Configuration panel
            title: "rules.general.SITE_CONFIGURATION",
            settings: [
              {
                function: "rules.general.BREAK_SHIFT_MIDNIGHT",
                description: "rules.general.BREAK_SHIFT_MIDNIGHT_DESC"
              },
              {
                function: "rules.general.BREAK_SHIFT_HOURS",
                description: "rules.general.BREAK_SHIFT_HOURS_DESC"
              },
              {
                function: "rules.general.REDUCE_MIN_HOURS_PTO",
                description: "rules.general.REDUCE_MIN_HOURS_PTO_DESC"
              },
              {
                function: "rules.general.ALLOW_CHAIN_TEAMS",
                description: "rules.general.ALLOW_CHAIN_TEAMS_DESC"
              },
              {
                function: "rules.general.ALLOW_CHAIN_SKILLS",
                description: "rules.general.ALLOW_CHAIN_SKILLS_DESC"
              },
              {
                function: "rules.general.ALLOW_CHAIN_MIDNIGHT",
                description: "rules.general.ALLOW_CHAIN_MIDNIGHT_DESC"
              },
              {
                function: "rules.general.FORCE_COMPLETION",
                description: "rules.general.FORCE_COMPLETION_DESC"
              }
            ],
            setConsecutiveLimit: {
              options: [-1, 1, 2, 3, 4, 5, 6, 7],
              function: "rules.general.CONSECUTIVE_LIMIT",
              description: "rules.general.CONSECUTIVE_LIMIT_DESC"
            },
            setProfileDayType: {
              function: "rules.general.PROFILE_DAY_TYPE",
              description: "rules.general.PROFILE_DAY_TYPE_DESC",
              options: ["DayShiftEnds", "DayShiftStarts", "ShiftMajority"]
            }
          },
          optimization: {                                            // Site Optimization panel
            title: "rules.general.SITE_OPTIMIZATION",
            settings: []
          }
        };



        //--------------------------------------------------------------------
        // Watch for
        //--------------------------------------------------------------------

        //
        // Settings data changed

        scope.$watch("settingsData", function(newSettings) {
          if (newSettings && !_.isEmpty(newSettings)) {
            preparePanelsToDisplay(newSettings);
            console.log('   --> in Schedule Settings dir', scope.panels);
            console.log('   --> if hasPermissions', scope.hasPermissions);
          }
        });


        //
        // Save btn clicked

        scope.$watch("saveClicked", function(saveClicked) {
          console.log('   --> saveClicked', scope.saveClicked);
          if (saveClicked === true) {
            scope.modifiedSettingsData = preparePanelsToSave(scope.panels);
          }
        });



        //--------------------------------------------------------------------
        // Other related methods
        //--------------------------------------------------------------------

        //
        // Update Editing status

        scope.updateEditing = function() {
          scope.isEditing = !angular.equals(panelsInit, scope.panels);
          console.log('   ---> updateEditing:', scope.isEditing);
        };


        //
        // Prepare Panels to display

        var preparePanelsToDisplay = function(data){
          console.log('   --> in preparePanelsToDisplay', data);

          // Set Site Configuration settings
          scope.panels.configuration.settings[0].value = data.breakShiftAtMidnightForDisplay;
          scope.panels.configuration.settings[1].value = data.breakShiftAtMidnightForHours;
          scope.panels.configuration.settings[2].value = data.reduceMaximumHoursForPTO;
          scope.panels.configuration.settings[3].value = data.allowChainingAccrossTeams;
          scope.panels.configuration.settings[4].value = data.allowChainingAccrossSkills;
          scope.panels.configuration.settings[5].value = data.allowChainingAccrossMidnight;
          scope.panels.configuration.settings[6].value = data.forceCompletion;

          scope.panels.configuration.setConsecutiveLimit.value = data.consecutiveLimitOf12hoursDays;    // digit
          scope.panels.configuration.setProfileDayType.value = data.profileDayType;                     // string


          // Set Site Optimization settings
          scope.panels.optimization.settings = [];

          for (var i = 0; i < data.optimizationSettings.length; i++) {                      // # of settings - not all?
            scope.panels.optimization.settings.push( {} );
            scope.panels.optimization.settings[i].value = data.optimizationSettings[i].value;
            scope.panels.optimization.settings[i].type = data.optimizationSettings[i].type;
            scope.panels.optimization.settings[i].name = data.optimizationSettings[i].name;

            scope.panels.optimization.settings[i].function = 'rules.general.' + data.optimizationSettings[i].name;
            scope.panels.optimization.settings[i].description = 'rules.general.' + data.optimizationSettings[i].name + '_DESC';

            if ( data.optimizationSettings[i].name === 'OptimizationPreference' ) {
              scope.panels.optimization.settings[i].options = ["None", "COP", "CPO", "OCP", "OPC", "PCO", "POC"];
            }
          }
          //console.log(scope.panels.optimization);
          panelsInit = angular.copy(scope.panels);                                          // save initial Settings
        };


        //
        // preparePanelsToSave

        var preparePanelsToSave = function(panels) {
          // Prepare Site Configuration settings
          var newScheduleSettings = { override: true };

          newScheduleSettings.breakShiftAtMidnightForDisplay = panels.configuration.settings[0].value;
          newScheduleSettings.breakShiftAtMidnightForHours = panels.configuration.settings[1].value;
          newScheduleSettings.reduceMaximumHoursForPTO = panels.configuration.settings[2].value;
          newScheduleSettings.allowChainingAccrossTeams = panels.configuration.settings[3].value;
          newScheduleSettings.allowChainingAccrossSkills = panels.configuration.settings[4].value;
          newScheduleSettings.allowChainingAccrossMidnight = panels.configuration.settings[5].value;
          newScheduleSettings.forceCompletion = panels.configuration.settings[6].value;
          newScheduleSettings.consecutiveLimitOf12hoursDays = panels.configuration.setConsecutiveLimit.value;    // digit
          newScheduleSettings.profileDayType = panels.configuration.setProfileDayType.value;                     // string


          // Prepare Site Optimization settings
          newScheduleSettings.optimizationSettings = [];

          for (var i = 0; i < panels.optimization.settings.length; i++) {
            newScheduleSettings.optimizationSettings.push( {} );
            newScheduleSettings.optimizationSettings[i] = {
              "type" : panels.optimization.settings[i].type,
              "name" : panels.optimization.settings[i].name,
              "value": panels.optimization.settings[i].value
            };
          }

          return newScheduleSettings;
        };



        //--------------------------------------------------------------------
        // UI
        //--------------------------------------------------------------------

        //
        // Sortable options
        // for drag-n-drop behavior in Optimization Settings table
        // Dependency: Angular UI Sortable

        scope.sortableOptions = {
          update: function() {
            console.log('   ---> sortableOptions upd:', scope.panels);
            scope.updateEditing(); // angular.equal doesn't evaluate 1st sortable event TODO
          },
          sort: function(e) {
            if (!scope.hasPermissions) {
              return false;
            }
          },
          axis: 'y',
          containment: 'parent',
          delay: 150,
          revert: true
        };

      }
    };
  };


  scheduleSettingsDirective.$inject = injectParams;
  angular.module('emlogis.rules').directive('schedsettings', scheduleSettingsDirective);

}());