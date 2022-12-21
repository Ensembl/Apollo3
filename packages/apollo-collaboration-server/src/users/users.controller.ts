import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import { DecodedJWT } from 'apollo-shared'
import { Request } from 'express'

import { Role } from '../utils/role/role.enum'
import { Validations } from '../utils/validation/validatation.decorator'
import { UserLocationDto } from './dto/create-user.dto'
import { UsersService } from './users.service'

@Validations(Role.ReadOnly)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() {
    return this.usersService.findAll()
  }

  /**
   * Get the oldest (in terms of creation date) admin email address. This is needed when user has logged in and he needs to email to admin to get role
   * User who is calling this endpoint does not have any role yet and therefore there can not be 'Role' -validation
   * @returns The oldest (in terms of creation date) admin email address.
   */
  @Get('admin')
  findAdmin() {
    return this.usersService.findByRole('admin')
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id)
  }

  /**
   * Receives user location and broadcast information using web sockets
   * @param userLocation - user's location information
   * @returns
   */
  @Post('userLocation')
  userLocation(@Body() userLocation: UserLocationDto, @Req() req: Request) {
    const { user } = req as unknown as { user: DecodedJWT }
    if (!user) {
      throw new Error('No user attached to request')
    }
    return this.usersService.broadcastLocation(userLocation, user)
  }
}
