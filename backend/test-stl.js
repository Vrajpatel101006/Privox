const NodeStl = require('node-stl');
const fs = require('fs');

// Create a dummy simple cube STL
const stlContent = `solid cube
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 10 10 0
      vertex 10 0 0
    endloop
  endfacet
  facet normal 0 0 -1
    outer loop
      vertex 0 0 0
      vertex 0 10 0
      vertex 10 10 0
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 10 0 10
      vertex 10 10 10
    endloop
  endfacet
  facet normal 0 0 1
    outer loop
      vertex 0 0 10
      vertex 10 10 10
      vertex 0 10 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 10 0 0
      vertex 10 0 10
    endloop
  endfacet
  facet normal 0 -1 0
    outer loop
      vertex 0 0 0
      vertex 10 0 10
      vertex 0 0 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 10 0
      vertex 10 10 10
    endloop
  endfacet
  facet normal 1 0 0
    outer loop
      vertex 10 0 0
      vertex 10 10 10
      vertex 10 0 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 10 10 0
      vertex 0 10 0
      vertex 0 10 10
    endloop
  endfacet
  facet normal 0 1 0
    outer loop
      vertex 10 10 0
      vertex 0 10 10
      vertex 10 10 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 10 0
      vertex 0 0 0
      vertex 0 0 10
    endloop
  endfacet
  facet normal -1 0 0
    outer loop
      vertex 0 10 0
      vertex 0 0 10
      vertex 0 10 10
    endloop
  endfacet
endsolid cube`;

fs.writeFileSync('test.stl', stlContent);

try {
  const stl = new NodeStl('test.stl');
  console.log('Volume:', stl.volume, 'cm^3');
  console.log('Area:', stl.area, 'm^2 (or cm^2?)');
  console.log('Bounding Box:', stl.boundingBox);
  
  // Dimensions 
  const [x, y, z] = stl.boundingBox;
  console.log(`Dimensions: L: ${x}mm, W: ${y}mm, H: ${z}mm`);
} catch (err) {
  console.error(err);
}
