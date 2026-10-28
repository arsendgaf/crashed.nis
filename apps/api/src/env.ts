export interface LoginRateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export type Bindings = CloudflareBindings & {
  LOGIN_RATE_LIMITER: LoginRateLimitBinding
}
