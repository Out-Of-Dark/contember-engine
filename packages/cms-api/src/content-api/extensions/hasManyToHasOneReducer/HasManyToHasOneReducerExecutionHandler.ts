import { Input, Model } from 'cms-common'
import SelectExecutionHandler from '../../sql/select/SelectExecutionHandler'
import { Accessor } from '../../../utils/accessor'
import Mapper from '../../sql/Mapper'
import ObjectNode from '../../graphQlResolver/ObjectNode'
import { acceptFieldVisitor } from '../../../content-schema/modelUtils'
import { isIt } from '../../../utils/type'

class HasManyToHasOneReducerExecutionHandler implements SelectExecutionHandler<{}> {
	constructor(private readonly schema: Model.Schema, private readonly mapperAccessor: Accessor<Mapper>) {}

	process(context: SelectExecutionHandler.Context): void {
		const { addData, entity, field } = context
		const objectNode = field as ObjectNode

		addData(
			entity.primary,
			async (ids: Input.PrimaryValue[]) => {
				const [targetEntity, targetRelation] = this.getRelationTarget(entity, objectNode.meta.relationName)

				const uniqueWhere = Object.entries(objectNode.args.by)
				if (uniqueWhere.length !== 1) {
					throw new Error()
				}
				const whereWithParentId = {
					and: [
						objectNode.args.where || {},
						{
							[uniqueWhere[0][0]]: { eq: uniqueWhere[0][1] },
						},
						{
							[targetRelation.name]: { [entity.primary]: { in: ids } },
						},
					],
				}
				const newObjectNode = objectNode.withArgs<Input.ListQueryInput>({ where: whereWithParentId })

				return this.mapperAccessor.get().select(targetEntity, newObjectNode, targetRelation.name)
			},
			null
		)
	}

	private getRelationTarget(
		entity: Model.Entity,
		relationName: string
	): [Model.Entity, Model.Relation & Model.JoiningColumnRelation] {
		return acceptFieldVisitor(this.schema, entity, relationName, {
			visitColumn: (): never => {
				throw new Error()
			},
			visitRelation: (
				entity,
				relation,
				targetEntity,
				targetRelation
			): [Model.Entity, Model.Relation & Model.JoiningColumnRelation] => {
				if (!targetRelation || !isIt<Model.JoiningColumnRelation>(targetRelation, 'joiningColumn')) {
					throw new Error()
				}
				return [targetEntity, targetRelation]
			},
		})
	}
}

export default HasManyToHasOneReducerExecutionHandler