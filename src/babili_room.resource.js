(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($resource, babili, $q, apiUrl, BabiliMessage, BabiliMembership) {
    var BabiliRoom = $resource(apiUrl + "/client/rooms/:id", {
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      },
      query: {
        method: "GET",
        headers: babili.headers(),
        isArray: true
      },
      get: {
        method: "GET",
        params: {id: "@id"},
        headers: babili.headers()
      },
      update: {
        method: "PUT",
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
        BabiliRoom.read({id: this.id}).$promise.then(function (response) {
          self.unreadMessageCount = 0;
          deferred.resolve(response.readMessageCount);
        });
      } else {
        deferred.resolve(0);
      }
      return deferred.promise;
    };

    BabiliRoom.prototype.addUser = function (userId) {
      var self = this;
      return BabiliMembership.save({
        roomId: self.id
      }, {
        userId: userId
      }).$promise.then(function (membership) {
        self.users.push(membership.user);
        return membership;
      });
    };

    BabiliRoom.prototype.fetchMoreMessages = function () {
      var self       = this;
      var attributes = {
        roomId: self.id,
        firstSeenMessageId: self.messages[0].id
      };
      return BabiliMessage.query(attributes).$promise.then(function (messages) {
        self.messages.unshift.apply(self.messages, messages);
        return messages;
      });
    };

    BabiliRoom.prototype.update = function () {
      var attributes = {
        name: this.name
      };
      return BabiliRoom.update({id: this.id}, attributes).$promise;
    };
    return BabiliRoom;
  });
}());
