export interface ApiError {
  error: {
    code: string
    message: string
  }
}

export interface ApiSuccess<T> {
  data: T
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
