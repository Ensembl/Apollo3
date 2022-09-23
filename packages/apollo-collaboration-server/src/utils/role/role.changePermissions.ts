import { Role } from './role.enum'

// Define change types
export const ChangeTypes = 'LocationEndChange' || 'LocationStartChange' || 'DeleteFeatureChange' || 'AddAssemblyFromFileChange'

// Define the lowest role to execute change
export const ChangePermission = {
  LocationEndChange: Role.User,
  LocationStartChange: Role.User,
  DeleteFeatureChange: Role.Admin,
  AddAssemblyFromFileChange: Role.Admin,
}
