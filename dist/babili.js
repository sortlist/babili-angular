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
          var transformedResponse             = angular.fromJson(data);
          transformedResponse.rooms           = [];
          transformedResponse.openedRooms     = [];
          transformedResponse.firstSeenRoom   = null;
          return transformedResponse;
        }
      }
    });

    BabiliMe.prototype.fetchRooms = function (options) {
      var self = this;
      return BabiliRoom.query(options).$promise.then(function (rooms) {
        rooms.forEach(function (room) {
          if (!self.roomWithId(room.id)) {
            self.addRoom(room);
          }
          if (room.open === true && !self.openedRoomWithId(room.id)) {
            self.openedRooms.push(room);
          }
        });
        return rooms;
      });
    };

    BabiliMe.prototype.fetchOpenedRooms = function () {
      return this.fetchRooms({onlyOpened: true});
    };

    BabiliMe.prototype.fetchClosedRooms = function () {
      return this.fetchRooms({onlyClosed: true});
    };

    BabiliMe.prototype.fetchMoreRooms = function () {
      return this.fetchRooms({firstSeenRoomId: this.firstSeenRoom.id});
    };

    BabiliMe.prototype.fetchRoomByIds = function (roomIds) {
      return this.fetchRooms({"roomIds[]": roomIds});
    };

    BabiliMe.prototype.roomWithId = function (id) {
      var foundRoom = _.find(this.rooms, function (room) {
        return room.id === id;
      });
      return foundRoom;
    };

    BabiliMe.prototype.openedRoomWithId = function (id) {
      var foundRoom = _.find(this.openedRooms, function (room) {
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

    BabiliMe.prototype.addRoom = function (room) {
      if (!this.firstSeenRoom || this.firstSeenRoom.lastActivityAt > room.lastActivityAt) {
        this.firstSeenRoom = room;
      }
      this.rooms.push(room);
    };

    BabiliMe.prototype.openRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      if (!self.hasRoomOpened(room)) {
        BabiliRoom.open({id: room.id}).$promise.then(function () {
          self.openedRooms.push(room);
          room.markAllMessageAsRead().then(function (readMessageCount) {
            self.unreadMessageCount = Math.max(self.unreadMessageCount - readMessageCount, 0);
          });
          deferred.resolve(room);
        }).catch(function (err) {
          deferred.reject(err);
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
        console.log("CLOSE", room.id);
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
      var roomsToBeClosed = self.openedRooms.filter(function (_room) {
        console.log(_room.id !== room.id);
        return _room.id !== room.id;
      });
      console.log(roomsToBeClosed);
      return self.closeRooms(roomsToBeClosed).then(function () {
        return self.openRoom(room);
      });
    };

    BabiliMe.prototype.hasOpenedRooms = function () {
      return !_.isEmpty(this.openedRooms);
    };

    BabiliMe.prototype.createRoom = function (name, babiliUserIds) {
      var self = this;
      var room = new BabiliRoom({
        name:    name,
        userIds: babiliUserIds.concat(self.id)
      });
      return BabiliRoom.save(room).$promise.then(function (room) {
        self.addRoom(room);
        return room;
      });
    };

    BabiliMe.prototype.updateRoomName = function (room) {
      var self = this;
      return room.update().then(function (_room) {
        var index = _.findIndex(self.rooms, function (__room) {
          return room.id === __room.id;
        });
        self.rooms[index].name = _room.name;
        return _room;
      });
    };

    BabiliMe.prototype.addUserToRoom = function (room, userId) {
      return room.addUser(userId);
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

    BabiliMe.prototype.unreadMessageCount = function () {
      var count = 0;
      this.rooms.forEach(function (room) {
        count = count + room.unreadMessageCount;
      });
      return count;
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
          var room  = self.roomWithId(message.roomId);
          var index = _.findIndex(room.messages, function (messageToDelete) {
            return messageToDelete.id === message.id;
          });
          room.messages.splice(index, 1);
          deferred.resolve();
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
      query: {
        method: "GET",
        headers: babili.headers(),
        isArray: true
      },
      get: {
        method: "GET",
        params: {id: "@id"},
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
        BabiliRoom.read({id: this.id}).$promise.then(function (response) {
          self.unreadMessageCount = 0;
          deferred.resolve(response.readMessageCount);
        });
      } else {
        deferred.resolve(0);
      }
      return deferred.promise;
    };

    BabiliRoom.prototype.addUser = function (userId) {
      var self = this;
      return BabiliMembership.save({
        roomId: self.id
      }, {
        userId: userId
      }).$promise.then(function (membership) {
        self.users.push(membership.user);
        return membership;
      });
    };

    BabiliRoom.prototype.fetchMoreMessages = function () {
      var self       = this;
      var attributes = {
        roomId: self.id,
        firstSeenMessageId: self.messages[0].id
      };
      return BabiliMessage.query(attributes).$promise.then(function (messages) {
        self.messages.unshift.apply(self.messages, messages);
        return messages;
      });
    };

    BabiliRoom.prototype.update = function () {
      var attributes = {
        name: this.name
      };
      return BabiliRoom.update({id: this.id}, attributes).$promise;
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
