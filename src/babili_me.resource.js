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
