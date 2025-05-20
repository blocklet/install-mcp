import type { ArgumentsCamelCase, Argv } from 'yargs'
import { logger } from '../logger'
import { green, red } from 'picocolors'
import { clientNames, readConfig, writeConfig } from '../client-config'

export interface InstallArgv {
  target?: string
  name?: string
  client: string
  local?: boolean
  sse?: boolean
  streamableHTTP?: boolean
  oauth2Bearer?: string
  header?: string
}

export const command = 'install [target]'
export const describe = 'Install MCP server'
export const aliases = ['i']

export function builder(yargs: Argv<InstallArgv>): Argv {
  return yargs
    .positional('target', {
      type: 'string',
      description: 'Installation target (URL or command)',
    })
    .positional('name', {
      type: 'string',
      description: 'Name of the server',
    })
    .option('client', {
      type: 'string',
      description: 'Client to use for installation',
      demandOption: true,
    })
    .option('sse', {
      type: 'boolean',
      description: 'Use SSE mode',
      default: false,
    })
    .option('streamableHTTP', {
      type: 'boolean',
      description: 'Use streamableHTTP mode',
      default: false,
    })
    .option('oauth2Bearer', {
      type: 'string',
      description: 'Adds an Authorization header with the provided Bearer token',
    })
    .option('header', {
      type: 'string',
      description: 'Add a custom header to the request',
    })
    .option('local', {
      type: 'boolean',
      description: 'Install to the local directory instead of the default location',
      default: false,
    })
}

export async function handler(argv: ArgumentsCamelCase<InstallArgv>) {
  if (!argv.client || !clientNames.includes(argv.client)) {
    logger.error(`Invalid client: ${argv.client}. Available clients: ${clientNames.join(', ')}`)
    return
  }

  let target = argv.target
  if (!target) {
    target = (await logger.prompt('Enter the installation target (URL or command):', { type: 'text' })) as string
  }

  let name = argv.name
  if (!name) {
    name = (await logger.prompt('Enter the name of the server:', { type: 'text' })) as string
  }

  const ready = await logger.prompt(
    green(`Are you ready to install MCP server ${target} in ${argv.client}${argv.local ? ' (locally)' : ''}?`),
    { type: 'confirm' },
  )

  if (ready) {
    try {
      const config = readConfig(argv.client, argv.local)

      // if it is a URL, add it to config
      if (target.startsWith('http') || target.startsWith('https')) {
        const type: string[] = []
        const headers: string[] = []

        if (argv.sse) type.push('--sse')
        if (argv.streamableHTTP) type.push('--streamableHTTP')
        if (argv.oauth2Bearer) headers.push('--oauth2Bearer', argv.oauth2Bearer)
        if (argv.header) headers.push('--header', argv.header)

        config.mcpServers[name] = {
          command: 'npx',
          args: ['-y', '@blocklet/supergateway', ...type, target, ...headers],
        }
        writeConfig(config, argv.client, argv.local)
      }

      // if it is a command, add it to config
      else {
        config.mcpServers[name] = {
          command: target.split(' ')[0],
          args: target.split(' ').slice(1),
        }
        writeConfig(config, argv.client, argv.local)
      }

      logger.box(
        green(`Successfully installed MCP server ${target} in ${argv.client}${argv.local ? ' (locally)' : ''}.`),
      )
    } catch (e) {
      logger.error(red((e as Error).message))
    }
  }
}
