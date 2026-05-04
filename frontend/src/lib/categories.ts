// Shared product categories for Prinvox marketplace
// Shared product categories for Prinvox marketplace with premium styling metadata
export const PRODUCT_CATEGORIES = [
  { id: 'Anime Models & Figurines',         emoji: '🎌', color: 'from-pink-500/20 to-rose-500/5', icon: 'Ghost', image: '/categories/anime.png' },
  { id: 'Idols & Religious Sculptures',     emoji: '🛕', color: 'from-amber-500/20 to-yellow-500/5', icon: 'Sun', image: '/categories/religious.png' },
  { id: 'Home Decor',                       emoji: '🏠', color: 'from-blue-500/20 to-cyan-500/5', icon: 'Home', image: '/categories/decor.png' },
  { id: 'Miniatures',                       emoji: '🎲', color: 'from-purple-500/20 to-indigo-500/5', icon: 'Box', image: '/categories/miniatures.png' },
  { id: 'Cosplay Props',                    emoji: '🎭', color: 'from-red-500/20 to-orange-500/5', icon: 'Masks', image: '/categories/props.png' },
  { id: 'Action Figures & Toys',            emoji: '🤖', color: 'from-emerald-500/20 to-teal-500/5', icon: 'Bot', image: '/categories/toys.png' },
  { id: 'Jewelry',                          emoji: '💍', color: 'from-violet-500/20 to-purple-500/5', icon: 'Sparkles', image: '/categories/jewelry.png' },
  { id: 'Kitchenware',                      emoji: '🍪', color: 'from-orange-500/20 to-yellow-500/5', icon: 'UtensilsCrossed', image: '/categories/kitchenware.png' },
  { id: 'Tech Accessories',                 emoji: '📱', color: 'from-sky-500/20 to-blue-500/5', icon: 'Cpu', image: '/categories/tech.png' },
  { id: 'Replacement Parts',               emoji: '⚙️', color: 'from-slate-500/20 to-zinc-500/5', icon: 'Settings', image: '/categories/parts.png' },
  { id: 'Fidget Toys',                      emoji: '🐉', color: 'from-lime-500/20 to-green-500/5', icon: 'Zap', image: '/categories/fidget.png' },
  { id: 'Planters & Gardening',             emoji: '🌱', color: 'from-green-500/20 to-emerald-500/5', icon: 'Leaf', image: '/categories/gardening.png' },
  { id: 'Architectural Models',             emoji: '🏛️', color: 'from-stone-500/20 to-neutral-500/5', icon: 'Building2', image: '/categories/architectural.png' },
  { id: 'Prosthetics & Medical Models',     emoji: '🏥', color: 'from-red-500/20 to-rose-500/5', icon: 'HeartPulse', image: '/categories/medical.png' },
  { id: 'Fashion Wearables',               emoji: '👗', color: 'from-fuchsia-500/20 to-pink-500/5', icon: 'Shirt', image: '/categories/fashion.png' },
  { id: 'Musical Instruments',              emoji: '🎸', color: 'from-indigo-500/20 to-blue-500/5', icon: 'Music', image: '/categories/musical.png' },
  { id: 'Educational Models',              emoji: '🔬', color: 'from-cyan-500/20 to-blue-500/5', icon: 'Microscope', image: '/categories/educational.png' },
  { id: 'Lithophanes',                      emoji: '🖼️', color: 'from-neutral-500/20 to-transparent', icon: 'Image', image: '/categories/LithophaneVase.jpg' },
  { id: 'Automotive Parts',                emoji: '🚗', color: 'from-red-600/20 to-red-900/5', icon: 'Car', image: '/categories/AutomotiveParts.jpg' },
  { id: 'Stationery',                       emoji: '✏️', color: 'from-yellow-500/20 to-orange-500/5', icon: 'PenTool', image: '/categories/Stationary.jpg' },
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number]['id'];
