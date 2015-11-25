(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliAlive", function ($resource, babili, apiUrl) {
    return $resource(apiUrl + "/client/alive", {}, {
      save: {
        method: "POST",
        headers: babili.headers()
      }
    });
  });
}());
