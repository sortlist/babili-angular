(function () {
  "use strict";

  angular.module("babili")

  .factory("BabiliUser", function () {
    var BabiliUser = function BabiliUser (data) {
      this.id                 = data.id;
      if (data.attributes) {
        this.status = data.attributes.status;
      }
    };
    return BabiliUser;
  });
}());
