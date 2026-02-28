/**
 * Adapter registry for agent runtimes.
 */

const ADAPTERS = {
  'claude-code': () => import('./claude-code.mjs'),
  copilot: () => import('./copilot.mjs'),
}

/**
 * Get an adapter module by name.
 * @param {string} name - Adapter name
 * @returns {Promise<object>} Adapter module with { name, isAvailable, execute }
 * @throws {Error} If adapter is not registered
 */
export async function getAdapter(name) {
  const loader = ADAPTERS[name]
  if (!loader) {
    const available = Object.keys(ADAPTERS).join(', ')
    throw new Error(
      `Unknown adapter "${name}". Available adapters: ${available}`
    )
  }
  return loader()
}

/**
 * List all registered adapters with their availability status.
 * @returns {Promise<Array<{ name: string, available: boolean }>>}
 */
export async function listAdapters() {
  const result = []
  for (const [name, loader] of Object.entries(ADAPTERS)) {
    const mod = await loader()
    result.push({
      name,
      available: await mod.isAvailable(),
    })
  }
  return result
}
