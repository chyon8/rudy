import { loadEnv } from '@rudy/shared';
import { buildApp } from './app';

const env = loadEnv();
const app = await buildApp(env);

app.listen({ port: env.PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
