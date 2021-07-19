import { GraphQLTestQuery } from '../cases/integration/mocked/gql/types'
import { testUuid } from './testUuid'
import { ProjectSchemaResolver } from '../../src/model/type'
import {
	createResolverContext,
	PermissionContext,
	ResolverContext,
	StaticIdentity,
	TenantContainerFactory,
	TenantMigrationArgs,
	typeDefs,
} from '../../src'
import { Buffer } from 'buffer'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { Acl, Schema } from '@contember/schema'
import { createMockedMailer, MockedMailer } from './mailer'
import { dbCredentials, recreateDatabase } from './dbUtils'
import { MigrationsRunner } from '@contember/database-migrations'
import { graphql } from 'graphql'
import { Membership } from '../../src/model/type/Membership'
import { Connection } from '@contember/database'
import * as uvu from 'uvu'

export interface TenantTest {
	query: GraphQLTestQuery
	return: object
	sentMails?: { subject: string }[]
}

export const createUuidGenerator = () => {
	let id = 1
	return () => testUuid(id++)
}

export const now = new Date('2019-09-04 12:00')
const schema: Schema = {
	model: { entities: {}, enums: {} },
	validation: {},
	acl: {
		roles: {
			superEditor: {
				stages: '*',
				entities: {},
				tenant: {
					invite: true,
					manage: {
						editor: {
							variables: {
								language: 'language',
							},
						},
					},
				},
				variables: {
					language: {
						type: Acl.VariableType.entity,
						entityName: 'Language',
					},
				},
			},
			editor: {
				stages: '*',
				entities: {},
				variables: {
					language: {
						type: Acl.VariableType.entity,
						entityName: 'Language',
					},
				},
			},
		},
	},
}

const projectSchemaResolver: ProjectSchemaResolver = project => Promise.resolve(schema)

export const authenticatedIdentityId = testUuid(999)
export const authenticatedApiKeyId = testUuid(998)

interface TenantTestOptions {
	membership?: Membership
	roles?: string[]
}

export interface TenantTester {
	execute(query: GraphQLTestQuery, options?: TenantTestOptions): Promise<any>
	mailer: MockedMailer
	end: () => Promise<void>
}

export const createTenantTester = async (): Promise<TenantTester> => {
	const dbName = String(process.env.TEST_DB_NAME)
	const credentials = dbCredentials(dbName)
	const conn = await recreateDatabase(dbName)
	await conn.end()
	const getMigrations = (await import(process.env.CONTEMBER_TENANT_MIGRATIONS_DIR || '../../migrations')).default
	const migrationsRunner = new MigrationsRunner(credentials, 'tenant', getMigrations)

	let counter = 0
	const providers = {
		bcrypt: (value: string) => Promise.resolve('BCRYPTED-' + value),
		bcryptCompare: (data: string, hash: string) => Promise.resolve('BCRYPTED-' + data === hash),
		now: () => now,
		randomBytes: (length: number) => Promise.resolve(Buffer.alloc(length, (counter++).toString())),
		uuid: createUuidGenerator(),
	}

	await migrationsRunner.migrate<TenantMigrationArgs>(() => {}, {
		credentials: {
			rootToken: process.env.CONTEMBER_ROOT_TOKEN,
		},
		providers,
	})
	const mailer = createMockedMailer()
	const tenantContainer = new TenantContainerFactory()
		.createBuilder({
			tenantDbCredentials: credentials,
			mailOptions: {},
			providers,
			projectSchemaResolver,
			projectInitializer: () => {
				throw new Error()
			},
		})
		.replaceService('mailer', () => mailer)
		.build()

	await tenantContainer.projectManager.createProject({ slug: 'blog', name: 'blog' })

	const schema = makeExecutableSchema({
		typeDefs: typeDefs,
		resolvers: tenantContainer.resolvers as any,
		resolverValidationOptions: {
			requireResolversForResolveType: 'ignore',
		},
	})

	return {
		async execute(query: GraphQLTestQuery, options: TenantTestOptions = {}): Promise<any> {
			const context: ResolverContext = createResolverContext(
				new PermissionContext(
					new StaticIdentity(authenticatedIdentityId, options.roles || [], {
						blog: [options.membership || { role: 'admin', variables: [] }],
					}),
					tenantContainer.authorizator,
					tenantContainer.projectScopeFactory,
				),
				authenticatedApiKeyId,
			)
			const result = await graphql(
				schema,
				typeof query === 'string' ? query : query.query,
				null,
				context,
				typeof query === 'string' ? undefined : query.variables,
			)
			return JSON.parse(JSON.stringify(result))
		},
		mailer,
		end: async () => {
			await (tenantContainer.connection as Connection).end()
		},
	}
}

interface TenantContext {
	tester: TenantTester
}

export const dbSuite = (title: string) => {
	const dbSuite = uvu.suite<TenantContext>(title)
	dbSuite.before.each(async ctx => {
		try {
			ctx.tester = await createTenantTester()
		} catch (e) {
			console.error(e)
			process.exit(1)
		}
	})
	dbSuite.after.each(async ctx => {
		await ctx.tester.end()
	})
	return dbSuite
}
