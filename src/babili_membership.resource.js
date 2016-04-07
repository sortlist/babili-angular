(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliMembership", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/user/rooms/:roomId/memberships/:id", {
      membershipId: "@membershipId",
      id: "@id"
    }, {
      save: {
        method: "POST",
        headers: babili.headers()
      }
    });
  });
}());
