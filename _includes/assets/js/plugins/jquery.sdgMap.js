/**
 * Notes:
 *
 * On load:
 *  - load all GeoJSON files and attach them as layers, but only one will be visible
 *  - each layer has its own style options
 * On feature click:
 *  - zoom to clicked feature
 *  - select clicked feature
 *  - update info pane about clicked feature
 * On zoom end:
 *  - show/hide layers as needed
 *  - if hiding a layer with a selected feature, unselect and remove info from pane
 *
 * Takeaways:
 * 1. The default layer will always be visible but not always clickable.
 * 2. For sanity, the lower layers should not receive choropleth colors, only outlines
 */
(function($, L, chroma, window, document, undefined) {

  // Create the defaults once
  var defaults = {
    geoLayers: [
      {
        min_zoom: 0,
        max_zoom: 6,
        serviceUrl: '/sdg-indicators/public/parents.geo.json',
        nameProperty: 'rgn17nm',
        idProperty: 'rgn17cd',
        csvDropdownColumn: 'Region',
        styleOptions: {
          weight: 1,
          opacity: 1,
          color: '#888',
          dashArray: '3',
          fillOpacity: 0.7
        },
        styleOptionsSelected: {
          weight: 2,
          color: '#555',
          dashArray: '3',
        }
      },
      {
        min_zoom: 7,
        max_zoom: 20,
        serviceUrl: '/sdg-indicators/public/children.geo.json',
        nameProperty: 'lad16nm',
        idProperty: 'lad16cd',
        csvDropdownColumn: 'Local authority',
        styleOptions: {
          weight: 1,
          opacity: 1,
          color: '#AAA',
          fillOpacity: 0.7
        },
        styleOptionsSelected: {
          weight: 3,
          color: '#222',
        }
      }
    ],
    // Options for using tile imagery with leaflet.
    tileURL: 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}',
    tileOptions: {
      id: 'mapbox.light',
      accessToken: 'pk.eyJ1IjoiYnJvY2tmYW5uaW5nMSIsImEiOiJjaXplbmgzczgyMmRtMnZxbzlmbGJmdW9pIn0.LU-BYMX69uu3eGgk0Imibg',
      attribution: 'Blah blah',
      minZoom: 5,
      maxZoom: 12,
    },
    // Visual/choropleth considerations.
    colorRange: ['#b4c5c1', '#004433'],
    noValueColor: '#f0f0f0',
    legendItems: 5,
    // Placement of map controls.
    legendPosition: 'bottomright',
    sliderPosition: 'bottomleft',
    infoPosition: 'topright',
    // Interaction with disaggregation filters.

  };

  function Plugin(element, options) {

    this.viewObj = options.viewObj;

    this.element = element;
    this.options = $.extend({}, defaults, options);

    this._defaults = defaults;
    this._name = 'sdgMap';

    this.valueRange = [_.min(_.pluck(this.options.geoData, 'Value')), _.max(_.pluck(this.options.geoData, 'Value'))];
    this.colorScale = chroma.scale(this.options.colorRange)
      .domain(this.valueRange)
      .classes(this.options.legendItems);

    this.years = _.uniq(_.pluck(this.options.geoData, 'Year'));
    this.currentYear = this.years[0];

    // Track the selected GeoJSON feature.
    this.selectedFeature = null;

    // Use the ZoomShowHide library to control visibility ranges.
    this.zoomShowHide = new ZoomShowHide();

    // These variables will be set later.
    this.selectedFields = [];
    this.map = null;

    this.init();
  }

  Plugin.prototype = {

    // Update the map according according to the currently-selected fields.
    updateSelectedFields: function() {
      this.updateColors();
    },

    // Get all of the GeoJSON layers.
    getAllLayers: function() {
      return L.featureGroup(this.zoomShowHide.layers);
    },

    // Get only the visible GeoJSON layers.
    getVisibleLayers: function() {
      // Unfortunately relies on an internal of the ZoomShowHide library.
      return this.zoomShowHide._layerGroup;
    },

    // Update the colors of the Features on the map.
    updateColors: function() {
      var plugin = this;
      this.getAllLayers().eachLayer(function(layer) {
        layer.setStyle(function(feature) {
          return { fillColor: plugin.getColor(feature.properties, layer.sdgOptions.idProperty) }
        });
      });
    },

    // Get the local (CSV) data corresponding to a GeoJSON "feature" with the
    // corresponding data.
    getData: function(geocode) {
      var conditions = {
        GeoCode: geocode,
        Year: this.currentYear,
      }
      if (this.viewObj._model.selectedFields.length) {
        this.viewObj._model.selectedFields.forEach(function(selectedField) {
          conditions[selectedField.field] = selectedField.values;
        });
      }
      var matches = _.where(this.options.geoData, conditions);
      if (matches.length) {
        return matches[0];
      }
      else {
        return false;
      }
    },

    // Choose a color for a GeoJSON feature.
    getColor: function(props, idProperty) {
      var thisID = props[idProperty];
      // First filter out most features if there is a selected parent feature.
      if (false && this.selectedFeature) {
        // If there is a selected feature, only display this one if it is
        // either the selected feature, or a child of it, or is a child of
        // the same parent.
        var selectedIDProperty = this.selectedFeature.options.sdgLayer.idProperty;
        var selectedID = this.selectedFeature.feature.properties[selectedIDProperty];
        var thisParent = props.parent;
        var selectedParent = this.selectedFeature.feature.properties.parent;
        var isSameAsSelected = (thisID == selectedID);
        var isChildOfSelected = (thisParent == selectedID);
        var isSiblingOfSelected = (thisParent == selectedParent)
        if (!isSameAsSelected && !isChildOfSelected && !isSiblingOfSelected) {
          return this.options.noValueColor;
        }
      }
      // Otherwise return a color based on the data.
      var localData = this.getData(thisID);
      return (localData) ? this.colorScale(localData['Value']).hex() : this.options.noValueColor;
    },

    // Zoom to a feature.
    zoomToFeature: function(layer) {
      this.map.fitBounds(layer.getBounds());
    },

    init: function() {

      // Create the map.
      this.map = L.map(this.element);
      this.map.setView([0, 0], 0);
      this.zoomShowHide.addTo(this.map);

      // Add tile imagery.
      L.tileLayer(this.options.tileURL, this.options.tileOptions).addTo(this.map);

      // Because after this point, "this" rarely works.
      var plugin = this;

      // Helper function to round values for the legend.
      function round(value) {
        return Math.round(value * 100) / 100;
      }

      // Add the legend.
      var legend = L.control();
      legend.onAdd = function() {
        var div = L.DomUtil.create('div', 'control legend');
        var grades = chroma.limits(plugin.valueRange, 'e', plugin.options.legendItems);
        for (var i = 0; i < grades.length; i++) {
          div.innerHTML +=
            '<i style="background:' + plugin.colorScale(grades[i]).hex() + '"></i> ' +
              round(grades[i]) + (grades[i + 1] ? '&ndash;' + round(grades[i + 1]) + '<br>' : '+');
        }
        return div;
      }
      legend.setPosition(this.options.legendPosition);
      legend.addTo(this.map);

      // Add the slider.
      var slider = L.control();
      slider.onAdd = function() {
        var div = L.DomUtil.create('div', 'control');
        var year = L.DomUtil.create('div', 'current-year', div);
        year.innerHTML = 'Showing year: <strong>' + plugin.currentYear + '</strong>';
        var input = L.DomUtil.create('input', 'slider', div);
        L.DomEvent.disableClickPropagation(input);
        // Add a bunch of attributes.
        input.type = 'range';
        input.min = 0;
        input.max = plugin.years.length - 1;
        input.value = 0;
        input.step = 1;
        input.oninput = function() {
          plugin.currentYear = plugin.years[input.value];
          year.innerHTML = 'Showing year: <strong>' + plugin.currentYear + '</strong>'
          plugin.updateColors();
        }
        return div;
      }
      slider.setPosition(this.options.sliderPosition);
      slider.addTo(this.map);

      // Add the info pane.
      var info = L.control();
      info.onAdd = function() {
        this._div = L.DomUtil.create('div', 'control info');
        this.update();
        return this._div;
      }
      info.update = function(layer) {
        if (this._div) {
          this._div.innerHTML = '';
        }
        if (layer) {
          var props = layer.feature.properties;
          var name = L.DomUtil.create('p', 'info-name', this._div);
          name.innerHTML = props[layer.options.sdgLayer.nameProperty];
          var localData = plugin.getData(props[layer.options.sdgLayer.idProperty]);
          if (localData['Value']) {
            name.innerHTML += ': <span class="info-value">' + localData['Value'] + '</span>';
          }
        }
      }
      info.setPosition(this.options.infoPosition);
      info.addTo(this.map);

      // At this point we need to load the GeoJSON layer/s.
      var geoURLs = this.options.geoLayers.map(function(item) {
        return $.getJSON(item.serviceUrl);
      });
      $.when.apply($, geoURLs).done(function() {

        function onEachFeature(feature, layer) {
          //feature.sdgLayerOptions = this.sdgLayerOptions;
          layer.on({
            click: clickHandler,
          });
        }

        var geoJsons = arguments;
        for (var i in geoJsons) {
          var layer = L.geoJson(geoJsons[i], {
            // Tack on the custom options here to access them later.
            sdgLayer: plugin.options.geoLayers[i],
            style: plugin.options.geoLayers[i].styleOptions,
            onEachFeature: onEachFeature,
          });
          layer.min_zoom = plugin.options.geoLayers[i].min_zoom;
          layer.max_zoom = plugin.options.geoLayers[i].max_zoom;
          // Store our custom options here, for easier access.
          layer.sdgOptions = plugin.options.geoLayers[i];
          // Add the layer to the ZoomShowHide group.
          plugin.zoomShowHide.addLayer(layer);
        }
        plugin.updateColors();

        // Highlight a feature.
        function highlightFeature(layer) {
          layer.setStyle(layer.options.sdgLayer.styleOptionsSelected);
          info.update(layer);

          if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
            layer.bringToFront();
          }
        }

        // Un-highlight a feature.
        function unHighlightFeature(layer) {
          layer.setStyle(layer.options.sdgLayer.styleOptions);
          info.update();
        }

        // Event handler for click/touch.
        function clickHandler(e) {
          var layer = e.target;
          // Clicking "selects" a feature.
          if (plugin.selectedFeature) {
            unHighlightFeature(plugin.selectedFeature);
          }
          plugin.selectedFeature = layer;
          // Zoom in.
          plugin.zoomToFeature(layer);
          // Highlight the feature.
          highlightFeature(layer);

          // Select dropdown if necessary.
          if (layer.options.sdgLayer.csvDropdownColumn) {
            var csvDropdownColumn = layer.options.sdgLayer.csvDropdownColumn;
            var geocode = layer.feature.properties[layer.options.sdgLayer.idProperty];
            var csvData = plugin.getData(geocode);
            var fields = [
              {
                'field': csvDropdownColumn,
                'values': [],
              }
            ]
            // If the CSV data contains it, use it.
            if (csvData[csvDropdownColumn]) {
              fields[0].values.push(csvData[csvDropdownColumn]);
            }
            // Otherwise try the name.
            else {
              fields[0].values.push(layer.feature.properties[layer.options.sdgLayer.nameProperty]);
            }
            // In order to imitate a user click, we have to update the model.
            plugin.viewObj._model.updateSelectedFields(fields);
            // And then we have to manually check the checkbox.
            var checkboxes = document.querySelectorAll('input[data-field="' + csvDropdownColumn + '"]');
            checkboxes.forEach(function(checkbox) {
              if (checkbox.value == fields[0].values[0]) {
                checkbox.checked = true;
              }
            });

            plugin.updateColors();
          }
        }
      });

      // Leaflet needs "invalidateSize()" if it was originally rendered in a
      // hidden element. So we need to do that when the tab is clicked.
      $('.map .nav-link').click(function() {
        setTimeout(function() {
          jQuery('#map #loader-container').hide();
          // Fix the size.
          plugin.map.invalidateSize();
          // Also zoom in/out as needed.
          plugin.zoomToFeature(plugin.getVisibleLayers());
        }, 500);
      });
    },
  };

  // A really lightweight plugin wrapper around the constructor,
  // preventing against multiple instantiations
  $.fn['sdgMap'] = function(options, alternateOptions) {
    return this.each(function() {
      if (typeof options === 'string') {
        if (options == 'update') {
          if ($.data(this, 'plugin_sdgMap')) {
            $.data(this, 'plugin_sdgMap').updateSelectedFields(alternateOptions);
          }
        }
      }
      else {
        if (!$.data(this, 'plugin_sdgMap')) {
          $.data(this, 'plugin_sdgMap', new Plugin(this, options));
        }
      }
    });
  };
})(jQuery, L, chroma, window, document);
