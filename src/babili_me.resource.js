(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMe", function ($resource, $q, apiUrl, ipCookie, BabiliRoom, BabiliMessage) {
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
  });
}());
