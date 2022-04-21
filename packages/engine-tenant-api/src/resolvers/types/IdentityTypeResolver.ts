import { Identity, IdentityProjectRelation, IdentityResolvers, Maybe, Person } from '../../schema'
import {
	PermissionActions,
	PersonByIdentityBatchQuery,
	PersonRow,
	ProjectManager,
	ProjectMemberManager,
} from '../../model'
import { ResolverContext } from '../ResolverContext'
import { notEmpty } from '../../utils/array'
import { batchLoader } from '../../utils/batchQuery'

export class IdentityTypeResolver implements IdentityResolvers {
	private personLoader = batchLoader<string, Record<string, PersonRow>, PersonRow>(
		async (ids, db) => {
			const persons = await db.queryHandler.fetch(new PersonByIdentityBatchQuery(ids))
			return Object.fromEntries(persons.map(it => [it.identity_id, it]))
		},
		(id, result) => result[id],
	)

	constructor(
		private readonly projectMemberManager: ProjectMemberManager,
		private readonly projectManager: ProjectManager,
	) {}

	async person(parent: Identity, args: unknown, context: ResolverContext): Promise<Maybe<Person>> {
		const person = await context.db.batchLoad(this.personLoader, parent.id)
		if (!person) {
			return null
		}
		return {
			id: person.id,
			email: person.email,
			otpEnabled: !!person.otp_activated_at,
			identity: parent,
		}
	}

	async projects(
		parent: { id: string; projects: readonly IdentityProjectRelation[] },
		{}: any,
		context: ResolverContext,
	): Promise<readonly IdentityProjectRelation[]> {
		if (parent.projects.length > 0) {
			return parent.projects
		}
		const isSelf = parent.id === context.identity.id
		const roles = isSelf ? context.identity.roles : []
		const projects = await this.projectManager.getProjectsByIdentity(context.db, parent.id, context.permissionContext)
		return (
			await Promise.all(
				projects.map(async (it): Promise<IdentityProjectRelation | null> => {
					const verifier = isSelf
						? undefined
						: context.permissionContext.createAccessVerifier(await context.permissionContext.createProjectScope(it))
					const memberships = await this.projectMemberManager.getProjectMemberships(
						context.db,
						{ id: it.id },
						{ id: parent.id, roles },
						verifier,
					)
					if (memberships.length === 0) {
						return null
					}
					return {
						project: { ...it, members: [], roles: [] },
						memberships: memberships,
					}
				}),
			)
		).filter(notEmpty)
	}
}
