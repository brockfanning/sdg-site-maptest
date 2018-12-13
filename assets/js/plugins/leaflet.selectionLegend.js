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

    addSelection: function(selection) {

    },

    removeSelection: function(selection) {

    },

    onAdd: function() {
      var controlTpl = '' +
        '<ul id="selection-list"></ul>' +
        '<div class="legend-swatches">' +
          '{legendSwatches}' +
        '</div>' +
        '<div class="legend-values">' +
          '<span class="legend-value left">{lowValue}</span>' +
          '<span class="arrow left"></span>' +
          '<span class="legend-value right">{highValue}</span>' +
          '<span class="arrow right"></span>' +
        '</div>';
      var swatchTpl = '<span class="legend-swatch" style="width:{width}%; background:{color};"></span>';
      var swatchWidth = 100 / this.options.colorRange.length;
      var swatches = this.options.colorRange.map(function(swatchColor) {
        return L.Util.template(swatchTpl, {
          width: swatchWidth,
          color: swatchColor,
        });
      }).join('');
      var div = L.DomUtil.create('div', 'selection-legend');
      div.innerHTML = L.Util.template(controlTpl, {
        lowValue: this.options.valueRange[0],
        highValue: this.options.valueRange[1],
        legendSwatches: swatches,
      });
      return div;
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

