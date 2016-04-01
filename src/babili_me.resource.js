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
      var deferred = $q.defer();
      var self     = this;
      BabiliRoom.query(options).$promise.then(function (rooms) {
        rooms.forEach(function (room) {
          if (!self.roomWithId(room.id)) {
            self.addRoom(room);
          }
          if (room.opened === true && !self.openedRoomWithId(room.id)) {
            self.openedRooms.push(room);
          }
        });
        deferred.resolve();
      }).catch(function (err) {
        deferred.reject(err);
      });
      return deferred.promise;
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
          room.markAllMessageAsRead();
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
        self.addRoom(room);
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
