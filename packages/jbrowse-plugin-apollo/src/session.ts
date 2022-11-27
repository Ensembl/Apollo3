import { AssemblyModel } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import {
  AbstractSessionModel,
  AppRootModel,
  Region,
  getSession,
} from '@jbrowse/core/util'
import { getDialogActionsUtilityClass } from '@mui/material'
import {
  AnnotationFeature,
  AnnotationFeatureI,
  AnnotationFeatureSnapshot,
  ApolloAssembly,
  ApolloRefSeq,
} from 'apollo-mst'
import {
  BackendDriver,
  ChangeManager,
  ClientDataStore as ClientDataStoreType,
  CollaborationServerDriver,
} from 'apollo-shared'
import { observable } from 'mobx'
import {
  IAnyModelType,
  Instance,
  flow,
  getParentOfType,
  getRoot,
  resolveIdentifier,
  types,
} from 'mobx-state-tree'
import { io } from 'socket.io-client'

import { ApolloInternetAccountModel } from './ApolloInternetAccount/model'

export interface ApolloSession extends AbstractSessionModel {
  apolloDataStore: ClientDataStoreType
  apolloSelectedFeature?: AnnotationFeatureI
  apolloSetSelectedFeature(feature?: AnnotationFeatureI): void
}

interface ApolloAssemblyResponse {
  _id: string
  name: string
  displayName?: string
  description?: string
  aliases?: string[]
}

interface ApolloRefSeqResponse {
  _id: string
  name: string
  description?: string
  length: string
  assembly: string
}
const socket = io('http://localhost:3999')

export interface CollaboratorLocation {
  assembly: string
  refName: string
  start: number
  end: number
}

export interface Collaborator {
  name: string
  id: string
  locations: CollaboratorLocation[]
}

const ClientDataStore = types
  .model('ClientDataStore', {
    typeName: types.optional(types.literal('Client'), 'Client'),
    assemblies: types.map(ApolloAssembly),
    backendDriverType: types.optional(
      types.enumeration('backendDriverType', ['CollaborationServerDriver']),
      'CollaborationServerDriver',
    ),
  })
  .views((self) => ({
    get internetAccounts() {
      return (getRoot(self) as AppRootModel).internetAccounts
    },
    getFeature(featureId: string) {
      return resolveIdentifier(AnnotationFeature, self.assemblies, featureId)
    },
  }))
  .actions((self) => ({
    loadFeatures: flow(function* loadFeatures(regions: Region[]) {
      console.log(`***** loadFeatures ******* ${JSON.stringify(regions)}`)

      for (const region of regions) {
        const features = (yield (
          self as unknown as { backendDriver: BackendDriver }
        ).backendDriver.getFeatures(region)) as AnnotationFeatureSnapshot[]
        if (!features.length) {
          return
        }
        const { assemblyName, refName } = region
        let assembly = self.assemblies.get(assemblyName)
        // //* **** SOCKET CHANGE BEGINS *** */
        const session = getSession(self) as ApolloSession
        const token = self.internetAccounts[0].retrieveToken()
        if (!token) {
          throw new Error(`No Token found`)
        }
        // Get and set server timestamp into session storage
        getAndSetServerTime(session)

        const { notify } = session
        const [firstRef] = regions
        const channel = `${assembly?._id}-${firstRef.refName}`
        const changeManager = new ChangeManager(
          self as unknown as ClientDataStoreType,
        )
        if (!socket.hasListeners('COMMON')) {
          console.log(`User starts to listen "COMMON" -channel`)
          socket.on('COMMON', (message) => {
            // Save the last server timestamp
            sessionStorage.setItem('LastSocketTimestamp', message.timestamp)
            console.log(`COMMON MESSAGE: '${JSON.stringify(message)}'`)
            if (message.channel === 'COMMON' && message.userToken !== token) {
              changeManager?.submit(message.changeInfo, {
                submitToBackend: false,
              })
              notify(
                `${JSON.stringify(message.userName)} changed : ${JSON.stringify(
                  message.changeInfo,
                )}`,
                'success',
              )
            }
            console.log(
              `Last timestamp: '${sessionStorage.getItem(
                'LastSocketTimestamp',
              )}'`,
            )
          })
        }
        if (!socket.hasListeners(channel)) {
          console.log(`User starts to listen "${channel}" -channel`)
          socket.on(channel, (message) => {
            console.log(
              `Channel "${channel}" message: "${JSON.stringify(message)}"`,
            )
            // Save the last server timestamp
            sessionStorage.setItem('LastSocketTimestamp', message.timestamp)
            if (message.userToken !== token && message.channel === channel) {
              changeManager?.submit(message.changeInfo, {
                submitToBackend: false,
              })
              notify(
                `${JSON.stringify(message.userName)} changed : ${JSON.stringify(
                  message.changeInfo,
                )}`,
                'success',
              )
            }
            console.log(
              `Last timestamp: '${sessionStorage.getItem(
                'LastSocketTimestamp',
              )}'`,
            )
          })

          socket.on('connect', function () {
            console.log('Connected')
            notify(`You are re-connected to Apollo server.`, 'success')
            getLastUpdates(session)
          })
          socket.on('disconnect', function () {
            console.log('Disconnected')
            notify(
              `You are disconnected from Apollo server! Please, close this message`,
              'error',
            )
          })
        }
        if (!socket.hasListeners('USER_LOCATION')) {
          const { internetAccounts } = getRoot(session) as AppRootModel
          const internetAccount =
            internetAccounts[0] as ApolloInternetAccountModel
          const { baseURL } = internetAccount
          console.log(`User starts to listen "USER_LOCATION" at ${baseURL}`)
          socket.on('USER_LOCATION', (message) => {
            if (
              message.channel === 'USER_LOCATION' &&
              message.userToken !== token
            ) {
              console.log(
                `User's ${JSON.stringify(
                  message.userName,
                )} location info ${JSON.stringify(message)}`,
              )
            }
          })
        }
        //* **** SOCKET CHANGE ENDS *** */
        if (!assembly) {
          assembly = self.assemblies.put({ _id: assemblyName, refSeqs: {} })
        }
        const [firstFeature] = features
        let ref = assembly.refSeqs.get(firstFeature.refSeq)
        if (!ref) {
          ref = assembly.refSeqs.put({
            _id: firstFeature.refSeq,
            name: refName,
            features: {},
          })
        }
        const newFeatures: Record<string, AnnotationFeatureSnapshot> = {}
        features.forEach((feature) => {
          newFeatures[feature._id] = feature
        })
        ref.features.merge(newFeatures)
      }
    }),
    addFeature(assemblyId: string, feature: AnnotationFeatureSnapshot) {
      const assembly = self.assemblies.get(assemblyId)
      if (!assembly) {
        throw new Error(
          `Could not find assembly "${assemblyId}" to add feature "${feature._id}"`,
        )
      }
      const ref = assembly.refSeqs.get(feature.refSeq)
      if (!ref) {
        throw new Error(
          `Could not find refSeq "${feature.refSeq}" to add feature "${feature._id}"`,
        )
      }
      ref.features.put(feature)
    },
    addAssembly(assemblyId: string, assemblyName: string) {
      self.assemblies.put({ _id: assemblyId, refSeqs: {} })
    },
    deleteFeature(featureId: string) {
      const feature = self.getFeature(featureId)
      if (!feature) {
        throw new Error(`Could not find feature "${featureId}" to delete`)
      }
      const { parent } = feature
      if (parent) {
        parent.deleteChild(featureId)
      } else {
        const refSeq = getParentOfType(feature, ApolloRefSeq)
        refSeq.deleteFeature(feature._id)
      }
    },
    deleteAssembly(assemblyId: string) {
      self.assemblies.delete(assemblyId)
    },
    getLocations() {
      // console.log('1 GET LOCATIONS...')
      // console.log(`0 VIEWS: ${JSON.stringify(self)}`)
      // console.log(`1 VIEWS: ${JSON.stringify((self as unknown as AbstractSessionModel))}`)
      // console.log(`2 VIEWS: ${JSON.stringify((self as unknown as AbstractSessionModel).views)}`)
      // console.log('2 GET LOCATIONS...')
      const locations = []
      // for (const view of (self as unknown as AbstractSessionModel).views) {
      //   if (view.type === 'LinearGenomeView') {
      //     console.log(`VIEW: ${JSON.stringify(view)}`)
      //     // const {dynamicBlocks} = view
      //     // // view and get location
      //     // console.log(`BLOCKS: ${JSON.stringify(dynamicBlocks)}`)
      //     // // run in https://developer.mozilla.org/en-US/docs/Web/API/setInterval
      //   }
      // }
    },
  }))
  .volatile((self) => ({
    changeManager: new ChangeManager(self as unknown as ClientDataStoreType),
  }))
  .volatile((self) => {
    if (self.backendDriverType !== 'CollaborationServerDriver') {
      throw new Error(`Unknown backend driver type "${self.backendDriverType}"`)
    }
    return {
      backendDriver: new CollaborationServerDriver(self),
    }
  })

export function extendSession(sessionModel: IAnyModelType) {
  const aborter = new AbortController()
  const { signal } = aborter
  return sessionModel
    .props({
      apolloDataStore: types.optional(ClientDataStore, { typeName: 'Client' }),
      apolloSelectedFeature: types.maybe(types.reference(AnnotationFeature)),
    })
    .extend((self) => {
      const collabs = observable.array<Collaborator>([])

      return {
        views: {
          get collaborators() {
            return collabs
          },
        },
        actions: {
          addOrUpdateCollaborator(collaborator: Collaborator) {
            const existingCollaborator = collabs.find(
              (obj: Collaborator) => obj.id === collaborator.id,
            )
            if (!existingCollaborator) {
              collabs.push(collaborator)
            } else {
              existingCollaborator.locations = collaborator.locations
            }
          },
        },
      }
    })
    .actions((self) => ({
      apolloSetSelectedFeature(feature?: AnnotationFeatureI) {
        self.apolloSelectedFeature = feature
      },
      addApolloTrackConfig(assembly: AssemblyModel) {
        const trackId = `apollo_track_${assembly.name}`
        const hasTrack = Boolean(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          self.tracks.find((track: any) => track.trackId === trackId),
        )
        if (!hasTrack) {
          self.addTrackConf({
            type: 'ApolloTrack',
            trackId,
            name: `Annotations (${
              getConf(assembly, 'displayName') || assembly.name
            })`,
            assemblyNames: [assembly.name],
            displays: [
              {
                type: 'LinearApolloDisplay',
                displayId: `apollo_track_${assembly.name}-LinearApolloDisplay`,
              },
            ],
          })
        }
      },
      afterCreate: flow(function* afterCreate() {
        const { internetAccounts } = getRoot(self) as AppRootModel
        for (const internetAccount of internetAccounts as ApolloInternetAccountModel[]) {
          const { baseURL } = internetAccount
          const uri = new URL('assemblies', baseURL).href
          const fetch = internetAccount.getFetcher({
            locationType: 'UriLocation',
            uri,
          })
          let response: Response
          try {
            response = yield fetch(uri, { signal })
          } catch (e) {
            console.error(e)
            // setError(e instanceof Error ? e : new Error(String(e)))
            continue
          }
          if (!response.ok) {
            let errorMessage
            try {
              errorMessage = yield response.text()
            } catch (e) {
              errorMessage = ''
            }
            console.error(
              `Failed to fetch assemblies — ${response.status} (${
                response.statusText
              })${errorMessage ? ` (${errorMessage})` : ''}`,
            )
            continue
          }
          let fetchedAssemblies
          try {
            fetchedAssemblies =
              (yield response.json()) as ApolloAssemblyResponse[]
          } catch (e) {
            console.error(e)
            continue
          }
          for (const assembly of fetchedAssemblies) {
            const { assemblyManager } = self
            const selectedAssembly = assemblyManager.get(assembly.name)
            if (selectedAssembly) {
              self.addApolloTrackConfig(selectedAssembly)
              continue
            }
            const searchParams = new URLSearchParams({
              assembly: assembly._id,
            })
            const uri2 = new URL(`refSeqs?${searchParams.toString()}`, baseURL)
              .href
            const fetch2 = internetAccount.getFetcher({
              locationType: 'UriLocation',
              uri: uri2,
            })
            const response2 = (yield fetch2(uri2, {
              signal,
            })) as unknown as Response
            if (!response2.ok) {
              let errorMessage
              try {
                errorMessage = yield response2.text()
              } catch (e) {
                errorMessage = ''
              }
              throw new Error(
                `Failed to fetch fasta info — ${response2.status} (${
                  response2.statusText
                })${errorMessage ? ` (${errorMessage})` : ''}`,
              )
            }
            const f = (yield response2.json()) as ApolloRefSeqResponse[]
            const ids: Record<string, string> = {}
            const refNameAliasesFeatures = f.map((contig) => {
              ids[contig.name] = contig._id
              return {
                refName: contig.name,
                aliases: [contig._id],
                uniqueId: `alias-${contig._id}`,
              }
            })
            const assemblyConfig = {
              name: assembly._id,
              aliases: [assembly.name, ...(assembly.aliases || [])],
              displayName: assembly.displayName || assembly.name,
              sequence: {
                trackId: `sequenceConfigId-${assembly.name}`,
                type: 'ReferenceSequenceTrack',
                adapter: {
                  type: 'ApolloSequenceAdapter',
                  assemblyId: assembly._id,
                  baseURL,
                },
                metadata: {
                  internetAccountConfigId:
                    internetAccount.configuration.internetAccountId,
                  ids,
                },
              },
              refNameAliases: {
                adapter: {
                  type: 'FromConfigAdapter',
                  features: refNameAliasesFeatures,
                },
              },
            }
            self.addAssembly?.(assemblyConfig)
            const a = yield assemblyManager.waitForAssembly(assemblyConfig.name)
            self.addApolloTrackConfig(a)
          }
        }
      }),
      beforeDestroy() {
        aborter.abort()
      },
    }))
}

/**
 * Get server timestamp and save it into session storage
 * @param apolloInternetAccount - apollo internet account
 * @returns
 */
async function getAndSetServerTime(session: ApolloSession) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
  const { baseURL } = internetAccount
  const uri = new URL('changes/getTimestamp', baseURL).toString()
  const apolloFetch = internetAccount.getFetcher({
    locationType: 'UriLocation',
    uri,
  })

  if (apolloFetch) {
    const response = await apolloFetch(uri, {
      method: 'GET',
    })
    if (!response.ok) {
      throw new Error(
        `Error when fetching server timestamp — ${response.status}`,
      )
    } else {
      sessionStorage.setItem('LastSocketTimestamp', await response.text())
    }
  }
}

/**
 * Start to listen temporary channel, fetch the last changes from server and finally apply those changes to client data store
 * @param apolloInternetAccount - apollo internet account
 * @returns
 */
async function getLastUpdates(session: ApolloSession) {
  const lastSuccTimestamp = sessionStorage.getItem('LastSocketTimestamp')
  if (!lastSuccTimestamp) {
    throw new Error(
      `No last succesfull timestamp stored in session. Please, refresh you browser to get last updates from server`,
    )
  }
  const { notify } = session
  const channel = `tmp_${Math.floor(Math.random() * (10000 - 1000 + 1) + 1000)}`
  // Let's start to listen temporary channel where server will send the last updates
  socket.on(channel, (message) => {
    const { changeManager } = (session as ApolloSessionModel).apolloDataStore
    changeManager?.submit(message.changeInfo[0], { submitToBackend: false })
    notify(
      `Get the last updates from server: ${JSON.stringify(message.changeInfo)}`,
      'success',
    )
  })
  const { internetAccounts } = getRoot(session) as AppRootModel
  const internetAccount = internetAccounts[0] as ApolloInternetAccountModel
  const { baseURL } = internetAccount
  const url = new URL('changes/getLastUpdateByTime', baseURL)
  const searchParams = new URLSearchParams({
    timestamp: lastSuccTimestamp,
    clientId: channel,
  })
  url.search = searchParams.toString()
  const uri = url.toString()
  const apolloFetch = internetAccount.getFetcher({
    locationType: 'UriLocation',
    uri,
  })

  if (apolloFetch) {
    const response = await apolloFetch(uri, {
      method: 'GET',
    })
    if (!response.ok) {
      console.log(
        `Error when fetching the last updates to recover socket connection — ${response.status}`,
      )
      return
    }
  }
}
export type ApolloSessionStateModel = ReturnType<typeof extendSession>
export type ApolloSessionModel = Instance<ApolloSessionStateModel>
