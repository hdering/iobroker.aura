import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.css';

import App from './App';
import { ThemeProvider } from './ThemeProvider';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminEditor } from './pages/admin/AdminEditor';
import { AdminWidgets } from './pages/admin/AdminWidgets';
import { AdminLayouts } from './pages/admin/AdminLayouts';
import { AdminPopups } from './pages/admin/AdminPopups';
import { PopupViewEditor } from './pages/admin/PopupViewEditor';

const router = createHashRouter([
  { path: '/', element: <App /> },
  { path: '/tab/:tabSlug', element: <App /> },
  { path: '/view/:layoutSlug', element: <App /> },
  { path: '/view/:layoutSlug/tab/:tabSlug', element: <App /> },
  { path: '/admin/login', element: <AdminLogin /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'editor', element: <AdminEditor /> },
      { path: 'theme', element: <Navigate to="/admin/layouts?tab=theme" replace /> },
      { path: 'widgets', element: <AdminWidgets /> },
      { path: 'layouts', element: <AdminLayouts /> },
      { path: 'popups', element: <AdminPopups /> },
      { path: 'popups/:viewId', element: <PopupViewEditor /> },
      { path: 'settings', element: <AdminSettings /> },
    ],
  },
]);

// Remove the pre-React boot screen once JS has loaded and React is about to paint.
const bootEl = document.getElementById('aura-boot');
if (bootEl) {
  bootEl.classList.add('hidden');
  bootEl.addEventListener('transitionend', () => bootEl.remove(), { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
