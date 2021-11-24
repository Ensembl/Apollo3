import {
  Body,
  Controller,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Put,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileHandlingService } from './fileHandling.service'
import { FileInterceptor } from '@nestjs/platform-express/multer'
import { Response } from 'express'
import { createReadStream } from 'fs'
import { join } from 'path'
import {
  gff3ChangeLineObjectDto,
  regionSearchObjectDto,
} from '../entity/gff3Object.dto'

@Controller('fileHandling')
export class FileHandlingController {
  constructor(private readonly fileService: FileHandlingService) {}
  private readonly logger = new Logger(FileHandlingController.name)

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Save new uploaded file into local filesystem. The filename in local filesystem will be: 'uploaded' + timestamp in ddmmyyyy_hh24miss -format + original filename
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/upload -F 'file=@./save_this_file.txt' -F 'name=test'
   * @param file File to save
   * @param response
   * @returns Return status 'HttpStatus.OK' if save was successful
   * or in case of error return throw exception
   */
  // @UseGuards(JwtAuthGuard)
  // @Roles(Role.User) // This value is for demo only
  @Post('/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Res() response: Response,
  ) {
    return this.fileService.saveNewFile(file, response)
  }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Download file from server to client. The given filename must exists in pre-defined folder (see fileConfig.ts)
   * You can call this endpoint like: curl http://localhost:3000/fileHandling/getfile/your_filename.txt
   * @param filename File to download
   * @param res
   * @returns
   */
  @Get('/getfile/:filename')
  getFile(@Param('filename') filename: string, @Res() res: Response) {
    // Check if file exists
    if (!this.fileService.fileExists(filename)) {
      this.logger.error(
        'File =' +
          filename +
          '= does not exist in folder =' +
          process.env.FILE_SEARCH_FOLDER +
          '=',
      )
      throw new InternalServerErrorException(
        'File ' + filename + ' does not exist!',
      )
    }
    this.logger.debug('Starting to download file ' + filename)

    // Download file
    const file = createReadStream(
      join(process.env.FILE_SEARCH_FOLDER, filename),
    )
    return file.pipe(res)
  }

  // /**
  //  * THIS IS JUST FOR DEMO PURPOSE
  //  * Updates string (or whole line) in existing file
  //  * @param id Filename to be updated
  //  * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
  //  * @param res
  //  * @returns Return 'HttpStatus.OK' if update was successful
  //  * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
  //  * or in case of error return throw exception
  //  */
  // @Put('/updategff3/:id')
  // updateGFF3Cache(
  //   @Param('id') id: string,
  //   @Body() postDto: gff3ChangeLineObjectDto,
  //   @Res() res: Response,
  // ) {
  //   this.logger.verbose(
  //     'Original value=' + JSON.stringify(postDto.originalLine),
  //   )
  //   this.logger.verbose('Updated value=' + JSON.stringify(postDto.updatedLine))
  //   return this.fileService.updateGFF3Cache(id, postDto, res)
  // }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Updates string (or whole line) in existing file
   * @param id Filename to be updated
   * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
   * @param res
   * @returns Return 'HttpStatus.OK' if update was successful
   * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error return throw exception
   */
  @Put('/update')
  updateGFF3File(
    @Body() postDto: gff3ChangeLineObjectDto,
    @Res() res: Response,
  ) {
    this.logger.debug('Filename=' + postDto.filename)
    this.logger.debug('Original value=' + JSON.stringify(postDto.originalLine))
    this.logger.debug('Updated value=' + JSON.stringify(postDto.updatedLine))
    return this.fileService.updateGFF3File(postDto, res)
  }

  /**
   * THIS IS JUST FOR DEMO PURPOSE
   * Loads GFF3 file data into cache. Cache key is started from 0
   * @param filename File to download
   * @param res
   * @returns
   */
  @Get('/getgff3file/:filename')
  getGff3File(@Param('filename') filename: string, @Res() res: Response) {
    return this.fileService.loadGff3IntoCache(filename, res)
  }

  /**
   * Updates string (or whole line) in CACHE
   * @param postDto Data Transfer Object that contains information about original string/line and updated string/line
   * @param res
   * @returns Return 'HttpStatus.OK' if update was successful
   * or if search string/line was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error throw exception
   */
  @Put('/updategff3')
  updateGFF3Cache(
    @Body() postDto: gff3ChangeLineObjectDto,
    @Res() res: Response,
  ) {
    this.logger.verbose(
      'Original value=' + JSON.stringify(postDto.originalLine),
    )
    this.logger.verbose('Updated value=' + JSON.stringify(postDto.updatedLine))
    return this.fileService.updateGFF3Cache(postDto, res)
  }

  /**
   * Fetch features based on Reference seq, Start and End -values
   * @param searchDto Data Transfer Object that contains information about searchable region
   * @param res
   * @returns Return 'HttpStatus.OK' and array of features if search was successful
   * or if search data was not found in the file then return error message with HttpStatus.NOT_FOUND
   * or in case of error throw exception
   */
  @Get('/getFeaturesByCriteria')
  getFeaturesByCriteria(
    @Body() searchDto: regionSearchObjectDto,
    @Res() res: Response,
  ) {
    return this.fileService.getFeaturesByCriteria(searchDto, res)
  }
}
