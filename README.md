# github-directory-downloader

Download just a sub directory from a GitHub repo

Node.js port for download-directory.github.io 
https://github.com/download-directory/download-directory.github.io 

```sh
npm i github-directory-downloader
```

## Usage
```typescript
import download from 'github-directory-downloader';
import { resolve } from 'path';

// Will download content of docs/manual into "../temp" 
// and return statistics for downloaded files
const stats = await download('https://github.com/mrdoob/three.js/tree/dev/docs/manual',
    resolve(__dirname, '../temp'));
```

You can also pass options as a third argument:
```typescript
{
    /** JWT token for authorization in private repositories */
    token?: string;
    
    /** Download mode. 
     * 'async' - make as many async requests as possible. Fast downloading for small repos
     * but your IP can get blocked for too many requests  
     * 'sync' - by default. Dowloading files ony by one */
    mode?: 'sync' | 'async';
}
```