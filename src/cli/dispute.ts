import type { CliContext } from './types.js'

const HELP = `
  opencastle dispute [options]

  Manage convoy dispute resolution — view, create, and resolve disputes
  that arise when panel reviews repeatedly block a task.

  Subcommands:
    list             List all disputes
    show <id>        Show dispute details
    resolve <id>     Mark a dispute as resolved

  Options:
    --convoy <id>    Filter by convoy ID
    --help, -h       Show this help
`

export default async function dispute({ args }: CliContext): Promise<void> {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP)
    return
  }

  console.error('  ✗ Dispute management is not yet implemented.')
  console.log(HELP)
  process.exit(1)
}
