import fs from 'fs-extra';
import fetch from 'node-fetch';
import { dirname, resolve } from 'path';
import { promisify } from 'util';

const streamPipeline = promisify(require('stream').pipeline);

type TreeItem = {
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number;
    url: string;
}

// Matches '/<re/po>/tree/<ref>/<dir>'
const urlParserRegex = /^[/]([^/]+)[/]([^/]+)[/]tree[/]([^/]+)[/](.*)/;

async function fetchRepoInfo(repo: string, token?: string) {
    const response = await fetch(`https://api.github.com/repos/${repo}`,
        token ? {
            headers: {
                Authorization: `Bearer ${token}`
            }
        } : {}
    );

    switch (response.status) {
        case 401:
            console.log('⚠ The token provided is invalid or has been revoked.', { token: token });
            throw new Error('Invalid token');

        case 403:
            // See https://developer.github.com/v3/#rate-limiting
            if (response.headers.get('X-RateLimit-Remaining') === '0') {
                console.log('⚠ Your token rate limit has been exceeded.', { token: token });
                throw new Error('Rate limit exceeded');
            }

            break;

        case 404:
            console.log('⚠ Repository was not found.', { repo });
            throw new Error('Repository not found');

        default:
    }

    if (!response.ok) {
        console.log('⚠ Could not obtain repository data from the GitHub API.', { repo, response });
        throw new Error('Fetch error');
    }

    return response.json();
}

async function api(endpoint: string, token?: string) {
    const response = await fetch(`https://api.github.com/repos/${endpoint}`, {
        headers: token ? {
            Authorization: `Bearer ${token}`
        } : undefined
    });
    return response.json();
}


// Great for downloads with many sub directories
// Pros: one request + maybe doesn't require token
// Cons: huge on huge repos + may be truncated
async function viaTreesApi({
    user,
    repository,
    ref = 'HEAD',
    directory,
    token,
}: {
    user: string;
    repository: string;
    ref: string;
    directory: string;
    token?: string;
}) {
    if (!directory.endsWith('/')) {
        directory += '/';
    }

    const files: TreeItem[] = [];

    const contents: {
        url: string;
        sha: string;
        tree: TreeItem[];
        message?: string;
        truncated: boolean;
    } = await api(`${user}/${repository}/git/trees/${ref}?recursive=1`, token);

    if (contents.message) {
        throw new Error(contents.message);
    }

    for (const item of contents.tree) {
        if (item.type === 'blob' && item.path.startsWith(directory)) {
            files.push(item);
        }
    }

    return files;
}


export default async function download(source: string, saveTo: string, token?: string) {

    const [, user, repository, ref, dir] = urlParserRegex.exec(new URL(source).pathname) ?? [];

    if (!user || !repository) {
        console.error('Invalid url');
        return;
    }

    const { private: repoIsPrivate } = await fetchRepoInfo(`${user}/${repository}`, token);

    const files = await viaTreesApi({
        user,
        repository,
        ref,
        directory: decodeURIComponent(dir),
        token,
    });

    if (files.length === 0) {
        console.log('No files to download');
        return;
    }

    console.log(`Downloading ${files.length} files…`);


    const fetchPublicFile = async (file: TreeItem) => {
        const response = await fetch(`https://raw.githubusercontent.com/${user}/${repository}/${ref}/${file.path}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.statusText} for ${file.path}`);
        }

        return response;
    };

    const fetchPrivateFile = async (file: TreeItem) => {
        const response = await fetch(file.url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.statusText} for ${file.path}`);
        }

        const { content } = await response.json();
        return await fetch(`data:application/octet-stream;base64,${content}`);
    };

    let downloaded = 0;
    const stats: { files: Record<string, string>; downloaded: number } = { files: {}, downloaded: 0 };

    const download = async (file: TreeItem) => {
        try {
            const response = repoIsPrivate ?
                await fetchPrivateFile(file) :
                await fetchPublicFile(file);

            downloaded++;

            const fileName = resolve(saveTo, file.path.replace(dir + '/', ''));
            await fs.ensureDir(dirname(fileName));
            await streamPipeline(response.body, fs.createWriteStream(fileName));
            stats.files[file.path] = fileName;

        } catch (e) {
            console.error('Failed to download file: ' + file.path, e);
        }
    };


    try {
        await Promise.all(files.map(download));
    } catch (e) {
        console.error(e)
        if (e.message.startsWith('HTTP ')) {
            console.log('⚠ Could not download all files.');
        } else {
            console.log('⚠ Some files were blocked from downloading, try to disable any ad blockers and refresh the page.');
        }
    }

    console.log(`Downloaded ${downloaded}/${files.length} files`);
    stats.downloaded = downloaded;
    return stats;
}