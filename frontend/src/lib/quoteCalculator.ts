// Frontend mirror of the quote calculator (no server call needed for live preview)
const GST_RATE = 0.18;

export const calculateQuote = (materialCost: number, machineCost: number, laborCost: number, platformFeeRate: number = 0.10) => {
  const subtotal = materialCost + machineCost + laborCost;
  const gst = subtotal * GST_RATE;
  const platformFee = subtotal * platformFeeRate;
  const totalPrice = subtotal + gst + platformFee;
  return {
    materialCost: +materialCost.toFixed(2),
    machineCost: +machineCost.toFixed(2),
    laborCost: +laborCost.toFixed(2),
    gst: +gst.toFixed(2),
    platformFee: +platformFee.toFixed(2),
    totalPrice: +totalPrice.toFixed(2),
  };
};
