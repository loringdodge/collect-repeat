angular.module('collectRepeat', [])

.factory('$repeatFactory', ['$animate', '$ionicPosition', function($animate,$ionicPosition){

  var calculateParentHeight = function(collectionLength, itemHeight) {
    return (collectionLength + 1) * itemHeight;
  }

  var calculateInViewCount = function(windowHeight, itemHeight, extra) {
    return Math.ceil((windowHeight / itemHeight) + extra);
  }

  var calculateScrollHeight = function(inViewCount, itemHeight) {
    return inViewCount * itemHeight;
  }

  var calculateEndIndex = function(collectionLength, inViewCount) {
    return (collectionLength < inViewCount ? collectionLength : inViewCount) - 1;
  }

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

      this.parentHeight = calculateParentHeight(this.collection.length, this.itemHeight);
      // Set the # of clones to be rendered at any given time
      this.inViewCount = calculateInViewCount(this.windowHeight, this.itemHeight, 4);
      // Set the comparative scroll height of all the rendered divs
      this.scrollHeight = calculateScrollHeight(this.inViewCount, this.itemHeight);
      // Set the endIndex: either the collection or inViewCount, whichever is greater
      this.endIndex = calculateEndIndex(this.collection.length, this.inViewCount);
      // Set the lowerThreshold so we know when to render a new item below the fold
      this.setThreshold('lower', this.scrollHeight);
    },
    setThreshold: function(orientation, number) {
      if(orientation === 'upper') {
        this.upperThreshold = number;
      } else if(orientation === 'lower') {
        this.lowerThreshold = number;
      }
    },
    registerNode: function(node) {
      this.map[node.index] = node;
    },
    isNodeRegistered: function(node) {
      return !typeof node === 'undefined';
    },
    isBelowLowerThreshold: function(scrollHeight) {
      return scrollHeight <= -(this.itemHeight*2);
    },
    isAboveLowerThreshold: function(scrollHeight){
      return scrollHeight >= -(this.itemHeight*2);
    },
    isAtEndOfArray: function() {
      return this.endIndex < this.collection.length;
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
    transcludeClone: function(clone, scope, Manager, index, valueIdentifier, value, key, collection, previousNode) {
      this.styleClone(clone[0], Manager.itemHeight*index);

      // Render the cloned directive onto the DOM
      this.renderNode(clone, null, angular.element(previousNode));

      // Set the previousNode to this clone (used for next item)
      previousNode = clone;

      // Update this clone's scope
      this.updateScope({
        scope: scope,
        index: index,
        valueIdentifier: valueIdentifier,
        value: value,
        key: key,
        collectionLength: collection.length
      });

      // Register the node with the Manager
      Manager.registerNode({
        index: index,
        value: collection[key],
        clone: clone,
        scope: scope,
        previousNode: (index) ? previousNode : null
      });
    },
    renderNode: function(node, parent, previous) {
      $animate.enter(node, parent, previous);
    },
    removeNode: function(node) {
      $animate.leave(node);
    },
    styleClone: function(clone, x) {
      clone.style.position = 'absolute';
      clone.style.width = '100%';
      clone.style.transform = clone.style.webkitTransform = 'translate3d(0,' + (x + 'px') + ',0)';
    },
    styleParent: function(parent, height) {
      parent.style.position = 'relative';
      parent.style.height = height + 'px';
    }
  }

}])


.directive('collectRepeat', ['$repeatFactory', '$ionicPosition', function($repeatFactory, $ionicPosition) {

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

        // Register the parent element
        Manager.parentElement = $element[0].parentElement;

        // Set a watch on the collection. Every time the collection changes, this block will be executed
        $scope.$watchCollection(collection, function(collection) {

        var index, length, previousNode = $element[0], collectionLength, key, value;

        collectionLength = collection.length;

        // Query the 'scroll-content' div (specific to ionic) and set windowHeight in Manager
        var content = document.getElementsByClassName('scroll-content');
        var windowHeight = content[0].clientHeight;

      // ********* 1. *********
      // Render the first element to get dimensions for the Manager

          // Transclude the first element of the collection
          $transclude(function(clone, scope) {

            index = key = 0;
            value = collection[key];

            // Render the clone
            $repeatFactory.transcludeClone(clone, scope, Manager, index, valueIdentifier, value, key, collection, previousNode);

            // Set the default values for the Manager
            Manager.setDefaults(clone, windowHeight);
          });

          $repeatFactory.styleParent(Manager.parentElement, Manager.parentHeight);

      // ********* 2. *********
      // Loop and render only those elements that are in view

          // Loop through all the nodes that will be inView
          for (index = (Manager.startIndex + 1); index < Manager.inViewCount; index++) {
            key = index;
            value = collection[key];

            // Transclude the node
            $transclude(function(clone, scope) {

              // Render the clone
              $repeatFactory.transcludeClone(clone, scope, Manager, index, valueIdentifier, value, key, collection, previousNode);

            });

          }

      // ********* 3. *********
      // Set a 'scroll' event listener to render and remove depending on view

          $scope.currentScroll = 0;

          // Create listener on scroll event
          // On Scroll, return the height of the top most node in view
          angular.element(content[0]).on('scroll', function(e) {
            $scope.currentScroll = $ionicPosition.offset(Manager.map[Manager.startIndex].clone).top;
            $scope.$apply();
          });

          // Set watch on $scope.currentScroll and return scrollHeight
          $scope.$watch('currentScroll', function(scrollHeight) {

            // Is scrollHeight below the predetermined threshold and are there still elements to be shown?
            if(Manager.isBelowLowerThreshold(scrollHeight) && Manager.isAtEndOfArray()) {

              key = index = ++Manager.endIndex;
              value = collection[key];

              // Has the node already been registered with the Manager?
              if(Manager.isNodeRegistered(key)) {

                // Render the node
                $repeatFactory.renderNode(Manager.map[Manager.endIndex].clone, Manager.parentElement, null);

              } else {

                $transclude(function(clone, scope) {

                  $repeatFactory.transcludeClone(clone, scope, Manager, index, valueIdentifier, value, key, collection, previousNode);

                });

              }

              // Is the view set to it's top most position?
              if(Manager.startIndex === 0) return;

              $repeatFactory.removeNode(Manager.map[--Manager.startIndex].clone);
              Manager.startIndex++;

            } else if(Manager.isAboveLowerThreshold(scrollHeight)) {

              // Is the view set to it's top most position?
              if(Manager.startIndex === 0) return;

              $repeatFactory.renderNode(Manager.map[--Manager.startIndex].clone, null, $element[0]);
              $repeatFactory.removeNode(Manager.map[Manager.endIndex--].clone);

            }
          });

        });

      }
    }
  }

}])