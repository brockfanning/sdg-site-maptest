/*
 * Leaflet legend bars.
 *
 * This is a Leaflet control designed to keep track of selected layers on a map
 * and visualize the selections as stacked bar graphs.
 */
(function () {
  "use strict";

  L.Control.SelectionLegend = L.Control.extend({
    options: {
      colorRange: chroma.brewer.BuGn,
      valueRange: null,
    },

    initialize: function(options) {
      L.setOptions(this, options);
      this.selections = [];
    },

    onAdd: function() {
      this._div = L.DomUtil.create('div', 'leaflet-control info');
      this._features = L.DomUtil.create('ul', 'feature-list', this._div);
      this._legend = L.DomUtil.create('div', 'legend', this._div);
      this._legendValues = L.DomUtil.create('div', 'legend-values', this._div);
      var swatchWidth = 100 / this.options.colorRange.length;
      for (var i = 0; i < this.options.colorRange.length; i++) {
        this._legend.innerHTML += '<span class="info-swatch" style="width:' + swatchWidth + '%; background:' + this.options.colorRange[i] + '"></span>';
      }
      this._legendValues.innerHTML += '<span class="legend-value left">' + this.options.valueRange[0] + '</span><span class="arrow left"></span>';
      this._legendValues.innerHTML += '<span class="legend-value right">' + this.options.valueRange[1] + '</span><span class="arrow right"></span>';

      return this._div;
    },

    update: function() {
      return;
      this._features.innerHTML = '';
      var pane = this;
      if (plugin.selectedFeatures.length) {
        plugin.selectedFeatures.forEach(function(layer) {
          var item = L.DomUtil.create('li', '', pane._features);
          var props = layer.feature.properties;
          var data = plugin.getData(props);
          var name, value, bar;
          if (data) {
            var fraction = (data - plugin.valueRange[0]) / (plugin.valueRange[1] - plugin.valueRange[0]);
            var percentage = Math.round(fraction * 100);
            name = '<span class="info-name">' + props.name + '</span>';
            value = '<span class="info-value" style="right: ' + percentage + '%">' + data + '</span>';
            bar = '<span class="info-bar" style="display: inline-block; width: ' + percentage + '%"></span>';
          }
          else {
            name = '<span class="info-name info-no-value">' + props.name + '</span>';
            value = '';
            bar = '';
          }
          item.innerHTML = bar + value + name + '<i class="info-close fa fa-remove"></i>';
          $(item).click(function(e) {
            plugin.unselectFeature(layer);
          });
          // Make sure that the value is not overlapping with the name.
          var nameWidth = $(item).find('.info-name').width();
          var barWidth = $(item).find('.info-bar').width();
          if (barWidth < nameWidth) {
            // If the bar is shorter than the name, bump out the value.
            // Adding 25 makes it come out right.
            var valueMargin = (nameWidth - barWidth) + 25;
            $(item).find('.info-value').css('margin-right', valueMargin + 'px');
          }
        });
      }
    }

  });

  // Factory function for this class.
  L.Control.selectionLegend = function(options) {
    return new L.Control.SelectionLegend(options);
  };
}());

