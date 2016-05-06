(function () {
  "use strict";

  var module            = angular.module("babili", ["ng"]);
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
          var message       = new BabiliMessage(jsonMessage.data);
          var room          = babiliUser.roomWithId(message.room.id);
          if (room !== undefined && room !== null) {
            scope.$apply(function () {
              if (room.addMessage(message) && !babiliUser.hasRoomOpened(room)) {
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
              var socket = injector.get("babiliSocket").initialize();
              socket.on("new message", handleNewMessage(scope));
              socket.on("connected", function (data) {
                babiliUser.deviceSessionId = data.deviceSessionId;
              });
              socketInitialized = true;

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

          apiToken          = null;
          pingPromise       = null;
          babiliUser        = null;
          socketInitialized = false;

          return deferred.promise;
        }
      };
    };
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMe", function ($http, $q, babili, apiUrl, BabiliRoom, BabiliMessage,
    babiliUtils) {

    var BabiliMe = function BabiliMe (data) {
      this.id                 = data.id;
      this.rooms              = [];
      this.openedRooms        = [];
      this.unreadMessageCount = 0;
      this.roomCount          = 0;

      if (data.meta) {
        this.unreadMessageCount = data.meta.unreadMessageCount || 0;
        this.roomCount          = data.meta.roomCount          || 0;
      }
    };

    BabiliMe.get = function () {
      return $http({
        method  : "GET",
        url     : apiUrl + "/user",
        headers : babili.headers()
      }).then(function (response) {
        return new BabiliMe(response.data.data);
      });
    };

    BabiliMe.prototype.updateAliveness = function () {
      return $http({
        method  : "PUT",
        url     : apiUrl + "/user/alive",
        headers : babili.headers(),
        data    : {
          data : {
            type: "alive"
          }
        }
      });
    };

    BabiliMe.prototype.fetchRooms = function (options) {
      var self = this;
      return BabiliRoom.query(options).then(function (rooms) {
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
      var foundRoomIndex = babiliUtils.findIndex(this.rooms, function (room) {
        return room.id === id;
      });
      return this.rooms[foundRoomIndex];
    };

    BabiliMe.prototype.openedRoomWithId = function (id) {
      var foundRoomIndex = babiliUtils.findIndex(this.openedRooms, function (room) {
        return room.id === id;
      });
      return this.openedRooms[foundRoomIndex];
    };

    BabiliMe.prototype.hasRoomOpened = function (room) {
      return Boolean(this.openedRoomWithId(room.id));
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
        room.openMembership().then(function () {
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
        room.closeMembership().then(function () {
          var roomToRemoveIndex = babiliUtils.findIndex(self.openedRooms, function (openedRoom) {
            return openedRoom.id === room.id;
          });
          if (roomToRemoveIndex > -1) {
            self.openedRooms.splice(roomToRemoveIndex, 1);
          }
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
      var roomsToBeClosed = self.openedRooms.filter(function (_room) {
        return _room.id !== room.id;
      });
      return self.closeRooms(roomsToBeClosed).then(function () {
        return self.openRoom(room);
      });
    };

    BabiliMe.prototype.hasOpenedRooms = function () {
      return this.openedRooms.length > 0;
    };

    BabiliMe.prototype.createRoom = function (name, userIds) {
      var self = this;

      return BabiliRoom.create(name, self.id, userIds).then(function (room) {
        self.addRoom(room);
        return room;
      });
    };

    BabiliMe.prototype.updateRoom = function (room) {
      var self = this;

      return room.update().then(function (updatedRoom) {
        var room = self.roomWithId(updatedRoom.id);
        room.name = updatedRoom.name;
        return room;
      });
    };

    BabiliMe.prototype.addUserToRoom = function (room, userId) {
      return room.addUser(userId);
    };

    BabiliMe.prototype.sendMessage = function (room, attributes) {
      var self     = this;
      var deferred = $q.defer();

      if (!attributes || !attributes.content) {
        deferred.resolve(null);
      } else if (!room) {
        deferred.reject(new Error("Room need to be defined."));
      } else {
        attributes.deviceSessionId = self.deviceSessionId;
        BabiliMessage.create(room, attributes).then(
          function (message) {
            room.addMessage(message);
            deferred.resolve(message);
          }
        ).catch(function (err) {
          deferred.reject(err);
        });
      }
      return deferred.promise;
    };

    BabiliMe.prototype.messageSentByMe = function (message) {
      return message && message.sender && this.id === message.sender.id;
    };

    BabiliMe.prototype.deleteMessage = function (message) {
      var deferred = $q.defer();
      var self     = this;
      if (!message) {
        deferred.resolve(null);
      } else {
        BabiliMessage.delete({
          id: message.id,
          roomId: message.room.id
        }).then(function () {
          var room  = self.roomWithId(message.room.id);
          var index = babiliUtils.findIndex(room.messages, function (messageToDelete) {
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

  .factory("BabiliMessage", function ($http, babili, apiUrl, BabiliUser) {
    var BabiliMessage = function BabiliMessage (data) {
      var BabiliRoom   = angular.injector(["babili"]).get("BabiliRoom");
      this.id          = data.id;
      this.content     = data.attributes.content;
      this.contentType = data.attributes.contentType;
      this.createdAt   = new Date(data.attributes.createdAt);
      this.room        = new BabiliRoom(data.relationships.room.data);
      if (data.relationships.sender) {
        this.sender = new BabiliUser(data.relationships.sender.data);
      }
    };

    BabiliMessage.create = function (room, attributes) {
      return $http({
        method  : "POST",
        url     : apiUrl + "/user/rooms/" + room.id + "/messages",
        headers : babili.headers(),
        data    : {
          data : {
            type       : "message",
            attributes : {
              content         : attributes.content,
              contentType     : attributes.contentType,
              deviceSessionId : attributes.deviceSessionId
            }
          }
        }
      }).then(function (response) {
        return new BabiliMessage(response.data.data);
      });
    };

    BabiliMessage.query = function (room, params) {
      return $http({
        method  : "GET",
        url     : apiUrl + "/user/rooms/" + room.id + "/messages",
        headers : babili.headers(),
        params  : params
      }).then(function (response) {
        return response.data.data.map(function (data) {
          return new BabiliMessage(data);
        });
      });
    };

    return BabiliMessage;
  });
}());

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($http, babili, $q, apiUrl, BabiliUser, BabiliMessage,
    babiliUtils) {

    var BabiliRoom = function BabiliRoom (data) {
      this.id       = data.id;
      this.users    = [];
      this.messages = [];

      if (data.attributes) {
        this.lastActivityAt     = data.attributes.lastActivityAt;
        this.name               = data.attributes.name;
        this.open               = data.attributes.open;
        this.unreadMessageCount = data.attributes.unreadMessageCount;
      }

      if (data.relationships) {
        if (data.relationships.users) {
          this.users = data.relationships.users.data.map(function (data) {
            return new BabiliUser(data);
          });
        }

        if (data.relationships.messages) {
          this.messages = data.relationships.messages.data.map(function (data) {
            return new BabiliMessage(data);
          });
        }

        if (data.relationships.initiator) {
          this.initiator = new BabiliUser(data.relationships.initiator);
        }
      }
    };

    BabiliRoom.get = function (id) {
      return $http({
        method  : "GET",
        url     : apiUrl + "/user/rooms/" + id,
        headers : babili.headers()
      }).then(function (response) {
        return new BabiliRoom(response.data.data);
      });
    };

    BabiliRoom.query = function (params) {
      return $http({
        method  : "GET",
        url     : apiUrl + "/user/rooms",
        headers : babili.headers(),
        params  : params
      }).then(function (response) {
        return response.data.data.map(function (data) {
          return new BabiliRoom(data);
        });
      });
    };

    BabiliRoom.create = function (name, ownerId, userIds) {
      return $http({
        method  : "POST",
        url     : apiUrl + "/user/rooms",
        headers : babili.headers(),
        data    : {
          data: {
            type      : "room",
            attributes: {
              name: name
            },
            relationships: {
              users: {
                data: userIds.concat(ownerId).map(function (userId) {
                  return {type: "room", id: userId};
                })
              }
            }
          }
        }
      }).then(function (response) {
        return new BabiliRoom(response.data.data);
      });
    };

    BabiliRoom.prototype.updateMembership = function (attributes) {
      var self = this;

      return $http({
        method  : "PUT",
        url     : apiUrl + "/user/rooms/" + this.id + "/membership",
        headers : babili.headers(),
        data    : {
          data: {
            type       : "membership",
            attributes : attributes
          }
        }
      }).then(function (response) {
        self.open = response.data.data.attributes.open;
        return self;
      });
    };

    BabiliRoom.prototype.update = function () {
      var self = this;

      return $http({
        method  : "PUT",
        url     : apiUrl + "/user/rooms/" + this.id,
        headers : babili.headers(),
        data    : {
          data: {
            type       : "room",
            attributes : {
              name : self.name
            }
          }
        }
      }).then(function (response) {
        self.name = response.data.data.attributes.name;
        return self;
      });
    };

    BabiliRoom.prototype.addUser = function (userId) {
      var self = this;
      return $http({
        method  : "POST",
        url     : apiUrl + "/user/rooms/" + this.id + "/memberships",
        headers : babili.headers(),
        data    : {
          data : {
            type          : "membership",
            relationships : {
              user : {
                data : {
                  type : "user",
                  id   : userId
                }
              }
            }
          }
        }
      }).then(function (response) {
        self.users.push(new BabiliUser(response.data.data));
        return self;
      });
    };

    BabiliRoom.prototype.messageWithId = function (id) {
      var foundMessageIndex = babiliUtils.findIndex(this.messages, function (message) {
        return message.id === id;
      });
      return this.messages[foundMessageIndex];
    };

    BabiliRoom.prototype.openMembership = function () {
      return this.updateMembership({open: true});
    };

    BabiliRoom.prototype.closeMembership = function () {
      return this.updateMembership({open: false});
    };

    BabiliRoom.prototype.addMessage = function (message) {
      this.messages.push(message);
    };

    BabiliRoom.prototype.markAllMessageAsRead = function () {
      var self     = this;
      var deferred = $q.defer();
      if (self.unreadMessageCount > 0) {

        return $http({
          method  : "PUT",
          url     : apiUrl + "/user/rooms/" + this.id + "/membership/unread-messages",
          headers : babili.headers()
        }).then(function (response) {
          self.unreadMessageCount = 0;
          deferred.resolve(response.readMessageCount);
        });
      } else {
        deferred.resolve(0);
      }
      return deferred.promise;
    };

    BabiliRoom.prototype.fetchMoreMessages = function () {
      var self   = this;
      var params = {
        firstSeenMessageId : self.messages[0].id
      };
      return BabiliMessage.query(self, params).then(function (messages) {
        self.messages.unshift.apply(self.messages, messages);
        return messages;
      });
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

(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliUser", function () {
    var BabiliUser = function BabiliUser (data) {
      this.id = data.id;
      if (data.attributes) {
        this.status = data.attributes.status;
      }
    };
    return BabiliUser;
  });
}());

(function () {
  "use strict";

  angular.module("babili")
  .factory("babiliUtils", function () {
    var babiliUtils = {
      findIndex: function (array, predicate) {
        var length = array.length;
        var value;
        for (var i = 0; i < length; i += 1) {
          value = array[i];
          if (predicate(value)) {
            return i;
          }
        }
        return -1;
      }
    };
    return babiliUtils;
  });
}());

