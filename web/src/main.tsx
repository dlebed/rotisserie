import { render } from 'preact';
import './theme.css';
import { App, applyStoredTheme } from './App';
import { stripToken } from './nav';

stripToken();
applyStoredTheme();
const root = document.getElementById('app');
if (root) render(<App />, root);
