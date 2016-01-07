(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (babili, socketUrl, $q) {
    var ioSocket;
    var babiliSocket = {
      initialize: function (callback) {
        ioSocket = io.connect(socketUrl, {
          transports: ['websocket'],
          "query": "token=" + babili.token()
        });

        ioSocket.on("connect", function () {
          callback(null, ioSocket);
        });
      },
      disconnect: function () {
        var deferred = $q.defer();
        ioSocket.disconnect(function () {
          deferred.resolve();
        });
        return deferred.promise;
      }
    };

    return babiliSocket;
  });
}());
