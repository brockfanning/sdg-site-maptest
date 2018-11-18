var mapView = function () {

  "use strict";

  this.initialise = function(geoData, geoCodeRegEx, viewObj) {
    $('.map').show();
    $('#map').sdgMap({
      geoData: geoData,
      geoCodeRegEx: geoCodeRegEx,
      viewObj: viewObj
    });
  };

  this.update = function() {
    $('#map').sdgMap('update');
  }
};
