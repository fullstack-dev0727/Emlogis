

(function () {
    console.log('in WebSocketService.');

    angular.module('emlogis.commonservices')
    .factory('wsService', ['$http', function($http) {
        var factory = {};
        var idx = 0;
        var consumers = {};
        var url;
        var websocket;
        var expectedActive = false;
        var connectionStatusListener;
        var connectionOpenAt;                   // date time the connection has been opened
        var connectionClosedAt = 0;             // date time the connection has been closed
        var logEvents = false;

        console.log('creating wsService...');


        //====================================================================
        // public methods


        factory.startWSlistener = function (baseurl, tokenId) {

            expectedActive = true;  // indicate that WebSocket connection shoudl be up from now
            console.log('==> WebSocketService  startWSlistener: ' + baseurl + ' token=' + tokenId);

            // TODO IMPROVE THIS (also may need a chnage for HTTPS)
            // pb, base url is a relative path, like ../emlogis => have to use document attributes
            // as the prtocol is different for WebSocket

     //       if (document.location.protocol.startsWith("https")) {     // startsWith doesn't seem to be supported on all browsers, use indexOf() instead
            if (document.location.protocol.indexOf("https") === 0) {
                  //  url = "wss://" + document.location.host + document.location.pathname + 'events?EmlogisToken=' + tokenId;
                // ugly temporary patch because document.location.pathname doesn't always return same value
                url = "wss://" + document.location.host  + '/scheduler-server/emlogis/events?EmlogisToken=' + tokenId;

            }
            else {
                // url = "ws://" + document.location.host + document.location.pathname + 'events?EmlogisToken=' + tokenId;
                // ugly temporary patch because document.location.pathname doesn't always return same value
                url = "ws://" + document.location.host  + '/scheduler-server/emlogis/events?EmlogisToken=' + tokenId;
            }
/*
            url = "ws://" 
                + (document.location.hostname === "" ? "localhost" : document.location.hostname) 
                + ":" + (document.location.port === "" ? "8080" : document.location.port)
                + '/scheduler-server/events?EmlogisToken=' + tokenId;
*/
            factory.startOrRestartWSlistener();
        };


        factory.stopWSlistener = function () {

            expectedActive = false;       // indicate that WebSocket connection shoudl be down now
            console.log('==> WebSocketService  stopWSlistener: ' + url);
            if (websocket) {
                try {
                    var ws = websocket;
                    websocket = null;
                    ws.close();
                }
                catch(err) {
                    console.error('Failed to close WebSocket: ' + err);
                }
            }

            // TODO add cleanup code

        };

        /*
        * public registerConsumer() register an WS consumer
        * a consumer is defined by an object with following attributes:
        * - selector a function that must return true or false. it is invoked with the event 'key' as parameter
        * - callback a function invoked if selector() returns true. invoked with event.key and event.data, as parameters
        * - an optional id. if unspecified, an id is generated autmatically and returned in object + as return value.
        * followed by optional parameters sepcified in consumer.params attributes
        * - scope (optional) scope for the callback ftn
        * - params (optional) and array of params passed to the callback, right after the event data 
        * returns a registration id if success / null otherwise
        */ 

        factory.registerConsumer = function (consumer) {
            if (consumer && consumer.selector !== undefined && consumer.callback !== undefined) {
                idx++;
                // as id, either use consumer specified id, or generate one
                var consumerId = consumer.id || 'c' + idx;
                consumers[consumerId] = consumer;
                consumer.id = consumerId;
                console.log("==> WebSocketService has registered an event Consumer, id: " + consumerId);
                return consumerId;
            }
            else {
                return null;
            }
        };

        factory.unregisterConsumer = function (consumerId) {
            consumers.delete(consumerId);
            console.log("==> WebSocketService has UN-registered the event Consumer id: " + consumerId);
        };

        /*
        * public registerConnectionStatusListener() register a WS connection status listener
        * a listener is defined by an object with following attributes:
        *   - callback (function invoked on satus change) 
        *   - scope (optional) scope for the callback ftn
        *   - params (optional) and array of params passed to the callback, right after the event status 
        * the callback is  invoked with a 
        *   - status param that can be: Active|Inactive|Reconnecting
        *   - date the connection has been successfully opeeed for the last time
        *   - date the connection has been closed for the last time
        *   - optional scope
        *   - optional params 
        */ 
        factory.registerConnectionStatusListener = function (listener) {
            connectionStatusListener = listener;
            console.log("==> WebSocketService has registered a Status Listener.");
        };



        //====================================================================
        // private methods

        factory.startOrRestartWSlistener = function () {

            console.log('==> WebSocketService  startOrRestartWSlistener: ' + url);
            var wsActive = (websocket !== undefined && websocket !== null && websocket.readyState === 1);
            if (!expectedActive || (expectedActive &&  wsActive)) {
                // seems this can happen if we have a delayed call arriving a bit late ??
                console.log('==> WebSocketService  startOrRestartWSlistener CANCEL due to : Open invoked when we don t actually want to open it, or Open invoked on a connexion Already active');
                return;
            }

            websocket = new WebSocket(url);


            websocket.onopen = function(evt) {
                console.log("==> WebSocketService WebSocket OPEN at " + new Date().toLocaleString() + " !");
                connectionOpenAt = Date.now();
                connectionClosedAt = 0;

                // TODO indicate websocket connection is Active
                // onOpen(evt)
                factory.notifyStatusChange('Active', '');
            };

            websocket.onerror = function(evt) {
                console.error('==> WebSocketService ERROR Event !');
                // TODO indicate websocket connection is Active
                //onError(evt)
            };

            websocket.onclose = function(evt) {
                console.log('==> WebSocketService Close Event at ' + new Date().toLocaleString() + " !");
                if (connectionClosedAt === 0) {
                    connectionClosedAt = Date.now();
                }
                if (expectedActive) {
                    console.error('==> WebSocketService ********* WebSocket Unexpected Close ! , will try to REOPEN the Connection later ************');
                    // TODO try to reestablish it periodically
                    var delay = 30000;
                    var nextTryDate = new Date(Date.now() + delay);
                    factory.notifyStatusChange('Reconnecting', ' Will try to Reconnect at ' + nextTryDate.toLocaleString());
                    setTimeout(factory.startOrRestartWSlistener, delay);
                }
                else {
                    console.log('==> WebSocketService ********* WebSocket expected Close !  ************');
                    factory.notifyStatusChange('Inactive', '');
                }
                // TODO indicate websocket connection is Inactive
                // onClose(evt)
            };

            websocket.onmessage = function(evt) {
                if (logEvents) {
                    console.log('==> WebSocketService got Event ! :' + evt.data);
                }
                var getKeyAsObject = function(keyAsString) {

                    keyAsString = keyAsString.split('><').join(','); // = replaceAll('><', ',');
                    keyAsString = keyAsString.split('<').join('');                   // = replaceAll('<', '');
                    keyAsString = keyAsString.split('>').join('');                   // = replaceAll('>', '');
                    var keyAr = keyAsString.split(',');
                    if (keyAr.length == 6) {
                        // key seems to be well formed
                        return {
                            topic: keyAr[0],
                            tenantId: keyAr[1],
                            accountId: keyAr[2],
                            entityClass: keyAr[3],
                            eventType: keyAr[4],
                            entityId: keyAr[5]
                        };
                    }
                    else {
                        // key doesn't have expected format, return it as is
                        return keyAsString;
                    }

                };  

                // decode event
                var serverEvent = JSON.parse(evt.data);
                var keyObj = getKeyAsObject(serverEvent.key);
                // go through list of selectors and invoke consumers
                for (var consumerId in consumers) { 
                    var consumer = consumers[consumerId];
                    var consumerparams = consumer.params || [];
                    //params.unshift(serverEvent.key, serverEvent.data);
                    var params = [keyObj, serverEvent.data].concat(consumerparams);
                    try {
                        if (consumer.selector(serverEvent.key)) {
                            // process event
                            if (consumer.scope) {
                                consumer.callback.apply(consumer.scope, params); 
                            }
                            else {
                                consumer.callback.apply(params); 
                            }
                        }
                    }
                    catch(error){
                        console.error('error while processing WS consumer id:' + consumerId + " error: " + error);
                    }
                }             
            };
        };


        factory.notifyStatusChange = function(status, message) {

            var listener = connectionStatusListener;
            if (listener !== undefined && listener !== null) {
                var listenerparams = listener.params || [];
                var params = [status, connectionOpenAt, connectionClosedAt, message].concat(listenerparams);
                try {
                    if (listener.scope) {
                        listener.callback.apply(listener.scope, params); 
                    }
                    else {
                        listener.callback.apply(params); 
                    }
                }
                catch(err) {
                    console.error('Failed to notify WebSocket Listener on connexion status change: ' + err);
                }
            }
        };


        console.log('WebSocketService created.');
        return factory;

    }]);

}());

