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

    this.$get = ["$q", "$interval", "$http", "$rootScope", "ipCookie", function ($q, $interval, $http, $rootScope, ipCookie) {
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
    }];
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliAlive", ["$resource", "apiUrl", "ipCookie", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/alive", {}, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      }
    });
  }]);
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMe", ["$resource", "$q", "apiUrl", "ipCookie", "BabiliRoom", "BabiliMessage", function ($resource, $q, apiUrl, ipCookie, BabiliRoom, BabiliMessage) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    var BabiliMe = $resource(apiUrl + "/client/me", {}, {
      get: {
        method: "GET",
        withCredentials: true,
        headers: headers(),
        transformResponse: function (data) {
          var transformedResponse = angular.fromJson(data);
          if (transformedResponse.rooms) {
            transformedResponse.rooms = transformedResponse.rooms.map(function (room) {
              return new BabiliRoom(room);
            });
          }
          if (transformedResponse.openedRoomIds === null ||
              transformedResponse.openedRoomIds === undefined) {
            transformedResponse.openedRoomIds = [];
          }
          return transformedResponse;
        }
      }
    });

    var _notifyOpenRoom = function (room, callback) {
      BabiliRoom.open({id: room.id}, callback);
    };

    var _notifyCloseRoom = function (room, callback) {
      BabiliRoom.close({id: room.id}, callback);
    };

    BabiliMe.prototype.rooms = function () {
      return this.rooms;
    };

    BabiliMe.prototype.roomWithId = function (id) {
      return _.find(this.rooms, function (room) {
        return room.id === id;
      });
    };

    BabiliMe.prototype.hasRoomOpened = function (room) {
      return _.includes(this.openedRoomIds, room.id);
    };

    BabiliMe.prototype.openRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();
      if (!self.hasRoomOpened(room)) {
        _notifyOpenRoom(room, function () {
          self.openedRoomIds.push(room.id);
          room.markAllMessageAsRead();
          deferred.resolve(room);
        });
      }
      return deferred.promise;
    };

    BabiliMe.prototype.closeAllRooms = function () {
      this.openedRoomIds = [];
    };

    BabiliMe.prototype.openSingleRoom = function (room) {
      this.openedRoomIds = [];
      return this.openRoom(room);
    };

    BabiliMe.prototype.closeRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();
      if (self.hasRoomOpened(room)) {
        _notifyCloseRoom(room, function () {
          _.remove(self.openedRoomIds, function (openedRoomId) {
            return openedRoomId === room.id;
          });
          deferred.resolve();
        });
      }
      return deferred.promise;
    };

    BabiliMe.prototype.hasOpenedRooms = function () {
      return !_.isEmpty(this.openedRoomIds);
    };

    BabiliMe.prototype.openedRooms = function () {
      var self = this;
      return _.filter(self.rooms, function (room) {
        return _.includes(self.openedRoomIds, room.id);
      });
    };

    BabiliMe.prototype.createRoom = function (name, babiliUserIds) {
      var self     = this;
      var deferred = $q.defer();

      var room = new BabiliRoom({
        name:    name,
        userIds: babiliUserIds.concat(self.id)
      });

      BabiliRoom.save(room, function (room) {
        var foundRoom = self.roomWithId(room.id);
        if (foundRoom !== null && foundRoom !== undefined) {
          deferred.resolve(foundRoom);
        } else {
          self.rooms.push(room);
          deferred.resolve(room);
        }
      }, function (err) {
        deferred.reject(err);
      });

      return deferred.promise;
    };

    BabiliMe.prototype.updateRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();
      room.update().then(function (_room) {
        var index = _.findIndex(self.rooms, function (__room) {
          return room.id === __room.id;
        });
        self.rooms[index] = _room;
        deferred.resolve();
      }).catch(function (err) {
        deferred.reject(err);
      });

      return deferred.promise;
    };

    BabiliMe.prototype.addUserToRoom = function (room, babiliUserId) {
      room = this.roomWithId(room.id);
      return room.addUser(this, babiliUserId);
    };

    BabiliMe.prototype.sendMessage = function (room, message) {
      var deferred = $q.defer();
      var self     = this;
      BabiliMessage.save({
        roomId: room.id
      }, message, function (_message) {
        self.roomWithId(room.id).messages.push(_message);
        deferred.resolve(_message);
      }, function (err) {
        deferred.reject(err);
      });
      return deferred.promise;
    };
    return BabiliMe;
  }]);
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMembership", ["$resource", "apiUrl", "ipCookie", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/rooms/:roomId/memberships/:id", {
      membershipId: "@membershipId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      }
    });
  }]);
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMessage", ["$resource", "apiUrl", "ipCookie", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/rooms/:roomId/messages/:id", {
      roomId: "@roomId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      },
      get: {
        method: "GET",
        withCredentials: true,
        headers: headers()
      },
      query: {
        method: "GET",
        withCredentials: true,
        isArray: true,
        headers: headers()
      },
      "delete": {
        method: "delete",
        withCredentials: true,
        headers: headers()
      }
    });
  }]);
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", ["$resource", "$q", "apiUrl", "ipCookie", "BabiliMessage", "BabiliMembership", function ($resource, $q, apiUrl, ipCookie, BabiliMessage,
                                   BabiliMembership) {
    var headers = function () {
      var head = {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
      console.log("headers", head);
      return head;
    };
    var BabiliRoom = $resource(apiUrl + "/client/rooms/:id", {
      id: "@id"
    }, {
      get: {
        method: "GET",
        withCredentials: true,
        headers: headers()
      },
      update: {
        method: "PUT",
        withCredentials: true,
        headers: headers()
      },
      delete: {
        method: "DELETE",
        withCredentials: true,
        headers: headers()
      },
      read: {
        url: apiUrl + "/client/rooms/:id/read",
        params: {id: "@id"},
        withCredentials: true,
        method: "POST",
        headers: headers()
      },
      open: {
        url: apiUrl + "/client/rooms/:id/open",
        params: {id: "@id"},
        withCredentials: true,
        method: "POST",
        headers: headers()
      },
      close: {
        url: apiUrl + "/client/rooms/:id/open",
        params: {id: "@id"},
        withCredentials: true,
        method: "DELETE",
        headers: headers()
      }
    });

    BabiliRoom.prototype.markAllMessageAsRead = function () {
      var self = this;
      if (self.unreadMessageCount > 0) {
        BabiliRoom.read({id: this.id}, function () {
          self.unreadMessageCount = 0;
        });
      }
    };

    BabiliRoom.prototype.lastMessage = function () {
      return _.last(this.messages);
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
  }]);
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("babiliSocket", ["ipCookie", "socketUrl", "cookieName", function (ipCookie, socketUrl, cookieName) {
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
  }]);
}());
