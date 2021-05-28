import {
	compose,
	createContentMiddleware,
	createDebugInfoMiddleware,
	createErrorResponseMiddleware,
	createHomepageMiddleware,
	createPlaygroundMiddleware,
	createServicesProviderMiddleware,
	createSystemMiddleware,
	createTenantMiddleware,
	createTimerMiddleware,
	KoaMiddleware,
	route,
	ServicesState,
} from '@contember/engine-http'
import prom from 'prom-client'
import koaCompress from 'koa-compress'
import bodyParser from 'koa-bodyparser'
import { createColllectHttpMetricsMiddleware } from './CollectHttpMetricsMiddelware'
import { Config } from '../config/config'

export const createRootMiddleware = (
	debug: boolean,
	services: ServicesState,
	prometheusRegistry: prom.Registry,
	httpConfig: Config['server']['http'],
): KoaMiddleware<any> => {
	return compose([
		koaCompress({
			br: false,
		}),
		bodyParser({
			jsonLimit: httpConfig.requestBodySize || '1mb',
		}),
		createColllectHttpMetricsMiddleware(prometheusRegistry),
		createDebugInfoMiddleware(debug),
		createServicesProviderMiddleware(services),
		createErrorResponseMiddleware(),
		createTimerMiddleware(),
		route('/playground$', createPlaygroundMiddleware()),
		createHomepageMiddleware(),
		createContentMiddleware(),
		createTenantMiddleware(),
		createSystemMiddleware(),
	])
}
