import { JoiningColumn, OnDelete } from "../model"
import FieldBuilder from "./FieldBuilder"
import { AddEntityCallback, EntityConfigurator } from "./SchemaBuilder";

type PartialOptions<K extends keyof OneHasOneBuilder.Options> = Partial<OneHasOneBuilder.Options> & Pick<OneHasOneBuilder.Options, K>

class OneHasOneBuilder<O extends PartialOptions<never> = PartialOptions<never>> implements FieldBuilder<O>
{
  private options: O
  private addEntity: AddEntityCallback

  constructor(options: O, addEntity: AddEntityCallback)
  {
    this.options = options
    this.addEntity = addEntity
  }

  target(target: string, configurator?: EntityConfigurator): OneHasOneBuilder<O & PartialOptions<'target'>>
  {
    if (configurator) {
      this.addEntity(target, configurator)
    }
    return this.withOption('target', target)
  }

  inversedBy(inversedBy: string): OneHasOneBuilder<O>
  {
    return this.withOption('inversedBy', inversedBy)
  }

  joiningColumn(columnName: string): OneHasOneBuilder<O>
  {
    return this.withOption('joiningColumn', {...this.joiningColumn, columnName})
  }

  onDelete(onDelete: OnDelete): OneHasOneBuilder<O>
  {
    return this.withOption('joiningColumn', {...this.joiningColumn, onDelete})
  }

  notNull(): OneHasOneBuilder<O>
  {
    return this.withOption('nullable', false)
  }

  inversedNotNull(): OneHasOneBuilder<O>
  {
    return this.withOption('inversedNullable', false)
  }

  getOption(): O
  {
    return this.options
  }

  private withOption<K extends keyof OneHasOneBuilder.Options>(key: K, value: OneHasOneBuilder.Options[K])
  {
    return new OneHasOneBuilder<O & PartialOptions<K>>({...(this.options as object), [key]: value} as O & PartialOptions<K>, this.addEntity)
  }
}

namespace OneHasOneBuilder
{
  export type Options = {
    target: string
    inversedBy?: string
    joiningColumn?: Partial<JoiningColumn>
    nullable?: boolean
    inversedNullable?: boolean
  }
}


export default OneHasOneBuilder