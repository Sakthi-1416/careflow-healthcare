import { createRoot } from 'react-dom/client';
import './styles.css';
import './analytics.css';
import './mobile.css';
import { FinalApp } from './final-app.jsx';

createRoot(document.getElementById('root')).render(<FinalApp/>);
