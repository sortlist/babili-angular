(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (babili, socketUrl, $q) {
    var ioSocket;
    var babiliSocket = {
      initialize: function (callback) {
        ioSocket = io.connect(socketUrl, {
          query    : "token=" + babili.token(),
          forceNew : true
        });

        ioSocket.on("connect", function () {
          callback(null, ioSocket);
        });
      },
      disconnect: function () {
        var deferred = $q.defer();
        if (ioSocket) {
          ioSocket.close();
          ioSocket = undefined;
          deferred.resolve();
        } else {
          deferred.resolve();
        }
        return deferred.promise;
      }
    };

    return babiliSocket;
  });
}());
