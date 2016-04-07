(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliUser", function ($resource, $q, babili, apiUrl, BabiliRoom, BabiliMessage, babiliUtils) {

    var BabiliUser = $resource(apiUrl + "/user", {}, {
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

    BabiliUser.prototype.fetchRooms = function (options) {
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

    BabiliUser.prototype.fetchOpenedRooms = function () {
      return this.fetchRooms({onlyOpened: true});
    };

    BabiliUser.prototype.fetchClosedRooms = function () {
      return this.fetchRooms({onlyClosed: true});
    };

    BabiliUser.prototype.fetchMoreRooms = function () {
      return this.fetchRooms({firstSeenRoomId: this.firstSeenRoom.id});
    };

    BabiliUser.prototype.fetchRoomByIds = function (roomIds) {
      return this.fetchRooms({"roomIds[]": roomIds});
    };

    BabiliUser.prototype.roomWithId = function (id) {
      var foundRoomIndex = babiliUtils.findIndex(this.rooms, function (room) {
        return room.id === id;
      });
      return this.rooms[foundRoomIndex];
    };

    BabiliUser.prototype.openedRoomWithId = function (id) {
      var foundRoomIndex = babiliUtils.findIndex(this.openedRooms, function (room) {
        return room.id === id;
      });
      return this.openedRooms[foundRoomIndex];
    };

    BabiliUser.prototype.hasRoomOpened = function (room) {
      return Boolean(this.openedRoomWithId(room.id));
    };

    BabiliUser.prototype.addRoom = function (room) {
      if (!this.firstSeenRoom || this.firstSeenRoom.lastActivityAt > room.lastActivityAt) {
        this.firstSeenRoom = room;
      }
      this.rooms.push(room);
    };

    BabiliUser.prototype.openRoom = function (room) {
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

    BabiliUser.prototype.closeRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      if (self.hasRoomOpened(room)) {
        BabiliRoom.close({id: room.id}).$promise.then(function () {
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

    BabiliUser.prototype.closeRooms = function (rooms) {
      var self     = this;
      var promises = rooms.map(function (room) {
        return self.closeRoom(room);
      });
      return $q.all(promises);
    };

    BabiliUser.prototype.openRoomAndCloseOthers = function (room) {
      var self = this;
      var roomsToBeClosed = self.openedRooms.filter(function (_room) {
        return _room.id !== room.id;
      });
      return self.closeRooms(roomsToBeClosed).then(function () {
        return self.openRoom(room);
      });
    };

    BabiliUser.prototype.hasOpenedRooms = function () {
      return this.openedRooms.length > 0;
    };

    BabiliUser.prototype.createRoom = function (name, babiliUserIds) {
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

    BabiliUser.prototype.updateRoomName = function (room) {
      var self = this;
      return room.update().then(function (_room) {
        var index = babiliUtils.findIndex(self.rooms, function (__room) {
          return room.id === __room.id;
        });
        self.rooms[index].name = _room.name;
        return _room;
      });
    };

    BabiliUser.prototype.addUserToRoom = function (room, userId) {
      return room.addUser(userId);
    };

    BabiliUser.prototype.sendMessage = function (room, message) {
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

    BabiliUser.prototype.messageSentByMe = function (message) {
      return message && this.id === message.senderId;
    };

    BabiliUser.prototype.unreadMessageCount = function () {
      var count = 0;
      this.rooms.forEach(function (room) {
        count = count + room.unreadMessageCount;
      });
      return count;
    };

    BabiliUser.prototype.deleteMessage = function (message) {
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
    return BabiliUser;
  });
}());
