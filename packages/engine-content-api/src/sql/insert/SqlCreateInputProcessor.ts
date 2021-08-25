import { Input, Value } from '@contember/schema'
import Mapper from '../Mapper'
import InsertBuilder from './InsertBuilder'
import { Providers, resolveColumnValue } from '@contember/schema-utils'
import { CreateInputProcessor } from '../../inputProcessing'
import * as Context from '../../inputProcessing/InputContext'
import { getInsertPrimary, MutationEntryNotFoundError, MutationResultList } from '../Result'
import { hasManyProcessor, hasOneProcessor } from '../MutationProcessorHelper'
import { AbortInsert } from './Inserter'

export default class SqlCreateInputProcessor implements CreateInputProcessor<MutationResultList> {
	constructor(
		private readonly insertBuilder: InsertBuilder,
		private readonly mapper: Mapper,
		private readonly providers: Providers,
	) {}

	public async column(context: Context.ColumnContext): Promise<MutationResultList> {
		this.insertBuilder.addFieldValue(
			context.column.name,
			((): Value.GenericValueLike<Value.AtomicValue> => {
				return resolveColumnValue(context, this.providers)
			})(),
		)
		return []
	}

	manyHasManyInversed: CreateInputProcessor<MutationResultList>['manyHasManyInversed'] = {
		connect: hasManyProcessor(
			async (context): Promise<MutationResultList> => {
				const primaryInversed = await this.insertBuilder.insert
				if (!primaryInversed) {
					return []
				}
				const primaryOwner = await this.mapper.getPrimaryValue(context.targetEntity, context.input)
				if (!primaryOwner) {
					return [new MutationEntryNotFoundError([], context.input)]
				}
				return await this.mapper.connectJunction(
					context.targetEntity,
					context.targetRelation,
					primaryOwner,
					primaryInversed,
				)
			},
		),
		create: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const primaryInversed = await this.insertBuilder.insert
				if (!primaryInversed) {
					return []
				}
				const insertResult = await this.mapper.insert(context.targetEntity, context.input)
				const primaryOwner = getInsertPrimary(insertResult)
				if (primaryOwner) {
					const connectResult = await this.mapper.connectJunction(
						context.targetEntity,
						context.targetRelation,
						primaryOwner,
						primaryInversed,
					)
					return [...insertResult, ...connectResult]
				}
				return insertResult
			},
		),
	}

	manyHasManyOwner: CreateInputProcessor<MutationResultList>['manyHasManyOwner'] = {
		connect: hasManyProcessor(
			async (context): Promise<MutationResultList> => {
				const primary = await this.insertBuilder.insert
				if (!primary) {
					return []
				}
				const primaryInversed = await this.mapper.getPrimaryValue(context.targetEntity, context.input)
				if (!primaryInversed) {
					return [new MutationEntryNotFoundError([], context.input)]
				}
				return await this.mapper.connectJunction(context.entity, context.relation, primary, primaryInversed)
			},
		),
		create: hasManyProcessor(
			async (context): Promise<MutationResultList> => {
				const primary = await this.insertBuilder.insert
				if (!primary) {
					return []
				}
				const insertResult = await this.mapper.insert(context.targetEntity, context.input)
				const primaryInversed = getInsertPrimary(insertResult)
				if (primaryInversed) {
					const connectResult = await this.mapper.connectJunction(
						context.entity,
						context.relation,
						primary,
						primaryInversed,
					)
					return [...insertResult, ...connectResult]
				}
				return insertResult
			},
		),
	}

	manyHasOne: CreateInputProcessor<MutationResultList>['manyHasOne'] = {
		nothing: async ctx => {
			this.insertBuilder.addFieldValue(ctx.relation.name, null)
			return []
		},
		connect: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const primaryValue = this.mapper.getPrimaryValue(context.targetEntity, context.input)
				this.insertBuilder.addFieldValue(context.relation.name, async () => {
					const value = await primaryValue
					if (!value) {
						return AbortInsert
					}
					return value
				})
				if (!(await primaryValue)) {
					return [new MutationEntryNotFoundError([], context.input)]
				}
				return []
			},
		),
		create: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const insertPromise = this.mapper.insert(context.targetEntity, context.input)
				await this.insertBuilder.addFieldValue(context.relation.name, async () => {
					const insertResult = await insertPromise
					const primary = getInsertPrimary(insertResult)
					if (!primary) {
						return AbortInsert
					}
					return primary
				})
				return await insertPromise
			},
		),
	}

	oneHasMany: CreateInputProcessor<MutationResultList>['oneHasMany'] = {
		connect: hasManyProcessor(
			async (context): Promise<MutationResultList> => {
				const value = await this.insertBuilder.insert
				if (!value) {
					return []
				}
				return await this.mapper.update(context.targetEntity, context.input, {
					[context.targetRelation.name]: {
						connect: { [context.relation.name]: value },
					},
				})
			},
		),
		create: hasManyProcessor(
			async (context): Promise<MutationResultList> => {
				const primary = await this.insertBuilder.insert
				if (!primary) {
					return []
				}
				return await this.mapper.insert(context.targetEntity, {
					...context.input,
					[context.targetRelation.name]: {
						connect: { [context.entity.primary]: primary },
					},
				})
			},
		),
	}

	oneHasOneOwner: CreateInputProcessor<MutationResultList>['oneHasOneOwner'] = {
		nothing: async ctx => {
			this.insertBuilder.addFieldValue(ctx.relation.name, null)
			return []
		},
		connect: hasOneProcessor(
			async (context: Context.OneHasOneOwnerContext & { input: Input.UniqueWhere }): Promise<MutationResultList> => {
				const primaryValue = this.mapper.getPrimaryValue(context.targetEntity, context.input)
				this.insertBuilder.addFieldValue(context.relation.name, async () => {
					const value = await primaryValue
					if (!value) {
						return AbortInsert
					}
					return value
				})
				if (!(await primaryValue)) {
					return [new MutationEntryNotFoundError([], context.input)]
				}
				return []
			},
		),
		create: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const insertPromise = this.mapper.insert(context.targetEntity, context.input)
				await this.insertBuilder.addFieldValue(context.relation.name, async () => {
					const insertResult = await insertPromise
					const primary = getInsertPrimary(insertResult)
					if (!primary) {
						return AbortInsert
					}
					return primary
				})
				return await insertPromise
			},
		),
	}

	oneHasOneInversed: CreateInputProcessor<MutationResultList>['oneHasOneInversed'] = {
		connect: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const value = await this.insertBuilder.insert
				if (!value) {
					return []
				}
				return await this.mapper.update(context.targetEntity, context.input, {
					[context.targetRelation.name]: {
						connect: { [context.entity.primary]: value },
					},
				})
			},
		),
		create: hasOneProcessor(
			async (context): Promise<MutationResultList> => {
				const primary = await this.insertBuilder.insert
				if (!primary) {
					return []
				}
				return await this.mapper.insert(context.targetEntity, {
					...context.input,
					[context.targetRelation.name]: {
						connect: { [context.entity.primary]: primary },
					},
				})
			},
		),
	}
}
