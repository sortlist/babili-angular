(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (babili, socketUrl, $q) {
    var ioSocket;
    var babiliSocket = {
      initialize: function () {
        ioSocket = io.connect(socketUrl, {
          query    : "token=" + babili.token(),
          forceNew : true
        });
        return ioSocket;
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
