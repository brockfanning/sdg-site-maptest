/*
 * Leaflet legend bars.
 *
 * This is a Leaflet control designed to keep track of selected layers on a map
 * and visualize the selections as stacked bar graphs.
 */
(function () {
  "use strict";

  L.Control.LegendBars = L.Control.extend({
    options: {

    },

  });

  // Helper function to compose the full widget.
  L.Control.legendBars = function(options) {

    return new L.Control.LegendBars(options);
  };
}());
