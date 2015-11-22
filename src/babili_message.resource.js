(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMessage", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/rooms/:roomId/messages/:id", {
      roomId: "@roomId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      },
      get: {
        method: "GET",
        withCredentials: true,
        headers: headers()
      },
      query: {
        method: "GET",
        withCredentials: true,
        isArray: true,
        headers: headers()
      },
      "delete": {
        method: "delete",
        withCredentials: true,
        headers: headers()
      }
    });
  });
}());
