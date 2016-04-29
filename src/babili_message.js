(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMessage", function ($http, babili, apiUrl, BabiliUser) {
    var BabiliMessage = function BabiliMessage (data) {
      var BabiliRoom   = angular.injector(["babili"]).get("BabiliRoom");
      this.id          = data.id;
      this.content     = data.attributes.content;
      this.contentType = data.attributes.contentType;
      this.createdAt   = new Date(data.attributes.createdAt);
      this.room        = new BabiliRoom(data.relationships.room.data);
      if (data.relationships.sender) {
        this.sender = new BabiliUser(data.relationships.sender.data);
      }
    };

    BabiliMessage.create = function (room, attributes) {
      return $http({
        method  : "POST",
        url     : apiUrl + "/user/rooms/" + room.id + "/messages",
        headers : babili.headers(),
        data    : {
          data : {
            type       : "message",
            attributes : {
              content     : attributes.content,
              contentType : attributes.contentType
            }
          }
        }
      }).then(function (response) {
        return new BabiliMessage(response.data.data);
      });
    };

    BabiliMessage.query = function (room, params) {
      return $http({
        method  : "GET",
        url     : apiUrl + "/user/rooms/" + room.id + "/messages",
        headers : babili.headers(),
        params  : params
      }).then(function (response) {
        return response.data.data.map(function (data) {
          return new BabiliMessage(data);
        });
      });
    };

    return BabiliMessage;
  });
}());
