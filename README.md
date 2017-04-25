# Babili Angular Library

## Usage

* Install with bower

    ```
    bower install -E babili-angular
    ```

* Install with npm

    ```
    npm install -E --save babili-angular
    ```

* Add the angular dependency to your app module:

  ```
  var myapp = angular.module('myapp', ['babili']);
  ```

  or in es6 style

  ```
  import angular     from "angular";
  import babili      from  "babili-angular";

  const myapp = angular.module("myapp", [babili])
  .config(babiliConfig);

  /*@ngInject*/
  function babiliConfig(babiliProvider) {
    babiliProvider.configure({
      apiUrl:    process.env.BABILI_API_URL,
      socketUrl: process.env.BABILI_SOCKET_URL
    });
  }

  export default inboxModule;

  ```

* Configure endpoints

    ```
    babiliProvider.configure({
      apiUrl    : <api-url>,
      socketUrl : <socket-url>
    })
    ```

* Load the user with her opened rooms and the first page of closed rooms

    ```
    babili.connect(scope, babiliToken).then(function (babiliUser) {
      $rootScope.babiliUser.fetchOpenedRooms().then(function () {
        $rootScope.babiliUser.fetchClosedRooms().then(function () {
          $scope.$apply();
        });
      });    
    });
    ```

## Changelog

### Version 0.11.0

Since version 0.11.0 messages are not marked as read automatically once the room has been opened. This allows you to control the reading state in a more granular way. (Messages are still marked as read upon room opening).

For Example, always mark new messages as read in a room:

```
$scope.room = room;
$scope.$watchCollection("room.messages", function() {
  babiliUser.markAllReceivedMessagesAsRead($scope.room)
};
```

You might want to do this conditionaly, e.g., only when the tab has the focus or only when the user clicks on the reply input field.

## Develop

Install packages:

  ```
  npm install
  ```

Compile sources:

  ```
  gulp
  ```

Auto recompile sources:

  ```
  gulp watch
  ```
