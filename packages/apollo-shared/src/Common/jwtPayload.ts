export interface JWTPayload {
  username: string
  email: string
  roles: ('admin' | 'user' | 'readOnly')[]
  id: string
}

export interface DecodedJWT extends JWTPayload {
  iat: number
  exp: number
}
