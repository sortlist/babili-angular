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
      var deferred = $q.defer();

      if (!attributes || !attributes.content) {
        deferred.resolve(null);
      } else if (!room) {
        deferred.reject(new Error("Room need to be defined."));
      } else {
        BabiliMessage.create(room, attributes).then(
          function (message) {
            room.addMessage(message);
            deferred.resolve(room);
          }
        ).catch(function (err) {
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
        }).then(function () {
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
    return BabiliMe;
  });
}());
