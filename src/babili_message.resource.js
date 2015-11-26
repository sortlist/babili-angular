(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMessage", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/client/rooms/:roomId/messages/:id", {
      roomId: "@roomId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      },
      get: {
        method: "GET",
        headers: babili.headers()
      },
      query: {
        method: "GET",
        isArray: true,
        headers: babili.headers()
      },
      "delete": {
        method: "delete",
        headers: babili.headers()
      }
    });
  });
}());
