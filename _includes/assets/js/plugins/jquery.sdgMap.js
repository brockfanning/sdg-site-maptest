/**
 * Notes:
 *
 * TODO:
 * Remove zoom control on mobile (L.Browser.mobile)
 * Remove legend and instead but a min/max bar at the top of the info pane.
 * Change info pane to show these two lines:
 * Name of region    |\/| (close button)
 * ============123   |/\|
 * If a child region is selected, and it's parent is not selected, make sure
 * to select it's parent.
 * Selections are always positioned child beneath parent
 * Make sure height is not greater than window height (-50 for ease of scrolling)
 * If feature is clicked again after selected, then unselect it and do not zoom
 * Zooming in/out has no affect one selected features
 * Make zoom on select an option
 */
(function($, L, chroma, window, document, undefined) {

  // Create the defaults once
  var defaults = {
    geoLayers: [
      {
        min_zoom: 0,
        max_zoom: 6,
        serviceUrl: '/sdg-site-maptest/public/parents.geo.json',
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
        }
      },
      {
        min_zoom: 7,
        max_zoom: 20,
        serviceUrl: '/sdg-site-maptest/public/children.geo.json',
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
      },
    ],
    // Options for the TimeDimension library.

    // Options for using tile imagery with leaflet.
    tileURL: 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}',
    tileOptions: {
      id: 'mapbox.light',
      accessToken: 'pk.eyJ1IjoiYnJvY2tmYW5uaW5nMSIsImEiOiJjaXplbmgzczgyMmRtMnZxbzlmbGJmdW9pIn0.LU-BYMX69uu3eGgk0Imibg',
      attribution: 'Blah blah',
      minZoom: 5,
      maxZoom: 8,
    },
    // Visual/choropleth considerations.
    colorRange: ['#b4c5c1', '#004433'],
    noValueColor: '#f0f0f0',
    // Placement of map controls.
    sliderPosition: 'bottomleft',
    infoPosition: 'topright',
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
      .classes(9);

    this.years = _.uniq(_.pluck(this.options.geoData, 'Year'));
    this.currentYear = this.years[0];

    // Track the selected GeoJSON features.
    this.selectedFeatures = [];

    // Use the ZoomShowHide library to control visibility ranges.
    this.zoomShowHide = new ZoomShowHide();

    // These variables will be set later.
    this.map = null;

    this.init();
  }

  Plugin.prototype = {

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

      // Remove zoom control on mobile.
      if (L.Browser.mobile) {
        this.map.removeControl(this.map.zoomControl);
      }

      // Add tile imagery.
      L.tileLayer(this.options.tileURL, this.options.tileOptions).addTo(this.map);

      // Because after this point, "this" rarely works.
      var plugin = this;

      // Add the time dimension stuff.
      // Hardcode the timeDimension to year intervals, because this is the SDGs.
      var timeDimension = new L.TimeDimension({
        period: 'P1Y',
        timeInterval: this.years[0] + '-01-02/' + this.years[this.years.length - 1] + '-01-02',
        currentTime: new Date(this.years[0] + '-01-02').getTime(),
      });
      // Save the timeDimension on the map so that it can be used by all layers.
      this.map.timeDimension = timeDimension;
      // Create the player. @TODO: Make these options configurable?
      var player = new L.TimeDimension.Player({
        transitionTime: 100,
        loop: false,
        startOver:true
      }, timeDimension);
      // Create the control. @TODO: Make these options configurable?
      var timeDimensionControlOptions = {
        player: player,
        timeDimension: timeDimension,
        position: this.options.sliderPosition,
        timeSliderDragUpdate: true,
        speedSlider: false,
      };
      // We have to hijack the control to set the output format.
      // @TODO: Create PR to make this configurable - this is a common need.
      L.Control.TimeDimensionCustom = L.Control.TimeDimension.extend({
        _getDisplayDateFormat: function(date){
          return date.getFullYear();
        }
      });
      var timeDimensionControl = new L.Control.TimeDimensionCustom(timeDimensionControlOptions);
      this.map.addControl(timeDimensionControl);
      // Listen to year changes to update the map colors.
      timeDimension.on('timeload', function(e) {
        plugin.currentYear = new Date(e.time).getFullYear();
        plugin.updateColors();
      });

      // Helper function to round values for the legend.
      function round(value) {
        return Math.round(value * 100) / 100;
      }

      // Add the info pane.
      var info = L.control();
      info.onAdd = function() {
        this._div = L.DomUtil.create('div', 'leaflet-control info');
        this._legend = L.DomUtil.create('div', '', this._div);
        this._features = L.DomUtil.create('div', 'feature-list', this._div);
        var grades = chroma.limits(plugin.valueRange, 'e', 9);
        for (var i = 0; i < grades.length; i++) {
          this._legend.innerHTML += '<span class="info-swatch" style="background:' + plugin.colorScale(grades[i]).hex() + '"></span>';
        }
        return this._div;
      }
      info.update = function() {
        this._features.innerHTML = '';
        // TODO: finish this.
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
          info.update();

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
          plugin.selectedFeatures.push(layer);
          // Zoom in.
          plugin.zoomToFeature(layer);
          // Highlight the feature.
          highlightFeature(layer);
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
  $.fn['sdgMap'] = function(options) {
    return this.each(function() {
      if (!$.data(this, 'plugin_sdgMap')) {
        $.data(this, 'plugin_sdgMap', new Plugin(this, options));
      }
    });
  };
})(jQuery, L, chroma, window, document);
