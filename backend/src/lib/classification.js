const { MaterialDensities } = require('./materials');

/**
 * Calculates the estimated print weight and platform commission category
 * 
 * @param {number} solidVolume - Base geometry volume in cm^3
 * @param {number} areaCm2 - Surface area in cm^2
 * @param {object} boundingBox - { length, width, height } in cm
 * @param {string} materialType - e.g. 'PLA', 'ABS'
 * @param {number} infillPercentage - e.g. 20 for 20%
 * @returns {object} { weightGrams, category, commissionRate }
 */
function classifyAndEstimate(solidVolume, areaCm2, boundingBox, materialType, infillPercentage) {
  // 1. Estimation Math Model
  const shellVolume = areaCm2 * 0.12; // 1.2mm walls
  const internalVolume = Math.max(0, solidVolume - shellVolume);
  const actualVolumeToPrint = shellVolume + (internalVolume * (infillPercentage / 100));
  
  // Calculate final print volume including realistic waste (Supports, Skirt, Brim/Bed Adhesion)
  // Industry average for rafts + standard supports is ~25% extra material bloat for typical FDM printing.
  const wasteMultiplier = 1.25; 
  const materialDensity = MaterialDensities[materialType] || MaterialDensities['PLA'];
  
  const weightGrams = (actualVolumeToPrint * wasteMultiplier) * materialDensity;

  // 2. Classification Logic
  // Dimensions check
  const l = boundingBox?.length || 0;
  const w = boundingBox?.width || 0;
  const h = boundingBox?.height || 0;

  const fitsSmall = weightGrams <= 250 && l <= 10 && w <= 10 && h <= 10;
  const fitsMedium = weightGrams <= 1000 && l <= 20 && w <= 20 && h <= 20;
  
  let category = 'Large';
  let commissionRate = 0.16; // 16% default Large

  if (fitsSmall) {
    category = 'Small';
    commissionRate = 0.11;
  } else if (fitsMedium) {
    category = 'Medium';
    commissionRate = 0.13;
  }

  return {
    weightGrams: Math.round(weightGrams * 100) / 100, // Round to 2 decimals
    category,
    commissionRate
  };
}

module.exports = {
  classifyAndEstimate
};
