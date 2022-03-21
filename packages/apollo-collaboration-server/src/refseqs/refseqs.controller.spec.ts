import { Test, TestingModule } from '@nestjs/testing'

import { RefSeqsController } from './refSeqs.controller'

describe('RefSeqsController', () => {
  let controller: RefSeqsController

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RefSeqsController],
    }).compile()

    controller = module.get<RefSeqsController>(RefSeqsController)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })
})
