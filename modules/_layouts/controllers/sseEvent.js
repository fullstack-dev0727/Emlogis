var app = angular.module('emlogis');

// This Controller will generate sseevent

app.controller('SseEventCtrl', ['$scope', '$sce', '$rootScope', 'sseService', 'wsService', 
    function ($scope, $sce, $rootScope, sseService, wsService) {

      // TEMP SseEvent TODO: where are Site-level notification being created?
      $rootScope.sseEventVisible = true;
      $scope.closeSseEvent = function () {
        $rootScope.sseEventVisible = false;
      };

        // register a consumer for SSE that will display the event in header
        // (registration can happen safely even before getting events is
        // started.)
        $scope.eventCnt = 0;
        $scope.eventData = 'no event';

        // TODO REMOVE
        /*
        sseService.registerConsumer({
            selector: function () {
                return true;					// for now, subscribe to all
                // events
            },
            callback: function (key, serverEvent) {
                $scope.$apply(function () {     // use $scope.$apply to refresh
                    // the view
                    $scope.eventData = JSON.stringify(serverEvent).substr(0,200);

                    $scope.eventCnt++;
                });
            },
            scope: $scope,
            params: []
        });
        */

        // register a listener for WebSocket connection status
        wsService.registerConnectionStatusListener({
            callback: function (status, connectionOpenAt, connectionClosedAt, message) {
                $scope.$apply(function () {     // use $scope.$apply to refresh the view
                    try { 
                        var display = status; 
                        switch (status) {
                            case 'Active':
                                display = '<font  color="green">WS</font>';
                                break;
                            case 'Inactive':
                                display = '<font  color="red">WS</font>';
                                $scope.eventData = '';
                                break;
                            case 'Reconnecting':
                                var msg = 'WebSocket Connection lost at: ' + new Date(connectionClosedAt).toLocaleString() + ' - ' + message;
                                display = '<font   color="gray">ws... </font> ' + msg;
                                break;
                        }
                        $scope.wsConnectionStatus = $sce.trustAsHtml(display);
                        console.log( "displayed: " + display);
                    }   
                    catch(err) {
                        console.error('Failed to display WebSocket status:' + err);
                    }
                });
            },
            scope: $scope,
            params: []
        });

        // register a consumer for WebSocket Events
        wsService.registerConsumer({
            selector: function () {
                return true;                    // for now, subscribe to all
                // events
            },
            callback: function (key, serverEvent) {
                $scope.$apply(function () {     // use $scope.$apply to refresh
                    // the view
                    /**
                     * Maximum 200 characters
                     */
                    try { 
                        var msg = JSON.stringify(serverEvent);
                        // key is expected as an object (if well formed) or can be just a String, if malformed
                        // key shoudld have format: {topic, tenantId, accountId, entityClass, eventType, entityId}
                        // if correctly decoded, do some beautifying of displayed mesage, otherwise display as is. 
                        if (key.topic !== undefined) {
                            // key has been correctly decoded
                            var prefix;
                            var display;
                            if (key.topic === 'ObjLifecycle') {
                                if (serverEvent.name !== undefined) {
                                    msg = "Object '" + serverEvent.name + "' " + key.eventType + ": " + JSON.stringify(serverEvent);
                                }
                                else if (serverEvent.id !== undefined) {
                                    msg = "Object Id='" + serverEvent.id + "' " + key.eventType + ": " + JSON.stringify(serverEvent);
                                }
                                else {
                                    msg = "Unidentifed Object " + key.eventType + ": " + JSON.stringify(serverEvent);                                    
                                }
                            }
                            else if (key.topic === 'System' && key.eventType == 'Heartbit') {
                                msg = "Heartbit " + JSON.stringify(serverEvent);
                                // as a workaround of inital status display, dispay connection as active when receiving a HB
                                display = '<font  color="green">WS</font>';
                                $scope.wsConnectionStatus = $sce.trustAsHtml(display);
                            }
                            else if (key.topic === 'SysNotifications' && key.entityClass == 'Schedule' && key.eventType == 'Progress') {
                                msg = "Progress " + serverEvent.progress + "%" 
                                + (serverEvent.hardScore !== undefined ? " HardScore: " +  serverEvent.hardScore  : "")
                                + (serverEvent.softScore !== undefined ? " SoftScore: " +  serverEvent.softScore  : "")
                                + ", for: " +  serverEvent.msg ;
                            }
                            else if (key.topic === 'System' && key.entityId == 'EventWebSocket' && key.eventType == 'Notification') {
                                msg = "WebSocket connection for real time events activated.";
                                // as a workaround of inital status display, dispay connection as active when receiving a HB
                                display = '<font  color="green">WS</font>';
                                $scope.wsConnectionStatus = $sce.trustAsHtml(display);
                            }
                        }

                        $scope.eventData = msg.substr(0,200);
                        console.debug('Received Event: ' + msg);

                    }   
                    catch(err) {
                        console.error('Failed to decode event:' + err);
                        $scope.eventData = ("Unknown Event: " + serverEvent).substr(0,200);
                    }
                    $scope.eventCnt++;
                });
            },
            scope: $scope,
            params: []
        });

    }
]);

