import Project from './Project'
import {
	ConfigLoader,
	createObjectParametersResolver,
	Merger,
	resolveParameters,
	UndefinedParameterError,
} from '@contember/config-loader'
import { DatabaseCredentials } from '@contember/engine-common'
import { tuple, upperCaseFirst } from '../utils'
import { MailerOptions } from '@contember/engine-tenant-api'
import { ConfigProcessor } from '@contember/engine-plugins'
import { isObject, typeConfigError, hasStringProperty, hasNumberProperty } from '@contember/engine-common'

export { Project }

export interface TenantConfig {
	db: DatabaseCredentials
	mailer: MailerOptions
}

export interface Config {
	tenant: TenantConfig
	projects: Record<string, Project>
	server: {
		port: number
		monitoringPort: number
		logging: {
			sentry?: {
				dsn: string
			}
		}
	}
}

function checkDatabaseCredentials(json: unknown, path: string): DatabaseCredentials {
	if (!isObject(json)) {
		return typeConfigError(path, json, 'object')
	}
	if (!hasStringProperty(json, 'host')) {
		return typeConfigError(path + '.host', json.host, 'string')
	}
	if (!hasNumberProperty(json, 'port')) {
		if (hasStringProperty({ ...json }, 'port')) {
			console.warn(
				`DEPRECATED: Property ${path}.port must be a number, but string was found. Use ::number typecast in config.`,
			)
			json.port = Number(json.port)
		} else {
			return typeConfigError(path + '.port', json.port, 'number')
		}
	}
	if (!hasNumberProperty(json, 'port')) {
		throw new Error('impl error')
	}
	if (!hasStringProperty(json, 'user')) {
		return typeConfigError(path + '.user', json.user, 'string')
	}
	if (!hasStringProperty(json, 'password')) {
		return typeConfigError(path + '.password', json.password, 'string')
	}
	if (!hasStringProperty(json, 'database')) {
		return typeConfigError(path + '.database', json.database, 'string')
	}
	return json
}

function checkMailerParameters(json: unknown, path: string): MailerOptions {
	if (!isObject(json)) {
		return typeConfigError(path, json, 'object')
	}
	const values = Object.fromEntries(Object.entries(json).filter(([, it]) => it !== undefined))
	if ('from' in values && !hasStringProperty(values, 'from')) {
		return typeConfigError(path + '.from', values.from, 'string')
	}
	if ('host' in values && !hasStringProperty(values, 'host')) {
		return typeConfigError(path + '.host', values.host, 'string')
	}
	if ('port' in values && !hasNumberProperty(values, 'port')) {
		return typeConfigError(path + '.port', values.port, 'number')
	}
	if ('user' in values && !hasStringProperty(json, 'user')) {
		return typeConfigError(path + '.user', json.user, 'string')
	}
	if ('password' in values && !hasStringProperty(json, 'password')) {
		return typeConfigError(path + '.password', json.password, 'string')
	}
	return {
		...values,
		...('user' in values && 'password' in values
			? { auth: { user: String(values.user), pass: String(values.password) } }
			: {}),
	}
}

function checkTenantStructure(json: unknown): Config['tenant'] {
	if (!isObject(json)) {
		return typeConfigError('tenant', json, 'object')
	}
	return {
		db: checkDatabaseCredentials(json.db, 'tenant.db'),
		mailer: checkMailerParameters(json.mailer, 'tenant.mailer'),
	}
}

function checkStageStructure(json: unknown, slug: string, path: string): Project.Stage {
	json = json || {}
	if (!isObject(json)) {
		return typeConfigError(path, json, 'object')
	}

	if (json.name && !hasStringProperty(json, 'name')) {
		return typeConfigError(path + '.name', json.name, 'string')
	}
	return { name: upperCaseFirst(slug), ...json, slug }
}

function checkProjectStructure(json: unknown, slug: string, path: string): Project {
	if (!isObject(json)) {
		return typeConfigError(path, json, 'object')
	}

	if (json.name && !hasStringProperty(json, 'name')) {
		return typeConfigError(path + '.name', json.name, 'string')
	}
	if (!isObject(json.stages)) {
		return typeConfigError(`${path}.stages`, json.stages, 'object')
	}
	if (json.dbCredentials) {
		console.warn(`${path}.dbCredentials is deprecated, use ${path}.db instead`)
		json.db = json.dbCredentials
	}
	const stages = Object.entries(json.stages).map(([slug, value]) =>
		checkStageStructure(value, slug, `${path}.stages.${slug}`),
	)
	return {
		name: upperCaseFirst(slug).replace(/-/g, ' '),
		directory: `${slug}/api`,
		...json,
		slug,
		stages: stages,
		db: checkDatabaseCredentials(json.db, `${path}.db`),
	}
}

function checkServerStructure(json: unknown): Config['server'] {
	if (!isObject(json)) {
		return typeConfigError('server', json, 'object')
	}
	if (!hasNumberProperty(json, 'port')) {
		if (hasStringProperty({ ...json }, 'port')) {
			console.warn(
				`DEPRECATED: Property server.port must be a number, but string was found. Use ::number typecast in config.`,
			)
			json.port = Number(json.port)
		} else {
			return typeConfigError('server.port', json.port, 'number')
		}
	}
	if (!hasNumberProperty(json, 'port')) {
		throw new Error('impl error')
	}
	if (!hasNumberProperty(json, 'monitoringPort')) {
		return typeConfigError('server.monitoringPort', json.monitoringPort, 'number')
	}
	return { ...json, logging: checkLoggingStructure(json.logging) }
}

function checkLoggingStructure(json: unknown): Config['server']['logging'] {
	if (!json) {
		return {}
	}
	if (!isObject(json)) {
		return typeConfigError('logging', json, 'object')
	}
	let sentry: Config['server']['logging']['sentry'] = undefined
	if (json.sentry) {
		if (!isObject(json.sentry)) {
			return typeConfigError('logging.sentry', json.sentry, 'object')
		}
		if (json.sentry.dsn) {
			if (!hasStringProperty(json.sentry, 'dsn')) {
				return typeConfigError('logging.sentry.dsn', json.sentry.dsn, 'string')
			}
			sentry = { dsn: json.sentry.dsn }
		}
	}

	return { sentry }
}

function checkConfigStructure(json: unknown): Config {
	if (!isObject(json)) {
		return typeConfigError('', json, 'object')
	}
	if (!isObject(json.projects)) {
		return typeConfigError('project', json.projects, 'object')
	}

	const projects = Object.entries(json.projects).map(([slug, value]) =>
		tuple(slug, checkProjectStructure(value, slug, `projects.${slug}`)),
	)
	return {
		...json,
		projects: Object.fromEntries(projects),
		tenant: checkTenantStructure(json.tenant),
		server: checkServerStructure(json.server),
	}
}

const projectNameToEnvName = (projectName: string): string => {
	return projectName.toUpperCase().replace(/-/g, '_')
}

export async function readConfig(filenames: string[], configProcessors: ConfigProcessor[] = []): Promise<Config> {
	const loader = new ConfigLoader()
	const configs = await Promise.all(filenames.map(it => loader.load(it)))
	const env: Record<string, string> = {
		...configProcessors.reduce((acc, curr) => ({ ...acc, ...curr.getDefaultEnv() }), {}),
		...Object.fromEntries(Object.entries(process.env).filter((it): it is [string, string] => it[1] !== undefined)),
	}

	const defaultTemplate: any = {
		tenant: {
			db: {
				host: `%tenant.env.DB_HOST%`,
				port: `%tenant.env.DB_PORT::number%`,
				user: `%tenant.env.DB_USER%`,
				password: `%tenant.env.DB_PASSWORD%`,
				database: `%tenant.env.DB_NAME%`,
			},
			mailer: {
				from: '%?tenant.env.MAILER_FROM%',
				host: '%?tenant.env.MAILER_HOST::string%',
				port: '%?tenant.env.MAILER_PORT::number%',
				secure: '%?tenant.env.MAILER_SECURE::bool%',
				user: '%?tenant.env.MAILER_USER%',
				password: '%?tenant.env.MAILER_PASSWORD%',
			},
		},
		projectDefaults: {
			db: {
				host: `%project.env.DB_HOST%`,
				port: `%project.env.DB_PORT::number%`,
				user: `%project.env.DB_USER%`,
				password: `%project.env.DB_PASSWORD%`,
				database: `%project.env.DB_NAME%`,
			},
		},
		server: {
			port: '%env.CONTEMBER_PORT::number%',
			monitoringPort: '%env.CONTEMBER_MONITORING_PORT::number%',
			logging: {
				sentry: {
					dsn: '%?env.SENTRY_DSN%',
				},
			},
		},
	}

	const template = configProcessors.reduce(
		(tpl, processor) => processor.prepareConfigTemplate(tpl, { env }),
		defaultTemplate,
	)

	let { projectDefaults, ...config } = Merger.merge(template, ...configs)
	if (typeof projectDefaults === 'object' && projectDefaults !== null && typeof config.projects === 'object') {
		const projectsWithDefaults = Object.entries(config.projects).map(([slug, project]) =>
			tuple(slug, Merger.merge(projectDefaults as any, project as any)),
		)
		config.projects = Object.fromEntries(projectsWithDefaults)
	}
	const parametersResolver = createObjectParametersResolver({ env })
	config = resolveParameters(config, (parts, path, dataResolver) => {
		if (parts[0] === 'project') {
			if (path[0] !== 'projects' || typeof path[1] !== 'string') {
				throw new Error(`Invalid use of ${parts.join('.')} variable in path ${path.join('.')}.`)
			}
			const projectSlug = path[1]
			if (parts[1] === 'env') {
				const envName = parts[2]
				const projectEnvName = projectNameToEnvName(projectSlug)
				const envValue = env[projectEnvName + '_' + envName] || env['DEFAULT_' + envName]
				if (envValue === undefined) {
					throw new UndefinedParameterError(`ENV variable "${projectEnvName + '_' + envName}" not found.`)
				}
				return envValue
			} else if (parts[1] === 'slug') {
				return projectSlug
			}
		}
		if (parts[0] === 'tenant') {
			if (path[0] !== 'tenant') {
				throw new Error(`Invalid use of ${parts.join('.')} variable in path ${path.join('.')}.`)
			}
			if (parts[1] === 'env') {
				const envName = parts[2]
				const envValue = env['TENANT_' + envName] || env['DEFAULT_' + envName]
				if (envValue === undefined) {
					throw new UndefinedParameterError(`ENV variable "${'TENANT_' + envName}" not found.`)
				}
				return envValue
			}
			throw new UndefinedParameterError(`Parameter "${parts.join('.')}" not found.`)
		}

		return parametersResolver(parts, path, dataResolver)
	})

	return configProcessors.reduce<Config>(
		(config, processor) => processor.processConfig(config, { env }),
		checkConfigStructure(config),
	)
}
