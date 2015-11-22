(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliAlive", function ($resource, apiUrl, ipCookie) {
    var headers = function () {
      return {
        "X-XSRF-BABILI-TOKEN": ipCookie("XSRF-BABILI-TOKEN")
      };
    };
    return $resource(apiUrl + "/client/alive", {}, {
      save: {
        method: "POST",
        withCredentials: true,
        headers: headers()
      }
    });
  });
}());
