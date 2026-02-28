/** Adapter name */
export const name = 'copilot'

/**
 * GitHub Copilot CLI adapter (stub).
 * Copilot does not yet support a headless/print mode suitable for
 * autonomous task execution. This adapter is a placeholder.
 *
 * @returns {Promise<boolean>}
 */
export async function isAvailable() {
  return false
}

/**
 * Execute a task via Copilot.
 * @throws {Error} Always — headless mode not yet supported
 */
export async function execute() {
  throw new Error(
    'Copilot headless mode is not yet supported. Use the claude-code adapter instead.'
  )
}
