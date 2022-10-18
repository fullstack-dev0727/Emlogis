var home = angular.module('emlogis.reports');

home.controller('ReportsCtrl', [
  '$scope',
  '$state',
  'ReportsiHubService',
  'ReportsService',
  'applicationContext',
  'angularLoad',
  function ($scope,
            $state,
            ReportsiHubService,
            ReportsService,
            applicationContext,
            angularLoad) {

    $scope.tabs = [];

    $scope.goState = function (tab) {
      $state.go.apply(this, tab.route);
    };

    $scope.active = function (route) {
      return $state.includes.apply(this, route);
    };

    $scope.$on("$stateChangeSuccess", function () {
      $scope.tabs.forEach(function (tab) {
        tab.active = $scope.active(tab.route);
      });
    });

    $scope.loadingReportsList = true;

    ReportsService.getIhubProperties().then(function (res) {
      ReportsiHubService.setIhubUrl(res.data.proxyHost, res.data.proxyIportalPort);
      ReportsService.loadJsapiPromise = angularLoad.loadScript(ReportsiHubService.getIhubUrl() + '/jsapi').then(function () {
        console.log("jsapi loaded ok");
        ReportsService.loginIntoIhub();
      }).catch(function () {
        applicationContext.setNotificationMsgWithValues('Cannot connect to IHub', 'danger', true);
        console.log("! jsapi load failed ");
        $scope.loadingReportsList = false;
      });
    }, function (err) {
      applicationContext.setNotificationMsgWithValues(err.data.message, 'danger', true, err.statusText);
    });

    loadReportsList();

    function loadReportsList() {
      ReportsService.reportsConfigPromise = ReportsService.loadReportsConfig().then(function (res) {
        ReportsService.setReportsConfig(res.data);
        $scope.loadingReportsList = false;
        var groups = res.data.groups;
        angular.forEach(groups, function (val, key) {
          var tab = {
            heading: val.heading,
            route: ['authenticated.reports.group', {groupId: val.id}]
          };
          $scope.tabs.push(tab);

        });
      });
    }


  }
]);

/*
* Directive to validadate timeframe parameters
* */
home.directive('timeframe', ['ReportsService', function (ReportsService) {
  var startTimeParamName = "StartTime";
  var endTimeParamName = "EndTime";
  var requiredTimeFormat = "h:mm:ss A";

  function storeParam(name, value, ngModel) {
    ReportsService.StoredReportParameters.put(
        name,
        {
          val: value,
          model: ngModel
        }
    );
    return ReportsService.StoredReportParameters.all();
  }

  /**
   * parse time string like to millis
   */
  function parseTime(timeStr, format) {
    var defaultTimeFormat = "hh:mm:ss";
    var momentDateTime = moment(timeStr, format || defaultTimeFormat, true);
    if (!momentDateTime.isValid()) {
      return NaN;
    }
    var dt = momentDateTime.toDate();
    return dt.getHours() * 60 * 60 * 1000 + dt.getMinutes() * 60 * 1000 + dt.getSeconds() * 1000;
  }

  function isValidTime(time) {
    return !isNaN(time);
  }

  function isValidTimeInterval(startTime, entTime) {
    return startTime && entTime && startTime <= entTime;
  }

  function validateParams(values) {
    var startTimeParam = values[startTimeParamName];
    var endTimeParam = values[endTimeParamName];

    if(!startTimeParam || !endTimeParam) {
      return;
    }

    var isValid = isValidTimeInterval(startTimeParam.val, endTimeParam.val);
    startTimeParam.model.$setValidity('timeframe', isValid);
    endTimeParam.model.$setValidity('timeframe', isValid);
  }

  return {
    require: 'ngModel',
    link: function (scope, elem, attr, ngModel) {
      var name = attr.name;
      if (name === startTimeParamName || name === endTimeParamName) {
        ngModel.$formatters.unshift(onValueChanged);
      }

      function onValueChanged(value) {
        var time = parseTime(value ? value.Value : "", requiredTimeFormat);
        if(!isValidTime(time)) {
          return;
        }
        var storedParams = storeParam(name, time, ngModel);
        validateParams(storedParams);
        return value;
      }
    }
  };
}]);

home.directive('dateInterval', ['ReportsService', function (ReportsService) {
  var startDateParamName = "StartDate";
  var endDateParamName = "EndDate";

  function storeParam(name, value, ngModel) {
    ReportsService.StoredReportParameters.put(
        name,
        {
          val: value,
          model: ngModel
        }
    );
    return ReportsService.StoredReportParameters.all();
  }

  function validateParams(values) {
    var startDate = values[startDateParamName];
    var endDate = values[endDateParamName];
    if(!startDate || !endDate) {
      return;
    }
    var isValidInterval = isValidDatesInterval(startDate.val, endDate.val);
    startDate.model.$setValidity('dateInterval', isValidInterval);
    endDate.model.$setValidity('dateInterval', isValidInterval);
  }

  function isValidDate(date) {
    return date && (date !== "Invalid Date") && (date instanceof Date);
  }

  function isValidDatesInterval(startDate, endDate) {
    return startDate <= endDate;
  }

  return {
    require: 'ngModel',
    link: function (scope, elem, attr, ngModel) {
      var name = attr.name;
      var datePattern = attr.datepickerPopup;

      if (name === startDateParamName || name === endDateParamName) {
        ngModel.$parsers.unshift(onValueChanged);
        ngModel.$formatters.unshift(onValueChanged);
      }

      function onValueChanged(value) {
        datePattern = datePattern ? datePattern : "";
        var date = moment(value, datePattern.toUpperCase()).toDate();
        if(!isValidDate(date)) {
          return value;
        }
        var storedDateParams = storeParam(name, date.getTime(), ngModel);
        validateParams(storedDateParams);
        return value;
      }
    }
  };
}]);

