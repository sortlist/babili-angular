(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (babili, socketUrl) {
    var babiliSocket = {
      connect: function () {
        this.ioSocket = io.connect(socketUrl, {
          query    : "token=" + babili.token(),
          forceNew : true
        });
        return this.ioSocket;
      },
      disconnect: function () {
        if (this.ioSocket) {
          this.ioSocket.close(true);
          this.ioSocket = undefined;
        }
      },
      socketExist: function () {
        return this.ioSocket !== null && this.ioSocket !== undefined;
      }
    };

    return babiliSocket;
  });
}());
