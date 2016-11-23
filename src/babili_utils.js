(function () {
  "use strict";

  angular.module("babili")
  .factory("babiliUtils", function () {
    var babiliUtils = {
      findIndex: function (array, predicate) {
        var length = array.length;
        var value;
        for (var i = 0; i < length; i += 1) {
          value = array[i];
          if (predicate(value)) {
            return i;
          }
        }
        return -1;
      }
    };
    return babiliUtils;
  });
}());

