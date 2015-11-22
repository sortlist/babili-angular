(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($resource, $q, apiUrl, ipCookie, BabiliMessage,
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
  });
}());
