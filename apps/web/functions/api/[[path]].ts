export const onRequest: PagesFunction<CloudflareBindings> = ({ request, env }) => {
  return env.API.fetch(request)
}
