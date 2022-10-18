angular.module('emlogis.employeeSchedules')
  .service('EmployeeSchedulesService', ['$http', 'applicationContext', 'UtilsService',
    function($http, applicationContext, UtilsService) {
      var baseUrl = applicationContext.getBaseRestUrl();

      function sendRequest(urlPart, method, requestPayload) {
        var apiUrl = baseUrl + urlPart;
        var req = {
          method: method,
          url: apiUrl
        };
        if (method === 'POST' || method === 'PUT') {
          req.data = requestPayload;
        }

        return $http(req);
      }

      this.getSiteSchedules = function(selectedSite) {
        var urlPart = 'sites/' + selectedSite.id + '/schedules?limit=200';

        return sendRequest(urlPart, 'GET', null);
      };

      this.getScheduleForWeekView = function(scheduleId) {
        var urlPart = 'schedules/' + scheduleId + '/scheduleview';

        return sendRequest(urlPart, 'GET', null);
      };

      this.getScheduleForDayView = function(scheduleId, datetimeStamp, shiftsOnly) {
        var urlPart = 'schedules/' + scheduleId + '/scheduledayview?date=' + datetimeStamp + '&shiftsonly=' + shiftsOnly;

        return sendRequest(urlPart, 'GET', null);
      };

      this.getScheduleStatistics = function(scheduleId) {
        var urlPart = 'schedules/' + scheduleId + '/statistics';

        return sendRequest(urlPart, 'GET', null);
      };

      this.getOpenShifts = function(scheduleId, startDate, endDate) {
        var urlPart = 'schedules/' + scheduleId + '/openshifts?startdate=' + startDate + '&enddate=' + endDate;

        return sendRequest(urlPart, 'GET', null);
      };

      this.getEligibilityDataFromSelectedEntities = function(scheduleId, payLoad) {
        var urlPart = 'schedules/' + scheduleId + '/ops/getopenshifteligibilitysimple?asstring=false';

        return sendRequest(urlPart, 'POST', payLoad);
      };

      this.getOverrideOptions = function(siteId) {
        var urlPart = 'sites/' + siteId + '/postoverrides/default';

        return sendRequest(urlPart, 'GET', null);
      };

      this.updateOverrideOptions = function(siteId, overrideOptions) {
        var urlPart = 'sites/' + siteId + '/postoverrides/default';
        var payLoad = {
          clName: 'PostOverrides',
          name: 'default',
          overrideOptions: overrideOptions
        };

        return sendRequest(urlPart, 'PUT', payLoad);
      };

      this.postOpenShifts = function(scheduleId, payLoad) {
        var urlPart = 'schedules/' + scheduleId + '/postedopenshifts';

        return sendRequest(urlPart, 'POST', payLoad);
      };

      this.getPostedOpenShifts = function(scheduleId) {
        var urlPart = 'schedules/' + scheduleId + '/postedopenshifts';

        return sendRequest(urlPart, 'GET', null);
      };
    }
  ]);