import { AbstractSessionModel, AppRootModel, iterMap } from '@jbrowse/core/util'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  TextField,
  withStyles,
} from '@material-ui/core'
import Accordion from '@material-ui/core/Accordion'
import AccordionDetails from '@material-ui/core/AccordionDetails'
import AccordionSummary from '@material-ui/core/AccordionSummary'
import Typography from '@material-ui/core/Typography'
import ExpandMoreIcon from '@material-ui/icons/ExpandMore'
import {
  DataGrid,
  GridColDef,
  GridRowsProp,
} from '@mui/x-data-grid'
import { getRoot } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import useCollapse from 'react-collapsed'

import { ApolloInternetAccountModel } from '../ApolloInternetAccount/model'

interface ViewChangeLogProps {
  session: AbstractSessionModel
  handleClose(): void
}

interface Collection {
  _id: string
  name: string
}

export function ViewChangeLog({ session, handleClose }: ViewChangeLogProps) {
  const { internetAccounts } = getRoot(session) as AppRootModel
  const { notify } = session
  const apolloInternetAccount = internetAccounts.find(
    (ia) => ia.type === 'ApolloInternetAccount',
  ) as ApolloInternetAccountModel | undefined
  if (!apolloInternetAccount) {
    throw new Error('No Apollo internet account found')
  }
  const { baseURL } = apolloInternetAccount
  const [assemblyName, setAssemblyName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [collection, setCollection] = useState<Collection[]>([])
  const [assemblyId, setAssemblyId] = useState('')
  const [typeName, setChangeType] = useState('')
  const [userName, setUserName] = useState('')
  const [disableUndo, setDisableUndo] = useState<boolean>(true)
  const [displayGridData, setDisplayGridData] = useState<GridRowsProp[]>([])
  const [isExpanded, setExpanded] = useState(false)
  const { getCollapseProps, getToggleProps } = useCollapse({ isExpanded })

  const currentValue = '3'
  // let defaultValueDrop = ''

  const StyledDataGrid = withStyles({
    root: {
      '& .MuiDataGrid-renderingZone': {
        maxHeight: 'none !important',
      },
      '& .MuiDataGrid-cell': {
        lineHeight: 'unset !important',
        maxHeight: 'none !important',
        whiteSpace: 'normal',
      },
      '& .MuiDataGrid-row': {
        maxHeight: 'none !important',
      },
    },
  })(DataGrid)
  const gridColumns: GridColDef[] = [
    {
      field: '_id',
      headerName: ' ',
      width: 100,
      renderCell: (params) => (
        <strong>
          <Button
            variant="contained"
            size="small"
            style={{ marginLeft: 16 }}
            tabIndex={params.hasFocus ? 0 : -1}
            disabled={disableUndo}
          >
            Undo
          </Button>
        </strong>
      ),
    },
    { field: 'typeName', headerName: 'Change type', width: 200 },
    {
      field: 'changes',
      headerName: 'Change JSON',
      width: 600,
      renderCell: (params) => JSON.stringify(params.value),
    },
    { field: 'user', headerName: 'User', width: 100 },
    { field: 'createdAt', headerName: 'DateTime', width: 200 },
  ]

  useEffect(() => {
    async function getAssemblies() {
      const uri = new URL('/assemblies', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const response = await apolloFetch(uri, {
          method: 'GET',
        })
        if (!response.ok) {
          let msg
          try {
            msg = await response.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when retrieving assemblies from server — ${
              response.status
            } (${response.statusText})${msg ? ` (${msg})` : ''}`,
          )
          return
        }
        const data = await response.json()
        data.forEach((item: Collection) => {
          setCollection((result) => [
            ...result,
            {
              _id: item._id,
              name: item.name,
            },
          ])
        })
      }
    }
    getAssemblies()
  }, [apolloInternetAccount, baseURL])

  useEffect(() => {
    async function getGridData() {
      let msg

      // Get changes
      const uri = new URL('/changes/getChange', baseURL).href
      const apolloFetch = apolloInternetAccount?.getFetcher({
        locationType: 'UriLocation',
        uri,
      })
      if (apolloFetch) {
        const res = await apolloFetch(uri, {
          method: 'POST',
          body: JSON.stringify({
            assemblyId,
            typeName,
            userName,
          }),
          headers: new Headers({
            'Content-Type': 'application/json',
          }),
        })
        if (!res.ok) {
          try {
            msg = await res.text()
          } catch (e) {
            msg = ''
          }
          setErrorMessage(
            `Error when retrieving changes — ${res.status} (${res.statusText})${
              msg ? ` (${msg})` : ''
            }`,
          )
          return
        }
        const data = await res.json()
        setDisplayGridData(data)
      }
    }
    getGridData()
  }, [assemblyId, typeName, userName])

  useEffect(() => {
    if (collection.length === 1) {
      setAssemblyId(collection[0]._id)
    }
  }, [collection])

  function handleOnClickExpanded() {
    setExpanded(!isExpanded)
  }

  async function handleChangeAssembly(
    e: React.ChangeEvent<{
      name?: string | undefined
      value: unknown
    }>,
  ) {
    setAssemblyId(e.target.value as string)
    setAssemblyName(
      (await collection.find((i) => i._id === e.target.value)?.name) as string,
    )
  }

  async function handleChangeType(
    e: React.ChangeEvent<{
      name?: string | undefined
      value: unknown
    }>,
  ) {
    setChangeType(e.target.value as string)
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
  }
  return (
      // <Dialog open style={{ width: 1000 }} data-testid="login-apollo">
      <Dialog open maxWidth="xl" data-testid="login-apollo">
      <DialogTitle>View Change Log</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <div>
            <Accordion style={{ width: 800 }}>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                aria-controls="panel1a-content"
              >
                <Typography>Filter</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <div className="content">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 200, alignItems: 'flex-start' }}>
                          Filter by assembly
                        </th>
                        <th style={{ width: 200, alignItems: 'flex-start' }}>
                          Filter by change
                        </th>
                        <th style={{ width: 200, alignItems: 'flex-start' }}>
                          Filter by username
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>
                          <Select
                            style={{ width: 200, alignItems: 'flex-start' }}
                            value={assemblyId}
                            onChange={handleChangeAssembly}
                          >
                            {collection.map((option) => (
                              <MenuItem key={option._id} value={option._id}>
                                {option.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td>
                          <Select
                            style={{ width: 200, alignItems: 'flex-start' }}
                            value={typeName}
                            onChange={handleChangeType}
                          >
                            <option value="">Any</option>
                            <option value="LocationStartChange">
                              LocationStartChange
                            </option>
                            <option value="LocationEndChange">
                              LocationEndChange
                            </option>
                            <option value="AddAssemblyFromFileChange">
                              AddAssemblyFromFileChange
                            </option>
                            <option value="AddAssemblyAndFeaturesFromFileChange">
                              AddAssemblyAndFeaturesFromFileChange
                            </option>
                            <option value="AddFeaturesFromFileChange">
                              AddFeaturesFromFileChange
                            </option>
                          </Select>
                        </td>
                        <td>
                          <TextField
                            id="name"
                            type="TextField"
                            style={{ width: 200, alignItems: 'flex-end' }}
                            variant="outlined"
                            onChange={(e) => setUserName(e.target.value)}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </AccordionDetails>
            </Accordion>
          </div>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            type="submit"
            onClick={() => {
              handleClose()
            }}
          >
            Close
          </Button>
        </DialogActions>
        <div style={{ height: 700, width: 1000 }}>
          <StyledDataGrid
            autoPageSize
            pagination
            rows={displayGridData}
            columns={gridColumns}
            getRowId={(row) => row._id}
          />
        </div>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
