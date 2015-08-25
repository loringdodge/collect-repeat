angular.module('starter', ['ionic', 'collectRepeat'])

.controller('MainCtrl', function($scope) {

  var newArr = [];
  for(var i = 0; i < 10000; i++) {
    newArr.push(i);
  }

  $scope.collection = newArr;

})

