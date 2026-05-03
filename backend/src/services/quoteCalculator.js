/**
 * Quote Pricing Calculator
 *
 * Total Price = Material Cost + Machine Cost + Labor Cost + GST (18%) + Platform Fee (10%)
 */

const GST_RATE = 0.18;

/**
 * @param {object} params
 * @param {number} params.materialCost - Direct material cost (grams * price_per_gram)
 * @param {number} params.machineCost  - Machine usage cost (hours * machine_rate)
 * @param {number} params.laborCost    - Labor cost (minutes * labor_rate)
 * @param {number} params.platformFeeRate - Dynamic commission rate (e.g. 0.11 for Small)
 * @returns {object} Full pricing breakdown
 */
const calculateQuote = ({ materialCost, machineCost, laborCost, platformFeeRate = 0.10 }) => {
  const subtotal = materialCost + machineCost + laborCost;
  const gst = subtotal * GST_RATE;
  const platformFee = subtotal * platformFeeRate;
  const totalPrice = subtotal + gst + platformFee;

  return {
    materialCost: parseFloat(materialCost.toFixed(2)),
    machineCost: parseFloat(machineCost.toFixed(2)),
    laborCost: parseFloat(laborCost.toFixed(2)),
    gst: parseFloat(gst.toFixed(2)),
    platformFee: parseFloat(platformFee.toFixed(2)),
    totalPrice: parseFloat(totalPrice.toFixed(2)),
  };
};

module.exports = { calculateQuote };
