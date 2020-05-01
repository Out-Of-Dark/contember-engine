import { KoaMiddleware } from './types'
import Koa from 'koa'

export function compose(middlewares: (KoaMiddleware<any> | Koa.Middleware)[]): KoaMiddleware<any> {
	return async (context, mainNext) => {
		let next = mainNext
		for (let i = middlewares.length - 1; i >= 0; i--) {
			const fn = middlewares[i]
			next = fn.bind(null, context, next)
		}
		return await next()
	}
}
