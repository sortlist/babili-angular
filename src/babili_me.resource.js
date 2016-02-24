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
          return transformedResponse;
        }
      }
    });

    BabiliMe.prototype.roomWithId = function (id) {
      var deferred = $q.defer();
      var foundRoom = _.find(this.rooms, function (room) {
        return room.id === id;
      });
      deferred.resolve(foundRoom);
      return deferred.promise;
    };

    BabiliMe.prototype.hasRoomOpened = function (room) {
      var deferred = $q.defer();
      if (room && room.id) {
        deferred.resolve(_.includes(this.openedRoomIds, room.id));
      } else {
        deferred.reject(new Error("Room need to be defined."));
      }
      return deferred.promise;
    };

    BabiliMe.prototype.openRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      self.hasRoomOpened(room).then(function (isOpen) {
        if (!isOpen) {
          BabiliRoom.open({id: room.id}).$promise.then(function () {
            self.openedRoomIds.push(room.id);
            room.markAllMessageAsRead();
            deferred.resolve(room);
          });
        } else {
          deferred.resolve();
        }
      });

      return deferred.promise;
    };

    BabiliMe.prototype.closeRoom = function (room) {
      var self     = this;
      var deferred = $q.defer();

      self.hasRoomOpened(room).then(function (isOpen) {
        if (isOpen) {
          BabiliRoom.close({id: room.id}).$promise.then(function () {
            _.remove(self.openedRoomIds, function (openedRoomId) {
              return openedRoomId === room.id;
            });
            deferred.resolve(room);
          });
        } else {
          deferred.resolve();
        }
      });
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
      var self            = this;
      var roomsToBeClosed = self.rooms.filter(function (_room) {
        return _room.id !== room.id;
      });
      return self.closeRooms(roomsToBeClosed).then(function () {
        return self.openRoom(room);
      });
    };

    BabiliMe.prototype.hasOpenedRooms = function () {
      var deferred = $q.defer();
      deferred.resolve(!_.isEmpty(this.openedRoomIds));
      return deferred.promise;
    };

    BabiliMe.prototype.openedRooms = function () {
      var self       = this;
      var deferred   = $q.defer();
      var foundRooms = _.filter(self.rooms, function (room) {
        return _.includes(self.openedRoomIds, room.id);
      });
      deferred.resolve(foundRooms);
      return deferred.promise;
    };

    BabiliMe.prototype.createRoom = function (name, babiliUserIds) {
      var self     = this;
      var deferred = $q.defer();
      var room     = new BabiliRoom({
        name:    name,
        userIds: babiliUserIds.concat(self.id)
      });
      BabiliRoom.save(room).$promise.then(function (room) {
        return self.roomWithId(room.id).then(function (foundRoom) {
          if (foundRoom) {
            deferred.resolve(foundRoom);
          } else {
            self.rooms.push(room);
            deferred.resolve(room);
          }
        });
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
      return this.roomWithId(room.id).then(function (room) {
        return room.addUser(this, babiliUserId);
      });
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
          return self.roomWithId(room.id).then(function (room) {
            room.messages.push(_message);
            deferred.resolve(_message);
          });
        }).catch(function (err) {
          deferred.reject(err);
        });
      }
      return deferred.promise;
    };

    BabiliMe.prototype.messageSentByMe = function (message) {
      var deferred = $q.defer();
      deferred.resolve(message && this.id === message.senderId);
      return deferred.promise;
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
            var index = _.findIndex(room.messages, function(messageToDelete) {
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
