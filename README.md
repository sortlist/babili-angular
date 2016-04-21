# Babili Angular Library

## Usage

* Install 

    ```
    bower install -E babili
    ```

* Configure endpoints

    ```
    babiliProvider.configure
      apiUrl    : <api-url>
      socketUrl : <socket-url>
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

## Develop

Install packages:

```
npm install
```

Compile sources:

```
grunt
```
