var i = 0;

self.addEventListener('message', function(e) {
	var data = e.data;
	var heartbiturl = data;
  var started = new Date();
  	var cnt = 0;
  	//console.log('heart bit worker firing, data=' + e.data);
  	//console.log('start wait');


    var interval = 60 * 1000;
  	setInterval( function (){
      console.log('heart bit worker, loop# ' + cnt);
      cnt++;

      try{
        var xmlHttp = new XMLHttpRequest();
          xmlHttp.onreadystatechange = function(){
            if ((xmlHttp.readyState == 4) && (xmlHttp.status == 401)){
              console.log('Token created at: ' + started.toLocaleString() + ' becomes invalidated at: ' + new Date().toLocaleString());
              console.log("==> WE SHOULD Stop gracefully the WebSocketService connection here  " + new Date().toLocaleString() + " !");
              self.postMessage('Your session has expired due to a too long inactivity period. Please login again.');
              self.close();
            }
          }

        xmlHttp.open( "GET", heartbiturl, false );
        xmlHttp.send( null );

      }
      catch( error){
        //console.log("Error Heartbit occured");
        console.log(error);

      }
    },
    interval
  );

}, false);

/*
self.startTimer = function() {
    timer.start();
    setTimeout(stopTimer,5000);
};

self.stopTimer = function () {
    timer.stop;
};

*/

/*
function timedCount() {
    i = i + 1;
    postMessage(i);
    setTimeout("timedCount()",500);
}

timedCount();
*/
