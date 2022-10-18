angular.module('emlogis.employeeSchedules')
  .controller('EmployeeSchedulesCtrl',
  ['$scope', '$state', '$stateParams', '$modal', '$sessionStorage', '$timeout', 'applicationContext', 'authService',
    'appFunc', 'dataService', 'EmployeeSchedulesService', 'sseService', 'wsService',
  function($scope, $state, $stateParams, $modal, $sessionStorage, $timeout, applicationContext, authService,
           appFunc, dataService, EmployeeSchedulesService, sseService, wsService) {

    var siteTimeZone = null;
    $scope.consts = {
      daysOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      calendarTimeLabels: [
        {label: '12A', value: '00'},  {label: '1A', value: '01'},   {label: '2A', value: '02'},
        {label: '3A', value: '03'},   {label: '4A', value: '04'},   {label: '5A', value: '05'},
        {label: '6A', value: '06'},   {label: '7A', value: '07'},   {label: '8A', value: '08'},
        {label: '9A', value: '09'},   {label: '10A', value: '10'},  {label: '11A', value: '11'},
        {label: '12P', value: '12'},  {label: '1P', value: '13'},   {label: '2P', value: '14'},
        {label: '3P', value: '15'},   {label: '4P', value: '16'},   {label: '5P', value: '17'},
        {label: '6P', value: '18'},   {label: '7P', value: '19'},   {label: '8P', value: '20'},
        {label: '9P', value: '21'},   {label: '10P', value: '22'},  {label: '11P', value: '23'}
      ],
        scheduleStatus: {
            POSTED: "Posted",
            SIMULATION: "Simulation",
            PRODUCTION: "Production"
        }
    };

    $scope.sort = {
      field: 'employeeName',
      order: 'asc'
    };
    $scope.filter = {
      homeTeams: [],
      assignedTeams: [],
      primarySkills: [],
      assignedSkills: [],
      selectedHomeTeams: [],
      selectedAssignedTeams: [],
      selectedPrimarySkills: [],
      selectedAssignedSkills: [],
      startTime: '0;1440',
      employeeName: '',
      sliderOptions: {
        from: 0,
        to: 1440,
        step: 30,
        dimension: '',
        scale: ['0', '|', '|', '|', '|', '|', '3', '|', '|', '|', '|', '|', '6',
          '|', '|', '|', '|', '|', '9', '|', '|', '|', '|', '|', '12',
          '|', '|', '|', '|', '|', '15', '|', '|', '|', '|', '|', '18',
          '|', '|', '|', '|', '|', '21', '|', '|', '|', '|', '|', '24'],
        calculate: function(value) {
          var hours = Math.floor( value / 60 );
          var mins = ( value - hours*60 );
          return (hours < 10 ? "0"+hours : hours) + ":" + ( mins === 0 ? "00" : mins );
        },
        css: {
          pointer: { 'background-color': '#0e9ac9' },
          background: { 'background-color': '#899498' },
          range: { 'background-color': '#0e9ac9' }
        }
      },
      displayFloats: false,
      displayScheduledOnly: false
    };
    $scope.checkboxModel = {
      showHourlyRate: false
    };

    $scope.viewMode = {
      mode: null
    };

    $scope.feedWeekForScheduleWeekView = null;
    $scope.selectedSchedule = null;
    $scope.scheduleInfoLoaded = null;
    $scope.summaryCollapsed = false;
    $scope.timeIntervalInMinutes = [{value: 0, width: '25%'}, {value: 15, width: '25%'}, {value: 30, width: '25%'}, {value: 45, width: '25%'}];

    $scope.onFilterChanged = function(needShiftsFilter) {
      $timeout(function() {
        angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
          if (employee.name.toLowerCase().indexOf($scope.filter.employeeName.toLowerCase()) < 0) {
            employee.visible = false;
            return;
          }
          if (_.findIndex($scope.filter.homeTeams, 'id', employee.homeTeamId) > -1 &&
            _.findIndex($scope.filter.selectedHomeTeams, 'id', employee.homeTeamId) === -1) {
            employee.visible = false;
            return;
          }
          if (_.findIndex($scope.filter.primarySkills, 'id', employee.primarySkillId) > -1 &&
            _.findIndex($scope.filter.selectedPrimarySkills, 'id', employee.primarySkillId) === -1) {
            employee.visible = false;
            return;
          }
          employee.visible = true;
        });

        if (needShiftsFilter) {
          $scope.applyFilterToShifts();
        }
        $scope.calculateSummaryInfoForSelectedWeekOrDay();

        if ($scope.viewMode.mode === 'day') {
          $scope.populateDayHeadCounts();
        }
      }, 0);
    };

    $scope.onFilterHomeTeamsChanged = function() {
      $scope.onFilterChanged(false);
    };

    $scope.onFilterAssignedTeamsChanged = function() {
      $scope.onFilterChanged(true);
    };

    $scope.onFilterPrimarySkillsChanged = function() {
      $scope.onFilterChanged(false);
    };

    $scope.onFilterAssignedSkillsChanged = function() {
      $scope.onFilterChanged(true);
    };

    $scope.onEmployeeNameChanged = function() {
      $scope.onFilterChanged(false);
    };

    $scope.$watch('filter.startTime', function() {
      if (typeof $scope.selectedSchedule !== 'undefined' && $scope.selectedSchedule !== null) {
        $scope.onFilterChanged(true);
      }
    });

    $scope.setViewMode = function(viewMode) {
      $scope.viewMode.mode = viewMode;
    };

    $scope.populateDayHeadCounts = function() {
      var getAppropriateShiftsCountOfEmployeeForMoment = function(employee, comparedDateTimeStamp) {
        if (typeof $scope.selectedSchedule.day.shifts.employeeShifts[employee.id] === 'undefined') {
          return 0;
        }

        var foundIndex = _.findIndex($scope.selectedSchedule.day.shifts.employeeShifts[employee.id], function(shiftIterator) {
          return (!shiftIterator.external && shiftIterator.filterPassed && shiftIterator.start <= comparedDateTimeStamp && shiftIterator.end >= comparedDateTimeStamp);
        });
        if (foundIndex > -1) {
          return 1;
        }
        return 0;
      };

      var getAppropriateShiftsCountForMoment = function(dateTimeStamp) {
        var count = 0;
        angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
          if (!employee.visible) {
            return;
          }
          var countRes = getAppropriateShiftsCountOfEmployeeForMoment(employee, dateTimeStamp);
          count += countRes;
        });

        return count;
      };

      angular.forEach($scope.consts.calendarTimeLabels, function(timeLabel) {
        $scope.selectedSchedule.day.headCounts[timeLabel.label] = [];
        for (var i=0; i<4; i++) {
          var minutes;
          if (i === 0) {
            minutes = '00';
          } else {
            minutes = (15 * i).toString();
          }
          var momentTimeStr = timeLabel.value + ':' + minutes;
          var fullMomentStr = $scope.selectedSchedule.day.dateText + ' ' + momentTimeStr;
          var dateTimeStamp = moment.tz(fullMomentStr, siteTimeZone).unix() * 1000;
          var count = getAppropriateShiftsCountForMoment(dateTimeStamp);
          $scope.selectedSchedule.day.headCounts[timeLabel.label].push(count);
        }
      });
    };

    $scope.getSchedule = function(scheduleId, dateTimeStamp) {
      $scope.scheduleInfoLoaded = false;
      $scope.selectedSchedule = null;
      if ($scope.viewMode.mode === 'week') {
        EmployeeSchedulesService.getScheduleForWeekView(scheduleId).then(function(response) {
          $scope.initializeSchedule(response.data);
        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
        }).finally(function() {
          $scope.scheduleInfoLoaded = true;
        });
      } else if ($scope.viewMode.mode === 'day') {
        EmployeeSchedulesService.getScheduleForDayView(scheduleId, dateTimeStamp, false).then(function(response) {
          $scope.initializeSchedule(response.data);
        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
        }).finally(function() {
          $scope.scheduleInfoLoaded = true;
        });
      }
    };

    $scope.showExceptions = function() {
      $modal.open({
        templateUrl: 'exceptionsModal.html',
        controller: 'ExceptionsModalInstanceCtrl',
        windowClass: 'exceptions-modal',
        resolve: {
          scheduleId: function() {
            return $scope.selectedSchedule.id;
          }
        }
      });
    };

    var reLoadSchedule = function() {
      if ($scope.viewMode.mode === 'week') {
        $scope.getSchedule($scope.selectedSchedule.id, null);
      } else if ($scope.viewMode.mode === 'day') {
        $scope.getSchedule($scope.selectedSchedule.id, $scope.selectedSchedule.day.datetimeStamp);
      }
    };

    $scope.goToWeekViewFromSelectedDay = function() {
      $scope.feedWeekForScheduleWeekView = {
        start: $scope.selectedSchedule.selectedWeek.start,
        end: $scope.selectedSchedule.selectedWeek.end
      };
      $state.go('authenticated.employeeSchedules.weekView.schedule', {scheduleId: $scope.selectedSchedule.id});
    };

    $scope.goToDayViewFromSelectedWeek = function(dayLabel) {
      var dateTimeStamp = moment.tz(dayLabel.date, siteTimeZone).unix() * 1000;
      $state.go('authenticated.employeeSchedules.dayView.schedule', {scheduleId: $scope.selectedSchedule.id, dateTimeStamp: dateTimeStamp});
    };

    $scope.goToPreviousDay = function() {
      var currentDateTimeMoment = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone);
      var previousDayMoment = currentDateTimeMoment.clone().subtract(1, 'days');
      $state.go('authenticated.employeeSchedules.dayView.schedule', {scheduleId: $scope.selectedSchedule.id, dateTimeStamp: previousDayMoment.unix() * 1000});
    };

    $scope.goToNextDay = function() {
      var currentDateTimeMoment = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone);
      var nextDayMoment = currentDateTimeMoment.clone().add(1, 'days');
      $state.go('authenticated.employeeSchedules.dayView.schedule', {scheduleId: $scope.selectedSchedule.id, dateTimeStamp: nextDayMoment.unix() * 1000});
    };

    $scope.selectWeek = function(week) {
      angular.forEach($scope.selectedSchedule.weeks, function(weekIterator) {
        weekIterator.selected = false;
      });

      week.selected = true;
      $scope.selectedSchedule.selectedWeek = week;
    };

    function employeeComparator(firstElement, secondElement) {
      var firstValue = null;
      var secondValue = null;

      if ($scope.sort.field === 'employeeName') {
        firstValue = firstElement.name;
        secondValue = secondElement.name;
      } else if ($scope.sort.field === 'serviceYears') {
        firstValue = firstElement.seniority;
        secondValue = secondElement.seniority;
      } else if ($scope.sort.field === 'rate') {
        firstValue = firstElement.hourlyRate;
        secondValue = secondElement.hourlyRate;
      } else if ($scope.sort.field === 'total') {
        firstValue = firstElement.total;
        secondValue = secondElement.total;
      } else if ($scope.sort.field === 'due') {
        firstValue = firstElement.due;
        secondValue = secondElement.due;
      } else if ($scope.sort.field === 'homeTeam') {
        firstValue = $scope.getHomeTeamName(firstElement.homeTeamId);
        if (typeof firstValue === 'undefined') {
          firstValue = firstElement.homeTeamId;
        }
        secondValue = $scope.getHomeTeamName(secondElement.homeTeamId);
        if (typeof secondValue === 'undefined') {
          secondValue = secondElement.homeTeamId;
        }
      } else if ($scope.sort.field === 'primarySkill') {
        firstValue = $scope.getPrimarySkillName(firstElement.primarySkillId);
        if (typeof firstValue === 'undefined') {
          firstValue = firstElement.primarySkillId;
        }
        secondValue = $scope.getPrimarySkillName(secondElement.primarySkillId);
        if (typeof secondValue === 'undefined') {
          secondValue = secondElement.primarySkillId;
        }
      }

      if (firstValue < secondValue) {
        if ($scope.sort.order === 'asc') {
          return -1;
        } else {
          return 1;
        }
      } else if (firstValue > secondValue) {
        if ($scope.sort.order === 'asc') {
          return 1;
        } else {
          return -1;
        }
      } else {
        return 0;
      }
    }

    $scope.toggleSort = function(field, order) {
      if (typeof order === 'undefined' || order === null) {
        if ($scope.sort.field === field) {
          if ($scope.sort.order === 'asc') {
            $scope.sort.order = 'dec';
          } else if ($scope.sort.order === 'dec') {
            $scope.sort.order = 'asc';
          } else {
            $scope.sort.order = 'asc';
          }
        } else {
          $scope.sort.field = field;
          $scope.sort.order = 'asc';
        }
      } else {
        $scope.sort.field = field;
        $scope.sort.order = order;
      }

      $scope.selectedSchedule.employeesInfo.result.sort(employeeComparator);
    };

    $scope.getHomeTeamName = function(teamId) {
      var foundTeam = _.find($scope.filter.homeTeams, 'id', teamId);

      if (typeof foundTeam === 'undefined') {
        return '-';
      }

      return foundTeam.name;
    };

    $scope.getAssignedTeamName = function(teamId) {
      var foundTeam = _.find($scope.filter.assignedTeams, 'id', teamId);

      if (typeof foundTeam === 'undefined') {
        return '-';
      }

      return foundTeam.name;
    };

    $scope.getPrimarySkillName = function(skillId) {
      var foundSkill = _.find($scope.filter.primarySkills, 'id', skillId);

      if (typeof foundSkill === 'undefined') {
        return '-';
      }

      return foundSkill.name;
    };

    $scope.getAssignedSkillName = function(skillId) {
      var foundSkill = _.find($scope.filter.assignedSkills, 'id', skillId);

      if (typeof foundSkill === 'undefined') {
        return '-';
      }

      return foundSkill.name;
    };

    $scope.getEmployeeTeamNamesList = function(employee) {
      var listStr = '';
      angular.forEach(employee.teamIds.split(','), function(teamId) {
        if (teamId === employee.homeTeamId) {
          listStr += $scope.getHomeTeamName(teamId) + ', ';
        } else {
          listStr += $scope.getAssignedTeamName(teamId) + ', ';
        }
      });
      listStr = listStr.substr(0, listStr.length - 2);

      return listStr;
    };

    $scope.getEmployeeSkillNamesList = function(employee) {
      var listStr = '';
      var skillIds = employee.skillIds ? employee.skillIds.split(',') : [];
      angular.forEach(skillIds, function(skillId) {
        if (skillId === employee.primarySkillId) {
          listStr += $scope.getPrimarySkillName(skillId) + ', ';
        } else {
          listStr += $scope.getAssignedSkillName(skillId) + ', ';
        }
      });
      listStr = listStr.substr(0, listStr.length - 2);

      return listStr;
    };

    $scope.applyFilterToShift = function(shift) {
      if (shift.external) {
        shift.filterPassed = true;
        return;
      }

      var filterTimeFrom = parseInt($scope.filter.startTime.substring(0, $scope.filter.startTime.indexOf(';')));
      var filterTimeTo = parseInt($scope.filter.startTime.substring($scope.filter.startTime.indexOf(';') + 1));
      var shiftStartDateTime = moment.tz(shift.start, siteTimeZone);
      var shiftStartTimeInMinutes = parseInt(shiftStartDateTime.format('H')) * 60 + parseInt(shiftStartDateTime.format('m'));

      if (_.findIndex($scope.filter.assignedTeams, 'id', shift.teamId) > -1 &&
        _.findIndex($scope.filter.selectedAssignedTeams, 'id', shift.teamId) === -1) {
        shift.filterPassed = false;
        return;
      }
      if (_.findIndex($scope.filter.assignedSkills, 'id', shift.skillId) > -1 &&
        _.findIndex($scope.filter.selectedAssignedSkills, 'id', shift.skillId) === -1) {
        shift.filterPassed = false;
        return;
      }

      if (shiftStartTimeInMinutes < filterTimeFrom || shiftStartTimeInMinutes > filterTimeTo) {
        shift.filterPassed = false;
        return;
      }
      shift.filterPassed = true;
    };

    $scope.applyFilterToShifts = function() {
      var maxShiftsCountPerDay = 0;
      var heightVal = 0;

      angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
        if ($scope.viewMode.mode === 'week') {
          maxShiftsCountPerDay = 0;
          angular.forEach($scope.selectedSchedule.selectedWeek.shifts.employeeShifts[employee.id], function(dateShifts, calendarDate) {
            angular.forEach(dateShifts, function(shift) {
              if (!shift.external) {
                $scope.applyFilterToShift(shift);
              }
            });
            if (maxShiftsCountPerDay < dateShifts.length) {
              maxShiftsCountPerDay = dateShifts.length;
            }
          });
          heightVal = 54 * Math.max(maxShiftsCountPerDay, 1);
          $scope.selectedSchedule.rowHeightsOfEmployees[employee.id] = heightVal + 'px';
        } else if ($scope.viewMode.mode === 'day') {
          angular.forEach($scope.selectedSchedule.day.shifts.employeeShifts[employee.id], function(shift) {
            if (!shift.external) {
              $scope.applyFilterToShift(shift);
            }
          });
        }
      });

      if ($scope.viewMode.mode === 'week') {
        maxShiftsCountPerDay = 0;
        angular.forEach($scope.selectedSchedule.selectedWeek.shifts.openShifts, function(dateShifts, calendarDate) {
          angular.forEach(dateShifts, function(shift) {
            if (!shift.external) {
              $scope.applyFilterToShift(shift);
            }
          });
          if (maxShiftsCountPerDay < dateShifts.length) {
            maxShiftsCountPerDay = dateShifts.length;
          }
        });
        heightVal = 54 * Math.max(maxShiftsCountPerDay, 1);
        $scope.selectedSchedule.openShiftsRowHeight = heightVal + 'px';
      } else if ($scope.viewMode.mode === 'day') {
        angular.forEach($scope.selectedSchedule.day.shifts.openShifts, function(shift) {
          if (!shift.external) {
            $scope.applyFilterToShift(shift);
          }
        });
        heightVal = 35 * Math.max($scope.selectedSchedule.day.shifts.openShifts.length, 1);
        $scope.selectedSchedule.openShiftsRowHeight = heightVal + 'px';
        $scope.selectedSchedule.openShiftsContainerRowHeight = (heightVal + 29) + 'px';
      }
    };

    function numberStringWithCommas(x) {
      return x.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    $scope.calculateSummaryInfoForSelectedWeekOrDay = function() {
      var totalHours = 0;
      var overtimeHours = 0;
      var totalCost = 0;
      var totalUnfilled = 0;
      var oneHourInMilliseconds = 3600000;

      if ($scope.selectedSchedule === null) {
        return;
      }

      angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
        if (employee.visible) {
          if ($scope.viewMode.mode === 'week') {
            angular.forEach($scope.selectedSchedule.selectedWeek.shifts.employeeShifts[employee.id], function(dateShifts, calendarDate) {
              angular.forEach(dateShifts, function(shift) {
                if (!shift.external && shift.filterPassed) {
                  addShiftStatistics(shift);
                }
              });
            });
          } else if ($scope.viewMode.mode === 'day') {
            angular.forEach($scope.selectedSchedule.day.shifts.employeeShifts[employee.id], function(shift) {
              if (!shift.external && shift.filterPassed) {
                addShiftStatistics(shift);
              }
            });
          }
        }

        function addShiftStatistics(shift) {
          var shiftDurationInHours = (shift.end - shift.start)/oneHourInMilliseconds;
          totalHours += shiftDurationInHours;
          overtimeHours += shift.overtime;
          totalCost += shift.cost;
        }
      });

      if ($scope.viewMode.mode === 'week') {
        angular.forEach($scope.selectedSchedule.selectedWeek.shifts.openShifts, function(dateShifts) {
          angular.forEach(dateShifts, function(shift) {
            if (!shift.external && shift.filterPassed) {
              var shiftDurationInHours = (shift.end - shift.start)/oneHourInMilliseconds;
              totalUnfilled += shiftDurationInHours;
            }
          });
        });
        updateStatisticsInView($scope.selectedSchedule.selectedWeek);
      } else if ($scope.viewMode.mode === 'day') {
        angular.forEach($scope.selectedSchedule.day.shifts.openShifts, function(shift) {
          if (!shift.external && shift.filterPassed) {
            var shiftDurationInHours = (shift.end - shift.start)/oneHourInMilliseconds;
            totalUnfilled += shiftDurationInHours;
          }
        });
        updateStatisticsInView($scope.selectedSchedule.day);
      }

      function updateStatisticsInView(targetObj) {
        targetObj.hours = numberStringWithCommas(totalHours.toFixed(2));
        targetObj.overtime = numberStringWithCommas(overtimeHours.toFixed(2));
        targetObj.cost = '$' + numberStringWithCommas(totalCost.toFixed(2));
        targetObj.unfilled = numberStringWithCommas(totalUnfilled.toFixed(2));
      }
    };

    $scope.employeeHasShifts = function(employeeId) {
      var result = false;
      if ($scope.viewMode.mode === 'week') {
        var foundObject = _.find($scope.selectedSchedule.selectedWeek.shifts.employeeShifts[employeeId], function(dateShifts, calendarDate) {
          return (dateShifts.length > 0);
        });
        result = (typeof foundObject !== 'undefined');
      } else if ($scope.viewMode.mode === 'day') {
        if (typeof $scope.selectedSchedule.day.shifts.employeeShifts[employeeId] !== 'undefined' &&
          $scope.selectedSchedule.day.shifts.employeeShifts[employeeId].length > 0) {
          result = true;
        }
      }

      return result;
    };

    $scope.openShiftsExisting = function() {
      var result = false;
      if ($scope.viewMode.mode === 'week') {
        var foundObject = _.find($scope.selectedSchedule.selectedWeek.shifts.openShifts, function(dateShifts, calendarDate) {
          return (dateShifts.length > 0);
        });
        result = (typeof foundObject !== 'undefined');
      } else if ($scope.viewMode.mode === 'day') {
        result = ($scope.selectedSchedule.day.shifts.openShifts.length > 0);
      }

      return result;
    };

    $scope.checkIfPastSchedule = function() {
      var currentTime = new Date().getTime();
      var scheduleEndTime = $scope.selectedSchedule.endDate;
      if (scheduleEndTime < currentTime) {
        return true;
      }
      return false;
    };

    $scope.checkIfPastDate = function(date) {
      var nowDateStamp = moment.tz(new Date().getTime(), siteTimeZone).hours(0).minutes(0).seconds(0).milliseconds(0).unix() * 1000;
      var selectedDateStamp = moment.tz(date + ' 00:00', siteTimeZone).unix() * 1000;
      return (nowDateStamp > selectedDateStamp);
    };

    $scope.$watch('selectedSchedule.selectedWeek', function() {
      if ($scope.selectedSchedule === null) {
        return;
      }

      $timeout(function() {
        $scope.applyFilterToShifts();
        $scope.calculateSummaryInfoForSelectedWeekOrDay();
      }, 0);
    });

    $scope.toggleSummary = function() {
      $scope.summaryCollapsed = !$scope.summaryCollapsed;
      if ($scope.summaryCollapsed) {
        angular.element('.schedule-calendar .employee-info.schedule-calendar-cell').css('width', '440px');
      } else {
        angular.element('.schedule-calendar .employee-info.schedule-calendar-cell').css('width', '210px');
      }
    };

    $scope.initializeWeeksLabels = function() {
      angular.forEach($scope.selectedSchedule.weeks, function(week) {
        week.selected = false;
        week.label = moment.tz(week.start, siteTimeZone).format('MMMM DD') +
          ' to ' + moment.tz(week.end, siteTimeZone).format('MMMM DD');
        week.dayLabels = {};
        var startMomentObj = moment.tz(week.start, siteTimeZone);

        for (var i=0; i<7; i++) {
          var momentObj = startMomentObj.clone().add(i, 'days');
          var titleText = momentObj.format('MMM DD');
          var fullStrText = momentObj.format('MMMM DD, YYYY');
          var labelText = $scope.consts.daysOfWeek[momentObj.day()] + ' ' + momentObj.format('MM/DD');
          var dateText = momentObj.format('YYYY-MM-DD');
          week.dayLabels['calendar-day-' + dateText] = {title: titleText, fullStr: fullStrText, label: labelText, date: dateText, selected: false};
        }
      });
    };

    $scope.initializeDayLabels = function() {
      var dateMoment = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone);
      var dateMomentWithNoHours = dateMoment.clone().hours(0).minutes(0).seconds(0).milliseconds(0);
      var siteFirstDayOfWeek = $scope.selectedSchedule.siteInfo[3].toLowerCase();
      var iteratorDateMoment = dateMomentWithNoHours.clone();
      var titleText = '', fullStrText = '', labelText = '', dateText = '';
      var disabledFlag = false;

      $scope.selectedSchedule.day.label = dateMoment.format('MMMM DD, YYYY');
      $scope.selectedSchedule.day.dateText = dateMoment.format('YYYY-MM-DD');
      $scope.selectedSchedule.day.headCounts = {};
      $scope.selectedSchedule.selectedWeek = {dayLabels: {}};

      while (iteratorDateMoment.format('dddd').toLowerCase() !== siteFirstDayOfWeek) {
        iteratorDateMoment.subtract(1, 'days');
      }

      var weekStartMoment = iteratorDateMoment.clone();
      var weekEndMoment = weekStartMoment.clone().add(7, 'days').subtract(1, 'seconds');
      $scope.selectedSchedule.selectedWeek.start = weekStartMoment.unix() * 1000;
      $scope.selectedSchedule.selectedWeek.end = weekEndMoment.unix() * 1000;
      for (var i=0; i<7; i++) {
        iteratorDateMoment = weekStartMoment.clone().add(i, 'days');
        titleText = iteratorDateMoment.format('MMM DD');
        fullStrText = iteratorDateMoment.format('MMMM DD, YYYY');
        labelText = $scope.consts.daysOfWeek[iteratorDateMoment.day()] + ' ' + iteratorDateMoment.format('MM/DD');
        dateText = iteratorDateMoment.format('YYYY-MM-DD');
        if (iteratorDateMoment.unix() * 1000 > $scope.selectedSchedule.endDate ||
          iteratorDateMoment.unix() * 1000 < $scope.selectedSchedule.startDate) {
          disabledFlag = true;
        }
        $scope.selectedSchedule.selectedWeek.dayLabels['calendar-day-' + dateText] = {title: titleText, fullStr: fullStrText, label: labelText, date: dateText, selected: false, disabled: disabledFlag};
      }
      $scope.selectedSchedule.selectedWeek.dayLabels['calendar-day-' + $scope.selectedSchedule.day.dateText].selected = true;
    };

    $scope.previousDayOutOfRange = function() {
      var currentDateTimeMoment = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone);
      var previousDayMoment = currentDateTimeMoment.clone().subtract(1, 'days');

      return (previousDayMoment.unix() * 1000 < $scope.selectedSchedule.startDate);
    };

    $scope.nextDayOutOfRange = function() {
      var currentDateTimeMoment = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone);
      var nextDayMoment = currentDateTimeMoment.clone().add(1, 'days');

      return (nextDayMoment.unix() * 1000 > $scope.selectedSchedule.endDate);
    };

    function shiftComparator(firstElement, secondElement) {
      if (firstElement.start < secondElement.start) {
        return -1;
      } else if (firstElement.start > secondElement.start) {
        return 1;
      } else {
        return 0;
      }
    }

    function parseShift(shift) {
      var dayInMilliseconds = 24 * 3600000;
      var timeStr = '';
      var tempStr = '';
      var startTimeMoment = moment.tz(shift[6], siteTimeZone);
      var endTimeMoment = moment.tz(shift[7], siteTimeZone);
      var selectedDayMomentInDayView = null;
      var startTimeOffSetPercentInDay = null;
      var tooltipPositionStr = null;
      var typeStr = '';
      var lengthPercentInDay = '';

      if (typeof shift[3] !== 'undefined' && shift[3] !== null) {
        typeStr = 'normal';
      } else {
        typeStr = 'open';
      }

      if ($scope.viewMode.mode === 'week') {
        timeStr = appFunc.toShortest12TimeFormat(startTimeMoment) + '-' + appFunc.toShortest12TimeFormat(endTimeMoment);
      } else if ($scope.viewMode.mode === 'day') {
        selectedDayMomentInDayView = moment.tz($scope.selectedSchedule.day.datetimeStamp, siteTimeZone).hours(0).minutes(0).seconds(0).milliseconds(0);

        if (selectedDayMomentInDayView.unix() * 1000 >= shift[6]) {
          timeStr = '(' + appFunc.toShortest12TimeFormat(startTimeMoment) + ')-' + appFunc.toShortest12TimeFormat(endTimeMoment);
          startTimeOffSetPercentInDay = 0;
          lengthPercentInDay = ((shift[7] - selectedDayMomentInDayView.unix() * 1000)/dayInMilliseconds) * 100;
        } else if (shift[7] <= selectedDayMomentInDayView.unix() * 1000 + dayInMilliseconds) {
          timeStr = appFunc.toShortest12TimeFormat(startTimeMoment) + '-' + appFunc.toShortest12TimeFormat(endTimeMoment);
          startTimeOffSetPercentInDay = (((startTimeMoment.hours() * 3600 + startTimeMoment.minutes() * 60 + startTimeMoment.seconds()) * 1000 + startTimeMoment.milliseconds())/dayInMilliseconds) * 100;
          lengthPercentInDay = ((shift[7] - shift[6])/dayInMilliseconds) * 100;
        } else {
          timeStr = appFunc.toShortest12TimeFormat(startTimeMoment) + '-(' + appFunc.toShortest12TimeFormat(endTimeMoment) + ')';
          startTimeOffSetPercentInDay = (((startTimeMoment.hours() * 3600 + startTimeMoment.minutes() * 60 + startTimeMoment.seconds()) * 1000 + startTimeMoment.milliseconds())/dayInMilliseconds) * 100;
          lengthPercentInDay = ((selectedDayMomentInDayView.unix() * 1000 + dayInMilliseconds - shift[6])/dayInMilliseconds) * 100;
        }

        if (startTimeOffSetPercentInDay <= 50) {
          tooltipPositionStr = 'right';
        } else {
          tooltipPositionStr = 'left';
        }
        startTimeOffSetPercentInDay += '%';
        lengthPercentInDay += '%';
      }

      var shiftObj = {
        id: shift[0],
        type: typeStr,
        employeeId: shift[3],
        excessType: (shift[1])? 'extra': 'regular',
        excessTypeStr: (shift[1])? 'Extra': '',
        start: shift[6],
        end: shift[7],
        timeStr: timeStr,
        startTimeOffSetPercentInDay: startTimeOffSetPercentInDay,
        tooltipPositionInDay: tooltipPositionStr,
        lengthPercentInDay: lengthPercentInDay,
        skillId: shift[4],
        skillName: $scope.getAssignedSkillName(shift[4]),
        skillAbbrev: shift[5],
        assignment: 'Assignment',
        teamId: shift[2],
        teamName: (shift[10] ? shift[10] : $scope.getAssignedTeamName(shift[2])),
        posted: '',
        requested: '',
        comment: shift[9],
        external: (shift[11] === 'otherSchedule')? true: false,
        filterPassed: true,
        overtime: shift[12] ? shift[12]/60.0 : 0,
        cost: shift[13] ? shift[13] : 0
      };

      if (shiftObj.end - shiftObj.start >= 7 * 3600 * 1000) {
        shiftObj.canShowAdditionalInfoInDayView = true;
        shiftObj.canShowInfoInDayView = true;
        shiftObj.canShowTimeInDayView = true;
      } else if (shiftObj.end - shiftObj.start >= 3 * 3600 * 1000) {
        shiftObj.canShowAdditionalInfoInDayView = false;
        shiftObj.canShowInfoInDayView = true;
        shiftObj.canShowTimeInDayView = true;
      } else if (shiftObj.end - shiftObj.start >= 2 * 3600 * 1000) {
        shiftObj.canShowAdditionalInfoInDayView = false;
        shiftObj.canShowInfoInDayView = false;
        shiftObj.canShowTimeInDayView = true;
      } else {
        shiftObj.canShowAdditionalInfoInDayView = false;
        shiftObj.canShowInfoInDayView = false;
        shiftObj.canShowTimeInDayView = false;
      }
      if (shiftObj.comment === null) {
        shiftObj.commentClass = '';
      } else {
        shiftObj.commentClass = 'has-comment';
      }

      if (shiftObj.external) {
        shiftObj.externalClass = 'external';
      } else {
        shiftObj.externalClass = '';
      }

      return shiftObj;
    }

    $scope.arrangeWeeksShifts = function() {
      $scope.selectedSchedule.rowHeightsOfEmployees = {};
      $scope.selectedSchedule.openShiftsRowHeight = null;
      angular.forEach($scope.selectedSchedule.weeks, function(week) {
        var arrangedShifts = {
          employeeShifts: {},
          openShifts: {}
        };
        angular.forEach(week.shifts, function(shift) {
          var shiftObj = parseShift(shift);
          var dateStr = moment.tz(shift[6], siteTimeZone).format('YYYY-MM-DD');

          if (shiftObj.type === 'normal') {
            if (typeof arrangedShifts.employeeShifts[shift[3]] === 'undefined') {
              arrangedShifts.employeeShifts[shift[3]] = {};
            }
            if (typeof arrangedShifts.employeeShifts[shift[3]]['calendar-day-' + dateStr] === 'undefined') {
              arrangedShifts.employeeShifts[shift[3]]['calendar-day-' + dateStr] = [];
            }
            arrangedShifts.employeeShifts[shift[3]]['calendar-day-' + dateStr].push(shiftObj);
            arrangedShifts.employeeShifts[shift[3]]['calendar-day-' + dateStr].sort(shiftComparator);
          } else if (shiftObj.type === 'open') {
            if (typeof arrangedShifts.openShifts['calendar-day-' + dateStr] === 'undefined') {
              arrangedShifts.openShifts['calendar-day-' + dateStr] = [];
            }
            var foundShift = _.find(week.postedOpenShifts, function(postedIterator) {
              return (postedIterator[0] === shiftObj.id);
            });
            if (typeof foundShift !== 'undefined') {
              shiftObj.posted = 'Posted ' + moment.tz(foundShift[1], siteTimeZone).format('YYYY-MM-DD');
              shiftObj.requested = (foundShift[2])? '(R)': '';
            }
            arrangedShifts.openShifts['calendar-day-' + dateStr].push(shiftObj);
            arrangedShifts.openShifts['calendar-day-' + dateStr].sort(shiftComparator);
          }
        });
        week.shifts = arrangedShifts;
        angular.forEach(week.dayLabels, function(dateLabel, calendarDate) {
          if (typeof week.shifts.openShifts[calendarDate] !== 'undefined' &&
            week.shifts.openShifts[calendarDate] !==null ) {
            var count = 0;
            angular.forEach(week.shifts.openShifts[calendarDate], function(shiftIterator) {
              if (!shiftIterator.external) {
                count ++;
              }
            });
            dateLabel.openShiftsCount = count;
          } else {
            dateLabel.openShiftsCount = 0;
          }
        });
      });
    };

    $scope.arrangeEmployeeWeeksHours = function() {
      angular.forEach($scope.selectedSchedule.weeks, function(week) {
        var arrangedEmployeeHours = {};
        angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
          var foundInfo = _.find(week.employees, 'employeeId', employee.id);
          if (typeof foundInfo !== 'undefined') {
            var minimumHours = (foundInfo.minimumMinutes/60);
            var scheduledHours = (foundInfo.scheduledMinutes/60).toFixed(1);
            var alarmed = (minimumHours > scheduledHours);
            arrangedEmployeeHours[employee.id] = {
              minimumHours: minimumHours > 0 ? minimumHours.toFixed(1) : "-",
              scheduledHours: scheduledHours,
              hoursAlarmed: alarmed
            };
          } else {
            arrangedEmployeeHours[employee.id] = {
              minimumHours: '-',
              scheduledHours: '-',
              hoursAlarmed: false
            };
          }
        });
        week.employees = arrangedEmployeeHours;
      });
    };

    $scope.arrangeDayShifts = function() {
      $scope.selectedSchedule.openShiftsRowHeight = null;
      $scope.selectedSchedule.openShiftsContainerRowHeight = null;
      var arrangedShifts = {
        employeeShifts: {},
        openShifts: []
      };
      angular.forEach($scope.selectedSchedule.day.shifts, function(shift) {
        var shiftObj = parseShift(shift);
        if (shiftObj.type === 'normal') {
          if (typeof arrangedShifts.employeeShifts[shift[3]] === 'undefined') {
            arrangedShifts.employeeShifts[shift[3]] = [];
          }
          arrangedShifts.employeeShifts[shift[3]].push(shiftObj);
          arrangedShifts.employeeShifts[shift[3]].sort(shiftComparator);
        } else if (shiftObj.type === 'open') {
          var foundShift = _.find($scope.selectedSchedule.day.postedOpenShifts, 'shiftId', shiftObj.id);
          if (typeof foundShift !== 'undefined') {
            shiftObj.posted = 'Posted ' + moment.tz(foundShift.posted, siteTimeZone).format('YYYY-MM-DD');
            shiftObj.requested = (foundShift.requested)? '(R)': '';
          }
          arrangedShifts.openShifts.push(shiftObj);
          arrangedShifts.openShifts.sort(shiftComparator);
        }
      });
      $scope.selectedSchedule.day.shifts = arrangedShifts;
    };

    $scope.getDisplayedEmployeesCount = function() {
      var number = 0;
      angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employee) {
        if (employee.visible && ($scope.employeeHasShifts(employee.id) || (employee.isFloating && $scope.filter.displayFloats) || (!employee.isFloating && !$scope.filter.displayScheduledOnly))) {
          number++;
        }
      });
      return number;
    };

    $scope.initializeSchedule = function(responseData) {
      $scope.selectedSchedule = responseData;
      siteTimeZone = $scope.selectedSchedule.siteInfo[2];
      $scope.selectedSchedule.startDateStr = moment.tz($scope.selectedSchedule.startDate, siteTimeZone).format('MMMM DD, YYYY');
      $scope.selectedSchedule.lengthInWeeks = $scope.selectedSchedule.scheduleLengthInDays/7;
      $scope.selectedSchedule.isDeletable = function () {
        //Show "Delete" button if schedule is not actual yet.
        if ($scope.selectedSchedule.status == $scope.consts.scheduleStatus.POSTED) {
          var scheduleStartDateTime = appFunc.convertToBrowserTimezone(
              $scope.selectedSchedule.startDate, siteTimeZone);
          return scheduleStartDateTime > new Date();
        }
        return true;
      }();

      fillScheduleStatistics($scope.selectedSchedule.totalMinutes/60,
          $scope.selectedSchedule.overtimeMinutes/60,
          $scope.selectedSchedule.totalCost,
          $scope.selectedSchedule.unfilledShiftsMinutes/60);

      $scope.filter.homeTeams = [];
      $scope.filter.assignedTeams = [];
      $scope.filter.primarySkills = [];
      $scope.filter.assignedSkills = [];
      $scope.filter.selectedHomeTeams = [];
      $scope.filter.selectedAssignedTeams = [];
      $scope.filter.selectedPrimarySkills = [];
      $scope.filter.selectedAssignedSkills = [];

      $scope.filter.homeTeams = prepareTeamsList($scope.selectedSchedule.teamsInfo.result, true);
      $scope.filter.assignedTeams = prepareTeamsList($scope.selectedSchedule.teamsInfo.result, false);

      angular.forEach($scope.selectedSchedule.skillsInfo.result, function(skillInfo) {
        var info = {
          id: skillInfo[0],
          name: skillInfo[1],
          ticked: true
        };
        $scope.filter.primarySkills.push(info);
      });
      $scope.filter.primarySkills.sort(function(firstSkill, secondSkill) {
        if (firstSkill.name < secondSkill.name) {
          return -1;
        } else if (firstSkill.name > secondSkill.name) {
          return 1;
        } else {
          return 0;
        }
      });
      $scope.filter.assignedSkills = angular.copy($scope.filter.primarySkills);

      var parsedEmployees = [];
      angular.forEach($scope.selectedSchedule.employeesInfo.result, function(employeeInfo) {
        var parsedEmployee = {
          id: employeeInfo[0],
          firstName: employeeInfo[1],
          lastName: employeeInfo[2],
          name: employeeInfo[1] + ' ' + employeeInfo[2],
          hourlyRate: employeeInfo[3].toFixed(2),
          teamIds: employeeInfo[4],
          homeTeamId: employeeInfo[5],
          primarySkillId: employeeInfo[6],
          skillIds: employeeInfo[7],
          seniority: employeeInfo[8],
          isFloating: employeeInfo[9],
          visible: true
        };

        if (typeof employeeInfo[8] !== 'number') {
          parsedEmployee.seniority = -1;
          parsedEmployee.seniorityStr = '-';
        } else {
          var abstractEndDate = moment.tz(employeeInfo[8], siteTimeZone);
          var abstractStartDate = moment.tz(0, siteTimeZone);
          var monthsDiff = abstractEndDate.diff(abstractStartDate, 'months');
          var yearsDiff = Math.floor(monthsDiff/12);
          monthsDiff = monthsDiff - 12 * yearsDiff;

          var yearsDiffStr = '', monthsDiffStr = '';
          if (yearsDiff !== 0) {
            yearsDiffStr = yearsDiff + 'y ';
          }
          if (monthsDiff !== 0) {
            monthsDiffStr = monthsDiff + 'm';
          }
          if (yearsDiff === 0 && monthsDiff === 0) {
            parsedEmployee.seniorityStr = '0';
          } else {
            parsedEmployee.seniorityStr = yearsDiffStr + monthsDiffStr;
          }
        }

        if ($scope.viewMode.mode === 'day') {
          var dueHours = parseFloat(employeeInfo[9])/60;
          parsedEmployee.due = dueHours > 0 ? dueHours.toFixed(2) : "-";
          parsedEmployee.total = (parseFloat(employeeInfo[10])/60).toFixed(2);
        }
        parsedEmployees.push(parsedEmployee);
      });
      $scope.selectedSchedule.employeesInfo.result = parsedEmployees;
      $scope.toggleSort('employeeName', 'asc');

      if ($scope.viewMode.mode === 'week') {
        $scope.initializeWeeksLabels();
        $scope.arrangeWeeksShifts();
        $scope.arrangeEmployeeWeeksHours();

        if ($scope.feedWeekForScheduleWeekView !== null) {
          var foundIndex = _.findIndex($scope.selectedSchedule.weeks, function(week) {
            return (week.start === $scope.feedWeekForScheduleWeekView.start);
          });
          if (foundIndex < 0) {
            foundIndex = 0;
          }
          $scope.selectedSchedule.weeks[foundIndex].selected = true;
          $scope.selectedSchedule.selectedWeek = $scope.selectedSchedule.weeks[foundIndex];
          $scope.feedWeekForScheduleWeekView = null;
        } else {
          $scope.selectedSchedule.weeks[0].selected = true;
          $scope.selectedSchedule.selectedWeek = $scope.selectedSchedule.weeks[0];
        }
      } else if ($scope.viewMode.mode === 'day') {
        $scope.initializeDayLabels();
        $scope.arrangeDayShifts();
        $scope.populateDayHeadCounts();
      }
    };

    function fillScheduleStatistics(regularHours, otHours, cost, unfilledHours) {
      $scope.selectedSchedule.totalHours = numberStringWithCommas(regularHours.toFixed(2));
      $scope.selectedSchedule.overtimeHours = numberStringWithCommas(otHours.toFixed(2));
      $scope.selectedSchedule.totalCost = '$' + numberStringWithCommas(cost.toFixed(2));
      $scope.selectedSchedule.unfilledShiftsHours
          = numberStringWithCommas(unfilledHours.toFixed(2));
    }

    function prepareTeamsList(teamsInfo, isHomeTeams) {
      var preparedTeams = [];
      angular.forEach(teamsInfo, function(teamInfo) {
        var isHomeTeam = teamInfo[2];
        if(isHomeTeams || isHomeTeams === false && !isHomeTeam) {
          var info = {
            id: teamInfo[0],
            name: teamInfo[1],
            ticked: true
          };
          preparedTeams.push(info);
        }
      });
      preparedTeams.sort(function(firstTeam, secondTeam) {
        if (firstTeam.name < secondTeam.name) {
          return -1;
        } else if (firstTeam.name > secondTeam.name) {
          return 1;
        } else {
          return 0;
        }
      });
      return preparedTeams;
    }

    $scope.promoteSchedule = function() {
      var modalInstance = $modal.open({
        templateUrl: 'promoteScheduleConfirmationModal.html',
        controller: 'PromoteScheduleConfirmationModalInstanceCtrl',
        size: 'sm',
        windowClass: 'promote-schedule-modal',
        resolve: {
          currentScheduleStatus: function() {
            return $scope.selectedSchedule.status;
          }
        }
      });
      modalInstance.result.then(function(result) {
        if (typeof result !== 'undefined' && result !== null && result.answer) {
          dataService.promoteSchedule($scope.selectedSchedule.id).then(function(response) {
            if ($scope.selectedSchedule.status === 'Production') {
              applicationContext.setNotificationMsgWithValues('employee_schedules.SCHEDULE_POSTED_SUCCESSFULLY', 'success', true);
            } else {
              applicationContext.setNotificationMsgWithValues('employee_schedules.SCHEDULE_PROMOTED_SUCCESSFULLY', 'success', true);
            }
            reLoadSchedule();
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        }
      });
    };

    $scope.deleteSchedule = function() {
      dataService.deleteSchedule($scope.selectedSchedule.id).then(function(response) {
        applicationContext.setNotificationMsgWithValues('employee_schedules.SCHEDULE_DELETED_SUCCESSFULLY', 'success', true);
        $scope.selectedSchedule = null;
        $scope.scheduleInfoLoaded = null;
        if ($scope.viewMode.mode === 'week') {
          $state.go('authenticated.employeeSchedules.weekView', null, {location: true});
        } else if ($scope.viewMode.mode === 'day') {
          $state.go('authenticated.employeeSchedules.dayView', null, {location: true});
        }
      }, function(err) {
        var errorMessage = err.data ? err.data.message : "Schedule delete failed";
        applicationContext.setNotificationMsgWithValues(JSON.stringify(errorMessage), 'danger', true);
      });
    };

    $scope.openSiteSchedulesModal = function() {
      var modalInstance = $modal.open({
        templateUrl: 'scheduleSelectorModal.html',
        controller: 'ScheduleSelectorModalInstanceCtrl',
        size: 'lg',
        windowClass: 'schedules-modal',
        resolve: {
          checkboxModel: function() {
            return {
              simulationGenerated: false,
              production: true,
              posted: true
            };
          },
          customFilter: function() {
            return null;
          }
        }
      });
      modalInstance.result.then(function(selectedSchedule) {
        if ($scope.viewMode.mode === 'week') {
          $state.go('authenticated.employeeSchedules.weekView.schedule', {scheduleId: selectedSchedule.id});
        } else if ($scope.viewMode.mode === 'day') {
          var nowDateStamp = new Date().getTime();
          if (selectedSchedule.start <= nowDateStamp && nowDateStamp <= selectedSchedule.end - 1) {
            $state.go('authenticated.employeeSchedules.dayView.schedule', {scheduleId: selectedSchedule.id, dateTimeStamp: nowDateStamp});
          } else {
            $state.go('authenticated.employeeSchedules.dayView.schedule', {scheduleId: selectedSchedule.id, dateTimeStamp: selectedSchedule.start});
          }
        }
      });
    };

    function pushInfoValuesToShift(info) {
      var shiftInfo = [];

      shiftInfo.push(info.id, info.excess, info.teamId, info.employeeId); // id, excess type, team id, employee id
      shiftInfo.push(info.skillId, info.skillAbbrev, info.startDateTime, info.endDateTime); // skill id, skill abbreviation, start, end
      shiftInfo.push(info.paidTime, info.comment); // paid time, comment

      return shiftInfo;
    }

    function updateEmployeeScheduledHours(operationType, employeeShifts, scheduleViewType) {
      if(!employeeShifts || employeeShifts.length <= 0) {
        return;
      }
      var employeeId = employeeShifts[0].employeeId;
      var shiftsHours = calculateShiftsHours(employeeShifts);

      switch (operationType) {
        case '+': break;
        case '-': shiftsHours *= -1; break;
        default:
          throw "Invalid operationType in updateEmployeeScheduledHours: " + operationType + ". '+' or '-' required!";
      }

      var employeeScheduledHours = 0;
      switch (scheduleViewType) {
        case 'day':
          //TODO: Works incorrect for replace (at least shift swap). Find the problem and uncomment
          //var employeeIndex = _.findIndex($scope.selectedSchedule.employeesInfo.result, 'id', employeeId);
          //if(employeeIndex === -1) {
          //  throw "Cannot find employee with id: " + employeeId;
          //}
          //employeeScheduledHours = $scope.selectedSchedule.employeesInfo.result[employeeIndex].total*1;
          //employeeScheduledHours += shiftsHours;
          //$scope.selectedSchedule.employeesInfo.result[employeeIndex].total = employeeScheduledHours.toFixed(2);
          break;
        case 'week':
          employeeScheduledHours = $scope.selectedSchedule.selectedWeek.employees[employeeId].scheduledHours*1;
          employeeScheduledHours += shiftsHours;
          $scope.selectedSchedule.selectedWeek.employees[employeeId].scheduledHours = employeeScheduledHours.toFixed(2);
          $scope.selectedSchedule.selectedWeek.employees[employeeId].hoursAlarmed =
              $scope.selectedSchedule.selectedWeek.employees[employeeId].minimumHours > employeeScheduledHours;
          break;
        default:
          throw "Invalid scheduleViewType in updateEmployeeScheduledHours: " + scheduleViewType + "." +
                " 'day' or 'week' required!";
      }
    }

    function markFilteredStatisticsAsNotValid() {
      $scope.selectedSchedule.selectedWeek.dirtyStatistics = true;
    }

    function calculateShiftsHours(shifts) {
      var shiftsHours = 0;
      _.forEach(shifts, function(shift) {
        var shiftLengthHours = (shift.end - shift.start) / 1000 / 60 / 60;
        if(shiftLengthHours > 0)
          shiftsHours += shiftLengthHours;
        else
          console.error("Invalid shiftLengthHours calculated: " + shiftLengthHours + " for shift id: " + shift.id);
      });
      return shiftsHours;
    }

    $scope.refreshScheduleStatistics = function() {
      EmployeeSchedulesService.getScheduleStatistics($scope.selectedSchedule.id).then(function(response) {
        var assigned = response.data.assignedShiftsStatistics;
        var unfulledMinutes = response.data.openShiftsTotalTimeMinutes;
        fillScheduleStatistics(assigned.totalTimeMinutes/60,
            assigned.overtimeMinutes/60,
            assigned.totalCost,
            unfulledMinutes/60);

        var assignedShiftsStatistics = assigned.shiftStatistics;

        _.forEach($scope.selectedSchedule.weeks, function(week) {
          _.forEach(week.shifts.employeeShifts, function(employeeDays) {
            _.forEach(employeeDays, function(employeeDayShifts) {
              _.forEach(employeeDayShifts, function(shift) {
                var currentShiftStatistics = assignedShiftsStatistics[shift.id];
                if(currentShiftStatistics) {
                  shift.overtime = currentShiftStatistics.overtimeMinutes/60;
                  shift.cost = currentShiftStatistics.totalCost;
                }
              });
            });
          });
        });
        $scope.calculateSummaryInfoForSelectedWeekOrDay();
        $scope.selectedSchedule.selectedWeek.dirtyStatistics = false;
      }, function(err) {
        console.error(err.data);
        applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true);
      });
    };

    function arrangeShift(arrangeType, shiftObj) {
      var dateStr = moment.tz(shiftObj.start, siteTimeZone).format('YYYY-MM-DD');
      var foundWeekIndex = -1;
      var needExit = false;

      if ($scope.viewMode.mode === 'week') {
        _.forEach($scope.selectedSchedule.weeks, function(week, weekIndex) {
          _.forEach(week.shifts.employeeShifts, function(employeeShifts, employeeId) {
            var foundDateShifts = _.find(employeeShifts, function(dateShifts, calendarDate) {
              var foundIndex = _.findIndex(dateShifts, 'id', shiftObj.id);

              return (foundIndex > -1);
            });
            if (typeof foundDateShifts !== 'undefined') {
              if (arrangeType === 'add') {
                needExit = true;

                return false;
              }

              foundWeekIndex = weekIndex;

              _.remove(foundDateShifts, function(shift) {
                if(shift.id === shiftObj.id) {
                  updateEmployeeScheduledHours('-', [shift], 'week');
                  return true;
                }
                return false;
              });

              return false;
            }
          });

          if (needExit || foundWeekIndex > -1) {
            return false;
          }

          var foundDateShifts = _.find(week.shifts.openShifts, function(dateShifts, calendarDate) {
            var foundIndex = _.findIndex(dateShifts, 'id', shiftObj.id);

            return (foundIndex > -1);
          });
          if (typeof foundDateShifts !== 'undefined') {
            if (arrangeType === 'add') {
              needExit = true;

              return false;
            }

            foundWeekIndex = weekIndex;
            var removedShifts = _.remove(foundDateShifts, 'id', shiftObj.id);
            if (removedShifts.length > 0) {
              $scope.selectedSchedule.weeks[foundWeekIndex].dayLabels['calendar-day-' + dateStr].openShiftsCount--;
            }

            return false;
          }
        });

        if (needExit || (foundWeekIndex === -1 && arrangeType === 'replace' && shiftObj.excessType !== 'extra')) {
          return;
        }
      } else if ($scope.viewMode.mode === 'day') {
        var foundEmployeeShifts = _.find($scope.selectedSchedule.day.shifts.employeeShifts, function(employeeShifts, employeeId) {
          var foundIndex = _.findIndex(employeeShifts, 'id', shiftObj.id);

          return (foundIndex > -1);
        });
        if (typeof foundEmployeeShifts !== 'undefined') {
          if (arrangeType === 'add') {
            return;
          }
          _.remove(foundEmployeeShifts, function(shift) {
            if(shift.id === shiftObj.id) {
              updateEmployeeScheduledHours('-', foundEmployeeShifts, 'day');
              return true;
            }
            return false;
          });
        } else {
          var foundIndex = _.findIndex($scope.selectedSchedule.day.shifts.openShifts, 'id', shiftObj.id);

          if (foundIndex > -1) {
            if (arrangeType === 'add') {
              return;
            }

            _.remove($scope.selectedSchedule.day.shifts.openShifts, 'id', shiftObj.id);
          } else {
            if (arrangeType === 'replace' && shiftObj.excessType !== 'extra') {
              return;
            }
          }
        }
      }

      if (arrangeType === 'remove') {
        return;
      }

      if ($scope.viewMode.mode === 'week' && foundWeekIndex === -1) {
        foundWeekIndex = _.findIndex($scope.selectedSchedule.weeks, function(week) {
          if (week.start <= shiftObj.start && week.end >= shiftObj.end) {
            return true;
          }
          return false;
        });
      }

      if (shiftObj.type === 'normal') {
        if ($scope.viewMode.mode === 'week') {
          if (typeof $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId] === 'undefined') {
            $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId] = {};
          }
          if (typeof $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId]['calendar-day-' + dateStr] === 'undefined') {
            $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId]['calendar-day-' + dateStr] = [];
          }
          $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId]['calendar-day-' + dateStr].push(shiftObj);
          updateEmployeeScheduledHours('+', [shiftObj], 'week');
          $scope.selectedSchedule.weeks[foundWeekIndex].shifts.employeeShifts[shiftObj.employeeId]['calendar-day-' + dateStr].sort(shiftComparator);
        } else if ($scope.viewMode.mode === 'day') {
          if (typeof $scope.selectedSchedule.day.shifts.employeeShifts[shiftObj.employeeId] === 'undefined') {
            $scope.selectedSchedule.day.shifts.employeeShifts[shiftObj.employeeId] = [];
          }
          $scope.selectedSchedule.day.shifts.employeeShifts[shiftObj.employeeId].push(shiftObj);
          updateEmployeeScheduledHours('+', [shiftObj], 'day');
          $scope.selectedSchedule.day.shifts.employeeShifts[shiftObj.employeeId].sort(shiftComparator);
        }
      } else if (shiftObj.type === 'open') {
        if ($scope.viewMode.mode === 'week') {
          if (typeof $scope.selectedSchedule.weeks[foundWeekIndex].shifts.openShifts['calendar-day-' + dateStr] === 'undefined') {
            $scope.selectedSchedule.weeks[foundWeekIndex].shifts.openShifts['calendar-day-' + dateStr] = [];
          }
          $scope.selectedSchedule.weeks[foundWeekIndex].shifts.openShifts['calendar-day-' + dateStr].push(shiftObj);
          $scope.selectedSchedule.weeks[foundWeekIndex].shifts.openShifts['calendar-day-' + dateStr].sort(shiftComparator);
          $scope.selectedSchedule.weeks[foundWeekIndex].dayLabels['calendar-day-' + dateStr].openShiftsCount++;
        } else if ($scope.viewMode.mode === 'day') {
          $scope.selectedSchedule.day.shifts.openShifts.push(shiftObj);
          $scope.selectedSchedule.day.shifts.openShifts.sort(shiftComparator);
        }
      }
      markFilteredStatisticsAsNotValid();
    }

    function doActionAfterDroppingShift(response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response);
      shiftObj = parseShift(shiftInfo);

      arrangeShift('replace', shiftObj);

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_DROPPED_SUCCESSFULLY', 'success', true);
    }

    function doActionAfterSwappingShifts(response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response.shift1Dto);
      shiftObj = parseShift(shiftInfo);
      arrangeShift('replace', shiftObj);

      shiftInfo = pushInfoValuesToShift(response.shift2Dto);
      shiftObj = parseShift(shiftInfo);
      arrangeShift('replace', shiftObj);

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFTS_SWAPPED_SUCCESSFULLY', 'success', true);
    }

    function doActionAfterUpdatingShift(updateType, response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response.updatedShiftDto);
      shiftObj = parseShift(shiftInfo);
      arrangeShift('replace', shiftObj);

      if (typeof response.createdShiftDto !== 'undefined' && response.createdShiftDto !== null) {
        shiftInfo = pushInfoValuesToShift(response.createdShiftDto);
        shiftObj = parseShift(shiftInfo);
        if (updateType === 'CreateAndPost') {
          shiftObj.posted = 'Posted ' + moment.tz(response.createdShiftDto.postedDate, siteTimeZone).format('YYYY-MM-DD');
          shiftObj.requested = '';
        }
        arrangeShift('add', shiftObj);
      }

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_UPDATED_SUCCESSFULLY', 'success', true);
    }

    $scope.openManageShiftModal = function(shift, employee) {
      if (shift.external) {
        return;
      }

      var modalInstance = $modal.open({
        templateUrl: 'manageScheduleShiftPopupModal.html',
        controller: 'ManageScheduleShiftPopupModalInstanceCtrl',
        windowClass: 'manage-shift-modal',
        resolve: {
          selectedSchedule: function() {
            return $scope.selectedSchedule;
          },
          selectedShift: function() {
            return shift;
          },
          selectedEmployee: function() {
            return employee;
          }
        }
      });
      modalInstance.result.then(function(modalResult) {
        if (modalResult.operation === 'drop') {
          dataService.dropShift($scope.selectedSchedule.id, shift.id, modalResult.dropShiftReasonId).then(function(response) {
            doActionAfterDroppingShift(response);
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        } else if (modalResult.operation === 'swap') {
          dataService.submitSelectedEligibleEntities('swap', $scope.selectedSchedule.id, shift, modalResult.newSelectedShift, modalResult.comment).then(function(response) {
            doActionAfterSwappingShifts(response);
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        } else if (modalResult.operation === 'update') {
          var shiftInfo = {
            newStartDateTime: modalResult.startTime,
            newEndDateTime: modalResult.endTime
          };
          var osShiftInfo = null;

          if (typeof modalResult.spaceOperation !== 'undefined') {
            osShiftInfo = {
              action: modalResult.spaceOperation,
              startDateTime: modalResult.newShiftStartTime,
              endDateTime: modalResult.newShiftEndTime
            };

            if (modalResult.spaceOperation === 'CreateAndAssign') {
              osShiftInfo.employeeId = modalResult.newFillEmployee.employeeId;
            }

            if (typeof modalResult.ptoType !== 'undefined') {
              osShiftInfo.unavailabilityInfo = {
                absenceTypeId: modalResult.ptoType
              };
            }
          }

          dataService.manageShift($scope.selectedSchedule.id, shift.id, modalResult.comment, shiftInfo, osShiftInfo).then(function(response) {
            doActionAfterUpdatingShift(modalResult.spaceOperation, response);
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        }
      });
    };

    $scope.openManageOpenShiftsModal = function(date) {
      if ($scope.selectedSchedule.status !== 'Posted') {
        return;
      }

      if (typeof date !== 'undefined' && date !== null) {
        if ($scope.checkIfPastDate(date)) {
          return;
        }
      } else {
        if ($scope.checkIfPastSchedule()) {
          return;
        }
      }

      var modalInstance = $modal.open({
        templateUrl: 'manageOpenShiftsPopupModal.html',
        controller: 'ManageOpenShiftsPopupModalInstanceCtrl',
        size: 'lg',
        backdrop: false,
        windowClass: 'manage-open-shifts-modal',
        resolve: {
          siteId: function() {
            return $scope.selectedSchedule.siteInfo[0];
          },
          scheduleId: function() {
            return $scope.selectedSchedule.id;
          },
          dateRangeStart: function() {
            if (typeof date === 'undefined' || date === null) {
              return $scope.selectedSchedule.selectedWeek.start;
            } else {
              return moment.tz(date + ' 00:00', siteTimeZone).unix() * 1000;
            }
          },
          dateRangeEnd: function() {
            var dateMoment = null;
            if (typeof date === 'undefined' || date === null) {
              return $scope.selectedSchedule.selectedWeek.end;
            } else {
              dateMoment = moment.tz(date + ' 00:00', siteTimeZone);
              dateMoment.add(1, 'days').subtract(1, 'seconds');
              return dateMoment.unix() * 1000;
            }
          },
          timezone: function() {
            return siteTimeZone;
          }
        }
      });

      modalInstance.result.then(function(modalResult) {
        if (modalResult.openShiftsPosted) {
          reLoadSchedule();
        }
      });
    };

    function doActionAfterAddingNewShift(addType, response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response.shiftDto);
      shiftObj = parseShift(shiftInfo);
      if (addType === 'CreateAndPost' && typeof response.postedEmployeeMap !== 'undefined' && response.postedEmployeeMap !== null) {
        shiftObj.posted = 'Posted ' + moment.tz(response.shiftDto.postedDate, siteTimeZone).format('YYYY-MM-DD');
        shiftObj.requested = '';
      }

      arrangeShift('add', shiftObj);

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_ADDED_SUCCESSFULLY', 'success', true);
    }

    $scope.openAddNewShiftModal = function() {
      var modalInstance = $modal.open({
        templateUrl: 'addNewShiftPopupModal.html',
        controller: 'AddNewShiftPopupModalInstanceCtrl',
        size: 'lg',
        windowClass: 'add-new-shift-modal',
        resolve: {
          viewMode: function() {
            return $scope.viewMode.mode;
          },
          selectedSchedule: function() {
            return $scope.selectedSchedule;
          }
        }
      });
      modalInstance.result.then(function(modalResult) {
        dataService.createShiftByAction($scope.selectedSchedule.id, modalResult.shiftInfo, modalResult.action, modalResult.employeeId).then(function(response) {
          doActionAfterAddingNewShift(modalResult.action, response);
        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
        });
      });
    };

    function doActionAfterDeletingShift(shift) {
      arrangeShift('remove', shift);

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('{{ "app.DELETED_SUCCESSFULLY" | translate }}', 'success', true);
    }

    function doActionAfterFillingShift(fillType, response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response.updatedShiftDto);
      shiftObj = parseShift(shiftInfo);
      if (fillType === 'Post' && typeof response.postedEmployeeMap !== 'undefined' && response.postedEmployeeMap !== null) {
        shiftObj.posted = 'Posted ' + moment.tz(response.updatedShiftDto.postedDate, siteTimeZone).format('YYYY-MM-DD');
        shiftObj.requested = '';
      } else if (fillType === 'Edit') {
        shiftObj.posted = 'Posted ' + moment.tz(response.updatedShiftDto.postedDate, siteTimeZone).format('YYYY-MM-DD');
        shiftObj.requested = (response.updatedShiftDto.requested)? '(R)': '';
      }

      arrangeShift('replace', shiftObj);

      $scope.onFilterChanged(true);
      if (fillType === 'Edit') {
        applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_UPDATED_SUCCESSFULLY', 'success', true);
      } else if (fillType === 'Post') {
        applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_POSTED_SUCCESSFULLY', 'success', true);
      } else if (fillType === 'Assign') {
        applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_FILLED_SUCCESSFULLY', 'success', true);
      }
    }

    $scope.openFillShiftModal = function(shift) {
      if (shift.external) {
        return;
      }

      var modalInstance = $modal.open({
        templateUrl: 'fillShiftPopupModal.html',
        controller: 'FillShiftPopupModalInstanceCtrl',
        windowClass: 'fill-shift-modal',
        resolve: {
          viewMode: function() {
            return $scope.viewMode.mode;
          },
          selectedSchedule: function() {
            return $scope.selectedSchedule;
          },
          selectedOpenShift: function() {
            return shift;
          }
        }
      });
      modalInstance.result.then(function(modalResult) {
        if (modalResult.action === 'Delete') {
          return dataService.deleteOS($scope.selectedSchedule.id, shift.id).then( function(response) {
            doActionAfterDeletingShift(shift);
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        }

        var employeeId = null;
        if (modalResult.action === 'Assign') {
          employeeId = modalResult.employeeId;
        }
        var payLoad = {
          updateOpenShiftInfo: modalResult.shiftInfo,
          action: modalResult.action,
          employeeId: employeeId,
          comment: null,
          force: false,
          overrideOptions: null
        };

        dataService.manageOpenShift($scope.selectedSchedule.id, shift.id, payLoad).then(function(response) {
          doActionAfterFillingShift(modalResult.action, response);
        }, function(err) {
          applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
        });
      });
    };

    function doActionAfterAssigningShift(response) {
      var shiftInfo = [];
      var shiftObj = {};

      shiftInfo = pushInfoValuesToShift(response.shiftDto);
      shiftObj = parseShift(shiftInfo);

      arrangeShift('replace', shiftObj);

      $scope.onFilterChanged(true);
      applicationContext.setNotificationMsgWithValues('employee_schedules.SHIFT_ASSIGNED_SUCCESSFULLY', 'success', true);
    }

    $scope.openAssignShiftsModal = function(selectedEmployee) {
      var modalInstance = $modal.open({
        templateUrl: 'assignShiftsPopupModal.html',
        controller: 'AssignShiftsPopupModalInstanceCtrl',
        size: 'lg',
        windowClass: 'assign-shifts-modal',
        resolve: {
          selectedSchedule: function() {
            return $scope.selectedSchedule;
          },
          selectedEmployee: function() {
            return selectedEmployee;
          }
        }
      });
      modalInstance.result.then(function(modalResult) {
        if (modalResult.selectedOpenShiftId !== null) {
          dataService.assignShiftToEmployee($scope.selectedSchedule.id, modalResult.selectedOpenShiftId, selectedEmployee.id).then(function(response) {
            doActionAfterAssigningShift(response);
          }, function(err) {
            applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
          });
        }
      });
    };

    $scope.openOverrides = function () {
      $modal.open({
        templateUrl: 'modules/common/partials/schedule-settings-overrides.html',
        controller: 'ScheduleBuilderCreateSettingsCtrl',
        windowClass: 'overrides-modal',
        resolve: {
          selectedSchedule: function() {
            return $scope.selectedSchedule;
          }
        }
      });
    };

    $scope.hasMgmtPermission = function() {
      return authService.hasPermission('Tenant_Mgmt');
    };

    $scope.hasViewPermission = function () {
      return authService.hasPermission('Tenant_View');
    };

    wsService.registerConsumer({
      id: 'scheduleShiftActionsEventHandler',
      selector: function (key) {
        if ($scope.selectedSchedule) {
          var keySelector = '<ObjLifecycle><.*><><Shift><.*><.*>';
          return key.match(keySelector);
        }
        return false;
      },
      callback: function(key, serverEvent) {
        var shiftInfo = [];
        var shiftObj = {};

        shiftInfo = pushInfoValuesToShift(serverEvent);
        shiftObj = parseShift(shiftInfo);

        switch (key.eventType) {
          case 'Create':
            if (serverEvent.scheduleId !== $scope.selectedSchedule.id) {
              return;
            }

            if (typeof serverEvent.postedDate !== 'undefined' && serverEvent.postedDate !== null) {
              shiftObj.posted = 'Posted ' + moment.tz(serverEvent.postedDate, siteTimeZone).format('YYYY-MM-DD');
              shiftObj.requested = '';
            }
            arrangeShift('add', shiftObj);
            break;
          case 'Update':
            if (serverEvent.scheduleId !== $scope.selectedSchedule.id) {
              arrangeShift('remove', shiftObj);
              break;
            }

            arrangeShift('replace', shiftObj);
            break;
          case 'Delete':
            arrangeShift('remove', shiftObj);
            break;
          default:
            break;
        }

        $scope.onFilterChanged(true);
        $scope.$apply();
      },
      scope: $scope,
      params: []
    });

    wsService.registerConsumer({
      id: 'schedulePostedOpenShiftsEventHandler',
      selector: function (key) {
        if ($scope.selectedSchedule) {
          var keySelector = '<Schedule><.*>< PostedOSChange ><' + $scope.selectedSchedule.id + '>';
          return key.match(keySelector);
        }
        return false;
      },
      callback: function(key, serverEvent) {
        if (key.eventType === 'PostedOSChange' && serverEvent !== null) {
          EmployeeSchedulesService.getPostedOpenShifts($scope.selectedSchedule.id).then(function(response) {
            angular.forEach(response.result, function(shiftInfo) {
              var arrayInfo = [];

              arrayInfo.push(shiftInfo.shiftId, shiftInfo.excess, shiftInfo.teamId, null); //id, excess, team id, employee id
              arrayInfo.push(shiftInfo.skillId, shiftInfo.skillAbbrev, shiftInfo.startDateTime, shiftInfo.endDateTime); // skill id, skill abbrev, start, end
              arrayInfo.push(0, shiftInfo.comments); // paid time, comment

              var shiftObj = parseShift(arrayInfo);
              arrangeShift('replace', shiftObj);
            });
          });
        }
      },
      scope: $scope,
      params: []
    });
  }
]);

angular.module('emlogis.employeeSchedules').controller('ManageOpenShiftsPopupModalInstanceCtrl', ['$scope', '$modalInstance', '$timeout', '$filter', 'appFunc', 'applicationContext', 'EmployeeSchedulesService', 'siteId', 'scheduleId', 'dateRangeStart', 'dateRangeEnd', 'timezone',
  function ($scope, $modalInstance, $timeout, $filter, appFunc, applicationContext, EmployeeSchedulesService, siteId, scheduleId, dateRangeStart, dateRangeEnd, timezone) {

    $scope.data = {
      originalOpenShifts: [],
      openShifts: [],
      selectedOpenShifts: [],
      employees: [],
      selectedEmployees: [],
      qualificationSummary: {},
      qualificationSummaryDisplayed: false,
      comments: '',
      deadline: moment.tz([new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 7], timezone).unix() * 1000,
      terms: 'AutoApprove',
      postingRulesShown: false,
      messages: [],
      operationRun: false
    };

    $scope.loadingState = {
      populatingOverrideOptions: true,
      populatingOpenShifts: true,
      loadingEligibilityData: null,
      postingOpenShifts: false
    };

    $scope.options = {
      firstRequestOnly: true,
      overrideOptions: {},
      allOverrideOptions: false
    };

    $scope.checkboxModel = {
      notPostedOnly: false,
      requested: false
    };

    $scope.datePickerModel = {
      postUntil: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 7),
      datePickerOpened: false,
      datePickerOptions: {
        formatYear: 'yyyy',
        startingDay: 1
      },
      openDatePicker: function($event) {
        $event.preventDefault();
        $event.stopPropagation();

        $scope.datePickerModel.datePickerOpened = true;
      }
    };

    $scope.toggleAllOverrideOptions = function() {
      if ($scope.options.allOverrideOptions) {
        $scope.options.overrideOptions.TEAM_FLOAT_ON = true;
        $scope.options.overrideOptions.AVOID_OVERTIME = true;
        $scope.options.overrideOptions.ALL_DAY_UNAVAILABLE_OVERRIDE = true;
        $scope.options.overrideOptions.TIME_WINDOW_UNAVAILABLE_OVERRIDE = true;
        $scope.options.overrideOptions.MAX_DAYS_WEEK_OVERRIDE = true;
        $scope.options.overrideOptions.MAX_CONSECUTIVE_DAYS_OVERRIDE = true;
        $scope.options.overrideOptions.MAX_HOURS_WEEK_OVERRIDE = true;
        $scope.options.overrideOptions.MIN_HOURS_WEEK_OVERRIDE = true;
        $scope.options.overrideOptions.MAX_HOURS_DAY_OVERRIDE = true;
        $scope.options.overrideOptions.MIN_HOURS_DAY_OVERRIDE = true;
      } else {
        $scope.options.overrideOptions.TEAM_FLOAT_ON = false;
        $scope.options.overrideOptions.AVOID_OVERTIME = false;
        $scope.options.overrideOptions.ALL_DAY_UNAVAILABLE_OVERRIDE = false;
        $scope.options.overrideOptions.TIME_WINDOW_UNAVAILABLE_OVERRIDE = false;
        $scope.options.overrideOptions.MAX_DAYS_WEEK_OVERRIDE = false;
        $scope.options.overrideOptions.MAX_CONSECUTIVE_DAYS_OVERRIDE = false;
        $scope.options.overrideOptions.MAX_HOURS_WEEK_OVERRIDE = false;
        $scope.options.overrideOptions.MIN_HOURS_WEEK_OVERRIDE = false;
        $scope.options.overrideOptions.MAX_HOURS_DAY_OVERRIDE = false;
        $scope.options.overrideOptions.MIN_HOURS_DAY_OVERRIDE = false;
      }
    };

    $scope.parseDeadline = function() {
      var yearVal = $scope.datePickerModel.postUntil.getFullYear();
      var monthVal = $scope.datePickerModel.postUntil.getMonth();
      var dateVal = $scope.datePickerModel.postUntil.getDate();
      var dateInArrFormat = [yearVal, monthVal, dateVal];
      $scope.data.deadline = moment.tz(dateInArrFormat, timezone).unix() * 1000;
    };

    $scope.parseTerms = function() {
      if ($scope.options.firstRequestOnly) {
        $scope.data.terms = 'AutoApprove';
      } else {
        $scope.data.terms = 'Manager Review';
      }
    };

    $scope.togglePostingRulesPopup = function(employeeListUpdateNeeded) {
      if (employeeListUpdateNeeded) {
        $scope.getEligibilityDataFromSelectedEntities();
      }
      $scope.data.postingRulesShown = !$scope.data.postingRulesShown;
    };

    $scope.getOverrideOptions = function() {
      $scope.loadingState.populatingOverrideOptions = true;
      EmployeeSchedulesService.getOverrideOptions(siteId).then(function(response) {
        $scope.options.overrideOptions = response.data.overrideOptions;
      }, function(err) {
        $scope.data.messages.push({type: 'danger', msg: $filter('translate')('employee_schedules.OVERRIDE_OPTIONS_GET_ERROR')});
      }).finally(function() {
        $scope.loadingState.populatingOverrideOptions = false;
      });
    };

    $scope.updateOverrideOptions = function() {
      EmployeeSchedulesService.updateOverrideOptions(siteId, $scope.options.overrideOptions).then(function(overrideOptionsResponse) {
        $scope.data.messages.push({type: 'success', msg: $filter('translate')('employee_schedules.OVERRIDE_OPTIONS_UPDATED_SUCCESSFULLY')});
      }, function(overrideOptionsErr) {
        $scope.data.messages.push({type: 'danger', msg: $filter('translate')('employee_schedules.OVERRIDE_OPTIONS_UPDATED_ERROR')});
      });
    };

    $scope.openShiftsGridOptions = {
      data: 'data.openShifts',
      enableRowSelection: true,
      enableSelectAll: true,
      multiSelect: true,
      columnDefs: [
        { field: 'shiftId', visible: false },
        { field: 'shift', width: '200', enableSorting: false },
        { field: 'teamName', width: '100' },
        { field: 'skillName', width: '100' },
        { field: 'posted', width: '90',
          cellClass: function(grid, row, col, rowRenderIndex, colRenderIndex) {
            if (grid.getCellValue(row,col) !== '-') {
              return 'cell-bold';
            }
          }
        },
        { field: 'req', width: '70',
          cellClass: function(grid, row, col, rowRenderIndex, colRenderIndex) {
            if (grid.getCellValue(row,col).charAt(0) !== '-') {
              return 'cell-req-bold cell-bold';
            }
          }
        }
      ]
    };

    $scope.processSelectedRow = function(gridName, row) {
      if (row.isSelected) {
        if (gridName === 'openShifts') {
          $scope.data.selectedOpenShifts.push(row.entity);
          $scope.data.employees = [];
          $scope.data.selectedEmployees = [];
        } else {
          $scope.data.selectedEmployees.push(row.entity);
        }
      } else {
        if (gridName === 'openShifts') {
          $scope.data.selectedOpenShifts = _.filter($scope.data.selectedOpenShifts, function(entity){ return entity.shiftId !== row.entity.shiftId; });
          $scope.data.employees = [];
          $scope.data.selectedEmployees = [];
        } else {
          $scope.data.selectedEmployees = _.filter($scope.data.selectedEmployees, function(entity){ return entity.id !== row.entity.id; });
        }
      }
    };

    $scope.openShiftsGridOptions.onRegisterApi = function(gridApi) {
      gridApi.selection.on.rowSelectionChanged($scope, function (row) {
        $scope.processSelectedRow('openShifts', row);
      });

      gridApi.selection.on.rowSelectionChangedBatch($scope, function (rows) {
        angular.forEach(rows, function (row) {
          $scope.processSelectedRow('openShifts', row);
        });
      });
    };

    function comparator(firstElement, secondElement) {
      var firstValue = firstElement.startDateTime;
      var secondValue = secondElement.startDateTime;

      if (firstValue < secondValue) {
        return -1;
      } else if (firstValue > secondValue) {
        return 1;
      } else {
        return 0;
      }
    }

    $scope.populateOpenShifts = function() {
      $scope.data.openShifts = [];
      $scope.data.selectedOpenShifts = [];
      $scope.data.employees = [];
      $scope.data.selectedEmployees = [];
      EmployeeSchedulesService.getOpenShifts(scheduleId, dateRangeStart, dateRangeEnd).then(function(response) {
        $scope.data.openShifts = response.data.result;
        angular.forEach($scope.data.openShifts, function(openShift) {
          var startMomentObj = moment.tz(openShift.startDateTime, timezone);
          var endMomentObj = moment.tz(openShift.endDateTime, timezone);
          var startTimeStr = '';
          var endTimeStr = '';
          if (startMomentObj.minutes() > 0) {
            startTimeStr = startMomentObj.format('hh:mma');
          } else {
            startTimeStr = startMomentObj.format('hha');
          }
          if (endMomentObj.minutes() > 0) {
            endTimeStr = endMomentObj.format('hh:mma');
          } else {
            endTimeStr = endMomentObj.format('hha');
          }
          var shiftStr = startMomentObj.format('MMMM DD, YYYY, ') + startTimeStr + ' - ' + endTimeStr;

          openShift.shift = shiftStr;
          openShift.posted = (typeof openShift.postId === 'undefined' || openShift.postId === null || openShift.postId === 0)? '-': moment.tz(openShift.postId, timezone).format('MM/DD/YYYY');
          var reqCountStr = (openShift.reqCount === 0)? '-': openShift.reqCount;
          var empCountStr = (openShift.empCount === 0)? '-': openShift.empCount;
          openShift.req = reqCountStr + '/' + empCountStr;
        });
        $scope.loadingState.populatingOpenShifts = false;
        $scope.data.openShifts.sort(comparator);
        $scope.data.originalOpenShifts = angular.copy($scope.data.openShifts);
        $timeout(function () {
          $('.open-shifts-grid').resize();

          // Make font bold for entire row which has req > 0
          angular.forEach($('.cell-req-bold'), function(reqCell) {
            $(reqCell).parent().css('font-weight', 900);
          });
        }, 0);
      }, function(err) {
        $scope.data.messages.push({type: 'danger', msg: $filter('translate')('employee_schedules.POPULATING_OPEN_SHIFTS_ERROR')});
      });
    };

    function formatShiftTime(startDateTime, endDateTime, timezone) {
      var shiftStartDate =  moment.tz(startDateTime, timezone);
      var shiftEndDate =  moment.tz(endDateTime, timezone);
      return appFunc.toShortest12TimeFormat(shiftStartDate) + "-" + appFunc.toShortest12TimeFormat(shiftEndDate);
    }

    $scope.filterDisplayedShifts = function() {
      $scope.data.openShifts = [];
      $scope.data.selectedOpenShifts = [];
      $scope.data.employees = [];
      $scope.data.selectedEmployees = [];

      angular.forEach($scope.data.originalOpenShifts, function(openShift) {
        if ($scope.checkboxModel.notPostedOnly) {
          if (openShift.postId > 0) {
            return;
          }
        }
        if ($scope.checkboxModel.requested) {
          if (openShift.reqCount <=0) {
            return;
          }
        }
        $scope.data.openShifts.push(openShift);
      });
    };

    $scope.getEligibilityDataFromSelectedEntities = function() {
      $scope.data.employees = [];
      $scope.data.selectedEmployees = [];
      $scope.loadingState.loadingEligibilityData = true;
      var payLoad = {
        includeConstraintViolationSummary: true,
        maxSynchronousWaitSeconds: 180,
        maxComputationTime: 180,
        maximumUnimprovedSecondsSpent: 100,
        employeeIds: null,
        shiftIds: _.map($scope.data.selectedOpenShifts, 'shiftId'),
        startDateTime: dateRangeStart,
        endDateTime: dateRangeEnd,
        overrideOptions: $scope.options.overrideOptions
      };
      EmployeeSchedulesService.getEligibilityDataFromSelectedEntities(scheduleId, payLoad).then(function(response) {
        $scope.data.qualificationSummary = response.data.constraintViolationSummary;
        angular.forEach($scope.data.qualificationSummary.constraintViolations, function(violation) {
          violation.shiftTime
              = formatShiftTime(violation.shiftStartDateTime, violation.shiftEndDateTime, timezone);
          violation.shiftDate = moment.tz(violation.shiftStartDateTime, timezone).format('M/D/YY');
        });
        $scope.data.qualificationSummary.constraintViolations.sort(constraintViolationsComparator);
        angular.forEach(response.data.openShifts, function(openShift) {
          var foundIndex = _.findIndex($scope.data.openShifts, 'shiftId', openShift.id);
          $scope.data.openShifts[foundIndex].eligibleEmployees = openShift.employees;

          angular.forEach(openShift.employees, function(employee) {
            if (_.findIndex($scope.data.employees, 'id', employee.id) < 0) {
              $scope.data.employees.push(employee);
            }
          });
        });
        $timeout(function () {
          $('.employees-grid').resize();
        }, 0);
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      }).finally(function() {
        $scope.loadingState.loadingEligibilityData = false;
      });
    };

    function constraintViolationsComparator(violation1, violation2) {
      if(violation1.shiftStartDateTime < violation2.shiftStartDateTime) {
        return -1;
      } else if(violation1.shiftStartDateTime > violation2.shiftStartDateTime){
        return 1;
      }
      var employee1Name = violation1.employeeFirstName + violation1.employeeLastName;
      var employee2Name = violation2.employeeFirstName + violation2.employeeLastName;
      if(employee1Name < employee2Name) {
        return -1;
      } else if(employee1Name > employee2Name) {
        return 1;
      }
      return 0;
    }

    $scope.toggleQualificationSummary = function() {
      $scope.data.qualificationSummaryDisplayed = !$scope.data.qualificationSummaryDisplayed;
    };

    $scope.employeesGridOptions = {
      data: 'data.employees',
      enableRowSelection: true,
      enableSelectAll: true,
      multiSelect: true,
      columnDefs: [
        { field: 'id', visible: false},
        { field: 'name'},
        { field: 'homeTeamName'}
      ]
    };

    $scope.employeesGridOptions.onRegisterApi = function(gridApi) {
      gridApi.selection.on.rowSelectionChanged($scope, function (row) {
        $scope.processSelectedRow('employees', row);
      });

      gridApi.selection.on.rowSelectionChangedBatch($scope, function (rows) {
        angular.forEach(rows, function (row) {
          $scope.processSelectedRow('employees', row);
        });
      });
    };

    $scope.postOpenShifts = function() {
      $scope.loadingState.postingOpenShifts = true;
      var openShifts = {};
      angular.forEach($scope.data.selectedOpenShifts, function(selectedOpenShift) {
        openShifts[selectedOpenShift.shiftId] = [];
        angular.forEach($scope.data.selectedEmployees, function(selectedEmployee) {
          if (_.findIndex(selectedOpenShift.eligibleEmployees, 'id', selectedEmployee.id) > -1) {
            openShifts[selectedOpenShift.shiftId].push(selectedEmployee.id);
          }
        });
        if (openShifts[selectedOpenShift.shiftId].length === 0) {
          delete openShifts[selectedOpenShift.shiftId];
        }
      });

      var payLoad = {
        comments: $scope.data.comments,
        terms: $scope.data.terms,
        deadline: $scope.data.deadline,
        overrideOptions: $scope.options.overrideOptions,
        openShifts: openShifts
      };

      EmployeeSchedulesService.postOpenShifts(scheduleId, payLoad).then(function(openShiftsResponse) {
        $scope.data.messages.push({type: 'success', msg: openShiftsResponse.data.result.length + ' ' + $filter('translate')('employee_schedules.OPEN_SHIFTS_POSTED_SUCCESSFULLY')});
        $scope.data.operationRun = true;
      }, function(openShiftsErr) {
        $scope.data.messages.push({type: 'danger', msg: $filter('translate')('employee_schedules.OPEN_SHIFTS_POSTED_ERROR')});
      }).finally(function() {
        $scope.loadingState.postingOpenShifts = false;
        $scope.populateOpenShifts();
      });
    };

    $scope.closeMessage = function(index) {
      $scope.data.messages.splice(index, 1);
    };

    $scope.close = function () {
      $modalInstance.close({openShiftsPosted: $scope.data.operationRun});
    };

    $scope.getOverrideOptions();
    $scope.populateOpenShifts();
  }]);

angular.module('emlogis.employeeSchedules').controller('ExceptionsModalInstanceCtrl', ['$scope', '$modalInstance', 'applicationContext', 'dataService', 'scheduleId',
  function ($scope, $modalInstance, applicationContext, dataService, scheduleId) {
    $scope.data = {
      exceptions: null,
      exceptionsLoaded: null
    };

    $scope.close = function () {
      $modalInstance.dismiss('cancel');
    };

    dataService.getScheduleExceptions(scheduleId).then(function(response) {
      $scope.data.exceptions = response.data;
    }, function(err) {
      applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
    }).finally(function() {
      $scope.data.exceptionsLoaded = true;
    });
  }]);

angular.module('emlogis.employeeSchedules').controller('PromoteScheduleConfirmationModalInstanceCtrl', ['$scope', '$modalInstance', '$filter', 'currentScheduleStatus',
  function ($scope, $modalInstance, $filter, currentScheduleStatus) {
    $scope.modalTitle = null;
    $scope.modalText = null;

    if (currentScheduleStatus === 'Production') {
      $scope.modalTitle = $filter('translate')('employee_schedules.POST_SCHEDULE');
      $scope.modalText = $filter('translate')('employee_schedules.POST_CONFIRMATION_MESSAGE');
    } else {
      $scope.modalTitle = $filter('translate')('employee_schedules.PROMOTE_SCHEDULE');
      $scope.modalText = $filter('translate')('employee_schedules.PROMOTE_CONFIRMATION_MESSAGE');
    }

    $scope.confirmToPromote = function() {
      $modalInstance.close({answer: true});
    };

    $scope.close = function () {
      $modalInstance.dismiss('cancel');
    };
  }]);

angular.module('emlogis.employeeSchedules').directive('shiftTimeLine',
  function() {
    return {
      restrict: 'A',
      link: function (scope, elem, attrs) {
        scope.timeLineWidth = attrs.width;
        scope.maxHours = 48;

        scope.$on('event:updateShift', function (event, args) {
          init();
        });

        function init() {
          elem.resizable({handles: 'w,e', containment: 'parent', grid: [scope.data.step, 1], minWidth : 1});
        }

        elem.on('resizestop', function (evt, ui) {
          scope.$apply(function() {
            scope.$eval(attrs.firstpos + '=' + ui.position.left);
            scope.$eval(attrs.endpos + '=' + (ui.size.width + 2));
            scope.data.swapShift = false;
            scope.getWipEligibleEmployees();
          });
        });

        scope.initShiftEditForm();
        init();
      }
    };
  });

angular.module('emlogis.employeeSchedules').controller('ManageScheduleShiftPopupModalInstanceCtrl', ['$scope', '$modalInstance', '$timeout', 'dataService', 'applicationContext', 'selectedSchedule', 'selectedShift', 'selectedEmployee',
  function ($scope, $modalInstance, $timeout, dataService, applicationContext, selectedSchedule, selectedShift, selectedEmployee) {
    var siteId = selectedSchedule.siteInfo[0];
    var timezone = selectedSchedule.siteInfo[2];

    $scope.watchers = {};

    $scope.removeWatchers = function() {
      for (var i in $scope.watchers) {
        $scope.watchers[i]();
      }
    };

    $scope.data = {
      selectedEmployee: selectedEmployee,
      teamName: selectedShift.teamName,
      skillName: selectedShift.skillName,
      swapShift: false,
      eligibleEmployeesLoaded: null,
      eligibleEmployees: [],
      qualificationSummary: {},
      qualificationSummaryDisplayed: false,
      eligibleShiftsLoaded: false,
      eligibleShifts: [],
      eligibleShiftsGridOptions: {
        data: 'data.eligibleShifts',
        enableRowSelection: true,
        enableSelectAll: false,
        multiSelect: false,
        columnDefs: [
          { name: 'shiftId', visible: false },
          { name: 'employeeId', visible: false },
          { name: 'employeeName', width: 140 },
          { name: 'teamName', width: 100 },
          { name: 'skillName', width: 120 },
          { name: 'date', width: 80 },
          { name: 'shift', width: 150, sortable: false }
        ],
        onRegisterApi: function(gridApi) {
          $scope.gridApi = gridApi;
          gridApi.selection.on.rowSelectionChanged($scope, function(row) {
            if (row.isSelected) {
              $scope.data.newSelectedShift = row.entity;
            } else {
              $scope.data.newSelectedShift = null;
            }
          });
        }
      },
      dropShiftReasonsAndAbsenceTypes: [],
      comment: selectedShift.comment
    };
    $scope.data.formattedTime = moment.tz(selectedShift.start, timezone).format('dddd, MM/DD/YYYY h:mma') + '-' +
      moment.tz(selectedShift.end, timezone).format('h:mma');

    $scope.hasNewShift = function() {
      if (typeof $scope.data.endPtoDate === 'undefined' || $scope.data.endPtoDate === null ||
        typeof $scope.data.startPtoDate === 'undefined' || $scope.data.startPtoDate === null) {
        return false;
      }

      if ($scope.data.endPtoDate.unix() > $scope.data.startPtoDate.unix()) {
        return true;
      }

      return false;
    };

    $scope.toggleQualificationSummary = function() {
      $scope.data.qualificationSummaryDisplayed = !$scope.data.qualificationSummaryDisplayed;
    };

    $scope.getWipEligibleEmployees = function() {
      if ($scope.data.action !== 'CreateAndAssign') {
        return;
      }

      $scope.data.eligibleEmployeesLoaded = false;
      $scope.data.eligibleEmployees = [];
      var shiftInfo = {
        teamId: selectedShift.teamId,
        skillId: selectedShift.skillId,
        start: $scope.data.startPtoDate.unix() * 1000,
        end: $scope.data.endPtoDate.unix() * 1000
      };

      dataService.getWipEligibleEmployeesForProposedOpenShift(selectedSchedule.id, shiftInfo).then(function(result) {
        $scope.data.qualificationSummary = result.data.constraintViolationSummary;
        $scope.data.eligibleEmployees = result.data.eligibleEmployees;
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      }).finally(function() {
        $scope.data.eligibleEmployeesLoaded = true;
      });
    };

    $scope.getSwapEligibleShifts = function() {
      $scope.data.eligibleShiftsLoaded = false;
      $scope.data.eligibleShifts = [];
      dataService.getSwapEligibleShiftsForShift(selectedEmployee.id, selectedShift.id).then(function(result) {
        angular.forEach(result.data.swappableShifts, function(shift) {
          shift.date = moment.tz(shift.startDateTime, timezone).format('MM/DD/YYYY');
          shift.shift = moment.tz(shift.startDateTime, timezone).format('hh:mma') + ' - ' +
            moment.tz(shift.endDateTime, timezone).format('hh:mma');
          $scope.data.eligibleShifts.push(shift);
        });
        $timeout(function() {
          $('.eligible-shifts-grid').resize();
        }, 0);
      }, function(err) {
        var message = err.data.message || JSON.stringify(err.data);
        applicationContext.setNotificationMsgWithValues(message, 'danger', true);
      }).finally(function() {
        $scope.data.eligibleShiftsLoaded = true;
      });
    };

    $scope.initTimeLine = function() {
      var timeLineWidth = $scope.timeLineWidth;
      var startDateLine = moment.tz($scope.data.selectedShift.start, timezone);
      startDateLine.hours(startDateLine.hours() - $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
      startDateLine.hours(startDateLine.hours() + startDateLine.hours()%2).minutes(0).seconds(0).milliseconds(0);
      var endDateLine = moment.tz($scope.data.selectedShift.end, timezone);
      endDateLine.hours(endDateLine.hours() + $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
      var hoursN = (endDateLine.unix() - startDateLine.unix()) / 3600;

      var koef = 1;
      if (hoursN > 12) {
        koef = Math.ceil(hoursN / 12);
        switch (koef) {
          case 5:
            koef = 6;
            break;
          case 7:
            koef = 8;
            break;
          default:
            if (koef > 8 && koef <= 12) {
              koef = 12;
            } else if (koef > 12) {
              koef = 24;
            }
        }
        //koef = Math.pow(2, Math.floor(hoursN / 12));
      }
      $scope.hours = [];
      for (var i = 0; i < hoursN / koef; i++) {
        var temp = moment.tz(startDateLine, timezone);
        temp.hours(temp.hours() + i * koef);
        $scope.hours[i] = temp;
      }

      var minStep = 15;
      //var minStep = 15 * Math.pow(2, Math.floor(Math.sqrt(koef1)) - 1);
      //if (minStep > 60) {
      //    minStep = 60;
      //}
      $scope.data.step = timeLineWidth / (hoursN * (60 / minStep));

      var controlDate = moment.tz($scope.hours[$scope.hours.length - 1], timezone);
      controlDate.hours(controlDate.hours() + koef);
      if (controlDate.unix() > endDateLine.unix()) {
        endDateLine = controlDate;
      }

      var lineDiff = (endDateLine.unix() - startDateLine.unix()) * 1000;
      var startPoint = ($scope.data.startDate.unix() - startDateLine.unix()) * 1000;
      var duration = ($scope.data.endDate.unix() - $scope.data.startDate.unix()) * 1000;

      $scope.data.shiftModel = {
        start: startPoint * timeLineWidth / lineDiff,
        width: duration * timeLineWidth / lineDiff
      };

      $scope.data.newShiftModel.start = ($scope.data.startPtoDate.unix() - startDateLine.unix()) * 1000 * timeLineWidth / lineDiff;
      $scope.data.newShiftModel.width = ($scope.data.endPtoDate.unix() - $scope.data.startPtoDate.unix()) * 1000 * timeLineWidth / lineDiff;

      $scope.data.limits = {
        start: ($scope.data.selectedShift.start - startDateLine.unix() * 1000) * timeLineWidth / lineDiff,
        end: ($scope.data.selectedShift.end - startDateLine.unix() * 1000) * timeLineWidth / lineDiff
      };

      $scope.watchers.shiftModel = $scope.$watch('[data.shiftModel.start, data.shiftModel.width]', function (newValue, oldValue) {
        $scope.data.startDate = moment.tz(roundTime((newValue[0] * lineDiff) / timeLineWidth + startDateLine.unix() * 1000, minStep), timezone);
        $scope.data.endDate = moment.tz(roundTime((newValue[1] * lineDiff) / timeLineWidth + $scope.data.startDate.unix() * 1000, minStep), timezone);
        $scope.data.dropShitAttempt = false;

        var newVal = {
          start: newValue[0],
          width: newValue[1]
        };

        var oldVal = {
          start: oldValue[0],
          width: oldValue[1]
        };

        var shiftModel = {
          start: newVal.start,
          width: newVal.width
        };
        var newShiftModel = angular.copy($scope.data.newShiftModel);

        angular.forEach(newValue, function(value, key) {
          if (newValue[key] < 0) {
            newValue[key] = 0;
          }
        });

        if (!$scope.hasNewShift()) {
          if (newVal.start > oldVal.start) {
            newShiftModel.start = $scope.data.limits.start;
            if ((newVal.start - $scope.data.limits.start) > 0) {
              newShiftModel.width = newVal.start - $scope.data.limits.start;
            } else {
              newShiftModel.width = 0;
            }
            newShiftModel.position = 'before';
          } else if (newVal.width < oldVal.width) {
            newShiftModel.start = newVal.start + newVal.width;
            if (($scope.data.limits.end - newVal.width) > 0) {
              newShiftModel.width = $scope.data.limits.end - (newVal.width + newVal.start);
            } else {
              newShiftModel.width = 0;
            }
            newShiftModel.position = 'after';
          }
        } else if (newShiftModel.position == 'before') {
          if ((newVal.start > oldVal.start)) {
            newShiftModel.width += (newVal.start - oldVal.start);
          } else if (newVal.start >= newShiftModel.start) {
            newShiftModel.width = newShiftModel.width - (oldVal.start - newVal.start);
          } else {
            newShiftModel.start = newVal.start;
            newShiftModel.width = 0;
          }
          //} else if (newShiftModel.position == 'after' && $scope.backUpEndDate.getTime() != $scope.endDate.getTime()) {
        } else if (newShiftModel.position == 'after' && (
          ( Math.abs((newVal.start + newVal.width) - (oldVal.start + oldVal.width)) > 3 ))) {
          var widthDiff = newVal.width - oldVal.width;
          if ((newVal.width < oldVal.width)) {
            newShiftModel.start += widthDiff;
            newShiftModel.width -= widthDiff;

          } else if ((newVal.start + newVal.width) < (newShiftModel.start + newShiftModel.width) &&
            (newVal.start + newVal.width) > newShiftModel.start) {
            newShiftModel.start += widthDiff;
            newShiftModel.width -= widthDiff;
          } else {
            newShiftModel.start = newVal.start;
            newShiftModel.width = 0;
          }
        }

        if ($scope.hasNewShift()) {
          if (newShiftModel.position == 'before' && (newVal.width < oldVal.width) &&
            ((newVal.width + newVal.start) < $scope.data.limits.end)) {
            shiftModel.width = Math.abs($scope.data.limits.end - newVal.start);
          }

          if (newShiftModel.position == 'after' && (newVal.width < oldVal.width) &&
            (shiftModel.start > $scope.data.limits.start)) {
            shiftModel.start = $scope.data.limits.start;
            shiftModel.width = Math.abs(newShiftModel.start - $scope.data.limits.start);
          }

          if (shiftModel.start + shiftModel.width > newShiftModel.start  && newShiftModel.position == 'after'){
            var diff = shiftModel.start + shiftModel.width - newShiftModel.start;
            newShiftModel.width -= diff;
            newShiftModel.start += diff;
          }
        }

        $scope.data.shiftModel = angular.copy(shiftModel);
        $scope.data.newShiftModel = angular.copy(newShiftModel);
        $scope.data.startPtoDate = moment.tz(roundTime(($scope.data.newShiftModel.start * lineDiff) / timeLineWidth + startDateLine.unix() * 1000, minStep), timezone);
        $scope.data.endPtoDate = moment.tz(roundTime(($scope.data.newShiftModel.width * lineDiff) / timeLineWidth + $scope.data.startPtoDate.unix() * 1000, minStep), timezone);
      }, true);

      function roundTime(time, min) {
        return (Math.round(time / 1000 / 60 / min)) * min * 60 * 1000;
      }
    };

    $scope.initShiftEditForm = function() {
      $scope.hoursBeforeAfter = 4;
      if (typeof $scope.gridApi !== 'undefined' && $scope.gridApi !== null) {
        $scope.gridApi.selection.clearSelectedRows();
      }

      $scope.data = _.assign($scope.data, {
        selectedShift: angular.copy(selectedShift),
        newFillEmployee: null,
        newSelectedShift: null,
        startDate: moment.tz(selectedShift.start, timezone),
        endDate: moment.tz(selectedShift.end, timezone),
        startPtoDate: moment.tz(selectedShift.start, timezone),
        endPtoDate: moment.tz(selectedShift.start, timezone),
        newShiftModel: {
          start: 0,
          width: 0,
          position: ''
        },
        action: 'CreateAndDelete',
        changeToPto: false,
        selectedDropShiftReasonAndAbsenceType: null
      });

      $scope.initTimeLine();
    };

    $scope.onSwapShiftChanged = function() {
      console.log("onSwapShiftChanged");

      $scope.data.dropShitAttempt = false;
      $scope.initShiftEditForm();
      if ($scope.data.swapShift) {
        $scope.getSwapEligibleShifts();
      }
    };

    $scope.onDropShiftAttempt = function() {
      $scope.data.dropShitAttempt = true;

      dataService.getDropShiftReasonsAndAbsenceTypes(siteId).then(function(result) {
        $scope.data.dropShiftReasonsAndAbsenceTypes = result.data;
        $scope.data.selectedDropShiftReasonAndAbsenceType = $scope.data.dropShiftReasonsAndAbsenceTypes[0];
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    $scope.zoomIn = function() {
      if ($scope.hoursBeforeAfter > 1) {
        $scope.hoursBeforeAfter /= 2;

        var tempStartDateLine = moment.tz($scope.data.selectedShift.start, timezone);
        tempStartDateLine.hours(tempStartDateLine.hours() - $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
        var tempEndDateLine = moment.tz($scope.data.selectedShift.end, timezone);
        tempEndDateLine.hours(tempEndDateLine.hours() + $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
        if (tempStartDateLine.unix() <= $scope.data.startDate.unix() &&
          tempEndDateLine.unix() >= $scope.data.endDate.unix()) {
          $scope.updateTimeLine();
          return true;
        } else {
          $scope.hoursBeforeAfter *= 2;
          return false;
        }
      }
    };

    $scope.zoomOut = function() {
      $scope.hoursBeforeAfter *= 2;

      var tempStartDateLine = moment.tz($scope.data.selectedShift.start, timezone);
      tempStartDateLine.hours(tempStartDateLine.hours() - $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
      var tempEndDateLine = moment.tz($scope.data.selectedShift.end, timezone);
      tempEndDateLine.hours(tempEndDateLine.hours() + $scope.hoursBeforeAfter).minutes(0).seconds(0).milliseconds(0);
      if ((tempEndDateLine.unix() - tempStartDateLine.unix()) < ($scope.maxHours * 3600)) {
        $scope.updateTimeLine();
        return true;
      } else {
        $scope.hoursBeforeAfter /= 2;
        return false;
      }
    };

    $scope.zoomBest = function() {
      var i = true;
      while(i) {
        i = $scope.zoomIn();
      }
    };

    $scope.updateTimeLine = function() {
      $scope.removeWatchers();
      $scope.$broadcast('event:updateShift');

      $scope.initTimeLine();
    };

    $scope.dropShift = function() {
      $modalInstance.close({operation: 'drop', dropShiftReasonId: $scope.data.selectedDropShiftReasonAndAbsenceType.name});
    };

    $scope.submit = function() {
      var result = null;
      var startTime = null;
      var endTime = null;
      var newShiftStartTime = null;
      var newShiftEndTime = null;

      if ($scope.data.swapShift) {
        result = {
          operation: 'swap',
          newSelectedShift: $scope.data.newSelectedShift
        };
      } else {
        startTime = $scope.data.startDate.unix() * 1000;
        endTime = $scope.data.endDate.unix() * 1000;
        result = {
          operation: 'update',
          startTime: startTime,
          endTime: endTime
        };
        if ($scope.hasNewShift()) {
          newShiftStartTime = $scope.data.startPtoDate.unix() * 1000;
          newShiftEndTime = $scope.data.endPtoDate.unix() * 1000;
          result.newShiftStartTime = newShiftStartTime;
          result.newShiftEndTime = newShiftEndTime;
          if ($scope.data.changeToPto) {
            result.ptoType = $scope.data.selectedAbsenceType;
          }
          result.spaceOperation = $scope.data.action;
          if ($scope.data.action === 'CreateAndAssign') {
            result.newFillEmployee = $scope.data.newFillEmployee;
          }
        }
      }
      result.comment = $scope.data.comment;
      $modalInstance.close(result);
    };

    $scope.close = function () {
      $modalInstance.dismiss('cancel');
    };
  }]);

angular.module('emlogis.employeeSchedules').controller('AddNewShiftPopupModalInstanceCtrl', ['$scope', '$modalInstance', '$timeout', '$filter', 'applicationContext', 'dataService', 'viewMode', 'selectedSchedule',
  function ($scope, $modalInstance, $timeout, $filter, applicationContext, dataService, viewMode, selectedSchedule) {
    var siteId = selectedSchedule.siteInfo[0];
    var scheduleId = selectedSchedule.id;
    var timezone = selectedSchedule.siteInfo[2];
    var teams = [];

    $scope.data = {
      selectedScheduleStatus: selectedSchedule.status,
      teams: _.filter(selectedSchedule.teamsInfo.result, function(teamInfo) {
        var isHomeTeam = teamInfo[2];
        return !isHomeTeam;
      }),
      skills: [],
      selectedTeam: null,
      selectedSkill: null,
      shiftTime: {
        start: null,
        end: null
      },
      shiftTimeRangeInvalid: true,
      selectedOperationType: 'addAsOpenShift',
      qualificationSummary: {},
      qualificationSummaryDisplayed: false,
      selectedEligibleEmployee: null,
      eligibleEmployees: [],
      eligibleEmployeesLoaded: true,
      showAvailableOnly: true,
      employeeCalendarHeaderCells: [],
      employeeCalendarShifts: {},
      employeeCalendarShiftsRowHeight: '51px',
      employeeCalendarAvailItems: {},
      employeeCalendarAvailItemsRowHeight: '26px',
      employeeCalendarPrefItems: {},
      employeeCalendarPrefItemsRowHeight: '26px',
      sortOption: 'sortByName'
    };

    function nameComparator(firstEntity, secondEntity) {
      if (firstEntity[1] < secondEntity[1]) {
        return -1;
      } else if (firstEntity[1] > secondEntity[1]) {
        return 1;
      } else {
        return 0;
      }
    }

    $scope.data.teams.sort(nameComparator);

    var initializeTeamsSkills = function() {
      dataService.getSitesTeamsTree({}).then(function(response) {
        teams = _.result(_.find(response.data, function(site) {return site.id === siteId;}), 'children');
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    $scope.onSelectedTeamChanged = function() {
      if ($scope.data.selectedTeam === null) {
        $scope.data.skills = [];
      } else {
        var selectedTeamId = $scope.data.selectedTeam[0];
        var selectedTeam = _.find(teams, function(team) {return team.id === selectedTeamId;});
        $scope.data.skills = _.filter(selectedSchedule.skillsInfo.result, function(skillInfo) {
          return (skillInfo[3] && _.findIndex(selectedTeam.children, function(skill) {
            return (skill.id === skillInfo[0]);
          }) > -1);
        });
        $scope.data.skills.sort(nameComparator);
      }
      $scope.data.selectedSkill = null;
      $scope.data.eligibleEmployees = [];
    };

    $scope.onSelectedSkillChanged = function() {
      if ($scope.data.selectedSkill === null) {
        $scope.data.eligibleEmployees = [];
        return;
      }
      $scope.getWipEligibleEmployees();
      initializeCalendarCells();
    };

    $scope.onFillShiftSelected = function() {
      $scope.getWipEligibleEmployees();
      initializeCalendarCells();
    };

    $scope.canShowFooterContent = function() {
      return ($scope.data.selectedTeam !== null && $scope.data.selectedSkill !== null &&
        $scope.data.shiftTime.start !== null && $scope.data.selectedOperationType === 'fillShift' &&
        $scope.data.selectedEligibleEmployee !== null);
    };

    var calculateEmployeesInfo = function() {
      angular.forEach($scope.data.eligibleEmployees, function(employee) {
        var foundEmployee = _.find(selectedSchedule.employeesInfo.result, function(iteratee) {
          return (iteratee.id === employee.employeeId);
        });
        var hoursOfEmployee = 0;
        angular.forEach(selectedSchedule.selectedWeek.shifts.employeeShifts[employee.employeeId], function(dateShifts, calendarDate) {
          angular.forEach(dateShifts, function(shift) {
            var shiftDurationInHours = (shift.end - shift.start)/3600000;
            hoursOfEmployee += shiftDurationInHours;
          });
        });
        var costOfEmployee = foundEmployee[3] * hoursOfEmployee;
        employee.hours = hoursOfEmployee;
        employee.cost = costOfEmployee;
      });
    };

    var comparator = function(firstElement, secondElement) {
      var firstValue = null;
      var secondValue = null;

      if ($scope.data.sortOption === 'sortByName') {
        firstValue = firstElement.employeeName;
        secondValue = secondElement.employeeName;
      } else if ($scope.data.sortOption === 'leastHoursFirst') {
        firstValue = firstElement.hours;
        secondValue = secondElement.hours;
      } else if ($scope.data.sortOption === 'leastCostFirst') {
        firstValue = firstElement.cost;
        secondValue = secondElement.cost;
      }

      if (firstValue < secondValue) {
        return -1;
      } else if (firstValue > secondValue) {
        return 1;
      } else {
        return 0;
      }
    };

    $scope.setSortOption = function(option) {
      $scope.data.sortOption = option;
      $scope.data.eligibleEmployees.sort(comparator);
    };

    $scope.getWipEligibleEmployees = function() {
      $scope.data.eligibleEmployees = [];
      $scope.data.selectedEligibleEmployee = null;

      if ($scope.data.selectedOperationType !== 'fillShift') {
        return;
      }
      if ($scope.data.selectedTeam === null || $scope.data.selectedSkill === null) {
        return;
      }
      if ($scope.data.shiftTime.start === null || $scope.data.shiftTime.end === null) {
        return;
      }

      $scope.data.eligibleEmployeesLoaded = false;
      var overrideOptions = null;

      if (!$scope.data.showAvailableOnly) {
        overrideOptions = {
          ALL_DAY_UNAVAILABLE_OVERRIDE: true,
          TIME_WINDOW_UNAVAILABLE_OVERRIDE: true
        };
      }

      var shiftInfo = {
        teamId: $scope.data.selectedTeam[0],
        skillId: $scope.data.selectedSkill[0],
        start: $scope.data.shiftTime.start,
        end: $scope.data.shiftTime.end
      };

      dataService.getWipEligibleEmployeesForProposedOpenShift(scheduleId, shiftInfo, overrideOptions).then(function(result) {
        $scope.data.eligibleEmployees = result.data.eligibleEmployees;
        $scope.data.qualificationSummary = result.data.constraintViolationSummary;
        calculateEmployeesInfo();
        $scope.setSortOption('sortByName');
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      }).finally(function() {
        $scope.data.eligibleEmployeesLoaded = true;
      });
    };

    $scope.toggleQualificationSummary = function() {
      $scope.data.qualificationSummaryDisplayed = !$scope.data.qualificationSummaryDisplayed;
    };

    var composeAvailabilityItem = function(availType, timeFrame) {
      var type = 'avail-item';
      var title = '';
      var className = '';

      if (availType === 'AVAIL') {
        var startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        var endDateTime = moment.tz(timeFrame.endDateTime, timezone);

        title = startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
        className = 'partially-available';
      } else if (availType === 'DAY_OFF') {
        if (timeFrame.pto) {
          title = $filter('translate')('availability.PTO_VACATION');
          className = 'holiday-vacation';
        } else {
          title = $filter('translate')('availability.NOT_AVAILABLE');
          className = 'not-available';
        }
      } else {
        title = $filter('translate')('availability.UNKNOWN_AVAILABILITY_TYPE') + ' ' + availType;
      }

      var result = {
        type: type,
        title: title,
        className: className
      };

      return result;
    };

    var composePreferenceItem = function(prefType, timeFrame) {
      var type = 'pref-item';
      var title = '';
      var className = '';
      var startDateTime = null;
      var endDateTime = null;

      if (timeFrame.startDateTime && timeFrame.endDateTime) {
        startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        endDateTime = moment.tz(timeFrame.endDateTime, timezone);
      }

      switch (prefType) {
        case 'AVOID_TIMEFRAME':
          title = $filter('translate')('availability.AVOID') + ' ' +
            startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
          className = 'avoid-time-frame';
          break;
        case 'PREFER_TIMEFRAME':
          title = $filter('translate')('availability.PREFER') + ' ' +
            startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
          className = 'prefer-time-frame';
          break;
        case 'AVOID_DAY':
          title = $filter('translate')('availability.AVOID_DAY');
          className = 'avoid-day';
          break;
        case 'PREFER_DAY':
          title = $filter('translate')('availability.PREFER_DAY');
          className = 'prefer-day';
          break;
        default:
          title = $filter('translate')('availability.UNKNOWN_PREFERENCE_TYPE') + ' ' + prefType;
      }

      var result = {
        type: type,
        title: title,
        className: className
      };

      return result;
    };

    $scope.onSelectedEligibleEmployeeChanged = function() {
      initializeCalendarCells();
      if ($scope.data.selectedEligibleEmployee === null) {
        return;
      }

      var rowCount = 0;
      var startTime = selectedSchedule.selectedWeek.start;
      var endTime = selectedSchedule.selectedWeek.end;

      var queryParams = {
        params: {
          startdate: startTime,
          enddate: endTime,
          returnedfields: 'id,startDateTime,endDateTime,excess,skillAbbrev,skillName,teamName'
        }
      };
      dataService.getEmployeeCalendarAndAvailabilityView(scheduleId, $scope.data.selectedEligibleEmployee.employeeId, queryParams).then(function(response) {
        // Draw Shifts
        angular.forEach(response.data.shifts.result, function(shift) {
          var shiftStartTimeDayOfWeek = moment.tz(shift[1], timezone).format('ddd');
          var startTimeStr = moment.tz(shift[1], timezone).format('h:mma');
          startTimeStr = startTimeStr.substr(0, startTimeStr.length - 1);
          var endTimeStr = moment.tz(shift[2], timezone).format('h:mma');
          endTimeStr = endTimeStr.substr(0, endTimeStr.length - 1);

          var shiftObj = {
            type: 'normal-shift',
            start: shift[1],
            end: shift[2],
            timeStr: startTimeStr + '-' + endTimeStr,
            team: shift[6],
            skill: shift[5],
            skillAbbrev: shift[4],
            className: ''
          };
          $scope.data.employeeCalendarShifts[shiftStartTimeDayOfWeek].push(shiftObj);
        });
        rowCount = _.max($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          return dayShifts.length;
        }).length;
        angular.forEach($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          if (dayShifts.length === rowCount) {
            dayShifts[dayShifts.length - 1].className = 'no-border';
          }
        });
        $scope.data.employeeCalendarShiftsRowHeight = Math.max(51, (51 * rowCount)) + 'px';

        // Draw Availability
        angular.forEach(response.data.availcalViewDto.availCDTimeFrames, function(availCDTimeFrame) {
          var availStartTimeDayOfWeek = moment.tz(availCDTimeFrame.startDateTime, timezone).format('ddd');
          var availItemObj = composeAvailabilityItem(availCDTimeFrame.availType, availCDTimeFrame);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        angular.forEach(response.data.availcalViewDto.availCITimeFrames, function(availCITimeFrame) {
          var availStartTimeDayOfWeek = availCITimeFrame.dayOfTheWeek.substr(0, 3);
          availStartTimeDayOfWeek = availStartTimeDayOfWeek.charAt(0).toUpperCase() + availStartTimeDayOfWeek.slice(1).toLowerCase();
          var availItemObj = composeAvailabilityItem(availCITimeFrame.availType, availCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarAvailItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarAvailItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight = Math.max(26, (26 * rowCount));

        // Draw Preference
        angular.forEach(response.data.availcalViewDto.prefCDTimeFrames, function(prefCDTimeFrame) {
          var prefStartTimeDayOfWeek = moment.tz(prefCDTimeFrame.startDateTime, timezone).format('ddd');
          var prefItemObj = composePreferenceItem(prefCDTimeFrame.prefType, prefCDTimeFrame);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        angular.forEach(response.data.availcalViewDto.prefCITimeFrames, function(prefCITimeFrame) {
          var prefStartTimeDayOfWeek = prefCITimeFrame.dayOfTheWeek.substr(0, 3);
          prefStartTimeDayOfWeek = prefStartTimeDayOfWeek.charAt(0).toUpperCase() + prefStartTimeDayOfWeek.slice(1).toLowerCase();
          var prefItemObj = composePreferenceItem(prefCITimeFrame.prefType, prefCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarPrefItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarPrefItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += Math.max(26, (26 * rowCount));
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += 'px';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });

      dataService.getEmployeeDetails($scope.data.selectedEligibleEmployee.employeeId).then(function(response) {
        $scope.data.selectedEligibleEmployee.name = response.data.firstName + response.data.lastName;
        $scope.data.selectedEligibleEmployee.homePhone = (response.data.homePhone)? response.data.homePhone: 'N/A';
        $scope.data.selectedEligibleEmployee.cellPhone = (response.data.mobilePhone)? response.data.mobilePhone: 'N/A';
        $scope.data.selectedEligibleEmployee.email = (response.data.workEmail)? response.data.workEmail: 'N/A';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    var initializeCalendarHeaderCells = function() {
      var startDayOfWeek = moment.tz(selectedSchedule.selectedWeek.start, timezone).hours(0).minutes(0).seconds(0).milliseconds(0);
      for (var i=0; i<7; i++) {
        var day = startDayOfWeek.clone().add(i, 'days');
        $scope.data.employeeCalendarHeaderCells.push({dayOfWeek: day.format('ddd'), date: day.format('M/D'), timestamp: day.unix() * 1000});
      }
    };

    var initializeCalendarCells = function() {
      if ($scope.data.selectedOperationType !== 'fillShift') {
        return;
      }
      if ($scope.data.selectedTeam === null || $scope.data.selectedSkill === null) {
        return;
      }
      if ($scope.data.shiftTime.start === null || $scope.data.shiftTime.end === null) {
        return;
      }

      $scope.data.employeeCalendarShifts = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarAvailItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarPrefItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };

      var shiftStartTimeDayOfWeek = moment.tz($scope.data.shiftTime.start, timezone).format('ddd');
      var startTimeStr = moment.tz($scope.data.shiftTime.start, timezone).format('h:mma');
      startTimeStr = startTimeStr.substr(0, startTimeStr.length - 1);
      var endTimeStr = moment.tz($scope.data.shiftTime.end, timezone).format('h:mma');
      endTimeStr = endTimeStr.substr(0, endTimeStr.length - 1);

      var shiftObj = {
        type: 'new-shift',
        start: $scope.data.shiftTime.start,
        end: $scope.data.shiftTime.end,
        timeStr: startTimeStr + '-' + endTimeStr,
        team: $scope.data.selectedTeam[1],
        skill: $scope.data.selectedSkill[1],
        skillAbbrev: $scope.data.selectedSkill[2],
        className: ''
      };
      $scope.data.employeeCalendarShifts[shiftStartTimeDayOfWeek] = [shiftObj];
    };

    $scope.submit = function() {
      var actionStr = '';
      var employeeId = null;
      var shiftInfo = {
        teamId: $scope.data.selectedTeam[0],
        skillId: $scope.data.selectedSkill[0],
        startDateTime: $scope.data.shiftTime.start,
        endDateTime: $scope.data.shiftTime.end
      };

      if ($scope.data.selectedOperationType === 'addAsOpenShift') {
        actionStr = 'CreateAsOpenShift';
      } else if ($scope.data.selectedOperationType === 'postShift') {
        actionStr = 'CreateAndPost';
      } else if ($scope.data.selectedOperationType === 'fillShift') {
        actionStr = 'CreateAndAssign';
        employeeId = $scope.data.selectedEligibleEmployee.employeeId;
      }

      var result = {
        shiftInfo: shiftInfo,
        action: actionStr,
        employeeId: employeeId
      };
      $modalInstance.close(result);
    };

    $scope.close = function() {
      $modalInstance.dismiss('cancel');
    };

    $timeout(function() {
      var startMoment = null;
      var endMoment = null;
      if (viewMode === 'week') {
        startMoment = moment.tz(selectedSchedule.selectedWeek.start, timezone);
        endMoment = moment.tz(selectedSchedule.selectedWeek.end, timezone);
      } else {
        startMoment = moment.tz(selectedSchedule.day.datetimeStamp, timezone).hours(0).minutes(0).seconds(0);
        endMoment = moment.tz(selectedSchedule.day.datetimeStamp, timezone).hours(23).minutes(59).seconds(59);
      }
      $('#start-datetime-picker').datetimepicker();
      $('#end-datetime-picker').datetimepicker();
      $('#start-datetime-picker').data('DateTimePicker').minDate(moment(startMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#start-datetime-picker').data('DateTimePicker').maxDate(moment(endMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#start-datetime-picker').data('DateTimePicker').date(moment(startMoment.clone().hours(8).format('YYYY-MM-DD HH:mm:ss')));
      $('#end-datetime-picker').data('DateTimePicker').date(moment(startMoment.clone().hours(8).format('YYYY-MM-DD HH:mm:ss')));
      $('#end-datetime-picker').data('DateTimePicker').minDate(moment(startMoment.clone().hours(8).format('YYYY-MM-DD HH:mm:ss')));

      var startDateTimeStr = $('#start-datetime-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
      var endDateTimeStr = $('#end-datetime-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
      $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
      $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;

      $('#start-datetime-picker').on('dp.change', function (e) {
        $('#end-datetime-picker').data('DateTimePicker').minDate(false);
        if ($('#end-datetime-picker').data('DateTimePicker').date().unix() < e.date.unix()) {
          $('#end-datetime-picker').data('DateTimePicker').date(e.date.clone());
        }
        $('#end-datetime-picker').data('DateTimePicker').minDate(e.date.clone());
        if ($('#end-datetime-picker').data('DateTimePicker').date().unix() - e.date.unix() > 16 * 3600 ||
          $('#end-datetime-picker').data('DateTimePicker').date().unix() - e.date.unix() === 0) {
          $scope.data.shiftTimeRangeInvalid = true;
          return;
        } else {
          $scope.data.shiftTimeRangeInvalid = false;
        }

        var startDateTimeStr = e.date.format('YYYY-MM-DD HH:mm:ss');
        var endDateTimeStr = $('#end-datetime-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
        $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
        $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;
        $scope.getWipEligibleEmployees();
        initializeCalendarCells();
        $scope.$apply();
      });
      $('#end-datetime-picker').on('dp.change', function (e) {
        if ($('#start-datetime-picker').data('DateTimePicker').date() === null) {
          $('#start-datetime-picker').data('DateTimePicker').date(e.date.clone());
        }
        if (e.date.unix() - $('#start-datetime-picker').data('DateTimePicker').date().unix() > 16 * 3600 ||
          e.date.unix() - $('#start-datetime-picker').data('DateTimePicker').date().unix() === 0) {
          $scope.data.shiftTimeRangeInvalid = true;
          return;
        } else {
          $scope.data.shiftTimeRangeInvalid = false;
        }

        var startDateTimeStr = $('#start-datetime-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
        var endDateTimeStr = e.date.format('YYYY-MM-DD HH:mm:ss');
        $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
        $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;
        $scope.getWipEligibleEmployees();
        initializeCalendarCells();
        $scope.$apply();
      });
    }, 0);
    initializeTeamsSkills();
    initializeCalendarHeaderCells();
  }]);

angular.module('emlogis.employeeSchedules').controller('AssignShiftsPopupModalInstanceCtrl', ['$scope', '$modalInstance', '$timeout', '$filter', 'appFunc', 'applicationContext', 'dataService', 'EmployeeSchedulesService', 'selectedSchedule', 'selectedEmployee',
  function ($scope, $modalInstance, $timeout, $filter, appFunc, applicationContext, dataService, EmployeeSchedulesService, selectedSchedule, selectedEmployee) {
    var siteId = selectedSchedule.siteInfo[0];
    var scheduleId = selectedSchedule.id;
    var timezone = selectedSchedule.siteInfo[2];

    $scope.data = {
      parsedEmployeeInfo: {
        id: selectedEmployee.id,
        name: selectedEmployee.name
      },
      employeeCalendarHeaderCells: [],
      employeeCalendarShifts: {},
      employeeCalendarShiftsRowHeight: '51px',
      employeeCalendarAvailItems: {},
      employeeCalendarAvailItemsRowHeight: '26px',
      employeeCalendarPrefItems: {},
      employeeCalendarPrefItemsRowHeight: '26px',
      employeeCalendarAvailPrefItemsRowHeight: '52px',
      employeeCalendarOpenShifts: {},
      employeeCalendarOpenShiftsRowHeight: '51px',
      selectedOpenShiftId: null,
      openShiftsLoaded: false,
      qualificationSummary: {},
      qualificationSummaryDisplayed: false
    };

    var initializeEmployeeDetails = function() {
      dataService.getEmployeeDetails(selectedEmployee.id).then(function(response) {
        $scope.data.parsedEmployeeInfo.homePhone = (response.data.homePhone)? response.data.homePhone: 'N/A';
        $scope.data.parsedEmployeeInfo.cellPhone = (response.data.mobilePhone)? response.data.mobilePhone: 'N/A';
        $scope.data.parsedEmployeeInfo.email = (response.data.workEmail)? response.data.workEmail: 'N/A';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    var initializeCalendarCells = function() {
      var startDayOfWeek = moment.tz(selectedSchedule.selectedWeek.start, timezone).hours(0).minutes(0).seconds(0).milliseconds(0);
      for (var i=0; i<7; i++) {
        var day = startDayOfWeek.clone().add(i, 'days');
        $scope.data.employeeCalendarHeaderCells.push({dayOfWeek: day.format('ddd'), date: day.format('M/D'), timestamp: day.unix() * 1000});
      }
      $scope.data.employeeCalendarShifts = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarAvailItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarPrefItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
    };

    var composeAvailabilityItem = function(availType, timeFrame) {
      var type = 'avail-item';
      var title = '';
      var className = '';

      if (availType === 'AVAIL') {
        var startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        var endDateTime = moment.tz(timeFrame.endDateTime, timezone);
        var startDateTimeStr = '', endDateTimeStr = '';
        if (startDateTime.minutes() > 0) {
          startDateTimeStr = startDateTime.format('h:mma');
        } else {
          startDateTimeStr = startDateTime.format('ha');
        }
        startDateTimeStr = startDateTimeStr.substr(0, startDateTimeStr.length - 1);
        if (endDateTime.minutes() > 0) {
          endDateTimeStr = endDateTime.format('h:mma');
        } else {
          endDateTimeStr = endDateTime.format('ha');
        }
        endDateTimeStr = endDateTimeStr.substr(0, endDateTimeStr.length - 1);
        title = startDateTimeStr + '-' + endDateTimeStr;
        className = 'partially-available';
      } else if (availType === 'DAY_OFF') {
        if (timeFrame.pto) {
          title = $filter('translate')('availability.PTO_VACATION');
          className = 'holiday-vacation';
        } else {
          title = $filter('translate')('availability.NOT_AVAILABLE');
          className = 'not-available';
        }
      } else {
        title = $filter('translate')('availability.UNKNOWN_AVAILABILITY_TYPE') + ' ' + availType;
      }

      var result = {
        type: type,
        title: title,
        className: className,
        availType: availType,
        start: (availType === 'AVAIL')? timeFrame.startDateTime: null,
        end: (availType === 'AVAIL')? timeFrame.endDateTime: null
      };

      return result;
    };

    var composePreferenceItem = function(prefType, timeFrame) {
      var type = 'pref-item';
      var title = '';
      var className = '';
      var startDateTime = null;
      var endDateTime = null;
      var startDateTimeStr = '', endDateTimeStr = '';

      if (timeFrame.startDateTime && timeFrame.endDateTime) {
        startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        endDateTime = moment.tz(timeFrame.endDateTime, timezone);
      }

      switch (prefType) {
        case 'AVOID_TIMEFRAME':
          if (startDateTime.minutes() > 0) {
            startDateTimeStr = startDateTime.format('h:mma');
          } else {
            startDateTimeStr = startDateTime.format('ha');
          }
          startDateTimeStr = startDateTimeStr.substr(0, startDateTimeStr.length - 1);
          if (endDateTime.minutes() > 0) {
            endDateTimeStr = endDateTime.format('h:mma');
          } else {
            endDateTimeStr = endDateTime.format('ha');
          }
          endDateTimeStr = endDateTimeStr.substr(0, endDateTimeStr.length - 1);
          title = $filter('translate')('availability.AVOID') + ' ' +
            startDateTimeStr + '-' + endDateTimeStr;
          className = 'avoid-time-frame';
          break;
        case 'PREFER_TIMEFRAME':
          if (startDateTime.minutes() > 0) {
            startDateTimeStr = startDateTime.format('h:mma');
          } else {
            startDateTimeStr = startDateTime.format('ha');
          }
          startDateTimeStr = startDateTimeStr.substr(0, startDateTimeStr.length - 1);
          if (endDateTime.minutes() > 0) {
            endDateTimeStr = endDateTime.format('h:mma');
          } else {
            endDateTimeStr = endDateTime.format('ha');
          }
          endDateTimeStr = endDateTimeStr.substr(0, endDateTimeStr.length - 1);
          title = $filter('translate')('availability.PREFER') + ' ' +
            startDateTimeStr + '-' + endDateTimeStr;
          className = 'prefer-time-frame';
          break;
        case 'AVOID_DAY':
          title = $filter('translate')('availability.AVOID_DAY');
          className = 'avoid-day';
          break;
        case 'PREFER_DAY':
          title = $filter('translate')('availability.PREFER_DAY');
          className = 'prefer-day';
          break;
        default:
          title = $filter('translate')('availability.UNKNOWN_PREFERENCE_TYPE') + ' ' + prefType;
      }

      var result = {
        type: type,
        title: title,
        className: className
      };

      return result;
    };

    var drawCalendarContent = function() {
      var rowCount = 0;
      var startTime = selectedSchedule.selectedWeek.start;
      var endTime = selectedSchedule.selectedWeek.end;

      var queryParams = {
        params: {
          startdate: startTime,
          enddate: endTime,
          returnedfields: 'id,startDateTime,endDateTime,excess,skillAbbrev,skillName,teamName,teamAbbrev'
        }
      };
      dataService.getEmployeeCalendarAndAvailabilityView(scheduleId, $scope.data.parsedEmployeeInfo.id, queryParams).then(function(response) {
        // Draw Shifts
        angular.forEach(response.data.shifts.result, function(shift) {
          var shiftStartTimeDayOfWeek = moment.tz(shift[1], timezone).format('ddd');

          var startTimeStr;
          var startTimeMoment = moment.tz(shift[1], timezone);
          if (startTimeMoment.minutes() > 0) {
            startTimeStr = startTimeMoment.format('h:mma');
          } else {
            startTimeStr = startTimeMoment.format('ha');
          }
          startTimeStr = startTimeStr.substr(0, startTimeStr.length - 1);

          var endTimeStr;
          var endTimeMoment = moment.tz(shift[2], timezone);
          if (endTimeMoment.minutes() > 0) {
            endTimeStr = endTimeMoment.format('h:mma');
          } else {
            endTimeStr = endTimeMoment.format('ha');
          }
          endTimeStr = endTimeStr.substr(0, endTimeStr.length - 1);

          var shiftObj = {
            type: 'normal-shift',
            start: shift[1],
            end: shift[2],
            timeStr: startTimeStr + '-' + endTimeStr,
            team: shift[6],
            teamAbbrev: shift[7],
            skill: shift[5],
            skillAbbrev: shift[4],
            className: ''
          };
          $scope.data.employeeCalendarShifts[shiftStartTimeDayOfWeek].push(shiftObj);
        });
        rowCount = _.max($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          return dayShifts.length;
        }).length;
        if (rowCount > 0) {
          angular.forEach($scope.data.employeeCalendarShifts, function(dayShifts, day) {
            if (dayShifts.length === rowCount) {
              dayShifts[dayShifts.length - 1].className = 'no-border';
            }
          });
        }
        $scope.data.employeeCalendarShiftsRowHeight = Math.max(51, (51 * rowCount)) + 'px';

        // Draw Availability
        angular.forEach(response.data.availcalViewDto.availCDTimeFrames, function(availCDTimeFrame) {
          var availStartTimeDayOfWeek = moment.tz(availCDTimeFrame.startDateTime, timezone).format('ddd');
          var availItemObj = composeAvailabilityItem(availCDTimeFrame.availType, availCDTimeFrame);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        angular.forEach(response.data.availcalViewDto.availCITimeFrames, function(availCITimeFrame) {
          var availStartTimeDayOfWeek = availCITimeFrame.dayOfTheWeek.substr(0, 3);
          availStartTimeDayOfWeek = availStartTimeDayOfWeek.charAt(0).toUpperCase() + availStartTimeDayOfWeek.slice(1).toLowerCase();
          var availItemObj = composeAvailabilityItem(availCITimeFrame.availType, availCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarAvailItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarAvailItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight = Math.max(26, (26 * rowCount));

        // Draw Preference
        angular.forEach(response.data.availcalViewDto.prefCDTimeFrames, function(prefCDTimeFrame) {
          var prefStartTimeDayOfWeek = moment.tz(prefCDTimeFrame.startDateTime, timezone).format('ddd');
          var prefItemObj = composePreferenceItem(prefCDTimeFrame.prefType, prefCDTimeFrame);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        angular.forEach(response.data.availcalViewDto.prefCITimeFrames, function(prefCITimeFrame) {
          var prefStartTimeDayOfWeek = prefCITimeFrame.dayOfTheWeek.substr(0, 3);
          prefStartTimeDayOfWeek = prefStartTimeDayOfWeek.charAt(0).toUpperCase() + prefStartTimeDayOfWeek.slice(1).toLowerCase();
          var prefItemObj = composePreferenceItem(prefCITimeFrame.prefType, prefCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarPrefItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarPrefItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += Math.max(26, (26 * rowCount));
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += 'px';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });

      // Draw Open Shifts
      var payLoad = {
        includeConstraintViolationSummary: true,
        maxSynchronousWaitSeconds: 180,
        maxComputationTime: 180,
        maximumUnimprovedSecondsSpent: 100,
        employeeIds: [selectedEmployee.id],
        shiftIds: null,
        startDateTime: startTime,
        endDateTime: endTime
      };
      EmployeeSchedulesService.getEligibilityDataFromSelectedEntities(scheduleId, payLoad).then(function(result) {
        $scope.data.qualificationSummary = result.data.constraintViolationSummary;
        angular.forEach($scope.data.qualificationSummary.constraintViolations, function(violation) {
          violation.shiftStr = moment.tz(violation.shiftStartDateTime, timezone).format('MM/DD/YYYY h:mma') + '-' +
            moment.tz(violation.shiftEndDateTime, timezone).format('h:mma');
        });
        angular.forEach(result.data.openShifts, function(openShift) {
          var startTimeDayOfWeek = moment.tz(openShift.startDateTime, timezone).format('ddd');
          if (typeof $scope.data.employeeCalendarOpenShifts[startTimeDayOfWeek] === 'undefined') {
            $scope.data.employeeCalendarOpenShifts[startTimeDayOfWeek] = [];
          }

          $scope.data.employeeCalendarOpenShifts[startTimeDayOfWeek].push(parseOpenShift(openShift));
        });

        $scope.data.openShiftsLoaded = true;
        rowCount = _.max($scope.data.employeeCalendarOpenShifts, function(dayShifts, day) {
          return dayShifts.length;
        }).length;
        $scope.data.employeeCalendarOpenShiftsRowHeight = Math.max(51, (51 * rowCount)) + 'px';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    function parseOpenShift(openShift) {
      var dayInMilliseconds = 24 * 3600000;
      var startTimeMoment = moment.tz(openShift.startDateTime, timezone);
      var endTimeMoment = moment.tz(openShift.endDateTime, timezone);

      var timeStr = appFunc.toShortest12TimeFormat(startTimeMoment) + '-' + appFunc.toShortest12TimeFormat(endTimeMoment);

      var startTimeOffSetPercentInDay =
          (((startTimeMoment.hours() * 3600 + startTimeMoment.minutes() * 60 + startTimeMoment.seconds()) * 1000
          + startTimeMoment.milliseconds())/dayInMilliseconds) * 100;
      var tooltipPositionStr = startTimeOffSetPercentInDay <= 50 ? 'right' : 'left';
      startTimeOffSetPercentInDay += '%';

      var lengthPercentInDay = ((openShift.endDateTime - openShift.startDateTime)/dayInMilliseconds) * 100 + "%";

      var shiftObj = {
        id: openShift.id,
        type: 'open',
        employeeId: null,
        excessType: openShift.excess ? 'extra' : 'regular',
        excessTypeStr: openShift.excess ? 'Extra' : '',
        start: openShift.startDateTime,
        end: openShift.endDateTime,
        timeStr: timeStr,
        startTimeOffSetPercentInDay: startTimeOffSetPercentInDay,
        tooltipPositionInDay: tooltipPositionStr,
        lengthPercentInDay: lengthPercentInDay,
        skillId: openShift.skillId,
        skillName: openShift.skillName,
        skillAbbrev: openShift.skillAbbrev,
        assignment: 'Assignment',
        teamId: openShift.teamId,
        teamName: openShift.teamName,
        teamAbbrev: openShift.teamAbbrev,
        posted: '',
        requested: '',
        comment: null,
        commentClass: '',
        external: false,
        filterPassed: true,
        overtime: 0,
        cost: 0
      };
      return shiftObj;
    }

    $scope.toggleQualificationSummary = function() {
      $scope.data.qualificationSummaryDisplayed = !$scope.data.qualificationSummaryDisplayed;
    };

    var validateOpenShiftTick = function(openShift, dayOfWeek) {
      var foundIndex = _.findIndex($scope.data.employeeCalendarShifts[dayOfWeek], function(shiftIterator) {
        return (shiftIterator.type !== 'new-shift' && (shiftIterator.end > openShift.start && shiftIterator.start < openShift.end));
      });

      if (foundIndex < 0) {
        foundIndex = _.findIndex($scope.data.employeeCalendarAvailItems[dayOfWeek], function(itemIterator) {
          return (itemIterator.availType === 'DAY_OFF' || (itemIterator.end > openShift.start && itemIterator.start < openShift.end));
        });
      }

      return (foundIndex < 0);
    };

    var updateEmployeeCalendarShifts = function(openShift, dayOfWeek) {
      if (openShift.ticked) {
        angular.forEach($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          _.remove(dayShifts, function(shiftIterator) {
            return (shiftIterator.type === 'new-shift');
          });
        });
        var addedOpenShift = angular.copy(openShift);
        addedOpenShift.type = 'new-shift';
        $scope.data.employeeCalendarShifts[dayOfWeek].push(addedOpenShift);
      } else {
        _.remove($scope.data.employeeCalendarShifts[dayOfWeek], function(shiftIterator) {
          return (shiftIterator.id === openShift.id);
        });
      }
      var rowCount = _.max($scope.data.employeeCalendarShifts, function(dayShifts, day) {
        return dayShifts.length;
      }).length;
      if (rowCount > 0) {
        angular.forEach($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          angular.forEach(dayShifts, function(dayShift) {
            dayShift.className = '';
          });
          if (dayShifts.length === rowCount) {
            dayShifts[dayShifts.length - 1].className = 'no-border';
          }
        });
      }
      $scope.data.employeeCalendarShiftsRowHeight = Math.max(51, (51 * rowCount)) + 'px';
    };

    $scope.tickOpenShift = function(openShift, dayOfWeek) {
      if ((!openShift.ticked /*&& validateOpenShiftTick(openShift, dayOfWeek)*/) || openShift.ticked) {
        angular.forEach($scope.data.employeeCalendarOpenShifts, function(dayOpenShifts, day) {
          angular.forEach(dayOpenShifts, function(dayOpenShift) {
            if (dayOpenShift.id !== openShift.id) {
              dayOpenShift.ticked = false;
            }
          });
        });
        openShift.ticked = !openShift.ticked;
        updateEmployeeCalendarShifts(openShift, dayOfWeek);
        $scope.data.selectedOpenShiftId = (openShift.ticked)? openShift.id: null;
      }
    };

    $scope.submit = function() {
      var result = {
        selectedOpenShiftId: $scope.data.selectedOpenShiftId
      };
      $modalInstance.close(result);
    };

    $scope.close = function() {
      $modalInstance.dismiss('cancel');
    };

    initializeEmployeeDetails();
    initializeCalendarCells();
    drawCalendarContent();
  }]);

angular.module('emlogis.employeeSchedules').controller('FillShiftPopupModalInstanceCtrl', ['$scope', '$modalInstance', '$timeout', '$filter', 'applicationContext', 'dataService', 'EmployeeSchedulesService', 'viewMode', 'selectedSchedule', 'selectedOpenShift',
  function ($scope, $modalInstance, $timeout, $filter, applicationContext, dataService, EmployeeSchedulesService, viewMode, selectedSchedule, selectedOpenShift) {
    var siteId = selectedSchedule.siteInfo[0];
    var scheduleId = selectedSchedule.id;
    var timezone = selectedSchedule.siteInfo[2];
    var teams = [];

    $scope.data = {
      selectedScheduleStatus: selectedSchedule.status,
      teams: _.filter(selectedSchedule.teamsInfo.result, function(teamInfo) {
        var isHomeTeam = teamInfo[2];
        return !isHomeTeam;
      }),
      skills: [],
      selectedTeam: null,
      selectedSkill: null,
      shiftTime: {
        start: null,
        end: null
      },
      shiftTimeRangeInvalid: false,
      selectedOpenShift: angular.copy(selectedOpenShift),
      selectedOperationType: 'saveShift',
      qualificationSummary: {},
      qualificationSummaryDisplayed: false,
      selectedEligibleEmployee: null,
      eligibleEmployees: [],
      eligibleEmployeesLoaded: true,
      showAvailableOnly: true,
      employeeCalendarHeaderCells: [],
      employeeCalendarShifts: {},
      employeeCalendarShiftsRowHeight: '51px',
      employeeCalendarAvailItems: {},
      employeeCalendarAvailItemsRowHeight: '26px',
      employeeCalendarPrefItems: {},
      employeeCalendarPrefItemsRowHeight: '26px',
      sortOption: 'sortByName'
    };

    function nameComparator(firstEntity, secondEntity) {
      if (firstEntity[1] < secondEntity[1]) {
        return -1;
      } else if (firstEntity[1] > secondEntity[1]) {
        return 1;
      } else {
        return 0;
      }
    }

    $scope.data.teams.sort(nameComparator);

    var initializeTeamsSkills = function() {
      dataService.getSitesTeamsTree({}).then(function(response) {
        var currentTeamIndexOfSelectedShift = _.findIndex($scope.data.teams, function(team) {
          return (team[1] === $scope.data.selectedOpenShift.teamName);
        });
        $scope.data.selectedTeam = $scope.data.teams[currentTeamIndexOfSelectedShift];

        teams = _.result(_.find(response.data, function(site) {return site.id === siteId;}), 'children');

        var currentTeamOfSelectedShift = _.find(teams, 'name', $scope.data.selectedOpenShift.teamName);
        $scope.data.skills = _.filter(selectedSchedule.skillsInfo.result, function(skillInfo) {
          return (skillInfo[3] && _.findIndex(currentTeamOfSelectedShift.children, function(skill) {
            return (skill.id === skillInfo[0]);
          }) > -1);
        });
        $scope.data.skills.sort(nameComparator);

        var currentSkillIndexOfSelectedShift = _.findIndex($scope.data.skills, function(skill) {
          return (skill[1] === $scope.data.selectedOpenShift.skillName);
        });
        $scope.data.selectedSkill = $scope.data.skills[currentSkillIndexOfSelectedShift];
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    $scope.onSelectedTeamChanged = function() {
      if ($scope.data.selectedTeam === null) {
        $scope.data.skills = [];
      } else {
        var selectedTeamId = $scope.data.selectedTeam[0];
        var selectedTeam = _.find(teams, function(team) {return team.id === selectedTeamId;});
        $scope.data.skills = _.filter(selectedSchedule.skillsInfo.result, function(skillInfo) {
          return (skillInfo[3] && _.findIndex(selectedTeam.children, function(skill) {
            return (skill.id === skillInfo[0]);
          }) > -1);
        });
        $scope.data.skills.sort(nameComparator);
      }
      $scope.data.selectedSkill = null;
      $scope.data.eligibleEmployees = [];
    };

    $scope.onSelectedSkillChanged = function() {
      if ($scope.data.selectedSkill === null) {
        $scope.data.eligibleEmployees = [];
        return;
      }
      $scope.getWipEligibleEmployees();
      initializeCalendarCells();
    };

    $scope.onFillShiftSelected = function() {
      $scope.getWipEligibleEmployees();
      initializeCalendarCells();
    };

    $scope.canShowFooterContent = function() {
      return ($scope.data.selectedTeam !== null && $scope.data.selectedSkill !== null &&
        $scope.data.shiftTime.start !== null && $scope.data.selectedOperationType === 'fillShift' &&
        $scope.data.selectedEligibleEmployee !== null);
    };

    $scope.checkIfPastShift = function(shift) {
      var nowDateTimeStamp = moment.tz(new Date().getTime(), timezone).unix() * 1000;
      return (nowDateTimeStamp > shift.start);
    };

    var calculateEmployeesInfo = function() {
      angular.forEach($scope.data.eligibleEmployees, function(employee) {
        var foundEmployee = _.find(selectedSchedule.employeesInfo.result, function(iteratee) {
          return (iteratee.id === employee.employeeId);
        });
        var hoursOfEmployee = 0;
        angular.forEach(selectedSchedule.selectedWeek.shifts.employeeShifts[employee.employeeId], function(dateShifts, calendarDate) {
          angular.forEach(dateShifts, function(shift) {
            var shiftDurationInHours = (shift.end - shift.start)/3600000;
            hoursOfEmployee += shiftDurationInHours;
          });
        });
        var costOfEmployee = foundEmployee[3] * hoursOfEmployee;
        employee.hours = hoursOfEmployee;
        employee.cost = costOfEmployee;
      });
    };

    var comparator = function(firstElement, secondElement) {
      var firstValue = null;
      var secondValue = null;

      if ($scope.data.sortOption === 'sortByName') {
        firstValue = firstElement.employeeName;
        secondValue = secondElement.employeeName;
      } else if ($scope.data.sortOption === 'leastHoursFirst') {
        firstValue = firstElement.hours;
        secondValue = secondElement.hours;
      } else if ($scope.data.sortOption === 'leastCostFirst') {
        firstValue = firstElement.cost;
        secondValue = secondElement.cost;
      }

      if (firstValue < secondValue) {
        return -1;
      } else if (firstValue > secondValue) {
        return 1;
      } else {
        return 0;
      }
    };

    $scope.setSortOption = function(option) {
      $scope.data.sortOption = option;
      $scope.data.eligibleEmployees.sort(comparator);
    };

    $scope.getWipEligibleEmployees = function() {
      $scope.data.eligibleEmployees = [];
      $scope.data.selectedEligibleEmployee = null;

      if ($scope.data.selectedOperationType !== 'fillShift') {
        return;
      }
      if ($scope.data.selectedTeam === null || $scope.data.selectedSkill === null) {
        return;
      }
      if ($scope.data.shiftTime.start === null || $scope.data.shiftTime.end === null) {
        return;
      }

      $scope.data.eligibleEmployeesLoaded = false;
      var overrideOptions = null;

      if (!$scope.data.showAvailableOnly) {
        overrideOptions = {
          ALL_DAY_UNAVAILABLE_OVERRIDE: true,
          TIME_WINDOW_UNAVAILABLE_OVERRIDE: true
        };
      }

      var shiftInfo = {
        teamId: $scope.data.selectedTeam[0],
        skillId: $scope.data.selectedSkill[0],
        start: $scope.data.shiftTime.start,
        end: $scope.data.shiftTime.end
      };

      dataService.getWipEligibleEmployeesForProposedOpenShift(scheduleId, shiftInfo, overrideOptions).then(function(result) {
        $scope.data.eligibleEmployees = result.data.eligibleEmployees;
        $scope.data.qualificationSummary = result.data.constraintViolationSummary;
        calculateEmployeesInfo();
        $scope.setSortOption('sortByName');
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      }).finally(function() {
        $scope.data.eligibleEmployeesLoaded = true;
      });
    };

    $scope.toggleQualificationSummary = function() {
      $scope.data.qualificationSummaryDisplayed = !$scope.data.qualificationSummaryDisplayed;
    };

    var composeAvailabilityItem = function(availType, timeFrame) {
      var type = 'avail-item';
      var title = '';
      var className = '';

      if (availType === 'AVAIL') {
        var startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        var endDateTime = moment.tz(timeFrame.endDateTime, timezone);

        title = startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
        className = 'partially-available';
      } else if (availType === 'DAY_OFF') {
        if (timeFrame.pto) {
          title = $filter('translate')('availability.PTO_VACATION');
          className = 'holiday-vacation';
        } else {
          title = $filter('translate')('availability.NOT_AVAILABLE');
          className = 'not-available';
        }
      } else {
        title = $filter('translate')('availability.UNKNOWN_AVAILABILITY_TYPE') + ' ' + availType;
      }

      var result = {
        type: type,
        title: title,
        className: className
      };

      return result;
    };

    var composePreferenceItem = function(prefType, timeFrame) {
      var type = 'pref-item';
      var title = '';
      var className = '';
      var startDateTime = null;
      var endDateTime = null;

      if (timeFrame.startDateTime && timeFrame.endDateTime) {
        startDateTime = moment.tz(timeFrame.startDateTime, timezone);
        endDateTime = moment.tz(timeFrame.endDateTime, timezone);
      }

      switch (prefType) {
        case 'AVOID_TIMEFRAME':
          title = $filter('translate')('availability.AVOID') + ' ' +
            startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
          className = 'avoid-time-frame';
          break;
        case 'PREFER_TIMEFRAME':
          title = $filter('translate')('availability.PREFER') + ' ' +
            startDateTime.format('h:mma') + '-' + endDateTime.format('h:mma');
          className = 'prefer-time-frame';
          break;
        case 'AVOID_DAY':
          title = $filter('translate')('availability.AVOID_DAY');
          className = 'avoid-day';
          break;
        case 'PREFER_DAY':
          title = $filter('translate')('availability.PREFER_DAY');
          className = 'prefer-day';
          break;
        default:
          title = $filter('translate')('availability.UNKNOWN_PREFERENCE_TYPE') + ' ' + prefType;
      }

      var result = {
        type: type,
        title: title,
        className: className
      };

      return result;
    };

    $scope.deleteOS = function() {
      var result = {
        shiftId: selectedOpenShift.id,
        action: 'Delete'
      };
      $modalInstance.close(result);
    };

    $scope.onSelectedEligibleEmployeeChanged = function() {
      initializeCalendarCells();
      if ($scope.data.selectedEligibleEmployee === null) {
        return;
      }

      var rowCount = 0;
      var startTime = selectedSchedule.selectedWeek.start;
      var endTime = selectedSchedule.selectedWeek.end;

      var queryParams = {
        params: {
          startdate: startTime,
          enddate: endTime,
          returnedfields: 'id,startDateTime,endDateTime,excess,skillAbbrev,skillName,teamName'
        }
      };
      dataService.getEmployeeCalendarAndAvailabilityView(scheduleId, $scope.data.selectedEligibleEmployee.employeeId, queryParams).then(function(response) {
        // Draw Shifts
        angular.forEach(response.data.shifts.result, function(shift) {
          var shiftStartTimeDayOfWeek = moment.tz(shift[1], timezone).format('ddd');
          var startTimeStr = moment.tz(shift[1], timezone).format('h:mma');
          startTimeStr = startTimeStr.substr(0, startTimeStr.length - 1);
          var endTimeStr = moment.tz(shift[2], timezone).format('h:mma');
          endTimeStr = endTimeStr.substr(0, endTimeStr.length - 1);

          var shiftObj = {
            type: 'normal-shift',
            start: shift[1],
            end: shift[2],
            timeStr: startTimeStr + '-' + endTimeStr,
            team: shift[6],
            skill: shift[5],
            skillAbbrev: shift[4],
            className: ''
          };
          $scope.data.employeeCalendarShifts[shiftStartTimeDayOfWeek].push(shiftObj);
        });
        rowCount = _.max($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          return dayShifts.length;
        }).length;
        angular.forEach($scope.data.employeeCalendarShifts, function(dayShifts, day) {
          if (dayShifts.length === rowCount) {
            dayShifts[dayShifts.length - 1].className = 'no-border';
          }
        });
        $scope.data.employeeCalendarShiftsRowHeight = Math.max(51, (51 * rowCount)) + 'px';

        // Draw Availability
        angular.forEach(response.data.availcalViewDto.availCDTimeFrames, function(availCDTimeFrame) {
          var availStartTimeDayOfWeek = moment.tz(availCDTimeFrame.startDateTime, timezone).format('ddd');
          var availItemObj = composeAvailabilityItem(availCDTimeFrame.availType, availCDTimeFrame);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        angular.forEach(response.data.availcalViewDto.availCITimeFrames, function(availCITimeFrame) {
          var availStartTimeDayOfWeek = availCITimeFrame.dayOfTheWeek.substr(0, 3);
          availStartTimeDayOfWeek = availStartTimeDayOfWeek.charAt(0).toUpperCase() + availStartTimeDayOfWeek.slice(1).toLowerCase();
          var availItemObj = composeAvailabilityItem(availCITimeFrame.availType, availCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarAvailItems[availStartTimeDayOfWeek].push(availItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarAvailItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarAvailItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight = Math.max(26, (26 * rowCount));

        // Draw Preference
        angular.forEach(response.data.availcalViewDto.prefCDTimeFrames, function(prefCDTimeFrame) {
          var prefStartTimeDayOfWeek = moment.tz(prefCDTimeFrame.startDateTime, timezone).format('ddd');
          var prefItemObj = composePreferenceItem(prefCDTimeFrame.prefType, prefCDTimeFrame);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        angular.forEach(response.data.availcalViewDto.prefCITimeFrames, function(prefCITimeFrame) {
          var prefStartTimeDayOfWeek = prefCITimeFrame.dayOfTheWeek.substr(0, 3);
          prefStartTimeDayOfWeek = prefStartTimeDayOfWeek.charAt(0).toUpperCase() + prefStartTimeDayOfWeek.slice(1).toLowerCase();
          var prefItemObj = composePreferenceItem(prefCITimeFrame.prefType, prefCITimeFrame.timeFrameInstances[0]);
          $scope.data.employeeCalendarPrefItems[prefStartTimeDayOfWeek].push(prefItemObj);
        });
        rowCount = _.max($scope.data.employeeCalendarPrefItems, function(dayItems, day) {
          return dayItems.length;
        }).length;
        $scope.data.employeeCalendarPrefItemsRowHeight = Math.max(26, (26 * rowCount)) + 'px';
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += Math.max(26, (26 * rowCount));
        $scope.data.employeeCalendarAvailPrefItemsRowHeight += 'px';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });

      dataService.getEmployeeDetails($scope.data.selectedEligibleEmployee.employeeId).then(function(response) {
        $scope.data.selectedEligibleEmployee.name = response.data.firstName + response.data.lastName;
        $scope.data.selectedEligibleEmployee.homePhone = (response.data.homePhone)? response.data.homePhone: 'N/A';
        $scope.data.selectedEligibleEmployee.cellPhone = (response.data.mobilePhone)? response.data.mobilePhone: 'N/A';
        $scope.data.selectedEligibleEmployee.email = (response.data.workEmail)? response.data.workEmail: 'N/A';
      }, function(err) {
        applicationContext.setNotificationMsgWithValues(err.data.message || JSON.stringify(err.data), 'danger', true);
      });
    };

    var initializeCalendarHeaderCells = function() {
      var startDayOfWeek = moment.tz(selectedSchedule.selectedWeek.start, timezone).hours(0).minutes(0).seconds(0).milliseconds(0);
      for (var i=0; i<7; i++) {
        var day = startDayOfWeek.clone().add(i, 'days');
        $scope.data.employeeCalendarHeaderCells.push({dayOfWeek: day.format('ddd'), date: day.format('M/D'), timestamp: day.unix() * 1000});
      }
    };

    var initializeCalendarCells = function() {
      if ($scope.data.selectedOperationType !== 'fillShift') {
        return;
      }
      if ($scope.data.selectedTeam === null || $scope.data.selectedSkill === null) {
        return;
      }
      if ($scope.data.shiftTime.start === null || $scope.data.shiftTime.end === null) {
        return;
      }

      $scope.data.employeeCalendarShifts = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarAvailItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };
      $scope.data.employeeCalendarPrefItems = { Sun: [], Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [] };

      var shiftStartTimeDayOfWeek = moment.tz(selectedOpenShift.start, timezone).format('ddd');
      var startTimeStr = moment.tz(selectedOpenShift.start, timezone).format('h:mma');
      startTimeStr = startTimeStr.substr(0, startTimeStr.length - 1);
      var endTimeStr = moment.tz(selectedOpenShift.end, timezone).format('h:mma');
      endTimeStr = endTimeStr.substr(0, endTimeStr.length - 1);

      var shiftObj = {
        type: 'new-shift',
        start: selectedOpenShift.start,
        end: selectedOpenShift.end,
        timeStr: startTimeStr + '-' + endTimeStr,
        team: selectedOpenShift.teamName,
        skill: selectedOpenShift.skillName,
        skillAbbrev: selectedOpenShift.skillAbbrev,
        className: ''
      };
      $scope.data.employeeCalendarShifts[shiftStartTimeDayOfWeek] = [shiftObj];
    };

    $scope.submit = function() {
      var actionStr = '';
      var employeeId = null;
      var shiftInfo = {
        teamId: $scope.data.selectedTeam[0],
        skillId: $scope.data.selectedSkill[0],
        newStartDateTime: $scope.data.shiftTime.start,
        newEndDateTime: $scope.data.shiftTime.end
      };

      if ($scope.data.selectedOperationType === 'saveShift') {
        actionStr = 'Edit';
      } else if ($scope.data.selectedOperationType === 'postShift') {
        actionStr = 'Post';
      } else if ($scope.data.selectedOperationType === 'fillShift') {
        actionStr = 'Assign';
        employeeId = $scope.data.selectedEligibleEmployee.employeeId;
      }

      var result = {
        shiftInfo: shiftInfo,
        action: actionStr,
        employeeId: employeeId
      };
      $modalInstance.close(result);
    };

    $scope.close = function() {
      $modalInstance.dismiss('cancel');
    };

    $timeout(function() {
      var startMoment = null;
      var endMoment = null;
      if (viewMode === 'week') {
        startMoment = moment.tz(selectedSchedule.selectedWeek.start, timezone);
        endMoment = moment.tz(selectedSchedule.selectedWeek.end, timezone);
      } else {
        startMoment = moment.tz(selectedSchedule.day.datetimeStamp, timezone).hours(0).minutes(0).seconds(0);
        endMoment = moment.tz(selectedSchedule.day.datetimeStamp, timezone).hours(23).minutes(59).seconds(59);
      }
      var selectedOpenShiftStartMoment = moment.tz(selectedOpenShift.start, timezone);
      var selectedOpenShiftEndMoment = moment.tz(selectedOpenShift.end, timezone);
      var startTimeStr = '', endTimeStr = '';
      startTimeStr = selectedOpenShiftStartMoment.format('MM/DD/YYYY h:mma');
      endTimeStr = selectedOpenShiftEndMoment.format('h:mma');
      $scope.data.selectedOpenShift.timeStr = startTimeStr + '-' + endTimeStr;

      $('#start-picker').datetimepicker();
      $('#end-picker').datetimepicker();
      $('#start-picker').data('DateTimePicker').minDate(moment(startMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#start-picker').data('DateTimePicker').maxDate(moment(endMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#start-picker').data('DateTimePicker').date(moment(selectedOpenShiftStartMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#end-picker').data('DateTimePicker').date(moment(selectedOpenShiftEndMoment.format('YYYY-MM-DD HH:mm:ss')));
      $('#end-picker').data('DateTimePicker').minDate(moment(selectedOpenShiftStartMoment.format('YYYY-MM-DD HH:mm:ss')));

      var startDateTimeStr = $('#start-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
      var endDateTimeStr = $('#end-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
      $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
      $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;

      $('#start-picker').on('dp.change', function (e) {
        $('#end-picker').data('DateTimePicker').minDate(false);
        if ($('#end-picker').data('DateTimePicker').date().unix() < e.date.unix()) {
          $('#end-picker').data('DateTimePicker').date(e.date.clone());
        }
        $('#end-picker').data('DateTimePicker').minDate(e.date.clone());
        if ($('#end-picker').data('DateTimePicker').date().unix() - e.date.unix() > 16 * 3600 ||
          $('#end-picker').data('DateTimePicker').date().unix() - e.date.unix() === 0) {
          $scope.data.shiftTimeRangeInvalid = true;
          return;
        } else {
          $scope.data.shiftTimeRangeInvalid = false;
        }

        var startDateTimeStr = e.date.format('YYYY-MM-DD HH:mm:ss');
        var endDateTimeStr = $('#end-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
        $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
        $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;
        $scope.getWipEligibleEmployees();
        initializeCalendarCells();
        $scope.$apply();
      });
      $('#end-picker').on('dp.change', function (e) {
        if ($('#start-picker').data('DateTimePicker').date() === null) {
          $('#start-picker').data('DateTimePicker').date(e.date.clone());
        }
        if (e.date.unix() - $('#start-picker').data('DateTimePicker').date().unix() > 16 * 3600 ||
          e.date.unix() - $('#start-picker').data('DateTimePicker').date().unix() === 0) {
          $scope.data.shiftTimeRangeInvalid = true;
          return;
        } else {
          $scope.data.shiftTimeRangeInvalid = false;
        }

        var startDateTimeStr = $('#start-picker').data('DateTimePicker').date().format('YYYY-MM-DD HH:mm:ss');
        var endDateTimeStr = e.date.format('YYYY-MM-DD HH:mm:ss');
        $scope.data.shiftTime.start = moment.tz(startDateTimeStr, timezone).unix() * 1000;
        $scope.data.shiftTime.end = moment.tz(endDateTimeStr, timezone).unix() * 1000;
        $scope.getWipEligibleEmployees();
        initializeCalendarCells();
        $scope.$apply();
      });
    }, 0);

    initializeTeamsSkills();
    initializeCalendarHeaderCells();
  }]);
