export const DECOR_TYPES = ['well', 'crates', 'flowers', 'bush', 'tree', 'rock', 'barrel', 'cart', 'grass']
export const DECOR_VARIANTS = [1, 2, 3]

export function decorationVariant(decor) {
  return DECOR_VARIANTS.includes(decor.variant) ? decor.variant : 1
}
