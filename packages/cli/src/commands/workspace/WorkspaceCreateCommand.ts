import { Command, CommandConfiguration, Input } from '../../cli'
import { join } from 'path'
import { createWorkspace } from '../../utils/Workspace'

type Args = {
	workspaceName: string
}

type Options = {
	['with-admin']: boolean
	['single-instance']: boolean
	template: string
}

export class WorkspaceCreateCommand extends Command<Args, Options> {
	protected configure(configuration: CommandConfiguration<Args, Options>): void {
		configuration.description('Creates a new Contember workspace')
		configuration.argument('workspaceName')
		configuration.option('single-instance').valueNone()
		configuration.option('with-admin').valueNone()
		configuration.option('template').valueRequired()
	}

	protected async execute(input: Input<Args, Options>): Promise<void> {
		const workspaceName = input.getArgument('workspaceName')
		const workspaceDirectory = join(process.cwd(), workspaceName)
		const withAdmin = input.getOption('with-admin')
		const singleInstance = input.getOption('single-instance')
		const template = input.getOption('template')
		await createWorkspace({ workspaceDirectory, withAdmin, template, singleInstance })

		console.log(`Workspace ${workspaceName} created`)
	}
}
