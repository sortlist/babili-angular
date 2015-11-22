(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (ipCookie, socketUrl, cookieName) {
    var babiliSocket = {
      initialize: function (callback) {
        var token     = ipCookie(cookieName);
        var ioSocket  = io.connect(socketUrl, {
          "query": "token=" + token
        });

        ioSocket.on("connect", function () {
          callback(null, ioSocket);
        });
      }
    };

    return babiliSocket;
  });
}());
