import { buildWhere } from "../whereMonster";
import { getEntity, Schema } from "../model";
import { aliasInAst, joinToAst } from "../joinMonster/sqlAstNodeUtils";
import { GraphQLFieldConfig, GraphQLFieldResolver, GraphQLList } from "graphql";
import { JoinMonsterFieldMapping, SqlAstNode } from "../joinMonsterHelpers";
import { GraphQLFieldConfigMap } from "graphql/type/definition";
import WhereTypeProvider from "./WhereTypeProvider";
import EntityTypeProvider from "./EntityTypeProvider";

type FieldConfig = JoinMonsterFieldMapping<any, any> & GraphQLFieldConfig<any, any>


export default class QueryProvider
{
  private schema: Schema
  private whereTypeProvider: WhereTypeProvider
  private entityTypeProvider: EntityTypeProvider
  private resolver: GraphQLFieldResolver<any, any>;

  constructor(schema: Schema, whereTypeProvider: WhereTypeProvider, entityTypeProvider: EntityTypeProvider, resolver: GraphQLFieldResolver<any, any>)
  {
    this.schema = schema
    this.whereTypeProvider = whereTypeProvider
    this.entityTypeProvider = entityTypeProvider
    this.resolver = resolver
  }

  getQueries(entityName: string): GraphQLFieldConfigMap<any, any>
  {
    const entity = getEntity(this.schema, entityName)
    return {
      [entityName]: this.getByPrimaryQuery(entityName),
      [entity.pluralName || (entityName + "s")]: this.getListQuery(entityName),
    }
  }


  private getByPrimaryQuery(entityName: string): FieldConfig
  {
    return {
      type: this.entityTypeProvider.getEntity(entityName),
      args: {
        where: {type: this.whereTypeProvider.getEntityUniqueWhereType(entityName)}
      },
      where: (tableName: string, args: any, context: any) => {
        const entity = this.schema.entities[entityName]
        return buildWhere(this.schema, entity, () => {
          throw new Error()
        })(tableName, args.where || {})
      },
      resolve: this.resolver,
    }
  }

  private getListQuery(entityName: string): FieldConfig
  {
    const entity = getEntity(this.schema, entityName)

    return {
      type: new GraphQLList(this.entityTypeProvider.getEntity(entityName)),
      args: {
        where: {type: this.whereTypeProvider.getEntityWhereType(entityName)},
      },
      where: (tableAlias: string, args: any, context: any, sqlAstNode: SqlAstNode) => {
        const createAlias = aliasInAst(sqlAstNode)

        return buildWhere(this.schema, entity, joinToAst(this.schema, createAlias)(sqlAstNode, entity))(tableAlias, args.where || {})
      },
      resolve: this.resolver,
    }
  }
}