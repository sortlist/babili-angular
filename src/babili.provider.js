(function () {
  "use strict";

  var apiToken          = null;
  var pingPromise       = null;
  var module            = angular.module("babili", ["ngResource"]);
  var babiliUser        = null;
  var socketInitialized = false;

  module.provider("babili", function () {
    var self     = this;
    self.options = {
      apiUrl           : "babili-api",
      socketUrl        : "",
      aliveInterval    : 30000
    };

    self.configure = function (options) {
      self.options = _.extend(self.options, options);
    };

    self.$get = function ($q, $interval, $http, $rootScope) {
      _.forEach(self.options, function (value, key) {
        module.constant(key, value);
      });

      var aliveInterval = self.options.aliveInterval;
      var injector      = angular.injector(["babili"]);
      var handleNewMessage = function (scope) {
        return function (message) {
          var room = babiliUser.roomWithId(message.roomId);
          if (room !== undefined && room !== null) {
            scope.$apply(function () {
              room.messages.push(message);
              if (!babiliUser.hasRoomOpened(room)) {
                room.unreadMessageCount       = room.unreadMessageCount + 1;
                babiliUser.unreadMessageCount = babiliUser.unreadMessageCount + 1;
              }
            });
          } else {
            injector.get("BabiliRoom").get({id: message.roomId}).$promise.then(function (_room) {
              babiliUser.addRoom(_room);
              room = _room;
              if (!babiliUser.hasRoomOpened(room)) {
                scope.$apply(function () {
                room.unreadMessageCount       = room.unreadMessageCount + 1;
                babiliUser.unreadMessageCount = babiliUser.unreadMessageCount + 1;
              });
              }
            });
          }

        };
      };

      return {
        headers: function () {
          var headers = {};
          headers["x-babili-token"] = apiToken;
          return headers;
        },
        token: function () {
          return apiToken;
        },
        connect: function (scope, token) {
          var deferred = $q.defer();
          if (babiliUser === undefined || babiliUser === null) {
            apiToken = token;
            injector.get("BabiliMe").get().$promise.then(function (_babiliUser) {
              babiliUser = _babiliUser;
              injector.get("babiliSocket").initialize(function (err, socket) {
                if (socketInitialized === false) {
                  socket.on("new message", handleNewMessage(scope));
                  socketInitialized = true;
                }
              });
              var ping = function () {
                injector.get("BabiliAlive").save({});
              };
              ping();
              pingPromise = $interval(ping, aliveInterval);
              deferred.resolve(babiliUser);
            }).catch(function (err) {
              deferred.reject(err);
            });
          } else {
            console.log("Babili: /!\\ You should call 'babili.connect' only once.");
            deferred.resolve(babiliUser);
          }
          return deferred.promise;
        },
        disconnect: function () {
          var deferred = $q.defer();
          apiToken     = null;
          $interval.cancel(pingPromise);
          injector.get("babiliSocket").disconnect().then(function () {
            deferred.resolve();
          });
          return deferred.promise;
        }
      };
    };
  });
}());
