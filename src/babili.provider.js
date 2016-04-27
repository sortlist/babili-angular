(function () {
  "use strict";

  var module            = angular.module("babili", []);
  var apiToken          = null;
  var pingPromise       = null;
  var babiliUser        = null;
  var socketInitialized = false;

  module.provider("babili", function () {
    var self     = this;
    self.options = {
      apiUrl           : "http://api.babili.local",
      socketUrl        : "http://pusher.babili.local",
      aliveInterval    : 30000
    };

    self.configure = function (options) {
      Object.keys(options).forEach(function (key) {
        self.options[key] = options[key];
      });
    };

    self.$get = function ($q, $interval) {
      Object.keys(self.options).forEach(function (key) {
        module.constant(key, self.options[key]);
      });

      var aliveInterval = self.options.aliveInterval;
      var injector      = angular.injector(["babili"]);
      var handleNewMessage = function (scope) {
        return function (jsonMessage) {
          var BabiliMessage = injector.get("BabiliMessage");
          var message = new BabiliMessage(jsonMessage.data);
          var room    = babiliUser.roomWithId(message.room.id);
          if (room !== undefined && room !== null) {
            scope.$apply(function () {
              room.messages.push(message);
              if (!babiliUser.hasRoomOpened(room)) {
                room.unreadMessageCount       = room.unreadMessageCount + 1;
                babiliUser.unreadMessageCount = babiliUser.unreadMessageCount + 1;
              }
            });
          } else {
            injector.get("BabiliRoom").get(message.room.id).then(function (_room) {
              babiliUser.addRoom(_room);
              room = _room;
              if (!babiliUser.hasRoomOpened(room)) {
                scope.$apply(function () {
                room.unreadMessageCount       = room.unreadMessageCount;
                babiliUser.unreadMessageCount = babiliUser.unreadMessageCount + 1;
              });
              }
            });
          }

        };
      };

      return {
        headers: function () {
          var headers = {
            "Authorization": "Bearer " + apiToken
          };
          return headers;
        },
        token: function () {
          return apiToken;
        },
        connect: function (scope, token) {
          var deferred = $q.defer();
          if (babiliUser === undefined || babiliUser === null) {
            apiToken = token;
            injector.get("BabiliMe").get().then(function (_babiliUser) {
              babiliUser = _babiliUser;
              injector.get("babiliSocket").initialize(function (err, socket) {
                if (socketInitialized === false) {
                  socket.on("new message", handleNewMessage(scope));
                  socketInitialized = true;
                }
              });
              var ping = function () {
                babiliUser.updateAliveness();
              };
              ping();
              pingPromise = $interval(ping, aliveInterval);
              deferred.resolve(babiliUser);
            }).catch(function (err) {
              deferred.reject(err);
            });
          } else {
            console.err("Babili: /!\\ You should call 'babili.connect' only once.");
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
