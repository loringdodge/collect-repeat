angular.module('collectRepeat', [])

.factory('$repeatFactory', ['$animate', '$ionicPosition', function($animate,$ionicPosition){

  var RepeatManager = function(collection, map){
    this.map = map;
    this.collection = collection;
    this.startIndex = 0;
    this.endIndex = null;
    this.upperThreshold = 0;
    this.lowerThreshold = null;
    this.itemHeight = null;
    this.inViewCount = null;
    this.scrollHeight = null;
    this.parentElement = null;
    this.parentHeight = null;
  }

  RepeatManager.prototype = {
    setDefaults: function(clone, windowHeight) {
      var itemOffset = $ionicPosition.offset(clone);
      var itemHeight = Math.round(itemOffset.height);

      this.windowHeight = windowHeight;
      this.itemHeight = itemHeight;

      this.parentHeight = (this.collection.length + 1) * this.itemHeight;

      // Set the # of clones to be rendered at any given time
      this.inViewCount = Math.ceil((this.windowHeight / this.itemHeight) + 4);
      // Set the comparative scroll height of all the rendered divs
      this.scrollHeight = this.inViewCount * this.itemHeight;
      // Set the endIndex: either the collection or inViewCount, whichever is greater
      this.endIndex = (this.collection.length < this.inViewCount ) ? this.collection.length-1 : this.inViewCount-1;
      // Set the lowerThreshold so we know when to render a new item below the fold
      var lowerThreshold = this.scrollHeight;
      this.setThreshold('lower', lowerThreshold);
    },
    setThreshold: function(orientation, number) {
      if(orientation === 'upper') {
        this.upperThreshold = number;
      } else if(orientation === 'lower') {
        this.lowerThreshold = number;
      }
    }
  }

  return {
    RepeatManager: RepeatManager,
    createMap: function() {
      return Object.create(null);
    },
    updateScope: function(obj) {
      var scope = obj.scope;

      scope[obj.valueIdentifier] = obj.value;
      scope.$index = obj.index;
      scope.$first = (obj.index === 0);
      scope.$last = (obj.index === (obj.arrayLength - 1));
      scope.$middle = !(scope.$first || scope.$last);
      scope.$odd = !(scope.$even = (obj.index&1) === 0);
    },
    transcludeClone: function($transclude, scopeParams) {

    },
    renderClone: function() {

    }
  }

}])


.directive('collectRepeat', [ '$animate', '$repeatFactory', '$ionicPosition', function($animate, $repeatFactory, $ionicPosition) {

  return {
    restrict: 'A',
    priority: 1000,
    transclude: 'element',
    compile: function($element, $attrs) {

      var expression = $attrs.collectRepeat;

      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)?\s*$/);

      var valueIdentifier = match[1];
      var collection = match[2];

      return function($scope, $element, $attr, ctrl, $transclude) {

        // Create a new object (map) to help keep track of which items have been transcluded
        var newMap = $repeatFactory.createMap();
        // Create a new instance of RepeatManager (the object that maintains the state of our repeat)
        var Manager = new $repeatFactory.RepeatManager($scope.collection, newMap);

        Manager.parentElement = $element[0].parentElement;

        // Set a watch on the collection. Every time the collection changes, this block will be executed
        $scope.$watchCollection(collection, function(collection) {


          // The process of creating a collection repeat is repeated after every change to a collection
          // It's broken into 3 components:
          //    1. Render the first element to get dimensions for the Manager
          //    2. Loop and render only those elements that are in view
          //    3. Set a 'scroll' event listener to render and remove depending on constraints


          var index, length, previousNode = $element[0], collectionLength, key, value;

          collectionLength = collection.length;

          // Query the 'scroll-content' div (specific to ionic) and set windowHeight in Manager
          var content = document.getElementsByClassName('scroll-content');
          var windowHeight = content[0].clientHeight;

      // ********* 1. *********

          // Render only if it hasn't been registered with Manager
          if(typeof Manager.map[key] === 'undefined') {
            index = key = 0;
            // Transclude the first element of the collection so we can get item measurements
            $transclude(function(clone, scope) {

              clone[0].style.position = 'absolute';
              clone[0].style.width = '100%';
              clone[0].style.transform = clone[0].style.webkitTransform = 'translate3d(0,' + ((Manager.itemHeight*index) + 'px') + ',0)';
              // Render the cloned directive onto the DOM
              $animate.enter(clone, null, angular.element(previousNode));
              // Set the previousNode to this clone (used for next item)
              previousNode = clone;
              // Update this clone's scope
              var scopeParams = {
                scope: scope,
                index: index,
                valueIdentifier: valueIdentifier,
                value: value,
                key: key,
                collectionLength: collectionLength
              }
              $repeatFactory.updateScope(scopeParams);

              // Register the node with the Manager
              Manager.map[key] = {
                index: 0,
                value: collection[key],
                clone: clone,
                scope: scope,
                previousNode: null
              }

              // Set the default values for the Manager
              Manager.setDefaults(clone, windowHeight);
            });
          }

          Manager.parentElement.style.position = 'relative';
          Manager.parentElement.style.height = Manager.parentHeight + 'px';

      // ********* 2. *********

          // Loop through all the nodes that are inView
          for (index = (Manager.startIndex + 1); index < Manager.inViewCount; index++) {
            key = index;
            value = collection[key];

            // Render only if it hasn't been registered with Manager
            if(typeof Manager.map[key] === 'undefined') {
              $transclude(function(clone, scope) {

                clone[0].style.position = 'absolute';
                clone[0].style.width = '100%';
                clone[0].style.transform = clone[0].style.webkitTransform = 'translate3d(0,' + ((Manager.itemHeight*index) + 'px') + ',0)';

                $animate.enter(clone, null, angular.element(previousNode));
                previousNode = clone;
                var scopeParams = {
                  scope: scope,
                  index: index,
                  valueIdentifier: valueIdentifier,
                  value: value,
                  key: key,
                  collectionLength: collectionLength
                }
                $repeatFactory.updateScope(scopeParams);

                Manager.map[key] = {
                  index: key,
                  value: collection[key],
                  clone: clone,
                  scope: scope,
                  previousNode: previousNode
                }

              });
            } else {
              // else just render the element
              $animate.enter(Manager.map[key].clone, null, angular.element(Manager.map[key].previousNode));
            }

          }

      // ********* 3. *********

          $scope.currentScroll = 0;

          angular.element(content[0]).on('scroll', function(e) {
            $scope.currentScroll = $ionicPosition.offset(Manager.map[Manager.startIndex].clone).top;
            $scope.$apply();
          });

          $scope.$watch('currentScroll', function(scrollHeight) {
            if(scrollHeight <= -Manager.itemHeight && (Manager.endIndex < Manager.collection.length)) {
              Manager.endIndex++;
              key = index = Manager.endIndex;
              // Render only if it hasn't been registered with Manager
              if(typeof Manager.map[key] === 'undefined') {
                $transclude(function(clone, scope) {

                  clone[0].style.position = 'absolute';
                  clone[0].style.width = '100%';
                  clone[0].style.transform = clone[0].style.webkitTransform = 'translate3d(0,' + ((Manager.itemHeight*index) + 'px') + ',0)';

                  $animate.enter(clone, null, angular.element(previousNode));
                  previousNode = clone;

                  var scopeParams = {
                    scope: scope,
                    index: index,
                    valueIdentifier: valueIdentifier,
                    value: value,
                    key: key,
                    collectionLength: collectionLength
                  }
                  $repeatFactory.updateScope(scopeParams);
                  Manager.map[key] = {
                    index: key,
                    value: collection[key],
                    clone: clone,
                    scope: scope,
                    previousNode: previousNode
                  }

                });
              } else {
                // else just render the element
                $animate.enter(Manager.map[Manager.endIndex].clone, Manager.parentElement);
              }
              if(Manager.startIndex > 0) {
                $animate.leave(Manager.map[--Manager.startIndex].clone);
                Manager.startIndex++;
              }
              $scope.currentIndex = Manager.map[Manager.startIndex++].clone;
            } else if(scrollHeight >= Manager.itemHeight) {
              if(Manager.startIndex > 0) {
                Manager.startIndex--;
                $animate.enter(Manager.map[Manager.startIndex].clone, null, $element[0]);
                $animate.leave(Manager.map[Manager.endIndex].clone);
                Manager.endIndex--;
              }
            }
          });

        });

      }
    }
  }

}])