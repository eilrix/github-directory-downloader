# github-directory-downloader

Download just a sub directory from a GitHub repo

Node.js port for [`download-directory.github.io`](https://github.com/download-directory/download-directory.github.io)

Recursively (with subdirectories) downloads files only from specified directory via https://raw.githubusercontent.com/
 

```sh
npm i github-directory-downloader
```

## Usage

#### CLI
```sh
github-directory-downloader https://github.com/mrdoob/three.js/tree/dev/docs/manual --dir=temp --token=******
```
#### Programmatic

```typescript
import download from 'github-directory-downloader';
import { resolve } from 'path';

// Will download content inside docs/manual into "../temp" 
// and return statistics for downloaded files
const stats = await download(
    'https://github.com/mrdoob/three.js/tree/dev/docs/manual',
    resolve(__dirname, '../temp')
);
```

You can also pass options as a third argument:
```typescript
{
    /** GitHub API token */
    token?: string;

    /** Max number of async requests at the same time. 10 by default.
     * download-directory.github.io has no limit, but it can lead to IP blocking
     */
    requests?: number;

    /** Disable console logs */
    muteLog?: boolean;
}
```