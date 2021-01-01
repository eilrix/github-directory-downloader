export type Config = {
    /** GitHub token for authorization in private repositories */
    token?: string;

    /** Max number of async requests at the same time. 10 by default.
     * download-directory.github.io has no limit, but it can lead to IP blocking
     */
    requests?: number;

    /** Disable console logs */
    muteLog?: boolean;
}

export type TreeItem = {
    path: string;
    mode: string;
    type: string;
    sha: string;
    size: number;
    url: string;
}

export type Stats = {
    files: Record<string, string>;
    downloaded: number;
    success: boolean;
    error?: any;
}