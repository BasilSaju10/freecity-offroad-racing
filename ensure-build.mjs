import {access} from 'node:fs/promises';
try{await access(new URL('./asset-manifest.json',import.meta.url));await access(new URL('./app.bundle.js',import.meta.url));}catch{await import('./build.mjs');}
