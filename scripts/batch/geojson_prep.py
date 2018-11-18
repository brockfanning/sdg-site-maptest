# -*- coding: utf-8 -*-
"""
This script tweaks GeoJSON files to prepare them for use with sdg-theme.

For now this is run manually and the results versioned, but ideally this would
be part of a build script.

This script is designed to work with a parent-child pair of geojsons, where one
is a set of boundaries that contain the other. For example, US states and
counties.
"""
import json
import urllib.request

lookup_file = 'https://opendata.arcgis.com/datasets/46d0cf00f75e4e4d8f5703c1cee283da_0.geojson'
lookup_parent_col = 'RGN16CD'
lookup_child_col = 'LAD16CD'

geojson_child_file = 'https://geoportal1-ons.opendata.arcgis.com/datasets/686603e943f948acaa13fb5d2b0f1275_4.geojson'
geojson_child_col = 'lad16cd'
geojson_parent_file = 'https://opendata.arcgis.com/datasets/4fcca2a47fed4bfaa1793015a18537ac_4.geojson'
geojson_parent_col = 'rgn17cd'

# Get the lookup table, as a dict of parents to lists of children.
lookup_table = {}
with urllib.request.urlopen(lookup_file) as url:
  lookup_data = json.loads(url.read().decode())
  for feature in lookup_data['features']:
    child = feature['properties'][lookup_child_col]
    parent = feature['properties'][lookup_parent_col]
    if parent not in lookup_table:
      lookup_table[parent] = []
    lookup_table[parent].append(child)

# Helper function to get parent from child.
def get_parent_from_child(child_id):
  for parent in lookup_table:
    if child_id in lookup_table[parent]:
      return parent
  return None

# Fix the child geojson by adding the 'parent' property.
child_data = None
with urllib.request.urlopen(geojson_child_file) as url:
  child_data = json.loads(url.read().decode())
  for feature in child_data['features']:
    child_id = feature['properties'][geojson_child_col]
    parent_id = get_parent_from_child(child_id)
    feature['properties']['parent'] = parent_id

# Fix the parent geojson by adding the 'has_children' property.
parent_data = None
with urllib.request.urlopen(geojson_parent_file) as url:
  parent_data = json.loads(url.read().decode())
  for feature in parent_data['features']:
    parent_id = feature['properties'][geojson_parent_col]
    if parent_id in lookup_table and len(lookup_table[parent_id]) > 0:
      feature['properties']['has_children'] = 1

# Output results to file.
with open('children.geo.json', 'w') as outfile:
  json.dump(child_data, outfile)
with open('parents.geo.json', 'w') as outfile:
  json.dump(parent_data, outfile)
