import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initDatabase, seedDefaults } from './lib/db';

async function bootstrap() {
  await initDatabase();
  await seedDefaults();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
