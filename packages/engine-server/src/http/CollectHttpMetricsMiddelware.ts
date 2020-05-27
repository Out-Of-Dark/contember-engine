import prom from 'prom-client'
import { ProjectResolveMiddlewareFactory } from './project-common'
import { KoaMiddleware } from '../core/koa'
import { ModuleInfoMiddlewareState } from './common/ModuleInfoMiddleware'
import { GraphQLInfoState } from './common/GraphqlInfoProviderPlugin'

export const createColllectHttpMetricsMiddleware = (
	registry: prom.Registry,
): KoaMiddleware<Partial<ProjectResolveMiddlewareFactory.KoaState & ModuleInfoMiddlewareState & GraphQLInfoState>> => {
	const requestSummary = new prom.Histogram({
		name: 'contember_http_duration_seconds',
		help:
			'Incoming HTTP requests statistics by http_method (OPTIONS requests are ignored), http_code, contember_project (or "unknown" for undefined project), contember_module (system, tenant, content, unknown) and graphql_operation (query, mutation, unknown)',
		registers: [registry],
		labelNames: ['http_method', 'http_code', 'contember_project', 'contember_module', 'graphql_operation'],
		buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
	})

	return async (ctx, next) => {
		const end = ctx.method === 'OPTIONS' ? () => null : requestSummary.startTimer()
		try {
			await next()
		} finally {
			const labels = {
				http_method: ctx.method,
				http_code: ctx.status,
				contember_project: ctx.state.projectContainer?.project?.slug || 'unknown',
				contember_module: ctx.state.module || 'unknown',
				graphql_operation: ctx.state.graphql?.operationName || 'unknown',
			}
			end(labels)
		}
	}
}
