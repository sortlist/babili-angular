(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliAlive", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/user/alive", {}, {
      update: {
        method: "PUT",
        headers: babili.headers()
      }
    });
  });
}());
