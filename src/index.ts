import fs from 'fs-extra';
import fetch from 'node-fetch';
import { dirname, isAbsolute, resolve } from 'path';
import { promisify } from 'util';

import { Config, Stats, TreeItem } from './types';

const streamPipeline = promisify(require('stream').pipeline);

// Matches '/<re/po>/tree/<ref>/<dir>'
const urlParserRegex = /^[/]([^/]+)[/]([^/]+)[/]tree[/]([^/]+)[/](.*)/;

async function fetchRepoInfo(repo: string, token?: string, muteLog?: boolean) {
    const response = await fetch(`https://api.github.com/repos/${repo}`,
        token ? {
            headers: {
                Authorization: `Bearer ${token}`
            }
        } : {}
    );

    switch (response.status) {
        case 401:
            if (!muteLog) console.log('⚠ The token provided is invalid or has been revoked.', { token: token });
            throw new Error('Invalid token');

        case 403:
            // See https://developer.github.com/v3/#rate-limiting
            if (response.headers.get('X-RateLimit-Remaining') === '0') {
                if (!muteLog) console.log('⚠ Your token rate limit has been exceeded.', { token: token });
                throw new Error('Rate limit exceeded');
            }

            break;

        case 404:
            if (!muteLog) console.log('⚠ Repository was not found.', { repo });
            throw new Error('Repository not found');

        default:
    }

    if (!response.ok) {
        if (!muteLog) console.log('⚠ Could not obtain repository data from the GitHub API.', { repo, response });
        throw new Error('Fetch error');
    }

    return response.json();
}

async function viaTreesApi({
    user,
    repository,
    ref = 'HEAD',
    directory,
    token,
    muteLog
}: {
    user: string;
    repository: string;
    ref: string;
    directory: string;
    token?: string;
    muteLog?: boolean;
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
    } = await fetchRepoInfo(`${user}/${repository}/git/trees/${ref}?recursive=1`, token, muteLog);

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

async function getRepoMeta(user: string, repository: string, ref: string, dir: string, config?: Config) {

    const repoIsPrivate: boolean = (await fetchRepoInfo(`${user}/${repository}`, config?.token, config?.muteLog)).private;

    const files: TreeItem[] = await viaTreesApi({
        user,
        repository,
        ref,
        directory: decodeURIComponent(dir),
        token: config?.token,
        muteLog: config?.muteLog,
    });

    return {
        files,
        repoIsPrivate
    }
}

const parseUrl = (source: string, muteLog?: boolean) => {
    try {
        const [, user, repository, ref, dir] = urlParserRegex.exec(new URL(source).pathname) ?? [];

        return [user, repository, ref, dir];

    } catch (e) { }
    return [];
}


export default async function download(source: string, saveTo: string, config?: Config): Promise<Stats> {

    const stats: Stats = { files: {}, downloaded: 0, success: false };

    const [user, repository, ref, dir] = parseUrl(source);

    if (!user || !repository) {
        if (!config?.muteLog) console.error('Invalid url. It must match: ', urlParserRegex);
        stats.error = 'Invalid url';
        return stats;
    }

    if (!saveTo) {
        saveTo = resolve(process.cwd(), dir);
    }
    if (!isAbsolute(saveTo)) saveTo = resolve(process.cwd(), saveTo);


    let meta;
    try {
        meta = await getRepoMeta(user, repository, ref, dir, config)
    } catch (e) {
        if (!config?.muteLog) console.error('Failed to fetch repo meta info: ', e);

        await new Promise(resolve => setTimeout(resolve, 3000));

        try {
            meta = await getRepoMeta(user, repository, ref, dir, config)
        } catch (e) {
            if (!config?.muteLog) console.error('Failed to fetch repo meta info after second attempt: ', e);

            stats.error = e;
            return stats;
        }
    }

    const { files, repoIsPrivate } = meta;

    if (files.length === 0) {
        if (!config?.muteLog) console.log('No files to download');
        stats.success = true;
        return stats;
    }

    if (!config?.muteLog) console.log(`Downloading ${files.length} files…`);


    const fetchFile = async (file: TreeItem) => {
        const response = await fetch(
            `https://raw.githubusercontent.com/${user}/${repository}/${ref}/${file.path}`,
            config?.token ? {
                headers: {
                    Authorization: `Bearer ${config?.token}`
                },
            } : undefined
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.statusText} for ${file.path}`);
        }

        return response;
    };

    let downloaded = 0;

    const download = async (file: TreeItem) => {
        let response;
        try {
            response = await fetchFile(file);
        } catch (e) {
            if (!config?.muteLog) console.log('⚠ Failed to download file: ' + file.path, e);

            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                response = await fetchFile(file);
            } catch (e) {
                if (!config?.muteLog) console.log('⚠ Failed to download file after second attempt: ' + file.path, e);
                return;
            }
        }

        try {
            downloaded++;

            const fileName = resolve(saveTo, file.path.replace(dir + '/', ''));

            await fs.ensureDir(dirname(fileName));
            await streamPipeline(response.body, fs.createWriteStream(fileName));

            stats.files[file.path] = fileName;

        } catch (e) {
            if (!config?.muteLog) console.error('Failed to write file: ' + file.path, e);
        }
    };

    const requests = config?.requests ?? 10;
    const statuses: Promise<void>[] = [];

    for (let i = 0; i < files.length; i++) {
        const num = i % requests;
        if (statuses[num]) {
            await statuses[num];
        }
        statuses[num] = download(files[i]);
    }

    await Promise.all(statuses);


    if (!config?.muteLog) console.log(`Downloaded ${downloaded}/${files.length} files`);

    stats.downloaded = downloaded;

    if (files.length === downloaded) stats.success = true;

    return stats;
}