import { AbstractSessionModel } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
} from '@mui/material'
import { AnnotationFeatureI } from 'apollo-mst'
import { DeleteFeatureChange } from 'apollo-shared'
import { getSnapshot } from 'mobx-state-tree'
import React, { useState } from 'react'

import { ChangeManager } from '../ChangeManager'
import { ApolloSessionModel } from '../session'
import { Dialog } from './Dialog'

interface DeleteFeatureProps {
  session: ApolloSessionModel
  handleClose(): void
  sourceFeature: AnnotationFeatureI
  sourceAssemblyId: string
  changeManager: ChangeManager
  selectedFeature?: AnnotationFeatureI
  setSelectedFeature(feature?: AnnotationFeatureI): void
}

export function DeleteFeature({
  changeManager,
  handleClose,
  selectedFeature,
  session,
  setSelectedFeature,
  sourceAssemblyId,
  sourceFeature,
}: DeleteFeatureProps) {
  const { notify } = session as unknown as AbstractSessionModel
  const [errorMessage, setErrorMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    if (selectedFeature?._id === sourceFeature._id) {
      setSelectedFeature()
    }

    // Delete features
    const change = new DeleteFeatureChange({
      changedIds: [sourceFeature._id],
      typeName: 'DeleteFeatureChange',
      assembly: sourceAssemblyId,
      deletedFeature: getSnapshot(sourceFeature),
      parentFeatureId: sourceFeature.parent?._id,
    })
    await changeManager.submit?.(change)
    notify('Feature deleted successfully', 'success')
    handleClose()
    event.preventDefault()
  }

  return (
    <Dialog
      open
      title="Delete feature"
      handleClose={handleClose}
      maxWidth={false}
      data-testid="delete-feature"
    >
      <form onSubmit={onSubmit}>
        <DialogContent style={{ display: 'flex', flexDirection: 'column' }}>
          <DialogContentText>
            Are you sure you want to delete the selected feature?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" type="submit">
            Yes
          </Button>
          <Button variant="outlined" type="submit" onClick={handleClose}>
            Cancel
          </Button>
        </DialogActions>
      </form>
      {errorMessage ? (
        <DialogContent>
          <DialogContentText color="error">{errorMessage}</DialogContentText>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
