# github-download-dir

Download just a sub directory from a GitHub repo

Node.js port for download-directory.github.io 
https://github.com/download-directory/download-directory.github.io 

```sh
npm i github-download-dir
```

## Usage
```typescript
import download from 'github-download-dir';
import { resolve } from 'path';

const stats = await download('https://github.com/mrdoob/three.js/tree/dev/docs/manual', 
    resolve(__dirname, '../temp'));
```