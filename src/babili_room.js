(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliRoom", function ($http, babili, $q, apiUrl, BabiliUser, BabiliMessage) {

    var BabiliRoom = function BabiliRoom (data) {
      this.id                 = data.id;
      this.lastActivityAt     = data.attributes.lastActivityAt;
      this.name               = data.attributes.name;
      this.open               = data.attributes.open;
      this.unreadMessageCount = data.attributes.unreadMessageCount;
      this.users              = [];
      this.messages           = [];

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

    BabiliRoom.prototype.openMembership = function () {
      return this.updateMembership({open: true});
    };

    BabiliRoom.prototype.closeMembership = function () {
      return this.updateMembership({open: false});
    };

    BabiliRoom.prototype.markAllMessageAsRead = function () {
      var self     = this;
      var deferred = $q.defer();
      if (self.unreadMessageCount > 0) {
        BabiliRoom.read({id: this.id}).then(function (response) {
          self.unreadMessageCount = 0;
          deferred.resolve(response.readMessageCount);
        });
      } else {
        deferred.resolve(0);
      }
      return deferred.promise;
    };

    BabiliRoom.prototype.fetchMoreMessages = function () {
      var self       = this;
      var attributes = {
        roomId             : self.id,
        firstSeenMessageId : self.messages[0].id
      };
      return BabiliMessage.query(attributes).then(function (messages) {
        self.messages.unshift.apply(self.messages, messages);
        return messages;
      });
    };

    return BabiliRoom;
  });
}());
