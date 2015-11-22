(function () {
  "use strict";

  var module = angular.module("babili", ["ipCookie", "ngResource"]);
  module.provider("babiliHelper", function () {
    this.options = {
      apiUrl:            "babili-api",
      socketUrl:         "",
      cookieName:        "babili_token",
      aliveInterval:     30000,
      fetchUserFunction: null
    };

    this.initialize = function (options) {
      this.options = _.extend(this.options, options);
      _.forEach(this.options, function (value, key) {
        module.constant(key, value);
      });
    };

    this.$get = function ($q, $interval, $http, $rootScope, ipCookie) {
      var pingPromise   = null;
      var aliveInterval = this.options.aliveInterval;
      var injector      = angular.injector(["babili", "ipCookie"]);
      var babiliSocket  = injector.get("babiliSocket");
      // var BabiliRoom    = injector.get("BabiliRoom");
      // var BabiliMe      = injector.get("BabiliMe");

      var handleNewMessage = function (babiliUser, scope) {
        return function (message) {
          var room = babiliUser.roomWithId(message.roomId);
          if (room !== undefined && room !== null) {
            scope.$apply(function () {
              room.messages.push(message);
            });
          } else {
            injector.get("BabiliRoom").get({id: message.roomId}, function (_room) {
              babiliUser.rooms.push(_room);
              room = _room;
            });
          }

          if (!babiliUser.hasRoomOpened(room)) {
            $rootScope.$apply(function () {
              room.unreadMessageCount = room.unreadMessageCount + 1;
            });
          }
        };
      };

      return {
        start: function (scope) {
          var deferred = $q.defer();
          injector.get("BabiliMe").get(function (babiliUser) {
            console.log("FIRST GET2");
            // $http.defaults.headers.common["X-XSRF-BABILI-TOKEN"] = ipCookie("XSRF-BABILI-TOKEN");
            babiliSocket.initialize(function (err, socket) {
              socket.on("new message", handleNewMessage(babiliUser, scope));
            });

            var ping = function () {
              injector.get("BabiliAlive").save({});
            };

            ping();
            console.log("FIRST POST");
            pingPromise = $interval(ping, aliveInterval);
            deferred.resolve(babiliUser);
          }, function (err) {
            deferred.reject(err);
          });
          return deferred.promise;
        }
      };
    };
  });
}());
