import './config/dotenv.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 9536);
const app = createApp();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[backend] listening on http://localhost:${PORT} (project standard: 9536)`);
});
