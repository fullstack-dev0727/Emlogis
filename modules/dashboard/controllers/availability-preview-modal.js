angular.module('emlogis.dashboard').controller('AvailabilityPreviewModalCtrl',
  ['$scope', '$timeout', '$modalInstance', 'dataService', 'applicationContext', 'employeeId', 'siteTimeZone', 'firstDayOfWeek', 'previewParams',
    function ($scope, $timeout, $modalInstance, dataService, applicationContext, employeeId, siteTimeZone, firstDayOfWeek, previewParams) {

      $scope.employeeId = employeeId;
      $scope.siteTimeZone = siteTimeZone;
      $scope.firstDayOfWeek = firstDayOfWeek;
      $scope.previewParams = previewParams;
      $scope.monthName = new Date($scope.previewParams.year, $scope.previewParams.month).toLocaleString("en-us", { month: "long" });

      $scope.cancel = function () {
        $modalInstance.dismiss('cancel');
      };
    }]);