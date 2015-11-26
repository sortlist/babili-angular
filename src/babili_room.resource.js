(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($resource, babili, $q, apiUrl, BabiliMessage, BabiliMembership) {
    var BabiliRoom = $resource(apiUrl + "/client/rooms/:id", {
      id: "@id"
    }, {
      get: {
        method: "GET",
        headers: babili.headers()
      },
      update: {
        method: "PUT",
        headers: babili.headers()
      },
      save: {
        method: "POST",
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
