(function () {
  "use strict";

  var apiToken    = null;
  var pingPromise = null;
  var module      = angular.module("babili", ["ngResource"]);

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
        }
      };
    };
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliAlive", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/client/alive", {}, {
      save: {
        method: "POST",
        headers: babili.headers()
      }
    });
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMe", function ($resource, $q, babili, apiUrl, BabiliRoom, BabiliMessage) {

    var BabiliMe = $resource(apiUrl + "/client/me", {}, {
      get: {
        method: "GET",
        headers: babili.headers(),
        transformResponse: function (data) {
          var transformedResponse = angular.fromJson(data);
          if (transformedResponse.rooms) {
            transformedResponse.rooms = transformedResponse.rooms.map(function (room) {
              return new BabiliRoom(room);
            });
          }
          transformedResponse.openedRooms = [];
          if (transformedResponse.openedRoomIds) {
            transformedResponse.openedRooms = transformedResponse.openedRoomIds.map(function (id) {
              return _.find(transformedResponse.rooms, function (room) {
                return room.id === id;
              });
            });
          }
          return transformedResponse;
        }
      }
    });

    BabiliMe.prototype.roomWithId = function (id) {
      var foundRoom = _.find(this.rooms, function (room) {
        return room.id === id;
      });
      return foundRoom;
    };

    BabiliMe.prototype.hasRoomOpened = function (room) {
      var foundRoom = _.find(this.openedRooms, function (openedRoom) {
        return room && openedRoom.id === room.id;
      });
      return Boolean(foundRoom);
    };

    BabiliMe.prototype.openRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      if (!self.hasRoomOpened(room)) {
        BabiliRoom.open({id: room.id}).$promise.then(function () {
          self.openedRooms.push(room);
          room.markAllMessageAsRead();
          deferred.resolve(room);
        });
      } else {
        deferred.resolve();
      }

      return deferred.promise;
    };

    BabiliMe.prototype.closeRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      if (self.hasRoomOpened(room)) {
        BabiliRoom.close({id: room.id}).$promise.then(function () {
          _.remove(self.openedRooms, function (openedRoom) {
            return openedRoom.id === room.id;
          });
          deferred.resolve(room);
        });
      } else {
        deferred.resolve();
      }

      return deferred.promise;
    };

    BabiliMe.prototype.closeRooms = function (rooms) {
      var self     = this;
      var promises = rooms.map(function (room) {
        return self.closeRoom(room);
      });
      return $q.all(promises);
    };

    BabiliMe.prototype.openRoomAndCloseOthers = function (room) {
      var self = this;
      var roomsToBeClosed = self.rooms.filter(function (_room) {
        return _room.id !== room.id;
      });
      return self.closeRooms(roomsToBeClosed).then(function () {
        return self.openRoom(room);
      });
    };

    BabiliMe.prototype.hasOpenedRooms = function () {
      return !_.isEmpty(this.openedRooms);
    };

    BabiliMe.prototype.createRoom = function (name, babiliUserIds) {
      var self     = this;
      var deferred = $q.defer();
      var room     = new BabiliRoom({
        name:    name,
        userIds: babiliUserIds.concat(self.id)
      });
      BabiliRoom.save(room).$promise.then(function (room) {
        self.rooms.push(room);
        deferred.resolve(room);
      }).catch(function (err) {
        deferred.reject(err);
      });
      return deferred.promise;
    };

    BabiliMe.prototype.updateRoomName = function (room) {
      var self     = this;
      var deferred = $q.defer();
      room.update().then(function (_room) {
        var index = _.findIndex(self.rooms, function (__room) {
          return room.id === __room.id;
        });
        self.rooms[index].name = _room.name;
        deferred.resolve();
      }).catch(function (err) {
        deferred.reject(err);
      });
      return deferred.promise;
    };

    BabiliMe.prototype.addUserToRoom = function (room, babiliUserId) {
      return room.addUser(this, babiliUserId);
    };

    BabiliMe.prototype.sendMessage = function (room, message) {
      var deferred = $q.defer();
      var self     = this;
      if (!message || !message.content) {
        deferred.resolve(null);
      } else if (!room) {
        deferred.reject(new Error("Room need to be defined."));
      } else {
        BabiliMessage.save({
          roomId: room.id
        }, message).$promise.then(function (_message) {
          var foundRoom = self.roomWithId(room.id);
          foundRoom.messages.push(_message);
          deferred.resolve(_message);
        }).catch(function (err) {
          deferred.reject(err);
        });
      }
      return deferred.promise;
    };

    BabiliMe.prototype.messageSentByMe = function (message) {
      return message && this.id === message.senderId;
    };

    BabiliMe.prototype.deleteMessage = function (message) {
      var deferred = $q.defer();
      var self     = this;
      if (!message) {
        deferred.resolve(null);
      } else {
        BabiliMessage.delete({
          id: message.id,
          roomId: message.roomId
        }).$promise.then(function () {
          return self.roomWithId(message.roomId).then(function (room) {
            var index = _.findIndex(room.messages, function (messageToDelete) {
              return messageToDelete.id === message.id;
            });
            room.messages.splice(index, 1);
            deferred.resolve();
          });
        }).catch(function (err) {
          deferred.reject(err);
        });
      }
      return deferred.promise;
    };

    return BabiliMe;
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMembership", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/client/rooms/:roomId/memberships/:id", {
      membershipId: "@membershipId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      }
    });
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMessage", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/client/rooms/:roomId/messages/:id", {
      roomId: "@roomId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      },
      get: {
        method: "GET",
        headers: babili.headers()
      },
      query: {
        method: "GET",
        isArray: true,
        headers: babili.headers()
      },
      "delete": {
        method: "delete",
        headers: babili.headers()
      }
    });
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($resource, babili, $q, apiUrl, BabiliMessage, BabiliMembership) {
    var BabiliRoom = $resource(apiUrl + "/client/rooms/:id", {
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      },
      get: {
        method: "GET",
        headers: babili.headers()
      },
      update: {
        method: "PUT",
        headers: babili.headers()
      },
      delete: {
        method: "DELETE",
        headers: babili.headers()
      },
      read: {
        url: apiUrl + "/client/rooms/:id/read",
        params: {id: "@id"},
        method: "POST",
        headers: babili.headers()
      },
      open: {
        url: apiUrl + "/client/rooms/:id/open",
        params: {id: "@id"},
        method: "POST",
        headers: babili.headers()
      },
      close: {
        url: apiUrl + "/client/rooms/:id/open",
        params: {id: "@id"},
        method: "DELETE",
        headers: babili.headers()
      }
    });

    BabiliRoom.prototype.markAllMessageAsRead = function () {
      var self     = this;
      var deferred = $q.defer();
      if (self.unreadMessageCount > 0) {
        BabiliRoom.read({id: this.id}).$promise.then(function () {
          self.unreadMessageCount = 0;
          deferred.resolve(true);
        });
      } else {
        deferred.resolve(false);
      }
      return deferred.promise;
    };

    BabiliRoom.prototype.addUser = function (babiliUser, babiliUserId) {
      var deferred = $q.defer();
      var self     = this;

      BabiliMembership.save({
        roomId: self.id
      }, {
        userId: babiliUserId
      }, function (membership) {
        self.users.push(membership.user);
        deferred.resolve();
      }, function (err) {
        deferred.reject(err);
      });

      return deferred.promise;
    };

    BabiliRoom.prototype.update = function () {
      var deferred   = $q.defer();
      var attributes = {
        name: this.name
      };
      BabiliRoom.update({id: this.id}, attributes, function (room) {
        deferred.resolve(room);
      }, function (err) {
        deferred.reject(err);
      });
      return deferred.promise;
    };

    return BabiliRoom;
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", function (babili, socketUrl, $q) {
    var ioSocket;
    var babiliSocket = {
      initialize: function (callback) {
        ioSocket = io.connect(socketUrl, {
          "query": "token=" + babili.token()
        });

        ioSocket.on("connect", function () {
          callback(null, ioSocket);
        });
      },
      disconnect: function () {
        var deferred = $q.defer();
        if (ioSocket) {
          ioSocket.disconnect(function () {
            deferred.resolve();
          });
        } else {
          deferred.resolve();
        }
        return deferred.promise;
      }
    };

    return babiliSocket;
  });
}());
