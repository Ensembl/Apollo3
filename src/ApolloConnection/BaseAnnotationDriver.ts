import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { Region } from '@jbrowse/core/util'
import { SnapshotIn } from 'mobx-state-tree'
import Feature from './ApolloFeature'

class Change {
  path: string[]

  newValue: unknown

  oldValue: unknown

  constructor({
    path,
    newValue,
    oldValue,
  }: {
    path: string[]
    newValue: unknown
    oldValue: unknown
  }) {
    this.path = path
    this.newValue = newValue
    this.oldValue = oldValue
  }

  getInverse() {
    return new Change({
      path: this.path,
      newValue: this.oldValue,
      oldValue: this.newValue,
    })
  }
}

class ChangeSet {
  changes: Change[]

  constructor({ changes }: { changes: Change[] }) {
    this.changes = changes
  }

  getInverse() {
    return new ChangeSet({
      changes: this.changes.map(change => change.getInverse()),
    })
  }
}

type GenericAnnotation = unknown

export default abstract class BaseAnnotationDriver {
  configSchema: AnyConfigurationModel

  changeSets: ChangeSet[] = []

  constructor(configSchema: AnyConfigurationModel) {
    this.configSchema = configSchema
  }

  abstract getFeatures(
    region: Region,
    limit: number,
  ): SnapshotIn<typeof Feature>[]

  abstract getFeaturesInMultipleRegions(
    region: Region,
    limit: number,
  ): SnapshotIn<typeof Feature>[]

  abstract addFeature(feature: SnapshotIn<typeof Feature>): void

  abstract updateFeature(featureId: string, data: ChangeSet): void

  abstract deleteFeature(region: Region): void

  abstract getAnnotations(featureId: string): Map<string, GenericAnnotation>

  abstract getAnnotation(featureId: string, type: string): GenericAnnotation

  abstract addAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): void

  abstract updateAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): void

  abstract deleteAnnotation(
    featuredId: string,
    type: string,
    data: ChangeSet,
  ): void

  abstract apply(change: ChangeSet): void

  undo() {
    const changeSet = this.changeSets.pop()
    if (!changeSet) {
      return
    }
    this.apply(changeSet.getInverse())
  }
}
