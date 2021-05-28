import { compose, KoaMiddleware, KoaRequestState, route } from '../koa'
import corsMiddleware from '@koa/cors'
import { createProjectMemberMiddleware, createProjectResolveMiddleware } from '../project-common'
import { createStageResolveMiddleware } from './StageResolveMiddlewareFactory'
import { createNotModifiedMiddleware } from './NotModifiedMiddlewareFactory'
import { createAuthMiddleware, createModuleInfoMiddleware } from '../common'
import { createContentServerMiddleware } from './ContentServerMiddleware'

export const createContentMiddleware = (): KoaMiddleware<KoaRequestState> => {
	return route(
		'/content/:projectSlug/:stageSlug$',
		compose([
			createModuleInfoMiddleware('content'),
			corsMiddleware(),
			createAuthMiddleware(),
			createProjectResolveMiddleware(),
			createStageResolveMiddleware(),
			createNotModifiedMiddleware(),
			createProjectMemberMiddleware(),
			createContentServerMiddleware(),
		]),
	)
}
