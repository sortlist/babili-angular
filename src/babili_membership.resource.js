(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMembership", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/rooms/:roomId/memberships/:id", {
      membershipId: "@membershipId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      }
    });
  });
}());
