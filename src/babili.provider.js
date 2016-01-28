(function () {
  "use strict";

  var apiToken    = null;
  var pingPromise = null;
  var module      = angular.module("babili", ["ngResource"]);

  module.provider("babili", function () {
    this.options = {
      apiUrl:            "babili-api",
      socketUrl:         "",
      aliveInterval:     30000,
      fetchUserFunction: null
    };

    this.configure = function (options) {
      this.options = _.extend(this.options, options);
    };

    this.$get = function ($q, $interval, $http, $rootScope) {
      _.forEach(this.options, function (value, key) {
        module.constant(key, value);
      });

      var aliveInterval = this.options.aliveInterval;
      var injector      = angular.injector(["babili"]);
      var handleNewMessage = function (babiliUser, scope) {
        return function (message) {
          babiliUser.roomWithId(message.roomId).then(function (room) {
            if (room !== undefined && room !== null) {
              scope.$apply(function () {
                room.messages.push(message);
              });
            } else {
              injector.get("BabiliRoom").get({id: message.roomId}).$promise.then(function (_room) {
                babiliUser.rooms.push(_room);
                room = _room;
              });
            }

            babiliUser.hasRoomOpened(room).then(function (isOpen) {
              if (!isOpen) {
                $rootScope.$apply(function () {
                  room.unreadMessageCount = room.unreadMessageCount + 1;
                });
              }
            });
          });
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
          apiToken = token;
          var deferred = $q.defer();
          injector.get("BabiliMe").get().$promise.then(function (babiliUser) {
            injector.get("babiliSocket").initialize(function (err, socket) {
              socket.on("new message", handleNewMessage(babiliUser, scope));
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
        },
        update: function (currentBabiliUser, token) {
          apiToken = token;
          var deferred = $q.defer();
          injector.get("BabiliMe").get().$promise.then(function onSuccess(newBabiliUser) {
            if (currentBabiliUser.rooms.length !== newBabiliUser.rooms.length) {
              newBabiliUser.rooms.forEach(function(room) {
                if (!currentBabiliUser.rooms.some(function hasRoom(userRoom) {
                  return userRoom.id === room.id;
                })) {
                  currentBabiliUser.rooms.push(room);
                }
              });
            }
            deferred.resolve();
          });
          return deferred.promise;
        }
      };
    };
  });
}());
